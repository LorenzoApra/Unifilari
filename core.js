(function exposeUnifilariCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnifilariCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createUnifilariCore() {
  'use strict';

  const SCHEMA_VERSION = 6;
  const NODE_TYPES = new Set(['supply', 'panel', 'load']);
  const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
  const PB63A_SPECIAL_SOCKETS = [
    ...['R1', 'R2', 'S5', 'S6', 'T9', 'T10', 'R3', 'R4', 'S7', 'S8', 'T11', 'T12'].map((name) => ({ name, type: 'cee16mono' })),
    ...['R13', 'S14', 'T15'].map((name) => ({ name, type: 'cee32mono' })),
  ];

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function asText(value, fallback = '', maxLength = 500) {
    if (value === undefined || value === null) return fallback;
    return String(value).slice(0, maxLength);
  }

  function asFiniteNumber(value, fallback, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, number));
  }

  function asPositiveInteger(value, fallback = 1, maximum = 10000) {
    const number = Math.trunc(Number(value));
    if (!Number.isFinite(number) || number < 1) return fallback;
    return Math.min(maximum, number);
  }

  function assertSafeId(value, label) {
    const id = asText(value);
    if (!SAFE_ID.test(id)) throw new Error(`${label} non è valido.`);
    return id;
  }

  function isPowerLock(id) {
    return ['powerlock', 'powerlock250', 'powerlock400'].includes(id);
  }

  function compatibleConnector(first, second) {
    if (!first || !second) return false;
    if (first === second) return true;
    if (first === 'powerlock' && isPowerLock(second)) return true;
    if (second === 'powerlock' && isPowerLock(first)) return true;
    return false;
  }

  function requiredPlug(node) {
    if (!node) return null;
    if (node.type === 'load') return node.plugType || null;
    if (node.type === 'panel') return node.inputType || null;
    return null;
  }

  function nodeById(project, id) {
    return (project.nodes || []).find((node) => node.id === id);
  }

  function supplyKey(node) {
    return node?.supplyKey || node?.id || '';
  }

  function panelKey(node) {
    return node?.panelKey || node?.id || '';
  }

  function isReferenceLink(link) {
    return Boolean(link?.referenceLink);
  }

  function samePhysicalSource(first, second) {
    if (!first || !second || first.type !== second.type) return false;
    if (first.type === 'panel') return panelKey(first) === panelKey(second);
    return first.id === second.id;
  }

  function samePhysicalTarget(first, second) {
    if (!first || !second || first.type !== second.type) return false;
    if (first.type === 'panel') return panelKey(first) === panelKey(second);
    return first.id === second.id;
  }

  function panelSockets(panel) {
    if (/^PB63A#(?:[1-9]|1[0-8])$/.test(panel?.panelModel || '')) {
      return PB63A_SPECIAL_SOCKETS.map((socket) => ({ ...socket }));
    }
    let index = 0;
    return (panel?.ports || []).flatMap((port) =>
      Array.from({ length: asPositiveInteger(port.quantity, 1, 500) }, () => ({
        name: `P${++index}`,
        type: port.type,
      })),
    );
  }

  function availablePanelSockets(project, panel, target, ignoredLinkId = null) {
    const required = requiredPlug(target);
    const used = new Set(
      (project.links || [])
        .filter((link) => {
          if (isReferenceLink(link) || link.id === ignoredLinkId) return false;
          return panelKey(nodeById(project, link.from)) === panelKey(panel);
        })
        .map((link) => nodeById(project, link.to)?.socket)
        .filter(Boolean),
    );
    return panelSockets(panel).filter(
      (socket) =>
        compatibleConnector(socket.type, required) &&
        (!used.has(socket.name) || (ignoredLinkId && socket.name === target?.socket)),
    );
  }

  function socketWarning(project, panel, target, socket, ignoredLinkId = null, cableName = (id) => id) {
    if (panel?.type !== 'panel' || !socket) return '';
    const required = requiredPlug(target);
    const matching = panelSockets(panel).filter((item) => compatibleConnector(item.type, required));
    if (!matching.some((item) => item.name === socket)) {
      return `La presa ${socket} non è compatibile con ${cableName(required)}.`;
    }
    if (!availablePanelSockets(project, panel, target, ignoredLinkId).some((item) => item.name === socket)) {
      return `La presa ${socket} del quadro ${panel.title} è già occupata.`;
    }
    return '';
  }

  function createsCycle(project, fromId, toId, ignoredLinkId = null) {
    const adjacency = new Map();
    (project.links || [])
      .filter((link) => !isReferenceLink(link) && link.id !== ignoredLinkId)
      .forEach((link) => {
        if (!adjacency.has(link.from)) adjacency.set(link.from, []);
        adjacency.get(link.from).push(link.to);
      });
    if (!adjacency.has(fromId)) adjacency.set(fromId, []);
    adjacency.get(fromId).push(toId);
    const stack = [toId];
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      (adjacency.get(current) || []).forEach((next) => stack.push(next));
    }
    return false;
  }

  function connectionFailure(message, code) {
    return { ok: false, message, code };
  }

  function validateConnection(project, candidate, options = {}) {
    const ignoredLinkId = options.ignoredLinkId || null;
    const cableName = options.cableName || ((id) => id);
    const from = nodeById(project, candidate.from);
    const to = nodeById(project, candidate.to);
    if (!from || !to) return connectionFailure('Il collegamento contiene un elemento inesistente.', 'missing-endpoint');
    if (candidate.from === candidate.to) return connectionFailure('Un elemento non può essere collegato a sé stesso.', 'self-link');
    if (isReferenceLink(candidate)) return { ok: true };
    if (from.type === 'load') return connectionFailure('Un’utenza non può alimentare altri elementi.', 'load-as-source');
    if (to.type === 'supply') return connectionFailure('Una fornitura può essere solo l’origine di un collegamento.', 'supply-as-target');
    if (from.type === 'supply' && to.type !== 'panel') {
      return connectionFailure('Una fornitura può alimentare soltanto un quadro.', 'invalid-supply-target');
    }
    if (from.type === 'panel' && !['panel', 'load'].includes(to.type)) {
      return connectionFailure('Un quadro può alimentare soltanto un quadro o un’utenza.', 'invalid-panel-target');
    }

    const required = requiredPlug(to);
    if (!required) return connectionFailure(`L’ingresso di ${to.title || 'destinazione'} non è configurato.`, 'missing-input');
    const cableType = candidate.cable || required;
    const isSocapex = cableType === 'socapex';
    if (isSocapex && !(from.type === 'panel' && to.type === 'load' && required === 'cee16mono')) {
      return connectionFailure('Il Socapex può collegare soltanto un quadro a utenze CEE 16 A monofase.', 'invalid-socapex');
    }
    if (!isSocapex && !compatibleConnector(cableType, required)) {
      return connectionFailure(
        `Il cavo ${cableName(cableType)} non è compatibile con l’ingresso ${cableName(required)} di ${to.title}.`,
        'invalid-cable',
      );
    }

    if (from.type === 'supply') {
      if (!compatibleConnector(from.supplyType, required) || !compatibleConnector(from.supplyType, cableType)) {
        return connectionFailure(
          `La fornitura ${cableName(from.supplyType)} non è compatibile con l’ingresso ${cableName(required)} del quadro.`,
          'incompatible-supply',
        );
      }
      const alreadyUsed = (project.links || []).some(
        (link) => !isReferenceLink(link) && link.id !== ignoredLinkId && link.from === from.id,
      );
      if (alreadyUsed) return connectionFailure(`La fornitura ${from.title} può alimentare un solo quadro.`, 'supply-already-used');
    }

    if (from.type === 'panel') {
      const capacity = (from.ports || [])
        .filter((port) => compatibleConnector(port.type, required))
        .reduce((sum, port) => sum + asPositiveInteger(port.quantity, 1, 500), 0);
      const used = (project.links || []).filter((link) => {
        if (isReferenceLink(link) || link.id === ignoredLinkId) return false;
        const source = nodeById(project, link.from);
        const target = nodeById(project, link.to);
        return samePhysicalSource(source, from) && compatibleConnector(requiredPlug(target), required);
      }).length;
      if (!capacity) {
        return connectionFailure(`${from.title} non ha uscite ${cableName(required)}.`, 'missing-panel-output');
      }
      if (used >= capacity) {
        return connectionFailure(
          `Le prese ${cableName(required)} del quadro ${from.title} sono terminate (${used}/${capacity}).`,
          'panel-capacity',
        );
      }
    }

    const alreadyIncoming = (project.links || []).some((link) => {
      if (isReferenceLink(link) || link.id === ignoredLinkId) return false;
      return samePhysicalTarget(nodeById(project, link.to), to);
    });
    if (alreadyIncoming) {
      return connectionFailure(
        `${to.type === 'panel' ? 'Il quadro' : 'L’utenza'} ${to.title} è già alimentat${to.type === 'panel' ? 'o' : 'a'}.`,
        'target-already-connected',
      );
    }

    if (createsCycle(project, candidate.from, candidate.to, ignoredLinkId)) {
      return connectionFailure('Il collegamento creerebbe un ciclo nella distribuzione.', 'cycle');
    }
    return { ok: true };
  }

  function validateProject(project, options = {}) {
    const issues = [];
    const ids = new Set();
    (project.nodes || []).forEach((node) => {
      if (ids.has(node.id)) issues.push({ code: 'duplicate-node', message: `Identificativo duplicato: ${node.id}.` });
      ids.add(node.id);
    });
    (project.links || []).forEach((link) => {
      if (!ids.has(link.from) || !ids.has(link.to)) {
        issues.push({ code: 'orphan-link', linkId: link.id, message: 'Un collegamento punta a un elemento inesistente.' });
        return;
      }
      const result = validateConnection(project, link, { ...options, ignoredLinkId: link.id });
      if (!result.ok) issues.push({ code: result.code, linkId: link.id, message: result.message });
      if (!isReferenceLink(link)) {
        const target = nodeById(project, link.to);
        const source = nodeById(project, link.from);
        if (source?.type === 'panel' && !target?.socket) {
          issues.push({ code: 'missing-socket', linkId: link.id, message: `${target?.title || 'La destinazione'} non ha una presa assegnata.` });
        } else {
          const warning = socketWarning(project, source, target, target?.socket, link.id, options.cableName);
          if (warning) issues.push({ code: 'invalid-socket', linkId: link.id, message: warning });
        }
      }
    });
    return issues;
  }

  function normalizePort(raw) {
    if (!isPlainObject(raw)) throw new Error('La configurazione di una presa non è valida.');
    return {
      type: assertSafeId(raw.type, 'Il tipo di presa'),
      quantity: asPositiveInteger(raw.quantity, 1, 500),
    };
  }

  function normalizeNode(raw) {
    if (!isPlainObject(raw)) throw new Error('Il progetto contiene un elemento non valido.');
    const type = asText(raw.type);
    if (!NODE_TYPES.has(type)) throw new Error(`Tipo di elemento non supportato: ${type || 'vuoto'}.`);
    const node = {
      id: assertSafeId(raw.id, 'L’identificativo di un elemento'),
      type,
      page: asPositiveInteger(raw.page, 1, 999),
      x: asFiniteNumber(raw.x, type === 'supply' ? 90 : type === 'panel' ? 280 : 835, 0, 1200),
      y: asFiniteNumber(raw.y, 135, 0, 780),
      title: asText(raw.title, type === 'load' ? 'Utenza' : type === 'panel' ? 'Quadro' : 'Fornitura', 200),
      subtitle: asText(raw.subtitle, '', 300),
      details: asText(raw.details, '', 500),
      note: asText(raw.note, '', 500),
      socket: asText(raw.socket, '', 40).toUpperCase(),
    };
    if (type === 'supply') {
      node.supplyKey = assertSafeId(raw.supplyKey || raw.id, 'L’identificativo della fornitura');
      node.supplyType = assertSafeId(raw.supplyType || 'cee125tri', 'Il tipo di fornitura');
    }
    if (type === 'panel') {
      node.panelKey = assertSafeId(raw.panelKey || raw.id, 'L’identificativo del quadro');
      node.panelModel = asText(raw.panelModel, 'Temporaneo', 100);
      node.panelMode = asText(raw.panelMode, '', 100);
      node.inputType = assertSafeId(raw.inputType || 'cee63tri', 'Il tipo di ingresso');
      node.ports = Array.isArray(raw.ports) ? raw.ports.map(normalizePort) : [];
    }
    if (type === 'load') {
      node.plugType = assertSafeId(raw.plugType || 'cee16mono', 'Il tipo di spina');
      node.watts = asFiniteNumber(raw.watts, 0, 0, 100000000);
      if (Array.isArray(raw.fixtures)) node.fixtures = raw.fixtures.slice(0, 10000).map((value) => asText(value, 'Fixture', 200));
    }
    return node;
  }

  function normalizeLink(raw) {
    if (!isPlainObject(raw)) throw new Error('Il progetto contiene un collegamento non valido.');
    const link = {
      id: assertSafeId(raw.id, 'L’identificativo di un collegamento'),
      from: assertSafeId(raw.from, 'L’origine di un collegamento'),
      to: assertSafeId(raw.to, 'La destinazione di un collegamento'),
      cable: assertSafeId(raw.cable || 'cee16mono', 'Il tipo di cavo'),
      length: asFiniteNumber(raw.length, 20, 0, 10000),
    };
    if (raw.referenceLink) link.referenceLink = true;
    if (raw.socapexGroup) link.socapexGroup = assertSafeId(raw.socapexGroup, 'Il gruppo Socapex');
    if (Number.isFinite(Number(raw.labelX))) link.labelX = asFiniteNumber(raw.labelX, 0, 0, 1200);
    if (Number.isFinite(Number(raw.labelY))) link.labelY = asFiniteNumber(raw.labelY, 0, 0, 780);
    return link;
  }

  function normalizeProject(raw) {
    if (!isPlainObject(raw)) throw new Error('Il file non contiene un progetto valido.');
    const meta = isPlainObject(raw.meta) ? raw.meta : {};
    const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(normalizeNode) : [];
    const links = Array.isArray(raw.links) ? raw.links.map(normalizeLink) : [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    if (nodeIds.size !== nodes.length) throw new Error('Il progetto contiene elementi con identificativi duplicati.');
    const linkIds = new Set(links.map((link) => link.id));
    if (linkIds.size !== links.length) throw new Error('Il progetto contiene collegamenti con identificativi duplicati.');
    links.forEach((link) => {
      if (!nodeIds.has(link.from) || !nodeIds.has(link.to)) {
        throw new Error('Il progetto contiene un collegamento verso un elemento inesistente.');
      }
    });
    const pageSet = new Set(
      [
        ...(Array.isArray(raw.pages) ? raw.pages : []),
        ...nodes.map((node) => node.page),
      ].map((page) => asPositiveInteger(page, 1, 999)),
    );
    if (!pageSet.size) pageSet.add(1);
    const sourcePages = [...pageSet].sort((first, second) => first - second);
    const pageMap = new Map(sourcePages.map((page, index) => [page, index + 1]));
    nodes.forEach((node) => { node.page = pageMap.get(node.page) || 1; });
    const pages = sourcePages.map((_, index) => index + 1);
    const requestedPage = asPositiveInteger(raw.currentPage, sourcePages[0], 999);
    return {
      version: SCHEMA_VERSION,
      meta: {
        name: asText(meta.name, '', 200),
        location: asText(meta.location, '', 300),
        type: asText(meta.type, 'Allestimento Luci', 200),
        revision: asText(meta.revision, '1.0', 50),
        company: asText(meta.company, 'ATS Srl', 200),
        companyAddress: asText(meta.companyAddress, '', 500),
        companyVat: asText(meta.companyVat, '', 100),
      },
      pages,
      currentPage: pageMap.get(requestedPage) || pages[0],
      nodes,
      links,
    };
  }

  function serializeProject(state) {
    return {
      version: SCHEMA_VERSION,
      meta: { ...state.meta },
      pages: [...new Set(state.pages || [1])].sort((first, second) => first - second),
      nodes: (state.nodes || []).map((node) => {
        const copy = { ...node };
        delete copy.selected;
        return copy;
      }),
      links: (state.links || []).map((link) => ({ ...link })),
    };
  }

  return {
    SCHEMA_VERSION,
    availablePanelSockets,
    compatibleConnector,
    isPowerLock,
    isReferenceLink,
    normalizeProject,
    panelKey,
    panelSockets,
    requiredPlug,
    serializeProject,
    socketWarning,
    supplyKey,
    validateConnection,
    validateProject,
  };
});
