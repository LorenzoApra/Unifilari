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
  const CEE_CONNECTORS = {
    cee16mono: { family: 'mono', amps: 16 },
    cee32mono: { family: 'mono', amps: 32 },
    cee16tri: { family: 'tri', amps: 16 },
    cee32tri: { family: 'tri', amps: 32 },
    cee63tri: { family: 'tri', amps: 63 },
    cee125tri: { family: 'tri', amps: 125 },
  };

  function createId(cryptoProvider = globalThis.crypto) {
    if (typeof cryptoProvider.randomUUID === 'function') return cryptoProvider.randomUUID();
    // getRandomValues è disponibile anche quando randomUUID richiede HTTPS.
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

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
    if (isPowerLock(first) && isPowerLock(second)) return true;
    return false;
  }

  function connectorCanFeedInput(sourceType, inputType) {
    if (compatibleConnector(sourceType, inputType)) return true;
    const supply = CEE_CONNECTORS[sourceType];
    const input = CEE_CONNECTORS[inputType];
    return Boolean(supply && input && supply.family === input.family && supply.amps <= input.amps);
  }

  function cableSectionMatchesConnector(connectorType, sectionType) {
    if (connectorType === 'socapex') return sectionType === 'socapex';
    if (isPowerLock(connectorType)) return isPowerLock(sectionType);
    return Boolean(CEE_CONNECTORS[connectorType] && CEE_CONNECTORS[sectionType] && CEE_CONNECTORS[connectorType].family === CEE_CONNECTORS[sectionType].family);
  }

  function requiredPlug(node) {
    if (!node) return null;
    if (node.type === 'load') return node.plugType || null;
    if (node.type === 'panel') return node.inputType || null;
    return null;
  }

  function createNodeIndex(project) {
    return new Map((project.nodes || []).map((node) => [node.id, node]));
  }

  function nodeById(project, id, nodeIndex = null) {
    return nodeIndex ? nodeIndex.get(id) : (project.nodes || []).find((node) => node.id === id);
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

  function phaseForSocket(socket) {
    const name = asText(socket).trim().toUpperCase();
    const explicitPhase = name.match(/^([RST])/);
    if (explicitPhase) return explicitPhase[1];
    const genericSocket = name.match(/^P(\d+)$/);
    if (!genericSocket) return null;
    return ['R', 'S', 'T'][(Number(genericSocket[1]) - 1) % 3];
  }

  function isThreePhaseConnector(id) {
    return ['cee16tri', 'cee32tri', 'cee63tri', 'cee125tri'].includes(id) || isPowerLock(id);
  }

  function rootSupplyKeyForNode(project, node, nodeIndex, incomingByPanelKey, visited = new Set()) {
    if (!node) return null;
    if (node.type === 'supply') return supplyKey(node);
    if (node.type !== 'panel') return null;
    const key = panelKey(node);
    if (!key || visited.has(key)) return null;
    visited.add(key);
    const incoming = incomingByPanelKey.get(key);
    return incoming ? rootSupplyKeyForNode(project, nodeById(project, incoming.from, nodeIndex), nodeIndex, incomingByPanelKey, visited) : null;
  }

  function calculatePhaseLoads(project, options = {}) {
    const phases = {
      R: { watts: 0, amps: 0 },
      S: { watts: 0, amps: 0 },
      T: { watts: 0, amps: 0 },
    };
    const nodeIndex = createNodeIndex(project);
    const incomingByTarget = new Map();
    const incomingByPanelKey = new Map();
    (project.links || []).forEach((link) => {
      if (isReferenceLink(link)) return;
      if (!incomingByTarget.has(link.to)) incomingByTarget.set(link.to, link);
      const target = nodeById(project, link.to, nodeIndex);
      if (target?.type === 'panel' && !incomingByPanelKey.has(panelKey(target))) incomingByPanelKey.set(panelKey(target), link);
    });
    const selectedSupplyKey = asText(options.supplyKey).trim();
    const selectedLoads = Array.isArray(options.loadIds) ? new Set(options.loadIds) : null;
    let connectedLoads = 0;
    let unassignedLoads = 0;
    let unassignedWatts = 0;

    (project.nodes || []).filter((node) => node.type === 'load').forEach((load) => {
      if (selectedLoads && !selectedLoads.has(load.id)) return;
      const watts = Math.max(0, Number(load.watts) || 0);
      const incoming = incomingByTarget.get(load.id);
      const source = incoming ? nodeById(project, incoming.from, nodeIndex) : null;
      if (!incoming || source?.type !== 'panel' || !load.socket) {
        if (watts > 0) {
          unassignedLoads += 1;
          unassignedWatts += watts;
        }
        return;
      }
      if (selectedSupplyKey && rootSupplyKeyForNode(project, source, nodeIndex, incomingByPanelKey) !== selectedSupplyKey) return;

      connectedLoads += 1;
      if (isThreePhaseConnector(requiredPlug(load))) {
        const wattsPerPhase = watts / 3;
        const ampsPerPhase = watts / (Math.sqrt(3) * 400);
        Object.values(phases).forEach((phase) => {
          phase.watts += wattsPerPhase;
          phase.amps += ampsPerPhase;
        });
        return;
      }

      const phaseName = phaseForSocket(load.socket);
      if (!phaseName) {
        unassignedLoads += 1;
        unassignedWatts += watts;
        return;
      }
      phases[phaseName].watts += watts;
      phases[phaseName].amps += watts / 230;
    });

    return { phases, connectedLoads, unassignedLoads, unassignedWatts };
  }

  // Raggruppa le istanze su più pagine per alimentazione fisica. Un quadro
  // residente senza fornitura esplicita rimane una radice autonoma dell'indice.
  function distributionEntries(project) {
    const nodes = project.nodes || [], nodeIndex = createNodeIndex(project);
    const keyFor = (node) => node?.type === 'supply' ? `supply:${supplyKey(node)}` : node?.type === 'panel' ? `panel:${panelKey(node)}` : '';
    const canonical = new Map(), parents = new Map(), incoming = new Map();
    nodes.forEach((node) => { const key = keyFor(node); if (key && !canonical.has(key)) canonical.set(key, node); });
    (project.links || []).filter((link) => !isReferenceLink(link)).forEach((link) => {
      const from = nodeIndex.get(link.from), to = nodeIndex.get(link.to);
      if (!incoming.has(link.to)) incoming.set(link.to, from);
      if (to?.type === 'panel' && keyFor(from)) parents.set(keyFor(to), keyFor(from));
    });
    const rootFor = (node) => {
      let key = keyFor(node);
      const visited = new Set();
      while (parents.has(key) && !visited.has(key)) { visited.add(key); key = parents.get(key); }
      return key;
    };
    const groups = new Map();
    const add = (rootKey, node, loadId = null) => {
      if (!canonical.has(rootKey)) return;
      if (!groups.has(rootKey)) groups.set(rootKey, { rootKey, node: canonical.get(rootKey), pages: new Set(), loadIds: [] });
      const entry = groups.get(rootKey);
      entry.pages.add(node.page);
      if (loadId) entry.loadIds.push(loadId);
    };
    nodes.forEach((node) => {
      if (keyFor(node)) add(rootFor(node), node);
      else if (node.type === 'load' && incoming.get(node.id)?.type === 'panel') add(rootFor(incoming.get(node.id)), node, node.id);
    });
    return [...groups.values()].map((entry) => ({ ...entry, pages: [...entry.pages].sort((a, b) => a - b) }))
      .sort((a, b) => a.pages[0] - b.pages[0] || (a.node.title || '').localeCompare(b.node.title || '', 'it', { numeric: true }));
  }

  function unconnectedLoadIds(project) {
    const connectedTargets = new Set((project.links || []).filter((link) => !isReferenceLink(link)).map((link) => link.to));
    return (project.nodes || []).filter((node) => node.type === 'load' && !connectedTargets.has(node.id)).map((node) => node.id);
  }

  function samePhysicalNode(first, second) {
    if (!first || !second || first.type !== second.type) return false;
    if (first.type === 'panel') return panelKey(first) === panelKey(second);
    if (first.type === 'supply') return supplyKey(first) === supplyKey(second);
    return first.id === second.id;
  }

  function panelSockets(panel) {
    if (/^PB63A#(?:0?[1-9]|1[0-8])$/.test(panel?.panelModel || '')) {
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

  function availablePanelSockets(project, panel, target, ignoredLinkId = null, nodeIndex = null) {
    const required = requiredPlug(target);
    const used = new Set(
      (project.links || [])
        .filter((link) => {
          if (isReferenceLink(link) || link.id === ignoredLinkId) return false;
          return panelKey(nodeById(project, link.from, nodeIndex)) === panelKey(panel);
        })
        .map((link) => nodeById(project, link.to, nodeIndex)?.socket)
        .filter(Boolean),
    );
    const compatible = panelSockets(panel).filter((socket) =>
      (target?.type === 'panel' ? connectorCanFeedInput(socket.type, required) : compatibleConnector(socket.type, required)) &&
      !used.has(socket.name));
    return compatible.sort((first, second) => {
      const exact = Number(second.type === required) - Number(first.type === required);
      if (exact) return exact;
      return (CEE_CONNECTORS[second.type]?.amps || 0) - (CEE_CONNECTORS[first.type]?.amps || 0);
    });
  }

  function availableSocapexSockets(project, panel, ignoredGroupId = null) {
    const nodes = createNodeIndex(project);
    const physicalLinks = (project.links || []).filter((link) => !isReferenceLink(link) && panelKey(nodes.get(link.from)) === panelKey(panel) && (!ignoredGroupId || link.socapexGroup !== ignoredGroupId));
    const available = availablePanelSockets({ ...project, links: physicalLinks }, panel, { type: 'load', plugType: 'cee16mono' });
    if (!/^PB63A#(?:0?[1-9]|1[0-8])$/.test(panel?.panelModel || '')) return available;
    // Un Socapex parziale conserva il suo banco: T10 non passa al gruppo successivo.
    const banks = [PB63A_SPECIAL_SOCKETS.slice(0, 6), PB63A_SPECIAL_SOCKETS.slice(6, 12)];
    const assigned = new Set(physicalLinks.filter((link) => link.socapexGroup).map((link) => nodes.get(link.to)?.socket));
    const free = new Set(available.map((socket) => socket.name));
    const bank = banks.find((sockets) => !sockets.some((socket) => assigned.has(socket.name)) && sockets.some((socket) => free.has(socket.name)));
    return bank ? bank.filter((socket) => free.has(socket.name)).map((socket) => ({ ...socket })) : [];
  }

  function socketWarning(project, panel, target, socket, ignoredLinkId = null, cableName = (id) => id, nodeIndex = null) {
    if (panel?.type !== 'panel' || !socket) return '';
    const required = requiredPlug(target);
    const matching = panelSockets(panel).filter((item) => target?.type === 'panel' ? connectorCanFeedInput(item.type, required) : compatibleConnector(item.type, required));
    if (!matching.some((item) => item.name === socket)) {
      return `La presa ${socket} non è compatibile con ${cableName(required)}.`;
    }
    if (!availablePanelSockets(project, panel, target, ignoredLinkId, nodeIndex).some((item) => item.name === socket)) {
      return `La presa ${socket} del quadro ${panel.title} è già occupata.`;
    }
    return '';
  }

  function createsCycle(project, fromId, toId, ignoredLinkId = null) {
    const nodes = createNodeIndex(project);
    const physicalKey = (id) => {
      const node = nodes.get(id);
      return node?.type === 'panel' ? `panel:${panelKey(node)}` : node?.type === 'supply' ? `supply:${supplyKey(node)}` : `load:${id}`;
    };
    const fromKey = physicalKey(fromId), toKey = physicalKey(toId);
    const adjacency = new Map();
    (project.links || [])
      .filter((link) => !isReferenceLink(link) && link.id !== ignoredLinkId)
      .forEach((link) => {
        const source = physicalKey(link.from), target = physicalKey(link.to);
        if (!adjacency.has(source)) adjacency.set(source, []);
        adjacency.get(source).push(target);
      });
    const stack = [toKey];
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === fromKey) return true;
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
    const nodeIndex = options.nodeIndex || createNodeIndex(project);
    const from = nodeById(project, candidate.from, nodeIndex);
    const to = nodeById(project, candidate.to, nodeIndex);
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
    const cableSection = candidate.cableSection || cableType;
    if (!cableSectionMatchesConnector(cableType, cableSection)) {
      return connectionFailure('La sezione scelta non è compatibile con il numero di conduttori della linea.', 'invalid-cable-section');
    }

    if (from.type === 'supply') {
      if (!connectorCanFeedInput(from.supplyType, required)) {
        return connectionFailure(
          `La fornitura ${cableName(from.supplyType)} non è compatibile con l’ingresso ${cableName(required)} del quadro.`,
          'incompatible-supply',
        );
      }
      const alreadyUsed = (project.links || []).some(
        (link) => !isReferenceLink(link) && link.id !== ignoredLinkId && samePhysicalNode(nodeById(project, link.from, nodeIndex), from),
      );
      if (alreadyUsed) return connectionFailure(`La fornitura ${from.title} può alimentare un solo quadro.`, 'supply-already-used');
    }

    if (from.type === 'panel') {
      const eligibleSockets = panelSockets(from).filter((socket) => to.type === 'panel' ? connectorCanFeedInput(socket.type, required) : compatibleConnector(socket.type, required));
      const capacity = eligibleSockets.length;
      const available = availablePanelSockets(project, from, to, ignoredLinkId, nodeIndex).length;
      const used = capacity - available;
      if (!capacity) {
        return connectionFailure(`${from.title} non ha uscite ${cableName(required)}.`, 'missing-panel-output');
      }
      if (!available) {
        return connectionFailure(
          `Le prese ${cableName(required)} del quadro ${from.title} sono terminate (${used}/${capacity}).`,
          'panel-capacity',
        );
      }
    }

    const alreadyIncoming = (project.links || []).some((link) => {
      if (isReferenceLink(link) || link.id === ignoredLinkId) return false;
      return samePhysicalNode(nodeById(project, link.to, nodeIndex), to);
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
    const nodeIndex = createNodeIndex(project);
    (project.nodes || []).forEach((node) => {
      if (ids.has(node.id)) issues.push({ code: 'duplicate-node', nodeId: node.id, message: `Identificativo duplicato: ${node.id}.` });
      ids.add(node.id);
    });
    (project.links || []).forEach((link) => {
      if (!ids.has(link.from) || !ids.has(link.to)) {
        issues.push({ code: 'orphan-link', linkId: link.id, message: 'Un collegamento punta a un elemento inesistente.' });
        return;
      }
      const result = validateConnection(project, link, { ...options, ignoredLinkId: link.id, nodeIndex });
      if (!result.ok) issues.push({ code: result.code, linkId: link.id, message: result.message });
      if (!isReferenceLink(link)) {
        const target = nodeById(project, link.to, nodeIndex);
        const source = nodeById(project, link.from, nodeIndex);
        if (source?.type === 'panel' && !target?.socket) {
          issues.push({ code: 'missing-socket', linkId: link.id, message: `${target?.title || 'La destinazione'} non ha una presa assegnata.` });
        } else {
          const warning = socketWarning(project, source, target, target?.socket, link.id, options.cableName, nodeIndex);
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
      cableSection: assertSafeId(raw.cableSection || raw.cable || 'cee16mono', 'La sezione del cavo'),
      length: asFiniteNumber(raw.length, 20, 0, 10000),
    };
    if (raw.referenceLink) link.referenceLink = true;
    if (raw.hideCableSection === true) link.hideCableSection = true;
    if (raw.hideLength === true) link.hideLength = true;
    if (raw.socapexGroup) link.socapexGroup = assertSafeId(raw.socapexGroup, 'Il gruppo Socapex');
    if (Number.isFinite(Number(raw.labelX))) link.labelX = asFiniteNumber(raw.labelX, 0, 0, 1200);
    if (Number.isFinite(Number(raw.labelY))) link.labelY = asFiniteNumber(raw.labelY, 0, 0, 780);
    if (Array.isArray(raw.routePoints) && raw.routePoints.length >= 2) {
      link.routePoints = raw.routePoints.slice(0, 64).map((point) => {
        if (!isPlainObject(point)) throw new Error('Il progetto contiene un punto di percorso non valido.');
        return {
          x: asFiniteNumber(point.x, 600, 0, 1200),
          y: asFiniteNumber(point.y, 390, 0, 780),
        };
      });
    }
    return link;
  }

  function migrateProject(raw) {
    if (raw.version !== undefined && (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > SCHEMA_VERSION)) {
      throw new Error('Versione progetto non supportata.');
    }
    if (raw.version === SCHEMA_VERSION) return raw;
    const nodes = raw.nodes.map((node) => ({ ...node }));
    let links = raw.links.map((link) => ({ ...link }));
    nodes.filter((node) => node.type === 'socapex').forEach((socapex) => {
      const incoming = links.find((link) => link.to === socapex.id);
      const outgoing = links.filter((link) => link.from === socapex.id);
      if (incoming && outgoing.length) {
        const socapexGroup = createId();
        outgoing.forEach((link, index) => links.push({
          id: createId(), from: incoming.from, to: link.to, cable: 'socapex',
          length: incoming.length ?? 20, socapexGroup,
          ...(index === 0 ? { labelX: incoming.labelX, labelY: incoming.labelY } : {}),
        }));
      }
      links = links.filter((link) => link.from !== socapex.id && link.to !== socapex.id);
    });
    const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
    nodes.filter((node) => node.type === 'supply' && node.supplyType === 'powerlock').forEach((node) => {
      node.supplyType = 'powerlock250';
      node.subtitle = 'PowerLock 250 A trifase';
    });
    links.forEach((link) => {
      if (link.cable === 'powerlock') link.cable = nodeIndex.get(link.from)?.supplyType === 'powerlock400' ? 'powerlock400' : 'powerlock250';
      const target = nodeIndex.get(link.to);
      if (target?.type === 'panel' && target.inputType?.startsWith('cee')) {
        const previousCable = link.cable;
        link.cable = target.inputType;
        if (!link.cableSection || link.cableSection === previousCable) link.cableSection = target.inputType;
      }
    });
    return { ...raw, version: SCHEMA_VERSION, nodes: nodes.filter((node) => node.type !== 'socapex'), links };
  }

  function normalizeProject(raw) {
    if (!isPlainObject(raw)) throw new Error('Il file non contiene un progetto valido.');
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) throw new Error('Il progetto deve contenere gli elenchi di elementi e collegamenti.');
    if (raw.nodes.some((node) => !isPlainObject(node)) || raw.links.some((link) => !isPlainObject(link))) throw new Error('Il progetto contiene un elemento o collegamento non valido.');
    raw = migrateProject(raw);
    const meta = isPlainObject(raw.meta) ? raw.meta : {};
    const nodes = raw.nodes.map(normalizeNode);
    const links = raw.links.map(normalizeLink);
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
        locationStreet: asText(meta.locationStreet, '', 200),
        locationPostcode: asText(meta.locationPostcode, '', 20),
        locationCity: asText(meta.locationCity, '', 120),
        locationProvince: asText(meta.locationProvince, '', 120),
        type: asText(meta.type, 'Allestimento Luci', 200),
        revision: asText(meta.revision, '1.0', 50),
        company: asText(meta.company, '', 200),
        companyAddress: asText(meta.companyAddress, '', 500),
        companyVat: asText(meta.companyVat, '', 100),
      },
      pages,
      pageNames: Object.fromEntries(sourcePages.filter((page) => isPlainObject(raw.pageNames) && asText(raw.pageNames[page], '', 80).trim()).map((page) => [pageMap.get(page), asText(raw.pageNames[page], '', 80).trim()])),
      currentPage: pageMap.get(requestedPage) || pages[0],
      nodes,
      links,
    };
  }

  function reorderPages(project, sourcePage, targetPosition) {
    const pages = [...new Set([...(project.pages || []), ...(project.nodes || []).map((node) => node.page)])].sort((a, b) => a - b);
    const from = pages.indexOf(sourcePage);
    if (from < 0 || !Number.isInteger(targetPosition) || targetPosition < 1 || targetPosition > pages.length) {
      return { ok: false, changed: false };
    }
    if (from === targetPosition - 1) return { ok: true, changed: false, project };
    const order = [...pages];
    order.splice(from, 1);
    order.splice(targetPosition - 1, 0, sourcePage);
    const pageMap = new Map(order.map((page, index) => [page, index + 1]));
    return {
      ok: true,
      changed: true,
      project: {
        ...project,
        pages: order.map((_, index) => index + 1),
        currentPage: pageMap.get(project.currentPage) || 1,
        pageNames: Object.fromEntries(Object.entries(project.pageNames || {}).filter(([page]) => pageMap.has(Number(page))).map(([page, name]) => [pageMap.get(Number(page)), name])),
        nodes: (project.nodes || []).map((node) => ({ ...node, page: pageMap.get(node.page) })),
      },
    };
  }

  function serializeProject(state) {
    return {
      version: SCHEMA_VERSION,
      meta: { ...state.meta },
      pages: [...new Set(state.pages || [1])].sort((first, second) => first - second),
      ...(state.pageNames && Object.keys(state.pageNames).length ? { pageNames: { ...state.pageNames } } : {}),
      nodes: (state.nodes || []).map((node) => {
        const copy = { ...node };
        delete copy.selected;
        return copy;
      }),
      links: (state.links || []).map((link) => ({ ...link })),
    };
  }

  function spreadWithoutOverlap(items, axis, sizeKey, minimum, maximum, gap) {
    const ordered = items
      .map((item, index) => ({ ...item, originalIndex: index }))
      .sort((first, second) => first[axis] - second[axis] || first.originalIndex - second.originalIndex);
    const distance = (first, second) => first[sizeKey] / 2 + gap + second[sizeKey] / 2;
    const positions = ordered.map((item) => item[axis]);

    positions[0] = Math.max(positions[0], minimum + ordered[0][sizeKey] / 2);
    for (let index = 1; index < ordered.length; index++) {
      positions[index] = Math.max(positions[index], positions[index - 1] + distance(ordered[index - 1], ordered[index]));
    }

    const last = ordered.length - 1;
    if (positions[last] + ordered[last][sizeKey] / 2 > maximum) {
      positions[last] = maximum - ordered[last][sizeKey] / 2;
      for (let index = last - 1; index >= 0; index--) {
        positions[index] = Math.min(positions[index], positions[index + 1] - distance(ordered[index], ordered[index + 1]));
      }
    }

    if (positions[0] - ordered[0][sizeKey] / 2 < minimum) {
      positions[0] = minimum + ordered[0][sizeKey] / 2;
      for (let index = 1; index < ordered.length; index++) {
        positions[index] = Math.max(positions[index], positions[index - 1] + distance(ordered[index - 1], ordered[index]));
      }
    }

    if (positions[last] + ordered[last][sizeKey] / 2 > maximum) return null;
    return new Map(ordered.map((item, index) => [item.id, positions[index]]));
  }

  function alignNodesWithoutOverlap(rawItems, mode, options = {}) {
    const validModes = new Set(['left', 'right', 'center-x', 'top', 'bottom', 'center-y']);
    if (!Array.isArray(rawItems) || rawItems.length < 2 || !validModes.has(mode)) {
      return { ok: false, reason: 'invalid-selection', positions: [] };
    }
    const items = rawItems.map((item) => ({
      id: item.id,
      x: Number(item.x),
      y: Number(item.y),
      width: Math.max(1, Number(item.width) || 1),
      height: Math.max(1, Number(item.height) || 1),
    }));
    if (items.some((item) => !item.id || !Number.isFinite(item.x) || !Number.isFinite(item.y))) {
      return { ok: false, reason: 'invalid-selection', positions: [] };
    }

    const bounds = {
      minX: Number.isFinite(options.minX) ? options.minX : 10,
      maxX: Number.isFinite(options.maxX) ? options.maxX : 1190,
      minY: Number.isFinite(options.minY) ? options.minY : 15,
      maxY: Number.isFinite(options.maxY) ? options.maxY : 735,
    };
    const gap = Math.max(0, Number(options.gap) || 0);
    const vertical = ['left', 'right', 'center-x'].includes(mode);
    const crossPositions = spreadWithoutOverlap(
      items,
      vertical ? 'y' : 'x',
      vertical ? 'height' : 'width',
      vertical ? bounds.minY : bounds.minX,
      vertical ? bounds.maxY : bounds.maxX,
      gap,
    );
    if (!crossPositions) return { ok: false, reason: 'insufficient-space', positions: [] };

    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const left = Math.max(bounds.minX, Math.min(...items.map((item) => item.x - item.width / 2)));
    const right = Math.min(bounds.maxX, Math.max(...items.map((item) => item.x + item.width / 2)));
    const top = Math.max(bounds.minY, Math.min(...items.map((item) => item.y - item.height / 2)));
    const bottom = Math.min(bounds.maxY, Math.max(...items.map((item) => item.y + item.height / 2)));
    const centerX = Math.max(
      bounds.minX + Math.max(...items.map((item) => item.width)) / 2,
      Math.min(bounds.maxX - Math.max(...items.map((item) => item.width)) / 2, average(items.map((item) => item.x))),
    );
    const centerY = Math.max(
      bounds.minY + Math.max(...items.map((item) => item.height)) / 2,
      Math.min(bounds.maxY - Math.max(...items.map((item) => item.height)) / 2, average(items.map((item) => item.y))),
    );

    return {
      ok: true,
      positions: items.map((item) => ({
        id: item.id,
        x: mode === 'left' ? left + item.width / 2 : mode === 'right' ? right - item.width / 2 : mode === 'center-x' ? centerX : crossPositions.get(item.id),
        y: mode === 'top' ? top + item.height / 2 : mode === 'bottom' ? bottom - item.height / 2 : mode === 'center-y' ? centerY : crossPositions.get(item.id),
      })),
    };
  }

  function distributeNodes(rawItems, axis, options = {}) {
    if (!Array.isArray(rawItems) || rawItems.length < 3 || !['x', 'y'].includes(axis)) return { ok: false, reason: 'invalid-selection', positions: [] };
    const sizeKey = axis === 'x' ? 'width' : 'height';
    const items = rawItems.map((item) => ({ ...item, [axis]: Number(item[axis]), [sizeKey]: Math.max(1, Number(item[sizeKey]) || 1) })).sort((a, b) => a[axis] - b[axis]);
    if (items.some((item) => !item.id || !Number.isFinite(item[axis]))) return { ok: false, reason: 'invalid-selection', positions: [] };
    const minimum = axis === 'x' ? 10 : 15, maximum = axis === 'x' ? 1190 : 735;
    const totalSize = items.reduce((sum, item) => sum + item[sizeKey], 0), minimumGap = options.gap ?? 18;
    const first = items[0], last = items.at(-1), low = first[axis] - first[sizeKey] / 2, high = last[axis] + last[sizeKey] / 2;
    const span = Math.max(high - low, totalSize + minimumGap * (items.length - 1));
    if (span > maximum - minimum) return { ok: false, reason: 'insufficient-space', positions: [] };
    let cursor = Math.max(minimum, Math.min(maximum - span, (low + high - span) / 2));
    const gap = (span - totalSize) / (items.length - 1);
    return { ok: true, positions: items.map((item) => {
      const position = { id: item.id, x: item.x, y: item.y, [axis]: cursor + item[sizeKey] / 2 };
      cursor += item[sizeKey] + gap;
      return position;
    }) };
  }

  return {
    SCHEMA_VERSION,
    alignNodesWithoutOverlap,
    availablePanelSockets,
    availableSocapexSockets,
    calculatePhaseLoads,
    compatibleConnector,
    connectorCanFeedInput,
    createId,
    distributeNodes,
    distributionEntries,
    isPowerLock,
    isReferenceLink,
    normalizeProject,
    panelKey,
    panelSockets,
    requiredPlug,
    reorderPages,
    samePhysicalNode,
    serializeProject,
    socketWarning,
    supplyKey,
    unconnectedLoadIds,
    validateConnection,
    validateProject,
  };
});
