const CABLES = [
  { id: 'cee16mono', name: 'CEE 16 A monofase', plug: 'CEE P+N+T 230 V 16 A', cable: 'H07RN-F 3G2,5 mm²' },
  { id: 'cee16tri', name: 'CEE 16 A trifase', plug: 'CEE 3P+N+T 400 V 16 A', cable: 'H07RN-F 5G2,5 mm²' },
  { id: 'cee32mono', name: 'CEE 32 A monofase', plug: 'CEE P+N+T 230 V 32 A', cable: 'H07RN-F 3G6 mm²' },
  { id: 'cee32tri', name: 'CEE 32 A trifase', plug: 'CEE 3P+N+T 400 V 32 A', cable: 'H07RN-F 5G6 mm²' },
  { id: 'cee63tri', name: 'CEE 63 A trifase', plug: 'CEE 3P+N+T 400 V 63 A', cable: 'H07RN-F 5G16 mm²' },
  { id: 'cee125tri', name: 'CEE 125 A trifase', plug: 'CEE 3P+N+T 400 V 125 A', cable: 'H07RN-F 5G35 mm²' },
  { id: 'powerlock', name: 'PowerLock', plug: 'PowerLock trifase', cable: 'Cavo sezione 95 mm²', internal: true },
  { id: 'powerlock250', name: '250A PowerLock', plug: 'PowerLock 250 A trifase', cable: 'Cavo sezione 95 mm²', supplyOnly: true },
  { id: 'powerlock400', name: '400A PowerLock', plug: 'PowerLock 400 A trifase', cable: 'Cavo sezione 120 mm²', supplyOnly: true },
  { id: 'socapex', name: 'Socapex', plug: 'Socapex', cable: 'Titanex 19G2,5 mm²' },
];
// Libreria standard derivata da Quadri.xlsx: viene gestita nel codice dell'app, non nell'interfaccia utente.
const portList = (...items) => items.map(([type, quantity]) => ({ type, quantity }));
const panelModels = (prefix, numbers, inputType, ports, alternatives = []) => numbers.map((number) => ({ matricola: `${prefix}#${number}`, inputType, ports, alternatives }));
const PANEL_LIBRARY = [
  ...panelModels('PB250A', [1], 'powerlock', portList(['cee16mono', 1], ['cee32tri', 1], ['cee63tri', 6])),
  ...panelModels('PB125A', [1], 'cee125tri', portList(['cee16mono', 3], ['cee32tri', 2], ['cee63tri', 3])),
  ...panelModels('PB125A', [2], 'cee125tri', portList(['cee16mono', 3], ['cee32tri', 3], ['cee63tri', 2])),
  ...panelModels('PB125A', [3], 'cee125tri', portList(['cee16mono', 4], ['cee16tri', 1], ['cee32tri', 4], ['cee63tri', 2])),
  ...panelModels('PB63A', Array.from({ length: 18 }, (_, index) => index + 1), 'cee63tri', portList(['cee16mono', 12], ['cee32mono', 3])),
  ...panelModels('PB63A', [19, 20, 21, 22, 28], 'cee63tri', portList(['cee16mono', 9], ['cee32mono', 3], ['cee32tri', 2], ['cee63tri', 1])),
  ...panelModels('PB63A', [23], 'cee63tri', portList(['cee16mono', 6], ['cee32mono', 3], ['cee32tri', 3], ['cee63tri', 1])),
  ...panelModels('PB63A', [25], 'cee63tri', portList(['cee16mono', 6], ['cee32tri', 2])),
  ...panelModels('PB63A', [26], 'cee63tri', portList(['cee16mono', 24])),
  ...panelModels('PB63A', [27], 'cee63tri', portList(['cee16mono', 6], ['cee32mono', 3], ['cee32tri', 1])),
  ...panelModels('PB63A', [29], 'cee63tri', portList(['cee16mono', 3], ['cee32mono', 3], ['cee32tri', 3])),
  ...panelModels('PB32AT', [1, 2], 'cee32tri', portList(['cee16mono', 6], ['cee32mono', 3], ['cee32tri', 1])),
  ...panelModels('PB32AT', [3], 'cee32tri', portList(['cee32mono', 3])),
  ...panelModels('PB32AT', [4], 'cee32tri', portList(['cee16mono', 6], ['cee32mono', 1], ['cee32tri', 1])),
  ...panelModels('PB32AT', [5, 6, 7, 8, 9, 11, 12, 13], 'cee32tri', portList(['cee16mono', 6])),
  ...panelModels('PB32AM', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'cee32mono', portList(['cee16mono', 6])),
];
const Core = window.UnifilariCore;
if (!Core) throw new Error('Il modulo di dominio Unifilari non è disponibile.');
const $ = (selector) => document.querySelector(selector);
const uid = () => crypto.randomUUID();
const NODE_HALF = 100;
const AUTOSAVE_KEY = 'unifilari.autosave.v6';
const HISTORY_LIMIT = 80;
const MAX_LOADS_PER_PAGE = 18;
let state = { version: Core.SCHEMA_VERSION, meta: { name: '', location: '', type: 'Allestimento Luci', revision: '1.0', company: 'ATS Srl', companyAddress: 'Via Vittorio Emanuele III\n12036 Revello CN', companyVat: '' }, pages: [1], currentPage: 1, selected: null, selectedIds: [], selectedLink: null, library: PANEL_LIBRARY, nodes: [], links: [] };
let temporaryPorts = [{ type: 'cee16mono', quantity: 1 }];
let editingTemporaryPanelId = null;
let pendingLinkReferences = [];
let alignmentGuides = [];
let pendingCaptureGroups = [];
let printPageNumbers = null;
let historyPast = [];
let historyFuture = [];
let lastHistoryKey = '';
let lastHistoryAt = 0;
let dirty = false;
let savedProjectSnapshot = null;
let autosaveTimer = null;

function serializableProject() {
  return Core.serializeProject(state);
}
function historySnapshot() {
  return JSON.stringify({ project: serializableProject(), currentPage: state.currentPage });
}
function checkpoint(key = 'command') {
  const now = Date.now();
  if (key === lastHistoryKey && now - lastHistoryAt < 450) return;
  const snapshot = historySnapshot();
  if (historyPast.at(-1) !== snapshot) historyPast.push(snapshot);
  if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
  historyFuture = [];
  lastHistoryKey = key;
  lastHistoryAt = now;
}
function dropNoopHistory() {
  if (historyPast.at(-1) === historySnapshot()) historyPast.pop();
  updateDirtyUi();
}
function restoreHistorySnapshot(snapshot) {
  const saved = JSON.parse(snapshot);
  const normalized = Core.normalizeProject({ ...saved.project, currentPage: saved.currentPage });
  state = { ...normalized, library: PANEL_LIBRARY, selected: null, selectedIds: [], selectedLink: null };
  syncMetaInputs();
  render();
}
function undo() {
  const snapshot = historyPast.pop();
  if (!snapshot) return;
  historyFuture.push(historySnapshot());
  restoreHistorySnapshot(snapshot);
  markChanged('Modifica annullata.');
}
function redo() {
  const snapshot = historyFuture.pop();
  if (!snapshot) return;
  historyPast.push(historySnapshot());
  restoreHistorySnapshot(snapshot);
  markChanged('Modifica ripristinata.');
}
function updateDirtyUi() {
  const saveState = $('#save-state');
  if (saveState) saveState.textContent = dirty ? 'Modifiche non salvate' : 'Salvato';
  if ($('#undo-action')) $('#undo-action').disabled = historyPast.length === 0;
  if ($('#redo-action')) $('#redo-action').disabled = historyFuture.length === 0;
}
function flushAutosave() {
  clearTimeout(autosaveTimer);
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), project: serializableProject() }));
  } catch {
    showStatus('Salvataggio automatico non disponibile in questo browser.');
  }
}
function markChanged(message = '') {
  dirty = JSON.stringify(serializableProject()) !== savedProjectSnapshot;
  updateDirtyUi();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(flushAutosave, 350);
  if (message) showStatus(message);
}
function markSaved() {
  savedProjectSnapshot = JSON.stringify(serializableProject());
  dirty = false;
  updateDirtyUi();
  flushAutosave();
}
function resetHistory() {
  historyPast = [];
  historyFuture = [];
  lastHistoryKey = '';
  updateDirtyUi();
}
function syncMetaInputs() {
  const ids = { name: 'event-name', location: 'event-location', type: 'event-type', revision: 'event-version' };
  Object.entries(ids).forEach(([key, id]) => { const input = $(`#${id}`); if (input) input.value = state.meta[key] || ''; });
}
function projectIssues() {
  return Core.validateProject(state, { cableName: (id) => cableById(id).name });
}

function demoProject() {
  const supply = { id: uid(), type: 'supply', page: 1, x: 75, y: 135, title: 'Fornitura', subtitle: CABLES[4].plug, supplyType: 'cee125tri', details: '' };
  const panel = { id: uid(), type: 'panel', page: 1, x: 270, y: 310, title: 'Quadro #1', subtitle: 'Quadro Generale', details: 'PB125A#01', panelModel: 'PB125A#01', inputType: 'cee125tri', ports: PANEL_LIBRARY[1].ports.map((port) => ({ ...port })), socket: '' };
  const load = { id: uid(), type: 'load', page: 1, x: 825, y: 295, title: 'Utenza di esempio', subtitle: CABLES[0].plug, plugType: 'cee16mono', details: 'Assorbimento 2,5 kW', socket: 'P1', watts: 2500 };
  state.nodes = [supply, panel, load];
  state.links = [{ id: uid(), from: supply.id, to: panel.id, cable: 'cee125tri', length: 20 }, { id: uid(), from: panel.id, to: load.id, cable: 'cee16mono', length: 20 }];
}
function nodeById(id) { return state.nodes.find((node) => node.id === id); }
function isReferenceLink(link) { return !!link?.referenceLink; }
function supplyKey(node) { return node?.supplyKey || node?.id; }
function supplyGroup(node) { return state.nodes.filter((item) => item.type === 'supply' && supplyKey(item) === supplyKey(node)); }
function uniqueSupplies() { return [...new Map(state.nodes.filter((node) => node.type === 'supply').map((node) => [supplyKey(node), node])).values()]; }
function panelKey(node) { return node?.panelKey || node?.id; }
function panelGroup(node) { return state.nodes.filter((item) => item.type === 'panel' && panelKey(item) === panelKey(node)); }
function uniquePanels() { return [...new Map(state.nodes.filter((node) => node.type === 'panel').map((node) => [panelKey(node), node])).values()]; }
function linkById(id) { return state.links.find((link) => link.id === id); }
function selectedNodes() { return state.nodes.filter((node) => state.selectedIds.includes(node.id)); }
function selectNode(id, additive = false) {
  if (additive) state.selectedIds = state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id];
  else state.selectedIds = [id];
  state.selected = state.selectedIds.includes(id) ? id : state.selectedIds.at(-1) || null; state.selectedLink = null;
}
function pageNodes() { return state.nodes.filter((node) => node.page === state.currentPage); }
function sortedPages() {
  return [...new Set([...(state.pages || [1]), ...state.nodes.map((node) => node.page)])].filter((page) => Number.isInteger(page) && page > 0).sort((first, second) => first - second);
}
function pagesCount() { return Math.max(1, ...sortedPages()); }
function cableById(id) { return CABLES.find((cable) => cable.id === id) || CABLES[0]; }
function esc(value) { return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function wrapText(value, maxLength) {
  const words = String(value || '').split(/\s+/); const lines = []; let line = '';
  words.forEach((word) => { const next = line ? `${line} ${word}` : word; if (line && next.length > maxLength) { lines.push(line); line = word; } else line = next; });
  if (line) lines.push(line); return lines;
}
function textLines(node) {
  if (node.type === 'load') return [`${node.title}${node.socket ? ` - Presa ${node.socket}` : ''}`, node.subtitle, node.details, node.note].filter(Boolean).flatMap((line) => wrapText(line, 32));
  return [node.title, node.socket ? `Presa ${node.socket}` : node.subtitle, node.socket ? node.subtitle : node.details, node.socket ? node.details : ''].filter(Boolean).flatMap((line) => wrapText(line, 23));
}
function directCableSiblings(link) { return state.links.filter((item) => !item.socapexGroup && item.from === link.from && item.cable === link.cable && nodeById(item.to)?.page === state.currentPage).sort((first, second) => (nodeById(first.to)?.y || 0) - (nodeById(second.to)?.y || 0)); }
function cablePlugLabel(cable) { return cable.plug.replace(/^CEE\s+/, '').replace('3P+N+T', '3P + N + T').replace('P+N+T', 'P + N + T'); }
function cableShortLabel(cable) { return cable.name.replace(/ monofase| trifase/gi, '').replace(/ (\d+) A$/, ' $1A'); }
function linkLabel(link) {
  const cable = cableById(link.cable);
  if (isPowerLock(cable.id)) return ['Cavo singolo polo PowerLock', `Lunghezza linea ${link.length || 0} metri`];
  if (cable.id === 'socapex') return [`Cavo ${cable.cable}`, `Lunghezza linea ${link.length || 0} metri`];
  return [cableShortLabel(cable), `Cavo ${cable.cable}`, `Lunghezza linea ${link.length || 0} metri`];
}
function linkLabelPosition(link, from, to) {
  const startX = from.x + NODE_HALF, endX = to.x - NODE_HALF, midX = Math.round((startX + endX) / 2), lines = linkLabel(link).flatMap((line) => wrapText(line, 29));
  return { x: link.labelX ?? Math.min(midX + 16, 790), y: link.labelY ?? Math.max(22, Math.min(from.y, to.y) - lines.length * 19 - 7), lines };
}
function linkLaneX(link, from) {
  const siblings = state.links.filter((item) => !item.socapexGroup && item.from === from.id && nodeById(item.to)?.page === state.currentPage).sort((first, second) => (nodeById(first.to)?.y || 0) - (nodeById(second.to)?.y || 0));
  if (siblings.length < 2) return Math.round((from.x + NODE_HALF + (nodeById(link.to)?.x || 0) - NODE_HALF) / 2);
  const index = siblings.findIndex((item) => item.id === link.id), startX = from.x + NODE_HALF, closestTargetX = Math.min(...siblings.map((item) => (nodeById(item.to)?.x || 0) - NODE_HALF));
  return Math.round(startX + 28 + ((index + 1) * Math.max(24, closestTargetX - startX - 56)) / (siblings.length + 1));
}
function nodeOptions(selected) { return pageNodes().map((node) => `<option value="${node.id}" ${node.id === selected ? 'selected' : ''}>${esc(node.title)}${node.socket ? ` (${node.socket})` : ''}</option>`).join(''); }
function cableOptions(selected) { return CABLES.filter((cable) => cable.id !== 'socapex' && !cable.internal).map((cable) => `<option value="${cable.id}" ${cable.id === selected ? 'selected' : ''}>${cable.name}</option>`).join(''); }
function plugOptions(selected) { return CABLES.filter((cable) => cable.id !== 'socapex' && !cable.internal && !cable.supplyOnly).map((cable) => `<option value="${cable.id}" ${cable.id === selected ? 'selected' : ''}>${cable.name}</option>`).join(''); }
function supplyOptions(selected) { return CABLES.filter((cable) => cable.id !== 'socapex' && !cable.internal).map((cable) => `<option value="${cable.id}" ${cable.id === selected ? 'selected' : ''}>${cable.name}</option>`).join(''); }
function panelPortOptions(selected) { return CABLES.filter((cable) => cable.id !== 'socapex' && !cable.supplyOnly).map((cable) => `<option value="${cable.id}" ${cable.id === selected ? 'selected' : ''}>${cable.name}</option>`).join(''); }
function isPowerLock(id) { return Core.isPowerLock(id); }
function compatibleConnector(first, second) { return Core.compatibleConnector(first, second); }
function requiredPlug(node) { return Core.requiredPlug(node); }
function panelSockets(panel) { return Core.panelSockets(panel); }
function availablePanelSockets(panel, target, ignoredLink = null) { return Core.availablePanelSockets(state, panel, target, ignoredLink); }
function socketWarning(panel, target, socket, ignoredLink = null) { return Core.socketWarning(state, panel, target, socket, ignoredLink, (id) => cableById(id).name); }
function assignFirstFreeSocket(from, to) {
  if (from.type !== 'panel') return true;
  const socket = availablePanelSockets(from, to)[0];
  if (!socket) { showStatus(`Collegamento bloccato: non ci sono prese ${cableById(requiredPlug(to)).name} libere sul quadro ${from.title}.`); return false; }
  to.socket = socket.name; return true;
}
function isPanelMatricolaUsed(matricola) { return state.nodes.some((node) => node.type === 'panel' && node.panelModel === matricola); }
function compatibilityWarning(from, to, ignoredLink = null, cable = null) {
  if (!from || !to) return 'Collegamento bloccato: origine o destinazione non disponibile.';
  const previous = ignoredLink ? linkById(ignoredLink) : null;
  const candidate = { ...(previous || {}), id: ignoredLink || 'candidate', from: from.id, to: to.id, cable: cable || previous?.cable || requiredPlug(to) || 'cee16mono' };
  const result = Core.validateConnection(state, candidate, { ignoredLinkId: ignoredLink, cableName: (id) => cableById(id).name });
  return result.ok ? '' : `Collegamento bloccato: ${result.message}`;
}
function showStatus(message = '') {
  $('#status-message').textContent = message;
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) return;
  let status = dialog.querySelector('.dialog-status');
  if (!status && message) {
    status = document.createElement('p'); status.className = 'dialog-status'; status.setAttribute('role', 'alert');
    const menu = dialog.querySelector('menu');
    const form = dialog.querySelector('form');
    if (menu) menu.before(status);
    else (form || dialog).append(status);
  }
  if (status) { status.textContent = message; status.hidden = !message; }
}
function physicalIncomingLink(panel) { return state.links.find((link) => !isReferenceLink(link) && panelKey(nodeById(link.to)) === panelKey(panel)); }
function supplyRootKey(node, visited = new Set()) {
  if (!node || visited.has(node.id)) return null;
  if (node.type === 'supply') return supplyKey(node);
  if (node.type !== 'panel') return null;
  visited.add(node.id); const incoming = physicalIncomingLink(node); return incoming ? supplyRootKey(nodeById(incoming.from), visited) : null;
}
function updatePanelNumbering(from, target) {
  if (target?.type !== 'panel') return;
  const root = supplyRootKey(from); if (!root) return;
  uniquePanels().filter((panel) => supplyRootKey(panel) === root).forEach((panel, index) => {
    panelGroup(panel).forEach((instance) => { if (/^Quadro #\d+$/.test(instance.title || '')) instance.title = `Quadro #${index + 1}`; });
  });
}
function tryAddLink(fromId, toId, cable, length, recordHistory = true) {
  const from = nodeById(fromId), to = nodeById(toId); if (!from || !to || fromId === toId) return false;
  const lineCable = cable || requiredPlug(to) || 'cee16mono';
  const warning = compatibilityWarning(from, to, null, lineCable); if (warning) { showStatus(warning); return false; }
  if (recordHistory) checkpoint('add-link');
  if (!assignFirstFreeSocket(from, to)) { if (recordHistory) dropNoopHistory(); return false; }
  state.links.push({ id: uid(), from: fromId, to: toId, cable: lineCable, length: Number.isFinite(Number(length)) ? Math.max(0, Number(length)) : 20 });
  updatePanelNumbering(from, to); markChanged(); showStatus(''); return true;
}

function render() {
  const pages = sortedPages(), maxPages = pagesCount();
  if (!pages.includes(state.currentPage)) state.currentPage = pages[0] || 1;
  state.selectedIds = state.selectedIds.filter((id) => nodeById(id));
  if (state.selected && !state.selectedIds.includes(state.selected)) state.selected = state.selectedIds.at(-1) || null;
  const svg = $('#diagram'); const nodes = pageNodes(); const ids = new Set(nodes.map((node) => node.id));
  let markup = '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#1c1c1c"/></marker></defs>';
  markup += alignmentGuides.map((guide) => guide.axis === 'x' ? `<path class="alignment-guide" d="M${guide.value},15 V735"/>` : `<path class="alignment-guide" d="M35,${guide.value} H1165"/>`).join('');
  const renderedSocapexGroups = new Set();
  state.links.forEach((link) => {
    if (link.socapexGroup) {
      if (renderedSocapexGroups.has(link.socapexGroup)) return;
      renderedSocapexGroups.add(link.socapexGroup);
      const group = state.links.filter((item) => item.socapexGroup === link.socapexGroup);
      const from = nodeById(group[0]?.from), visibleTargets = group.map((item) => ({ link: item, node: nodeById(item.to) })).filter(({ node }) => node && ids.has(node.id));
      if (!from || !ids.has(from.id) || !visibleTargets.length) return;
      const startX = from.x + NODE_HALF, endX = Math.min(...visibleTargets.map(({ node }) => node.x - NODE_HALF)), busX = Math.round((startX + endX) / 2), ys = visibleTargets.map(({ node }) => node.y), master = group[0], label = linkLabelPosition(master, from, visibleTargets[0].node);
      const labelMarkup = `<g class="link-label" data-link-id="${master.id}"><rect class="label-hit" x="${label.x - 5}" y="${label.y - 17}" width="310" height="${label.lines.length * 19 + 10}"/>${label.lines.map((line, index) => `<text class="line-label" x="${label.x}" y="${label.y + index * 19}">${esc(line)}</text>`).join('')}</g>`;
      markup += `<g class="link ${group.some((item) => item.id === state.selectedLink) ? 'selected' : ''}" data-link-id="${master.id}" tabindex="0" role="button" aria-label="Collegamento Socapex da ${esc(from.title)}"><path class="socapex-bus" d="M${startX},${from.y} H${busX} V${Math.min(...ys)} M${busX},${Math.min(...ys)} V${Math.max(...ys)}"/>${visibleTargets.map(({ node }) => `<path class="connector" d="M${busX},${node.y} H${node.x - NODE_HALF}"/>`).join('')}${labelMarkup}</g>`;
      return;
    }
    const from = nodeById(link.from), to = nodeById(link.to); if (!from || !to || !ids.has(from.id)) return;
    if (!ids.has(to.id)) { const pageNumber = printPageNumbers?.get(to.page) ?? to.page; markup += `<g class="link" data-link-id="${link.id}"><path class="connector" d="M${from.x + NODE_HALF},${from.y} H1050"/><rect class="page-jump" x="1060" y="${from.y - 22}" width="105" height="44"/><text class="page-jump-text" x="1112" y="${from.y + 5}">Pagina ${pageNumber}</text></g>`; return; }
    const startX = from.x + NODE_HALF, endX = to.x - NODE_HALF, midX = linkLaneX(link, from), label = linkLabelPosition(link, from, to);
    const labelMarkup = `<g class="link-label" data-link-id="${link.id}"><rect class="label-hit" x="${label.x - 5}" y="${label.y - 17}" width="310" height="${label.lines.length * 19 + 10}"/>${label.lines.map((line, index) => `<text class="line-label" x="${label.x}" y="${label.y + index * 19}">${esc(line)}</text>`).join('')}</g>`;
    markup += `<g class="link ${state.selectedLink === link.id ? 'selected' : ''}" data-link-id="${link.id}" tabindex="0" role="button" aria-label="Collegamento da ${esc(from.title)} a ${esc(to.title)}"><path class="connector" d="M${startX},${from.y} H${midX} V${to.y} H${endX}"/>${labelMarkup}</g>`;
  });
  nodes.forEach((node) => {
    const lines = textLines(node), compact = node.type === 'load', lineHeight = compact ? 14 : 20, topPadding = compact ? 14 : 21, height = Math.max(compact ? 50 : 58, lines.length * lineHeight + (compact ? 10 : 16));
    const texts = lines.map((line, index) => `<text class="${index === 0 || (node.type === 'panel' && index === 2) ? 'node-title' : ''}" x="${node.x}" y="${node.y - height / 2 + topPadding + index * lineHeight}">${esc(line)}</text>`).join('');
    markup += `<g class="node ${node.type} ${state.selectedIds.includes(node.id) ? 'selected' : ''}" data-id="${node.id}" tabindex="0" role="button" aria-label="${esc(node.title)}"><rect x="${node.x - NODE_HALF}" y="${node.y - height / 2}" width="${NODE_HALF * 2}" height="${height}"/>${texts}<circle class="link-handle" data-source="${node.id}" cx="${node.x + NODE_HALF}" cy="${node.y}" r="7" aria-hidden="true"/></g>`;
  });
  svg.innerHTML = markup;
  $('#page-label').textContent = `Pagina ${state.currentPage}`; $('#page-summary').textContent = `${nodes.length} elementi`;
  $('#page-select').innerHTML = pages.map((page) => `<option value="${page}" ${page === state.currentPage ? 'selected' : ''}>Pagina ${page}</option>`).join('');
  const pageIndex = pages.indexOf(state.currentPage);
  $('#previous-page').disabled = pageIndex <= 0;
  $('#next-page').disabled = pageIndex < 0 || pageIndex >= pages.length - 1;
  $('#delete-page').disabled = pages.length <= 1;
  $('#block-event').textContent = state.meta.name || '—'; $('#block-location').textContent = state.meta.location || '—'; $('#block-type').textContent = state.meta.type || '—'; $('#block-version').textContent = state.meta.revision || '1.0'; $('#block-company').textContent = state.meta.company || '—'; $('#block-company-address').textContent = state.meta.companyAddress || '—'; $('#block-company-vat').textContent = state.meta.companyVat ? `P. IVA ${state.meta.companyVat}` : ''; $('#block-page').textContent = `Pagina ${state.currentPage} di ${maxPages}`; $('#project-name').textContent = state.meta.name || 'Nuovo progetto';
  renderInspector();
  updateDirtyUi();
}
function renderCatalog() { $('#cable-catalog').innerHTML = CABLES.filter((cable) => !cable.internal).map((cable) => `<div class="catalog-item"><strong>${cable.name}</strong>${cable.cable}</div>`).join(''); }
function renderInspector() {
  const form = $('#property-form'), node = nodeById(state.selected), link = linkById(state.selectedLink);
  const selected = node || link; $('.empty-state').hidden = !!selected; form.hidden = !selected; $('#delete-selected').hidden = !selected;
  if (!selected) return;
  if (link) {
    const from = nodeById(link.from), to = nodeById(link.to), reference = isReferenceLink(link);
    form.innerHTML = `${reference ? `<div class="read-only">Collegamento richiamato: non impegna ulteriormente prese o ingressi.</div><label>Da<div class="read-only">${esc(from?.title || '—')}</div></label><label>A<div class="read-only">${esc(to?.title || '—')}</div></label>` : `<label>Da<select name="from">${nodeOptions(link.from)}</select></label><label>A<select name="to">${nodeOptions(link.to)}</select></label>`}<label>Linea<select name="cable">${cableOptions(link.cable)}</select></label><label>Lunghezza (m)<input name="length" type="number" min="0" step="0.5" value="${link.length}" /></label><span class="field-help">Puoi eliminare questo collegamento con il pulsante in alto.</span>`;
    return;
  }
  const hasIncoming = state.links.some((item) => item.to === node.id);
  const incoming = state.links.find((item) => item.to === node.id), source = incoming && nodeById(incoming.from);
  const connectorControl = node.type === 'load' ? `<label>Spina utenza<select name="plugType">${plugOptions(node.plugType)}</select></label>` : node.type === 'supply' ? `<label>Fornitura<select name="supplyType">${supplyOptions(node.supplyType || 'cee125tri')}</select></label>` : '';
  const sockets = source?.type === 'panel' ? availablePanelSockets(source, node, incoming.id) : [], socketControl = node.type === 'supply' ? '' : source?.type === 'panel' ? `<label>Presa disponibile<select name="socket" ${sockets.length ? '' : 'disabled'}>${sockets.length ? sockets.map((item) => `<option value="${item.name}" ${item.name === node.socket ? 'selected' : ''}>${item.name} · ${cableById(item.type).name}</option>`).join('') : '<option value="">Nessuna presa compatibile libera</option>'}</select></label><label>Oppure scrivi presa<input name="manualSocket" list="socket-list-${node.id}" value="${esc(node.socket || '')}" placeholder="Es. P1" /><datalist id="socket-list-${node.id}">${sockets.map((item) => `<option value="${item.name}">${cableById(item.type).name}</option>`).join('')}</datalist></label>` : `<label>Presa<input name="socket" value="${esc(node.socket || '')}" placeholder="Es. P1" /></label>`;
  const sharedSupply = node.type === 'supply' && supplyGroup(node).length > 1 ? `<div class="read-only">Fornitura condivisa su ${supplyGroup(node).length} pagine: nome, tipo e dettaglio vengono mantenuti uguali.</div>` : '';
  const sharedPanel = node.type === 'panel' && panelGroup(node).length > 1 ? `<div class="read-only">Quadro condiviso su ${panelGroup(node).length} pagine: uscite, nome e matricola sono condivisi.</div>` : '';
  const temporaryEdit = node.type === 'panel' && node.panelModel === 'Temporaneo' ? '<button type="button" class="button" id="edit-temporary-panel">Modifica configurazione quadro temporaneo</button>' : '';
  const duplicateLoad = node.type === 'load' ? '<button type="button" class="button" id="duplicate-load">Duplica utenza</button>' : '';
  const pageOptions = sortedPages().map((page) => `<option value="${page}" ${page === node.page ? 'selected' : ''}>Pagina ${page}</option>`).join('');
  const detailControl = node.type === 'load'
    ? `<label>Assorbimento (W)<input name="watts" type="number" min="0" step="1" value="${esc(node.watts || 0)}" /></label><label>Nota<input name="note" value="${esc(node.note || '')}" /></label>`
    : `<label>Dettaglio / matricola<input name="details" value="${esc(node.details || '')}" /></label>`;
  form.innerHTML = `${state.selectedIds.length > 1 ? `<div class="read-only">${state.selectedIds.length} elementi selezionati. Trascina uno dei blocchi per spostarli insieme.</div>` : ''}<label>Tipo<div class="read-only">${node.type === 'supply' ? 'Fornitura' : node.type === 'panel' ? 'Quadro' : 'Utenza'}</div></label>${sharedSupply}${sharedPanel}${node.type === 'panel' && node.panelModel ? `<label>Modello database<div class="read-only">${esc(node.panelModel)}</div></label>` : ''}${temporaryEdit}${duplicateLoad}<label>Pagina<select name="page">${pageOptions}</select></label><label>Titolo<input name="title" value="${esc(node.title)}" /></label>${connectorControl}${node.type === 'panel' ? '<label>Sottotitolo<input name="subtitle" value="' + esc(node.subtitle) + '" /></label>' : ''}${socketControl}${detailControl}${hasIncoming ? '<button type="button" class="button" id="unlink-selected">Scollega dal quadro / fornitura</button>' : ''}<span class="field-help">⇧/⌘ + clic per aggiungere o togliere un blocco dalla selezione. Trascina un blocco selezionato per spostarli insieme.</span>`;
}
function addNode(type) {
  checkpoint(`add-${type}`);
  const page = state.currentPage, same = pageNodes().filter((node) => node.type === type).length;
  const supplyNumber = uniqueSupplies().length + 1;
  const defaults = { supply: [`Fornitura #${supplyNumber}`, '63 A', '', 90, Math.min(650, 135 + same * 95)], load: ['Nuova utenza', 'CEE P+N+T 230 V 16 A', 'Assorbimento 0,0 kW', 835, 135 + same * 92] }[type];
  const node = { id: uid(), type, page, title: defaults[0], subtitle: defaults[1], details: defaults[2], x: defaults[3], y: defaults[4], socket: '', watts: 0 };
  if (type === 'supply') { node.supplyKey = uid(); node.supplyType = 'cee125tri'; node.subtitle = CABLES.find((cable) => cable.id === node.supplyType).plug; }
  if (type === 'load') { node.plugType = 'cee16mono'; node.subtitle = CABLES.find((cable) => cable.id === node.plugType).plug; }
  state.nodes.push(node); const extraPages = type === 'load' ? ensureLoadPageCapacity(page) : 0; if (extraPages) state.currentPage = node.page; state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; markChanged(); render(); if (extraPages) showStatus(`Utenza aggiunta e nuova pagina ${pagesCount()} creata automaticamente.`);
}
function openSupplyReferenceDialog() {
  const supplies = uniqueSupplies().filter((supply) => !pageNodes().some((node) => node.type === 'supply' && supplyKey(node) === supplyKey(supply)));
  if (!supplies.length) return showStatus('Non ci sono forniture da richiamare in questa pagina.');
  $('#supply-reference-choice').innerHTML = supplies.map((supply) => `<option value="${supplyKey(supply)}">${esc(supply.title)} - ${esc(cableById(supply.supplyType).name)}</option>`).join('');
  $('#supply-reference-dialog').showModal();
}
function addSupplyReference() {
  const original = uniqueSupplies().find((supply) => supplyKey(supply) === $('#supply-reference-choice').value);
  if (!original) return;
  checkpoint('add-supply-reference'); original.supplyKey ||= original.id;
  const referencesOnPage = pageNodes().filter((node) => node.type === 'supply').length;
  const node = { ...original, id: uid(), page: state.currentPage, x: 90, y: 135 + referencesOnPage * 95, socket: '' };
  state.nodes.push(node); autoRecallConnections(); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#supply-reference-dialog').close(); markChanged(); render();
}
function openPanelReferenceDialog() {
  const panels = uniquePanels().filter((panel) => !pageNodes().some((node) => node.type === 'panel' && panelKey(node) === panelKey(panel)));
  if (!panels.length) return showStatus('Non ci sono quadri da richiamare in questa pagina.');
  $('#panel-reference-choice').innerHTML = panels.map((panel) => `<option value="${panelKey(panel)}">${esc(panel.title)}${panel.details ? ` (${esc(panel.details)})` : ''}</option>`).join('');
  $('#panel-reference-dialog').showModal();
}
function addPanelReference() {
  const original = uniquePanels().find((panel) => panelKey(panel) === $('#panel-reference-choice').value);
  if (!original) return;
  checkpoint('add-panel-reference'); original.panelKey ||= original.id;
  const position = panelPosition(pageNodes().filter((node) => node.type === 'panel').length);
  const node = { ...original, id: uid(), page: state.currentPage, x: position.x, y: position.y, socket: '' };
  state.nodes.push(node); autoRecallConnections(); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#panel-reference-dialog').close(); markChanged(); render();
}
function samePhysicalNode(first, second) {
  if (!first || !second || first.type !== second.type) return false;
  if (first.type === 'supply') return supplyKey(first) === supplyKey(second);
  if (first.type === 'panel') return panelKey(first) === panelKey(second);
  return first.id === second.id;
}
function linkReferenceCandidates() {
  const nodes = pageNodes();
  return state.links.filter((link) => !isReferenceLink(link)).map((link) => {
    const originalFrom = nodeById(link.from), originalTo = nodeById(link.to);
    const from = nodes.find((node) => samePhysicalNode(node, originalFrom)), to = nodes.find((node) => samePhysicalNode(node, originalTo));
    return { link, originalFrom, originalTo, from, to };
  }).filter((item) => item.from && item.to && item.from.id !== item.to.id && !state.links.some((link) => link.from === item.from.id && link.to === item.to.id));
}
function addLinkReferenceItem(item) {
  if (!item) return null;
  if (item.to.type === 'panel' && item.originalTo.socket) item.to.socket = item.originalTo.socket;
  const link = { ...item.link, id: uid(), from: item.from.id, to: item.to.id, referenceLink: true, labelX: undefined, labelY: undefined };
  state.links.push(link); return link;
}
function autoRecallConnections() {
  linkReferenceCandidates().forEach((item) => addLinkReferenceItem(item));
}
function openLinkReferenceDialog() {
  pendingLinkReferences = linkReferenceCandidates();
  if (!pendingLinkReferences.length) return showStatus('Richiama prima nella pagina sia l’origine sia la destinazione del collegamento.');
  $('#link-reference-choice').innerHTML = pendingLinkReferences.map((item, index) => `<option value="${index}">${esc(item.originalFrom.title)} → ${esc(item.originalTo.title)} · ${esc(cableById(item.link.cable).name)}</option>`).join('');
  $('#link-reference-dialog').showModal();
}
function addLinkReference() {
  const item = pendingLinkReferences[Number($('#link-reference-choice').value)];
  if (!item) return;
  checkpoint('add-link-reference'); const link = addLinkReferenceItem(item); if (!link) return;
  $('#link-reference-dialog').close(); state.selectedLink = link.id; state.selected = null; state.selectedIds = []; markChanged(); render(); showStatus('Collegamento richiamato.');
}
function openBulkLoadDialog() {
  const panels = pageNodes().filter((node) => node.type === 'panel');
  $('#bulk-load-name').value = 'Utenza'; $('#bulk-load-count').value = 6; $('#bulk-load-start').value = 1; $('#bulk-load-watts').value = 0;
  $('#bulk-load-plug').innerHTML = plugOptions('cee16mono');
  $('#bulk-load-parent').innerHTML = `<option value="">Non collegare ora</option>${panels.map((panel) => `<option value="${panel.id}">Quadro: ${esc(panel.title)}${panel.details ? ` (${esc(panel.details)})` : ''}</option>`).join('')}`;
  $('#bulk-load-dialog').showModal();
}
function addBulkLoads() {
  checkpoint('add-bulk-loads');
  const count = Math.max(1, Math.min(200, Number($('#bulk-load-count').value) || 1)), start = Math.max(1, Number($('#bulk-load-start').value) || 1), title = $('#bulk-load-name').value.trim() || 'Utenza', plugType = $('#bulk-load-plug').value, watts = Math.max(0, Number($('#bulk-load-watts').value) || 0), parentId = $('#bulk-load-parent').value, nodes = [];
  for (let index = 0; index < count; index++) {
    const node = { id: uid(), type: 'load', page: state.currentPage, x: 835, y: 135 + index * 56, title: count === 1 ? title : `${title} ${start + index}`, subtitle: cableById(plugType).plug, plugType, details: `Assorbimento ${(watts / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW`, socket: '', watts };
    state.nodes.push(node); nodes.push(node);
  }
  arrangeNodes(pageNodes().filter((node) => node.type === 'load'), 850);
  let linked = 0; nodes.forEach((node) => { if (parentId && tryAddLink(parentId, node.id, plugType, 20, false)) linked++; });
  const extraPages = ensureLoadPageCapacity(state.currentPage);
  $('#bulk-load-dialog').close(); state.selectedIds = nodes.filter((node) => node.page === state.currentPage).map((node) => node.id); state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; markChanged(); render(); showStatus(`Aggiunte ${count} utenze${parentId ? `, collegate ${linked}` : ''}${extraPages ? ` e distribuite su ${extraPages + 1} pagine` : ''}.`);
}
function selectedPanelPorts(config) { const alternative = (config.alternatives || []).find((item) => item.id === $('#panel-mode').value); return alternative?.ports || config.ports; }
function addPanelFromLibrary(matricola) {
  if (isPanelMatricolaUsed(matricola)) { showStatus(`Il quadro con matricola ${matricola} è già presente nel progetto.`); return; }
  const config = state.library.find((item) => item.matricola === matricola); if (!config) return showStatus('Configurazione quadro non disponibile.');
  checkpoint('add-panel'); const index = pageNodes().filter((node) => node.type === 'panel').length + 1;
  const position = panelPosition(index - 1);
  const alternative = (config.alternatives || []).find((item) => item.id === $('#panel-mode').value);
  const node = { id: uid(), panelKey: uid(), type: 'panel', page: state.currentPage, x: position.x, y: position.y, title: `Quadro #${index}`, subtitle: 'Da denominare', details: matricola, panelModel: matricola, panelMode: alternative?.label || 'Prese CEE', inputType: config.inputType, socket: '', ports: selectedPanelPorts(config).map((port) => ({ ...port })) };
  state.nodes.push(node); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#panel-dialog').close(); markChanged(); render();
}
function panelPosition(index) { return { x: Math.min(520, 280 + Math.floor(index / 5) * 240), y: 165 + (index % 5) * 110 }; }
function renderTemporaryPorts() { $('#temporary-panel-ports').innerHTML = temporaryPorts.map((port, index) => `<div class="temporary-port"><label>Uscita<select data-port-type="${index}">${panelPortOptions(port.type)}</select></label><label>Quantità<input data-port-quantity="${index}" type="number" min="1" value="${port.quantity}" /></label>${temporaryPorts.length > 1 ? `<button type="button" data-remove-port="${index}">Rimuovi</button>` : ''}</div>`).join(''); }
function openTemporaryPanelDialog(node = null) { editingTemporaryPanelId = node?.id || null; temporaryPorts = node?.ports?.map((port) => ({ ...port })) || [{ type: 'cee16mono', quantity: 1 }]; $('#temporary-panel-input').innerHTML = supplyOptions(node?.inputType || 'cee63tri'); $('#temporary-panel-name').value = node?.title || 'Quadro temporaneo'; $('#temporary-panel-code').value = node?.details || ''; $('#confirm-temporary-panel').textContent = node ? 'Salva modifiche' : 'Aggiungi quadro'; renderTemporaryPorts(); $('#temporary-panel-dialog').showModal(); }
function addTemporaryPanel() {
  const existing = nodeById(editingTemporaryPanelId), inputType = $('#temporary-panel-input').value, title = $('#temporary-panel-name').value || 'Quadro temporaneo', details = $('#temporary-panel-code').value || 'Quadro temporaneo', ports = temporaryPorts.map((port) => ({ ...port }));
  if (existing) {
    const before = historySnapshot(); checkpoint('edit-temporary-panel');
    panelGroup(existing).forEach((panel) => { panel.title = title; panel.details = details; panel.inputType = inputType; panel.ports = ports.map((port) => ({ ...port })); });
    const issue = projectIssues()[0];
    if (issue) { restoreHistorySnapshot(before); dropNoopHistory(); showStatus(`Modifica annullata: ${issue.message}`); return; }
    state.selected = existing.id; state.selectedIds = [existing.id]; editingTemporaryPanelId = null; $('#temporary-panel-dialog').close(); markChanged(); render(); return;
  }
  checkpoint('add-temporary-panel');
  const index = pageNodes().filter((node) => node.type === 'panel').length + 1, position = panelPosition(index - 1); const node = { id: uid(), panelKey: uid(), type: 'panel', page: state.currentPage, x: position.x, y: position.y, title, subtitle: 'Temporaneo', details, panelModel: 'Temporaneo', inputType, socket: '', ports }; state.nodes.push(node); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#temporary-panel-dialog').close(); render();
  markChanged();
}
function detectCsvDelimiter(text) {
  const header = String(text || '').split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  return candidates.sort((first, second) => header.split(second).length - header.split(first).length)[0];
}
function parseCsv(text, delimiter = detectCsvDelimiter(text)) {
  if (!String(text || '').trim()) throw new Error('Il file CSV è vuoto.');
  const rows = []; let row = [], cell = '', quote = false;
  for (let index = 0; index < text.length; index++) { const char = text[index], next = text[index + 1]; if (char === '"' && quote && next === '"') { cell += '"'; index++; } else if (char === '"') quote = !quote; else if (char === delimiter && !quote) { row.push(cell); cell = ''; } else if ((char === '\n' || char === '\r') && !quote) { if (char === '\r' && next === '\n') index++; row.push(cell); if (row.some((value) => value)) rows.push(row); row = []; cell = ''; } else cell += char; }
  if (quote) throw new Error('Il CSV contiene una cella tra virgolette non chiusa.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift();
  if (!header) throw new Error('Il CSV non contiene intestazioni.');
  const canonical = { circuit: 'Circuit', fixture: 'Fixture', wattage: 'Wattage' };
  const keys = header.map((value) => {
    const cleaned = value.replace(/^\uFEFF/, '').trim();
    return canonical[cleaned.toLowerCase()] || cleaned;
  });
  const missing = ['Circuit', 'Fixture', 'Wattage'].filter((key) => !keys.includes(key));
  if (missing.length) throw new Error(`Intestazioni mancanti: ${missing.join(', ')}.`);
  return rows.map((values) => Object.fromEntries(keys.map((key, index) => [key, values[index] || ''])));
}
function circuitPrefix(circuit) { const value = String(circuit || '').trim().replace(/^circuito\s+/i, ''); return (value.match(/^[A-Za-z]+/)?.[0] || value.charAt(0) || 'Altro').toUpperCase(); }
function parseLocaleNumber(value) {
  let cleaned = String(value ?? '').trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(','), lastDot = cleaned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    cleaned = cleaned.replace(thousands, '').replace(decimal, '.');
  } else if (lastComma >= 0) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  else if ((cleaned.match(/\./g) || []).length > 1) {
    const parts = cleaned.split('.'); cleaned = `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
  }
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}
function arrangeNodes(nodes, anchorX = 600) {
  const items = [...nodes]; if (!items.length) return;
  const loadGrid = items.every((node) => node.type === 'load');
  const rows = Math.min(loadGrid ? 6 : 4, items.length), columns = Math.ceil(items.length / rows), stepX = loadGrid ? 245 : 220, stepY = loadGrid ? Math.min(108, rows > 1 ? 550 / (rows - 1) : 100) : 124;
  const minCenter = 110 + ((columns - 1) * stepX) / 2, maxCenter = 1090 - ((columns - 1) * stepX) / 2, centerX = Math.max(minCenter, Math.min(maxCenter, anchorX)), startX = centerX - ((columns - 1) * stepX) / 2, startY = 390 - ((rows - 1) * stepY) / 2;
  items.forEach((node, index) => { const column = Math.floor(index / rows), row = index % rows; node.x = startX + column * stepX; node.y = startY + row * stepY; });
}
function createPhysicalReference(source, page) {
  const existing = state.nodes.find((node) => node.page === page && samePhysicalNode(node, source));
  if (existing) return existing;
  const index = state.nodes.filter((node) => node.page === page && node.type === source.type).length;
  const position = source.type === 'supply' ? { x: 90, y: 135 + index * 95 } : panelPosition(index);
  const reference = { ...source, id: uid(), page, x: position.x, y: position.y, socket: '' };
  state.nodes.push(reference);
  return reference;
}
function ensureLoadPageCapacity(page) {
  const loads = state.nodes.filter((node) => node.type === 'load' && node.page === page);
  if (loads.length <= MAX_LOADS_PER_PAGE) { arrangeNodes(loads, 835); return 0; }
  const units = [], grouped = new Set();
  loads.forEach((load) => {
    const link = state.links.find((item) => !isReferenceLink(item) && item.to === load.id);
    if (link?.socapexGroup) {
      if (grouped.has(link.socapexGroup)) return;
      grouped.add(link.socapexGroup);
      units.push(loads.filter((item) => state.links.some((candidate) => candidate.socapexGroup === link.socapexGroup && candidate.to === item.id)));
    } else units.push([load]);
  });
  const chunks = [[]];
  units.forEach((unit) => {
    if (chunks.at(-1).length && chunks.at(-1).length + unit.length > MAX_LOADS_PER_PAGE) chunks.push([]);
    chunks.at(-1).push(...unit);
  });
  arrangeNodes(chunks[0], 835);
  let createdPages = 0;
  chunks.slice(1).forEach((chunk) => {
    const nextPage = pagesCount() + 1; state.pages.push(nextPage); createdPages++;
    chunk.forEach((load) => { load.page = nextPage; });
    const references = new Map();
    chunk.forEach((load) => {
      const incoming = state.links.find((link) => !isReferenceLink(link) && link.to === load.id);
      const source = incoming && nodeById(incoming.from);
      if (!incoming || !source || !['supply', 'panel'].includes(source.type)) return;
      const key = source.type === 'panel' ? `panel:${panelKey(source)}` : `supply:${supplyKey(source)}`;
      if (!references.has(key)) references.set(key, createPhysicalReference(source, nextPage));
      incoming.from = references.get(key).id;
    });
    arrangeNodes(chunk, 835);
  });
  return createdPages;
}
function prepareCaptureImport(text) {
  const groups = new Map(); parseCsv(text).forEach((row) => { const circuit = (row.Circuit || '').trim() || 'Senza circuito'; const watts = Math.max(0, parseLocaleNumber(row.Wattage)); const group = groups.get(circuit) || { circuit, watts: 0, fixtures: [] }; group.watts += watts; group.fixtures.push(row.Fixture || 'Fixture'); groups.set(circuit, group); });
  if (!groups.size) throw new Error('Il CSV non contiene circuiti importabili.');
  pendingCaptureGroups = [...groups.values()].sort((first, second) => first.circuit.localeCompare(second.circuit, 'it', { numeric: true, sensitivity: 'base' })); renderCaptureImportDialog(); $('#welcome-dialog').close(); $('#capture-import-dialog').showModal();
}
function renderCaptureImportDialog() {
  const targets = pageNodes().filter((node) => node.type === 'panel');
  $('#capture-parent').innerHTML = `<option value="">Non collegare ora</option>${targets.map((node) => `<option value="${node.id}">Quadro: ${esc(node.title)}${node.details ? ` (${esc(node.details)})` : ''}</option>`).join('')}`;
  $('#capture-use-socapex').checked = false; updateCaptureSocapexAvailability();
  const prefixes = [...new Set(pendingCaptureGroups.map((group) => circuitPrefix(group.circuit)))];
  $('#capture-prefix-actions').innerHTML = prefixes.map((prefix) => `<button type="button" data-capture-prefix="${esc(prefix)}">Solo ${esc(prefix)}</button>`).join('');
  $('#capture-circuit-list').innerHTML = pendingCaptureGroups.map((group, index) => `<label class="capture-circuit"><input type="checkbox" data-capture-index="${index}" checked /><span><strong>Circuito ${esc(group.circuit)}</strong><br />${group.fixtures.length} fixture - ${(group.watts / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW</span></label>`).join('');
}
function updateCaptureSocapexAvailability() {
  const enabled = !!$('#capture-parent').value;
  $('#capture-use-socapex').disabled = !enabled;
  if (!enabled) $('#capture-use-socapex').checked = false;
  $('#capture-socapex-help').textContent = enabled ? 'I circuiti CEE 16 A monofase saranno raggruppati automaticamente, fino a 6 per ogni Socapex.' : 'Scegli prima un quadro per attivare il collegamento tramite Socapex.';
}
function connectLoadsAsSocapex(parentId, loadIds, length = 20) {
  const parent = nodeById(parentId), eligibleIds = loadIds.filter((id) => { const load = nodeById(id); return load?.type === 'load' && load.plugType === 'cee16mono' && !state.links.some((link) => !isReferenceLink(link) && link.to === id); });
  if (!parent || parent.type !== 'panel') return { linked: 0, groups: 0 };
  let linked = 0, groups = 0;
  for (let offset = 0; offset < eligibleIds.length;) {
    const target = nodeById(eligibleIds[offset]), sockets = availablePanelSockets(parent, target);
    if (!sockets.length) break;
    const groupIds = eligibleIds.slice(offset, offset + Math.min(6, sockets.length)), groupId = uid();
    groupIds.forEach((loadId, index) => { const load = nodeById(loadId); load.socket = sockets[index].name; state.links.push({ id: uid(), from: parentId, to: loadId, cable: 'socapex', length, socapexGroup: groupId }); });
    linked += groupIds.length; groups++; offset += groupIds.length;
  }
  return { linked, groups };
}
function importSelectedCaptureGroups() {
  const selected = [...document.querySelectorAll('[data-capture-index]:checked')].map((input) => pendingCaptureGroups[Number(input.dataset.captureIndex)]), parent = $('#capture-parent').value, useSocapex = parent && $('#capture-use-socapex').checked; let index = pageNodes().filter((node) => node.type === 'load').length, linked = 0, socapexGroups = 0; const importedIds = [];
  if (!selected.length) return showStatus('Seleziona almeno un circuito da importare.');
  checkpoint('import-capture');
  selected.forEach((group) => { index++; const node = { id: uid(), type: 'load', page: state.currentPage, x: 835, y: Math.min(650, 120 + index * 75), title: `Circuito ${group.circuit}`, subtitle: CABLES[0].plug, plugType: 'cee16mono', details: `Assorbimento ${(group.watts / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW`, socket: '', watts: group.watts, fixtures: group.fixtures }; state.nodes.push(node); importedIds.push(node.id); });
  if (useSocapex) ({ linked, groups: socapexGroups } = connectLoadsAsSocapex(parent, importedIds));
  else if (parent) importedIds.forEach((id) => { if (tryAddLink(parent, id, 'cee16mono', 20, false)) linked++; });
  const extraPages = ensureLoadPageCapacity(state.currentPage);
  $('#capture-import-dialog').close(); state.selectedIds = importedIds.filter((id) => nodeById(id)?.page === state.currentPage); state.selected = state.selectedIds.at(-1) || null; markChanged(); render(); showStatus(`Importati ${selected.length} circuiti${parent ? `, collegati ${linked}${useSocapex ? ` in ${socapexGroups} Socapex` : ''}` : ''}${parent && linked < selected.length ? `; ${selected.length - linked} senza collegamento per mancanza di prese libere` : ''}${extraPages ? `, distribuiti su ${extraPages + 1} pagine` : ''}.`);
}
function openSocapexDialog() {
  const panels = pageNodes().filter((node) => node.type === 'panel');
  const loads = pageNodes().filter((node) => node.type === 'load' && node.plugType === 'cee16mono' && !state.links.some((link) => link.to === node.id));
  $('#socapex-parent').innerHTML = panels.map((node) => `<option value="${node.id}">${esc(node.title)}${node.details ? ` (${esc(node.details)})` : ''}</option>`).join('');
  const prefixes = [...new Set(loads.map((node) => circuitPrefix(node.title)))];
  $('#socapex-prefix-actions').innerHTML = prefixes.map((prefix) => `<button type="button" data-socapex-prefix="${esc(prefix)}">Solo ${esc(prefix)}</button>`).join('');
  $('#socapex-load-list').innerHTML = loads.length ? loads.map((node) => `<label class="capture-circuit"><input type="checkbox" data-socapex-load="${node.id}" /><span><strong>${esc(node.title)}</strong><br />${esc(node.socket ? `Presa ${node.socket} · ` : '')}${esc(node.details || '')}</span></label>`).join('') : '<p class="help">Non ci sono utenze CEE 16 A monofase non ancora collegate in questa pagina.</p>';
  if (!panels.length) { showStatus('Aggiungi prima un quadro a questa pagina.'); return; }
  $('#socapex-dialog').showModal();
}
function createSocapexGroup() {
  const parentId = $('#socapex-parent').value, loadIds = [...document.querySelectorAll('[data-socapex-load]:checked')].map((input) => input.dataset.socapexLoad), parent = nodeById(parentId);
  if (!parent || !loadIds.length) return showStatus('Seleziona un quadro e almeno un’utenza.');
  if (loadIds.length > 6) return showStatus('Un Socapex può raggruppare al massimo 6 utenze CEE 16 A monofase.');
  const capacity = (parent.ports || []).filter((port) => port.type === 'cee16mono').reduce((sum, port) => sum + port.quantity, 0), used = state.links.filter((link) => !isReferenceLink(link) && panelKey(nodeById(link.from)) === panelKey(parent) && requiredPlug(nodeById(link.to)) === 'cee16mono').length;
  if (used + loadIds.length > capacity) return showStatus(`Collegamento bloccato: le prese CEE 16 A monofase del quadro ${parent.title} non bastano (${used}/${capacity} già impegnate).`);
  const sockets = availablePanelSockets(parent, nodeById(loadIds[0]));
  if (sockets.length < loadIds.length) return showStatus(`Collegamento bloccato: non ci sono abbastanza prese CEE 16 A monofase libere sul quadro ${parent.title}.`);
  checkpoint('create-socapex'); connectLoadsAsSocapex(parentId, loadIds);
  $('#socapex-dialog').close(); state.selected = loadIds.at(-1); state.selectedIds = loadIds; state.selectedLink = null; markChanged(); render(); showStatus(`Creato Socapex unico per ${loadIds.length} utenz${loadIds.length === 1 ? 'a' : 'e'}.`);
}
function openBulkConnectDialog() {
  const sources = pageNodes().filter((node) => node.type === 'panel'), selectedIds = new Set(state.selectedIds), loads = pageNodes().filter((node) => node.type === 'load' && !state.links.some((link) => link.to === node.id));
  $('#bulk-connect-parent').innerHTML = sources.map((node) => `<option value="${node.id}" ${selectedIds.has(node.id) ? 'selected' : ''}>${node.type === 'panel' ? 'Quadro' : 'Fornitura'}: ${esc(node.title)}</option>`).join('');
  $('#bulk-connect-load-list').innerHTML = loads.length ? loads.map((node) => `<label class="capture-circuit"><input type="checkbox" data-bulk-connect-load="${node.id}" ${selectedIds.has(node.id) ? 'checked' : ''}/><span><strong>${esc(node.title)}</strong><br />${esc(node.socket ? `Presa ${node.socket} · ` : '')}${esc(cableById(node.plugType).name)}</span></label>`).join('') : '<p class="help">Non ci sono utenze non ancora collegate in questa pagina.</p>';
  if (!sources.length) { showStatus('Aggiungi prima un quadro a questa pagina.'); return; }
  $('#bulk-connect-dialog').showModal();
}
function createBulkConnections() {
  const parentId = $('#bulk-connect-parent').value, targetIds = [...document.querySelectorAll('[data-bulk-connect-load]:checked')].map((input) => input.dataset.bulkConnectLoad), parent = nodeById(parentId);
  if (!parent || !targetIds.length) return showStatus('Seleziona un quadro e almeno un’utenza.');
  const targets = targetIds.map(nodeById).filter(Boolean), requirements = new Map();
  targets.forEach((node) => requirements.set(requiredPlug(node), (requirements.get(requiredPlug(node)) || 0) + 1));
  if (parent.type === 'panel') {
    for (const [plug, count] of requirements) {
      const capacity = (parent.ports || []).filter((port) => port.type === plug).reduce((sum, port) => sum + port.quantity, 0), used = state.links.filter((link) => !isReferenceLink(link) && panelKey(nodeById(link.from)) === panelKey(parent) && requiredPlug(nodeById(link.to)) === plug).length;
      if (used + count > capacity) return showStatus(`Collegamento bloccato: le prese ${cableById(plug).name} del quadro ${parent.title} non bastano (${used}/${capacity} già impegnate).`);
    }
  }
  const incompatible = targets.map((node) => compatibilityWarning(parent, node)).find(Boolean); if (incompatible) return showStatus(incompatible);
  checkpoint('bulk-connect'); targets.forEach((node) => tryAddLink(parent.id, node.id, requiredPlug(node), 20, false));
  $('#bulk-connect-dialog').close(); state.selectedIds = [parent.id, ...targetIds]; state.selected = parent.id; state.selectedLink = null; markChanged(); render(); showStatus(`Collegate ${targetIds.length} utenz${targetIds.length === 1 ? 'a' : 'e'}.`);
}
function openArrangeDialog() {
  const targets = selectedNodes();
  if (!targets.length) { showStatus('Seleziona gli elementi da ordinare, oppure disegna un riquadro attorno a loro.'); return; }
  const references = pageNodes().filter((node) => !state.selectedIds.includes(node.id));
  $('#arrange-reference').innerHTML = references.map((node) => `<option value="${node.id}">${node.type === 'panel' ? 'Quadro' : node.type === 'supply' ? 'Fornitura' : 'Utenza'}: ${esc(node.title)}</option>`).join('');
  $('#arrange-reference-row').hidden = true; $('#arrange-mode').value = 'center'; $('#arrange-dialog').showModal();
}
function arrangeSelectedNodes() {
  const targets = selectedNodes(), mode = $('#arrange-mode').value, reference = nodeById($('#arrange-reference').value);
  if (!targets.length) return;
  checkpoint('arrange'); arrangeNodes(targets, mode === 'relative' && reference ? reference.x + 310 : 600);
  $('#arrange-dialog').close(); markChanged(); render(); showStatus(`${targets.length} elementi ordinati.`);
}
function openAlignDialog() { if (!selectedNodes().length) return showStatus('Seleziona gli elementi da allineare.'); $('#align-dialog').showModal(); }
function alignSelectedNodes() {
  const nodes = selectedNodes(); if (nodes.length < 2) return showStatus('Seleziona almeno due elementi da allineare.');
  checkpoint('align'); const mode = $('#align-mode').value, xs = nodes.map((node) => node.x), ys = nodes.map((node) => node.y), average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mode === 'left') nodes.forEach((node) => { node.x = Math.min(...xs); });
  if (mode === 'right') nodes.forEach((node) => { node.x = Math.max(...xs); });
  if (mode === 'center-x') nodes.forEach((node) => { node.x = average(xs); });
  if (mode === 'top') nodes.forEach((node) => { node.y = Math.min(...ys); });
  if (mode === 'bottom') nodes.forEach((node) => { node.y = Math.max(...ys); });
  if (mode === 'center-y') nodes.forEach((node) => { node.y = average(ys); });
  $('#align-dialog').close(); markChanged(); render(); showStatus(`${nodes.length} elementi allineati.`);
}
function duplicateSelectedLoads() {
  const originals = selectedNodes().filter((node) => node.type === 'load');
  if (!originals.length) return showStatus('Seleziona almeno un’utenza da duplicare.');
  checkpoint('duplicate-loads'); const duplicates = originals.map((original, index) => {
    const baseTitle = original.title.replace(/\s+copia(?:\s+\d+)?$/i, ''), sameTitles = state.nodes.filter((node) => node.type === 'load' && node.page === state.currentPage && node.title.startsWith(`${baseTitle} copia`)).length;
    return { ...original, id: uid(), title: `${baseTitle} copia${sameTitles + index ? ` ${sameTitles + index + 1}` : ''}`, socket: '', x: original.x + 20, y: original.y + 20 };
  });
  state.nodes.push(...duplicates); const extraPages = ensureLoadPageCapacity(state.currentPage); state.selectedIds = duplicates.filter((node) => node.page === state.currentPage).map((node) => node.id); state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; markChanged(); render(); showStatus(`Duplicate ${duplicates.length} utenz${duplicates.length === 1 ? 'a' : 'e'}${extraPages ? ` su ${extraPages + 1} pagine` : ''}.`);
}
function migrateLegacySocapex(project) {
  project.nodes = Array.isArray(project.nodes) ? project.nodes : [];
  project.links = Array.isArray(project.links) ? project.links : [];
  const legacy = (project.nodes || []).filter((node) => node.type === 'socapex');
  legacy.forEach((socapex) => {
    const incoming = project.links.find((link) => link.to === socapex.id), outgoing = project.links.filter((link) => link.from === socapex.id);
    if (incoming && outgoing.length) {
      const groupId = uid();
      outgoing.forEach((link, index) => project.links.push({ id: uid(), from: incoming.from, to: link.to, cable: 'socapex', length: incoming.length || 20, socapexGroup: groupId, labelX: index === 0 ? incoming.labelX : undefined, labelY: index === 0 ? incoming.labelY : undefined }));
    }
    project.links = project.links.filter((link) => link.from !== socapex.id && link.to !== socapex.id);
  });
  project.nodes = (project.nodes || []).filter((node) => node.type !== 'socapex');
}
function migrateSupplyReferences(project) {
  (project.nodes || []).filter((node) => node.type === 'supply').forEach((node) => { node.supplyKey ||= node.id; });
}
function migratePanelReferences(project) {
  (project.nodes || []).filter((node) => node.type === 'panel').forEach((node) => { node.panelKey ||= node.id; });
}
function migratePowerLockSupplyTypes(project) {
  (project.nodes || []).filter((node) => node.type === 'supply' && node.supplyType === 'powerlock').forEach((node) => { node.supplyType = 'powerlock250'; node.subtitle = cableById(node.supplyType).plug; });
  (project.links || []).filter((link) => link.cable === 'powerlock').forEach((link) => { const source = (project.nodes || []).find((node) => node.id === link.from); link.cable = source?.supplyType === 'powerlock400' ? 'powerlock400' : 'powerlock250'; });
}
function migrateProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('Il file non contiene un progetto valido.');
  migrateLegacySocapex(project);
  migrateSupplyReferences(project);
  migratePanelReferences(project);
  migratePowerLockSupplyTypes(project);
  project.version = Core.SCHEMA_VERSION;
  return project;
}
function applyLoadedProject(raw, options = {}) {
  const normalized = Core.normalizeProject(migrateProject(raw));
  state = { ...normalized, library: PANEL_LIBRARY, selected: null, selectedIds: [], selectedLink: null };
  syncMetaInputs(); resetHistory(); $('#welcome-dialog').close();
  savedProjectSnapshot = options.dirty ? null : JSON.stringify(serializableProject());
  dirty = Boolean(options.dirty);
  updateDirtyUi(); render();
  const issues = projectIssues();
  if (issues.length) showStatus(`Progetto aperto con ${issues.length} anomalie: ${issues[0].message}`);
  else showStatus(options.message || 'Progetto aperto correttamente.');
  flushAutosave();
}
function loadProjectText(text, options = {}) {
  try {
    applyLoadedProject(JSON.parse(text), options);
    return true;
  } catch (error) {
    showStatus(`Impossibile aprire il progetto: ${error.message}`);
    return false;
  }
}
function createNewProject() {
  if (dirty && !window.confirm('Creare un nuovo progetto? Salva prima il progetto corrente se vuoi conservarlo.')) return;
  const normalized = Core.normalizeProject({
    version: Core.SCHEMA_VERSION,
    meta: { name: '', location: '', type: 'Allestimento Luci', revision: '1.0', company: state.meta.company || 'ATS Srl', companyAddress: state.meta.companyAddress || '', companyVat: state.meta.companyVat || '' },
    pages: [1],
    nodes: [],
    links: [],
  });
  state = { ...normalized, library: PANEL_LIBRARY, selected: null, selectedIds: [], selectedLink: null };
  resetHistory(); savedProjectSnapshot = null; syncMetaInputs(); markChanged('Nuovo progetto creato.'); render(); $('#welcome-dialog').showModal();
}
function readAutosave() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    if (!stored?.project) return null;
    return { ...stored, project: Core.normalizeProject(migrateProject(stored.project)) };
  } catch {
    return null;
  }
}
function panelTypeCode(matricola) { return matricola.match(/^[A-Z]+\d+[A-Z]*/)?.[0] || matricola; }
function panelTypeLabel(code) { return ({ PB250A: 'Quadro 250 A', PB125A: 'Quadro 125 A', PB63A: 'Quadro 63 A', PB32AT: 'Quadro 32 A trifase', PB32AM: 'Quadro 32 A monofase' })[code] || code; }
function updatePanelMatricolaChoices() { const type = $('#panel-type').value, models = state.library.filter((model) => panelTypeCode(model.matricola) === type && !isPanelMatricolaUsed(model.matricola)); $('#panel-choice').innerHTML = models.length ? models.map((model) => `<option value="${model.matricola}">${model.matricola}</option>`).join('') : '<option value="">Nessuna matricola disponibile</option>'; updatePanelChoiceDetails(); }
function openPanelDialog() {
  const types = [...new Set(state.library.filter((model) => !isPanelMatricolaUsed(model.matricola)).map((model) => panelTypeCode(model.matricola)))];
  if (!types.length) return showStatus('La libreria standard quadri non è disponibile.');
  $('#panel-type').innerHTML = types.map((type) => `<option value="${type}">${panelTypeLabel(type)}</option>`).join(''); updatePanelMatricolaChoices(); $('#panel-dialog').showModal();
}
function updatePanelChoiceDetails() {
  const model = state.library.find((row) => row.matricola === $('#panel-choice').value), mode = $('#panel-mode'), modeRow = $('#panel-mode-row'), alternatives = model?.alternatives || [];
  modeRow.hidden = !alternatives.length; mode.innerHTML = `<option value="cee">Prese CEE</option>${alternatives.map((item) => `<option value="${item.id}">${item.label}</option>`).join('')}`;
  const ports = selectedPanelPorts(model || { ports: [] }); $('#panel-choice-details').textContent = `${cableById(model?.inputType).name} in ingresso · ${ports.map((port) => `${port.quantity}× ${cableById(port.type).name}`).join(', ')}`;
}
function updatePanelModeDetails() { const model = state.library.find((row) => row.matricola === $('#panel-choice').value); const ports = selectedPanelPorts(model || { ports: [] }); $('#panel-choice-details').textContent = `${cableById(model?.inputType).name} in ingresso · ${ports.map((port) => `${port.quantity}× ${cableById(port.type).name}`).join(', ')}`; }
function refreshLinkDialog() {
  const source = nodeById($('#link-from').value);
  const targets = pageNodes().filter((node) => {
    if (!source || node.id === source.id || !['panel', 'load'].includes(node.type)) return false;
    return !compatibilityWarning(source, node, null, requiredPlug(node));
  });
  const previousTarget = $('#link-to').value;
  $('#link-to').innerHTML = targets.map((node) => `<option value="${node.id}" ${node.id === previousTarget ? 'selected' : ''}>${esc(node.title)}</option>`).join('');
  const target = nodeById($('#link-to').value), required = requiredPlug(target);
  const allowed = target ? CABLES.filter((cable) => {
    if (cable.internal || cable.id === 'socapex') return false;
    if (!compatibleConnector(cable.id, required)) return false;
    if (source.type === 'supply') return compatibleConnector(source.supplyType, cable.id);
    return (source.ports || []).some((port) => compatibleConnector(port.type, required) && compatibleConnector(port.type, cable.id));
  }) : [];
  $('#link-cable').innerHTML = allowed.map((cable) => `<option value="${cable.id}">${cable.name}</option>`).join('');
  $('#confirm-link').disabled = !source || !target || !allowed.length;
}
function showLinkDialog() {
  const sources = pageNodes().filter((node) => ['supply', 'panel'].includes(node.type));
  if (!sources.length) return showStatus('Aggiungi prima una fornitura o un quadro.');
  $('#link-from').innerHTML = sources.map((node) => `<option value="${node.id}">${esc(node.title)}</option>`).join('');
  refreshLinkDialog();
  if (!$('#link-to').options.length) return showStatus('Non ci sono destinazioni compatibili e libere in questa pagina.');
  $('#link-dialog').showModal();
}
function save() {
  const issues = projectIssues();
  if (issues.length) return showStatus(`Salvataggio bloccato: ${issues[0].message}`);
  const blob = new Blob([JSON.stringify(serializableProject(), null, 2)], { type: 'application/json' }), filename = [state.meta.name || 'unifilare', state.meta.revision].filter(Boolean).join(' ').replace(/[^\w]+/g, '-').toLowerCase(), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${filename}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); markSaved(); showStatus('Progetto salvato.');
}
function coverMarkup() {
  const company = [state.meta.company, state.meta.companyAddress, state.meta.companyVat ? `P. IVA ${state.meta.companyVat}` : ''].filter(Boolean).join('\n');
  const rows = [['Nome Evento', state.meta.name || '—'], ['Location', state.meta.location || '—'], ['Descrizione Allestimento', state.meta.type || '—'], ['Versione', state.meta.revision || '—'], ['Ditta esecutrice', company || '—']];
  return `<article class="cover-sheet" data-print-page="1"><div class="cover-heading">Schema unifilare di distribuzione elettrica</div><div class="cover-grid">${rows.map(([label, value]) => `<div class="cover-row"><div class="cover-label">${esc(label)}</div><div class="cover-value ${label === 'Ditta esecutrice' ? 'cover-company' : ''}">${esc(value)}</div></div>`).join('')}</div></article>`;
}
function titleBlockMarkup(page, total) {
  return `<footer class="title-block"><div><small>Ditta esecutrice</small><strong>${esc(state.meta.company || '—')}</strong><span>${esc(state.meta.companyAddress || '—')}</span>${state.meta.companyVat ? `<span>P. IVA ${esc(state.meta.companyVat)}</span>` : ''}</div><div><small>Descrizione</small><strong>${esc(state.meta.type || '—')}</strong></div><div><small>Evento</small><strong>${esc(state.meta.name || '—')}</strong></div><div><small>Luogo</small><strong>${esc(state.meta.location || '—')}</strong></div><div><small>Versione</small><strong>${esc(state.meta.revision || '1.0')}</strong><small>Pagina ${page} di ${total}</small></div></footer>`;
}
function splitIntoPages(items, size) { return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)); }
function splitIndexEntries(entries, size = 5) {
  const pageGroups = [...new Map(entries.map((entry) => [entry.page, entries.filter((item) => item.page === entry.page)])).values()], result = []; let current = [];
  pageGroups.forEach((group) => {
    if (current.length && current.length + group.length > size) { result.push(current); current = []; }
    if (group.length > size) { if (current.length) { result.push(current); current = []; } result.push(...splitIntoPages(group, size)); }
    else current.push(...group);
  });
  if (current.length) result.push(current);
  return result;
}
function topologyNodeKey(node) {
  if (node?.type === 'supply') return `supply:${supplyKey(node)}`;
  if (node?.type === 'panel') return `panel:${panelKey(node)}`;
  return '';
}
function indexTopology(diagramPages) {
  const canonical = new Map([...uniqueSupplies(), ...uniquePanels()].map((node) => [topologyNodeKey(node), node])), physicalLinks = state.links.filter((link) => !isReferenceLink(link)).map((link) => ({ link, from: nodeById(link.from), to: nodeById(link.to) })).filter(({ from, to }) => ['supply', 'panel'].includes(from?.type) && to?.type === 'panel'), parentByKey = new Map(), linkByPair = new Map(), childKeys = new Set(), physicalIds = new Set();
  physicalLinks.forEach(({ link, from, to }) => { const fromKey = topologyNodeKey(from), toKey = topologyNodeKey(to); canonical.set(fromKey, from); canonical.set(toKey, to); parentByKey.set(toKey, fromKey); linkByPair.set(`${fromKey}→${toKey}`, link); childKeys.add(fromKey); physicalIds.add(from.id); physicalIds.add(to.id); });
  const pathFor = (key) => {
    const path = [], visited = new Set(); let current = key;
    while (current && !visited.has(current)) { visited.add(current); path.unshift(current); current = parentByKey.get(current); }
    return path;
  };
  let entries = [];
  uniquePanels().forEach((panel) => {
    const key = topologyNodeKey(panel), instances = panelGroup(panel).sort((first, second) => first.page - second.page), physical = instances.find((node) => physicalIds.has(node.id)) || instances[0], referencePages = [...new Set(instances.filter((node) => node.id !== physical.id).map((node) => node.page))], isMainDistributionPanel = canonical.get(parentByKey.get(key))?.type === 'supply' && childKeys.has(key), destinationPages = isMainDistributionPanel ? [] : referencePages.length ? referencePages : [physical.page];
    destinationPages.filter((page) => diagramPages.includes(page)).forEach((page) => entries.push({ panelKey: key, page, path: pathFor(key) }));
  });
  if (!entries.length) {
    diagramPages.forEach((page) => {
      const pagePanels = state.nodes.filter((node) => node.page === page && node.type === 'panel'), leaves = pagePanels.filter((node) => !childKeys.has(topologyNodeKey(node))), candidates = leaves.length ? leaves : pagePanels.slice(-1);
      candidates.forEach((panel) => { const key = topologyNodeKey(panel); entries.push({ panelKey: key, page, path: pathFor(key) }); });
    });
  }
  entries = entries.filter((entry, index, list) => entry.path.length && list.findIndex((item) => item.panelKey === entry.panelKey && item.page === entry.page) === index).sort((first, second) => first.page - second.page || (canonical.get(first.panelKey)?.title || '').localeCompare(canonical.get(second.panelKey)?.title || '', 'it', { numeric: true }));
  const roots = new Map();
  entries.forEach((entry) => { const root = entry.path[0]; if (!roots.has(root)) roots.set(root, []); roots.get(root).push(entry); });
  const groups = [...roots.entries()].flatMap(([rootKey, rootEntries]) => splitIndexEntries(rootEntries).map((items) => ({ rootKey, entries: items })));
  return { canonical, parentByKey, linkByPair, groups };
}
function indexNodeLines(node) {
  if (!node) return [];
  const values = node.type === 'supply' ? [node.title, node.subtitle || node.details] : [node.title, node.socket ? `Presa ${node.socket}` : node.subtitle, node.socket ? node.subtitle : node.details, node.socket ? node.details : ''];
  return values.filter(Boolean).flatMap((value) => wrapText(value, node.type === 'supply' ? 22 : 25));
}
function indexMarkup(group, topology, indexPage, total, diagramOffset, indexTotal, diagramPages) {
  const entries = group.entries, count = entries.length, startY = count === 1 ? 365 : 125, step = count === 1 ? 0 : Math.min(135, 540 / (count - 1)), rowByEntry = new Map(entries.map((entry, index) => [entry, startY + index * step])), usedKeys = [...new Set(entries.flatMap((entry) => entry.path))], maxDepth = Math.max(1, ...entries.map((entry) => entry.path.length - 1)), commonPrefix = entries[0].path.filter((key, index) => entries.every((entry) => entry.path[index] === key)), supplyAndMain = commonPrefix.length >= 2 && topology.canonical.get(commonPrefix[0])?.type === 'supply' && topology.canonical.get(commonPrefix[1])?.type === 'panel', centers = new Map();
  usedKeys.forEach((key) => {
    const matchingEntries = entries.filter((entry) => entry.path.includes(key)), ownRows = entries.filter((entry) => entry.panelKey === key).map((entry) => rowByEntry.get(entry)), rows = ownRows.length ? ownRows : matchingEntries.map((entry) => rowByEntry.get(entry)), depth = Math.max(...matchingEntries.map((entry) => entry.path.indexOf(key))), averageY = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    if (supplyAndMain && key === commonPrefix[0]) centers.set(key, { x: 120, y: 120 });
    else if (supplyAndMain && key === commonPrefix[1]) centers.set(key, { x: 120, y: 390 });
    else if (supplyAndMain) centers.set(key, { x: ownRows.length ? 710 : 530 + Math.max(0, depth - 2) * 90, y: averageY });
    else centers.set(key, { x: 120 + (depth * 650) / maxDepth, y: averageY });
  });
  const dimensions = new Map(usedKeys.map((key) => { const node = topology.canonical.get(key), lines = indexNodeLines(node); return [key, { width: node?.type === 'supply' ? 170 : 190, height: Math.max(62, lines.length * 17 + 18), lines }]; }));
  const edges = new Map();
  entries.forEach((entry) => entry.path.slice(1).forEach((key, index) => edges.set(`${entry.path[index]}→${key}`, [entry.path[index], key])));
  const edgeParts = [...edges.entries()].map(([pair, [fromKey, toKey]]) => {
    const from = centers.get(fromKey), to = centers.get(toKey), fromSize = dimensions.get(fromKey), toSize = dimensions.get(toKey), vertical = Math.abs(from.x - to.x) < 5, middleX = (from.x + fromSize.width / 2 + to.x - toSize.width / 2) / 2, path = vertical ? `M${from.x},${from.y + fromSize.height / 2} V${to.y - toSize.height / 2}` : `M${from.x + fromSize.width / 2},${from.y} H${middleX} V${to.y} H${to.x - toSize.width / 2}`, link = topology.linkByPair.get(pair), lines = link ? linkLabel(link).flatMap((line) => wrapText(line, 27)) : [], labelX = vertical && from.x > 400 ? from.x - fromSize.width / 2 - 235 : vertical ? from.x + fromSize.width / 2 + 18 : from.x + fromSize.width / 2 + 25, labelY = vertical ? (from.y + fromSize.height / 2 + to.y - toSize.height / 2) / 2 - ((lines.length - 1) * 16) / 2 : to.y - Math.max(36, lines.length * 16 + 8);
    return { path: `<path class="index-connector" marker-end="url(#index-arrow-${indexPage})" d="${path}"/>`, label: lines.map((line, lineIndex) => `<text class="index-edge-label" x="${labelX}" y="${labelY + lineIndex * 16}">${esc(line)}</text>`).join('') };
  });
  const edgeMarkup = edgeParts.map((part) => part.path).join(''), edgeLabelMarkup = edgeParts.map((part) => part.label).join('');
  const nodeMarkup = usedKeys.map((key) => {
    const node = topology.canonical.get(key), center = centers.get(key), size = dimensions.get(key), textStart = center.y - ((size.lines.length - 1) * 17) / 2 + 5;
    return `<rect class="index-node" x="${center.x - size.width / 2}" y="${center.y - size.height / 2}" width="${size.width}" height="${size.height}"/>${size.lines.map((line, lineIndex) => `<text class="index-node-text ${lineIndex === 0 ? 'index-node-title' : ''}" x="${center.x}" y="${textStart + lineIndex * 17}">${esc(line)}</text>`).join('')}`;
  }).join('');
  const pageX = 1080, pageWidth = 130, pages = [...new Map(entries.map((entry) => [entry.page, entries.filter((item) => item.page === entry.page)])).entries()], pageMarkup = pages.map(([page, pageEntries]) => {
    const yValues = pageEntries.map((entry) => rowByEntry.get(entry)), y = yValues.reduce((sum, value) => sum + value, 0) / yValues.length, mergeX = 950, diagramIndex = diagramPages.indexOf(page), printedPage = diagramOffset + diagramIndex + 1, lines = pageEntries.map((entry) => { const center = centers.get(entry.panelKey), size = dimensions.get(entry.panelKey); return `<path class="index-page-branch" d="M${center.x + size.width / 2},${center.y} H${mergeX} V${y}"/>`; }).join('');
    return `${lines}<path class="index-connector" marker-end="url(#index-arrow-${indexPage})" d="M${mergeX},${y} H${pageX - pageWidth / 2}"/><rect class="index-page-box" x="${pageX - pageWidth / 2}" y="${y - 30}" width="${pageWidth}" height="60"/><text class="index-page-text" x="${pageX}" y="${y + 5}">Pagina ${printedPage}</text>`;
  }).join('');
  return `<article class="drawing-sheet index-sheet" data-print-page="${indexPage}"><div class="drawing-title">Schema unifilare di distribuzione elettrica</div><svg class="index-diagram" viewBox="0 0 1200 780" aria-label="Indice schemi"><defs><marker id="index-arrow-${indexPage}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#1c1c1c"/></marker></defs>${edgeMarkup}${pageMarkup}${nodeMarkup}${edgeLabelMarkup}</svg>${titleBlockMarkup(indexPage, total)}</article>`;
}
async function preparePrint() {
  const issues = projectIssues();
  if (issues.length) return showStatus(`Esportazione bloccata: ${issues[0].message}`);
  const currentPage = state.currentPage, printPages = $('#print-pages'), candidatePages = [...new Set([...(state.pages || []), ...state.nodes.map((node) => node.page)])].sort((first, second) => first - second), diagramPages = candidatePages.filter((page) => state.nodes.some((node) => node.page === page)), exportedPages = diagramPages.length ? diagramPages : [1], hasIndex = exportedPages.length > 1, topology = indexTopology(exportedPages), indexGroups = hasIndex ? topology.groups : [], pageOffset = 1 + indexGroups.length, totalPages = exportedPages.length + pageOffset, previousTitle = document.title; printPages.innerHTML = coverMarkup() + indexGroups.map((group, index) => indexMarkup(group, topology, index + 2, totalPages, pageOffset, indexGroups.length, exportedPages)).join('');
  printPageNumbers = new Map(exportedPages.map((page, index) => [page, index + pageOffset + 1]));
  exportedPages.forEach((page, index) => { const printPage = index + pageOffset + 1; state.currentPage = page; render(); const sheet = $('#drawing-sheet').cloneNode(true); sheet.removeAttribute('id'); sheet.classList.add('print-sheet'); sheet.dataset.sourcePage = page; sheet.dataset.printPage = printPage; sheet.querySelector('#block-page').textContent = `Pagina ${printPage} di ${totalPages}`; printPages.append(sheet); });
  printPageNumbers = null; state.currentPage = currentPage; render();
  const renderedPages = [...printPages.children].map((sheet) => Number(sheet.dataset.printPage)), expectedPages = Array.from({ length: totalPages }, (_, index) => index + 1);
  if (renderedPages.length !== totalPages || renderedPages.some((page, index) => page !== expectedPages[index])) { showStatus(`Export interrotto: preparate ${renderedPages.length} pagine su ${totalPages}. Riprova dopo aver salvato e riaperto il progetto.`); return; }
  document.title = `Unifilare ${state.meta.name || 'Progetto'} ${state.meta.revision || ''}`.trim(); document.body.classList.add('preparing-print');
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.addEventListener('afterprint', () => { document.title = previousTitle; document.body.classList.remove('preparing-print'); showStatus(`PDF preparato: ${totalPages} pagine totali, di cui ${exportedPages.length} schemi.`); }, { once: true });
  window.print();
}
function svgPoint(event) { const svg = $('#diagram'), point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform(svg.getScreenCTM().inverse()); }
function snapToAlignmentGuides(node, references) {
  const threshold = 12, closest = (value, axis) => references.map((item) => item[axis]).sort((first, second) => Math.abs(first - value) - Math.abs(second - value))[0];
  const guideX = closest(node.x, 'x'), guideY = closest(node.y, 'y');
  if (guideX !== undefined && Math.abs(guideX - node.x) <= threshold) { node.x = guideX; alignmentGuides.push({ axis: 'x', value: guideX }); }
  if (guideY !== undefined && Math.abs(guideY - node.y) <= threshold) { node.y = guideY; alignmentGuides.push({ axis: 'y', value: guideY }); }
}
function bindDiagram() {
  $('#diagram').addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.link-handle'); const labelGroup = event.target.closest('.link-label'); const linkGroup = event.target.closest('.link'); const nodeGroup = event.target.closest('.node');
    if (handle) {
      event.stopPropagation(); const source = handle.dataset.source, svg = $('#diagram'), from = nodeById(source), draft = document.createElementNS('http://www.w3.org/2000/svg', 'path'); draft.setAttribute('class', 'connector'); draft.setAttribute('id', 'link-draft'); draft.setAttribute('d', `M${from.x + NODE_HALF},${from.y} L${from.x + NODE_HALF},${from.y}`); svg.append(draft);
      const move = (next) => { const point = svgPoint(next); draft.setAttribute('d', `M${from.x + NODE_HALF},${from.y} L${point.x},${point.y}`); };
      const stop = (next) => { draft.remove(); const target = document.elementFromPoint(next.clientX, next.clientY)?.closest('.node')?.dataset.id; if (target && target !== source && !state.links.some((link) => link.from === source && link.to === target)) tryAddLink(source, target, requiredPlug(nodeById(target)) || (from.type === 'supply' ? from.supplyType : 'cee16mono'), 20); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); render(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); return;
    }
    if (labelGroup) {
      const link = linkById(labelGroup.dataset.linkId), from = nodeById(link.from), to = nodeById(link.to), current = linkLabelPosition(link, from, to), start = svgPoint(event), offset = { x: start.x - current.x, y: start.y - current.y };
      let moved = false; checkpoint('move-link-label');
      state.selectedLink = link.id; state.selected = null; state.selectedIds = [];
      const move = (next) => { moved = true; const point = svgPoint(next); link.labelX = Math.max(10, Math.min(875, point.x - offset.x)); link.labelY = Math.max(22, Math.min(720, point.y - offset.y)); render(); };
      const stop = () => { if (moved) markChanged(); else dropNoopHistory(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); render(); return;
    }
    if (linkGroup) { state.selectedLink = linkGroup.dataset.linkId; state.selected = null; state.selectedIds = []; render(); return; }
    if (!nodeGroup) {
      const svg = $('#diagram'), start = svgPoint(event), box = document.createElementNS('http://www.w3.org/2000/svg', 'rect'), additive = event.shiftKey || event.metaKey || event.ctrlKey;
      box.setAttribute('class', 'selection-box'); svg.append(box);
      const move = (next) => { const point = svgPoint(next), x = Math.min(start.x, point.x), y = Math.min(start.y, point.y); box.setAttribute('x', x); box.setAttribute('y', y); box.setAttribute('width', Math.abs(point.x - start.x)); box.setAttribute('height', Math.abs(point.y - start.y)); };
      const stop = (next) => { const point = svgPoint(next), minX = Math.min(start.x, point.x), maxX = Math.max(start.x, point.x), minY = Math.min(start.y, point.y), maxY = Math.max(start.y, point.y), inside = pageNodes().filter((item) => item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY).map((item) => item.id); box.remove(); state.selectedIds = additive ? [...new Set([...state.selectedIds, ...inside])] : inside; state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); render(); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); return;
    }
    const nodeId = nodeGroup.dataset.id, additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (additive) { selectNode(nodeId, true); render(); return; }
    if (!state.selectedIds.includes(nodeId)) selectNode(nodeId); else { state.selected = nodeId; state.selectedLink = null; }
    const node = nodeById(nodeId), start = svgPoint(event), positions = selectedNodes().map((item) => ({ node: item, x: item.x, y: item.y })), references = pageNodes().filter((item) => !state.selectedIds.includes(item.id)); let moved = false; checkpoint('move-nodes');
    const move = (next) => { moved = true; const point = svgPoint(next), dx = point.x - start.x, dy = point.y - start.y; alignmentGuides = []; positions.forEach(({ node: item, x, y }) => { item.x = Math.max(85, Math.min(1115, x + dx)); item.y = Math.max(55, Math.min(700, y + dy)); snapToAlignmentGuides(item, references); }); alignmentGuides = alignmentGuides.filter((guide, index, guides) => guides.findIndex((item) => item.axis === guide.axis && item.value === guide.value) === index); render(); };
    const stop = () => { if (moved) markChanged(); else dropNoopHistory(); alignmentGuides = []; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); render(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); render();
  });
  $('#diagram').addEventListener('keydown', (event) => {
    const nodeGroup = event.target.closest('.node'), linkGroup = event.target.closest('.link');
    if (['Enter', ' '].includes(event.key) && (nodeGroup || linkGroup)) {
      event.preventDefault();
      if (nodeGroup) selectNode(nodeGroup.dataset.id);
      else { state.selectedLink = linkGroup.dataset.linkId; state.selected = null; state.selectedIds = []; }
      render();
    }
    if (['Delete', 'Backspace'].includes(event.key) && (nodeGroup || linkGroup)) {
      event.preventDefault(); deleteSelection();
    }
  });
}
function deleteSelection() {
  const selectedLink = linkById(state.selectedLink);
  const deletedIds = state.selected ? (state.selectedIds.length > 1 ? state.selectedIds : [state.selected]) : [];
  const connected = deletedIds.some((id) => state.links.some((link) => link.from === id || link.to === id));
  if ((selectedLink || deletedIds.length) && (connected || deletedIds.length > 1) && !window.confirm(`Eliminare ${selectedLink ? 'il collegamento selezionato' : `${deletedIds.length} elementi selezionati`}? L’operazione può essere annullata.`)) return;
  if (!selectedLink && !deletedIds.length) return;
  checkpoint('delete');
  if (selectedLink) {
    const links = selectedLink.socapexGroup ? state.links.filter((item) => item.socapexGroup === selectedLink.socapexGroup) : [selectedLink];
    links.forEach((link) => { const target = nodeById(link.to); if (target && !isReferenceLink(link)) target.socket = ''; });
    const linkIds = new Set(links.map((link) => link.id)); state.links = state.links.filter((item) => !linkIds.has(item.id)); state.selectedLink = null;
  } else {
    state.links = state.links.filter((link) => !deletedIds.includes(link.from) && !deletedIds.includes(link.to));
    state.nodes = state.nodes.filter((node) => !deletedIds.includes(node.id)); state.selected = null; state.selectedIds = [];
  }
  markChanged('Elemento eliminato.'); render();
}
function removeCurrentPage() {
  const pages = sortedPages();
  if (pages.length <= 1) return;
  const nodes = pageNodes();
  if (nodes.length && !window.confirm(`Eliminare pagina ${state.currentPage} e i suoi ${nodes.length} elementi? L’operazione può essere annullata.`)) return;
  checkpoint('delete-page');
  const removedPage = state.currentPage, removedIds = new Set(nodes.map((node) => node.id));
  state.links = state.links.filter((link) => !removedIds.has(link.from) && !removedIds.has(link.to));
  state.nodes = state.nodes.filter((node) => node.page !== removedPage);
  state.nodes.forEach((node) => { if (node.page > removedPage) node.page--; });
  state.pages = pages.filter((page) => page !== removedPage).map((page) => page > removedPage ? page - 1 : page);
  state.currentPage = Math.max(1, Math.min(removedPage, pagesCount()));
  state.selected = null; state.selectedIds = []; state.selectedLink = null; markChanged(`Pagina ${removedPage} eliminata.`); render();
}
function togglePanel(element, button, open) {
  element.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
}
function bind() {
  ['event-name', 'event-location', 'event-type', 'event-version'].forEach((id) => {
    const key = { 'event-name': 'name', 'event-location': 'location', 'event-type': 'type', 'event-version': 'revision' }[id];
    $(`#${id}`).addEventListener('input', (event) => { checkpoint(`meta-${key}`); state.meta[key] = event.target.value; markChanged(); render(); });
  });
  $('#edit-company').onclick = () => { $('#company-name').value = state.meta.company || ''; $('#company-address').value = state.meta.companyAddress || ''; $('#company-vat').value = state.meta.companyVat || ''; $('#company-dialog').showModal(); };
  $('#confirm-company').onclick = (event) => { event.preventDefault(); checkpoint('edit-company'); state.meta.company = $('#company-name').value.trim(); state.meta.companyAddress = $('#company-address').value.trim(); state.meta.companyVat = $('#company-vat').value.trim(); $('#company-dialog').close(); markChanged(); render(); };

  $('#add-supply').onclick = () => addNode('supply');
  $('#reuse-supply').onclick = openSupplyReferenceDialog;
  $('#confirm-supply-reference').onclick = (event) => { event.preventDefault(); addSupplyReference(); };
  $('#add-panel').onclick = openPanelDialog;
  $('#reuse-panel').onclick = openPanelReferenceDialog;
  $('#confirm-panel-reference').onclick = (event) => { event.preventDefault(); addPanelReference(); };
  $('#reuse-link').onclick = openLinkReferenceDialog;
  $('#confirm-link-reference').onclick = (event) => { event.preventDefault(); addLinkReference(); };
  $('#add-temp-panel').onclick = openTemporaryPanelDialog;
  $('#group-socapex').onclick = openSocapexDialog;
  $('#add-load').onclick = () => addNode('load');
  $('#add-bulk-loads').onclick = openBulkLoadDialog;
  $('#confirm-bulk-loads').onclick = (event) => { event.preventDefault(); addBulkLoads(); };
  $('#add-link').onclick = showLinkDialog;
  $('#connect-selected').onclick = openBulkConnectDialog;
  $('#arrange-selected').onclick = openArrangeDialog;
  $('#align-selected').onclick = openAlignDialog;
  $('#confirm-align').onclick = (event) => { event.preventDefault(); alignSelectedNodes(); };
  $('#panel-type').onchange = updatePanelMatricolaChoices;
  $('#panel-choice').onchange = updatePanelChoiceDetails;
  $('#panel-mode').onchange = updatePanelModeDetails;
  $('#confirm-panel').onclick = (event) => { event.preventDefault(); addPanelFromLibrary($('#panel-choice').value); };

  $('#add-temporary-port').onclick = () => { temporaryPorts.push({ type: 'cee16mono', quantity: 1 }); renderTemporaryPorts(); };
  $('#temporary-panel-ports').addEventListener('input', (event) => { const typeIndex = event.target.dataset.portType, quantityIndex = event.target.dataset.portQuantity; if (typeIndex !== undefined) temporaryPorts[Number(typeIndex)].type = event.target.value; if (quantityIndex !== undefined) temporaryPorts[Number(quantityIndex)].quantity = Math.max(1, Number(event.target.value) || 1); });
  $('#temporary-panel-ports').addEventListener('click', (event) => { const removeIndex = event.target.dataset.removePort; if (removeIndex !== undefined) { temporaryPorts.splice(Number(removeIndex), 1); renderTemporaryPorts(); } });
  $('#confirm-temporary-panel').onclick = (event) => { event.preventDefault(); addTemporaryPanel(); };
  $('#confirm-socapex').onclick = (event) => { event.preventDefault(); createSocapexGroup(); };
  $('#confirm-bulk-connect').onclick = (event) => { event.preventDefault(); createBulkConnections(); };
  $('#arrange-mode').onchange = () => { $('#arrange-reference-row').hidden = $('#arrange-mode').value !== 'relative'; };
  $('#confirm-arrange').onclick = (event) => { event.preventDefault(); arrangeSelectedNodes(); };
  $('#socapex-select-all').onclick = () => document.querySelectorAll('[data-socapex-load]').forEach((input) => { input.checked = true; });
  $('#socapex-select-none').onclick = () => document.querySelectorAll('[data-socapex-load]').forEach((input) => { input.checked = false; });
  $('#socapex-prefix-actions').onclick = (event) => { const prefix = event.target.dataset.socapexPrefix; if (!prefix) return; document.querySelectorAll('[data-socapex-load]').forEach((input) => { input.checked = circuitPrefix(nodeById(input.dataset.socapexLoad)?.title) === prefix; }); };
  $('#bulk-connect-select-all').onclick = () => document.querySelectorAll('[data-bulk-connect-load]').forEach((input) => { input.checked = true; });
  $('#bulk-connect-select-none').onclick = () => document.querySelectorAll('[data-bulk-connect-load]').forEach((input) => { input.checked = false; });

  const goToPage = (page) => { state.currentPage = page; state.selected = null; state.selectedIds = []; state.selectedLink = null; render(); };
  $('#previous-page').onclick = () => { const pages = sortedPages(), index = pages.indexOf(state.currentPage); if (index > 0) goToPage(pages[index - 1]); };
  $('#next-page').onclick = () => { const pages = sortedPages(), index = pages.indexOf(state.currentPage); if (index >= 0 && index < pages.length - 1) goToPage(pages[index + 1]); };
  $('#page-select').onchange = (event) => goToPage(Number(event.target.value));
  $('#new-page').onclick = () => { checkpoint('new-page'); const page = pagesCount() + 1; state.pages.push(page); state.currentPage = page; state.selected = null; state.selectedIds = []; state.selectedLink = null; markChanged(`Pagina ${page} creata.`); render(); };
  $('#delete-page').onclick = removeCurrentPage;

  $('#property-form').addEventListener('input', (event) => {
    const node = nodeById(state.selected), name = event.target.name;
    if (!node || !name || ['socket', 'manualSocket'].includes(name)) return;
    const pages = sortedPages(), value = ['page', 'watts'].includes(name) ? Number(event.target.value) : event.target.value;
    if (name === 'page' && !pages.includes(value)) { event.target.value = node.page; return showStatus('Scegli una pagina esistente.'); }
    checkpoint(`property-${node.id}-${name}`);
    const sharedFields = ['title', 'subtitle', 'details', 'note'];
    const sharedNodes = node.type === 'supply' && [...sharedFields, 'supplyType'].includes(name) ? supplyGroup(node) : node.type === 'panel' && sharedFields.includes(name) ? panelGroup(node) : [node];
    const before = sharedNodes.map((item) => ({ item, value: item[name], subtitle: item.subtitle, details: item.details }));
    sharedNodes.forEach((item) => { item[name] = value; if (name === 'supplyType') item.subtitle = cableById(item.supplyType).plug; });
    if (name === 'watts') node.details = `Assorbimento ${(node.watts / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW`;
    if (name === 'plugType') node.subtitle = cableById(node.plugType).plug;
    if (['supplyType', 'plugType'].includes(name)) {
      const affected = new Set(sharedNodes.map((item) => item.id));
      const issue = projectIssues().find((item) => { const link = linkById(item.linkId); return !link || affected.has(link.from) || affected.has(link.to); });
      if (issue) {
        before.forEach((entry) => { entry.item[name] = entry.value; entry.item.subtitle = entry.subtitle; entry.item.details = entry.details; });
        dropNoopHistory(); showStatus(`Modifica annullata: ${issue.message}`); render(); return;
      }
    }
    if (name === 'page') state.currentPage = value;
    markChanged();
    if (['page', 'supplyType', 'plugType'].includes(name)) render();
  });
  $('#property-form').addEventListener('change', (event) => {
    const link = linkById(state.selectedLink), node = nodeById(state.selected), name = event.target.name;
    if (link) {
      const before = { ...link }, oldTarget = nodeById(link.to), oldSocket = oldTarget?.socket || '', changesEndpoint = ['from', 'to'].includes(name);
      checkpoint(`link-${link.id}-${name}`);
      if (changesEndpoint && oldTarget && !isReferenceLink(link)) oldTarget.socket = '';
      link[name] = name === 'length' ? Math.max(0, Number(event.target.value) || 0) : event.target.value;
      const newTarget = nodeById(link.to), newTargetSocket = newTarget?.socket || '';
      const warning = isReferenceLink(link) ? '' : compatibilityWarning(nodeById(link.from), newTarget, link.id, link.cable);
      if (warning || (!isReferenceLink(link) && changesEndpoint && !assignFirstFreeSocket(nodeById(link.from), newTarget))) {
        Object.assign(link, before); if (oldTarget) oldTarget.socket = oldSocket; if (newTarget && newTarget !== oldTarget) newTarget.socket = newTargetSocket;
        dropNoopHistory(); showStatus(warning || 'Modifica del collegamento non valida.'); render(); return;
      }
      markChanged(); showStatus('Collegamento aggiornato.'); render(); return;
    }
    if (node && ['socket', 'manualSocket'].includes(name)) {
      const incoming = state.links.find((item) => item.to === node.id), source = incoming && nodeById(incoming.from), proposed = event.target.value.trim().toUpperCase(), warning = socketWarning(source, node, proposed, incoming?.id);
      if (warning) { showStatus(warning); render(); return; }
      checkpoint(`socket-${node.id}`); node.socket = proposed; markChanged(); showStatus('Presa aggiornata.'); render(); return;
    }
    if (node) { markChanged(); render(); }
  });
  $('#property-form').addEventListener('click', (event) => {
    if (event.target.id === 'edit-temporary-panel') { const node = nodeById(state.selected); if (node) openTemporaryPanelDialog(node); }
    if (event.target.id === 'duplicate-load') duplicateSelectedLoads();
    if (event.target.id === 'unlink-selected') {
      checkpoint('unlink');
      state.links.filter((link) => link.to === state.selected).forEach((link) => { const target = nodeById(link.to); if (target) target.socket = ''; });
      state.links = state.links.filter((link) => link.to !== state.selected); markChanged('Elemento scollegato.'); render();
    }
  });
  $('#delete-selected').onclick = deleteSelection;

  const importCaptureFile = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try { prepareCaptureImport(await file.text()); }
    catch (error) { showStatus(`Importazione non riuscita: ${error.message}`); }
    finally { event.target.value = ''; }
  };
  $('#capture-file').addEventListener('change', importCaptureFile);
  $('#welcome-capture-file').addEventListener('change', importCaptureFile);
  $('#welcome-add-supply').onclick = () => { $('#welcome-dialog').close(); addNode('supply'); };
  $('#capture-parent').onchange = updateCaptureSocapexAvailability;
  $('#confirm-capture-import').onclick = (event) => { event.preventDefault(); importSelectedCaptureGroups(); };
  $('#capture-select-all').onclick = () => document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = true; });
  $('#capture-select-none').onclick = () => document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = false; });
  $('#capture-prefix-actions').onclick = (event) => { const prefix = event.target.dataset.capturePrefix; if (!prefix) return; document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = circuitPrefix(pendingCaptureGroups[Number(input.dataset.captureIndex)].circuit) === prefix; }); };

  $('#link-from').onchange = refreshLinkDialog;
  $('#link-to').onchange = refreshLinkDialog;
  $('#confirm-link').onclick = (event) => { event.preventDefault(); const from = $('#link-from').value, to = $('#link-to').value; if (tryAddLink(from, to, $('#link-cable').value, Number($('#link-length').value) || 0)) $('#link-dialog').close(); render(); };
  $('#new-project').onclick = createNewProject;
  $('#save-project').onclick = save;
  $('#print-project').onclick = preparePrint;
  $('#open-project').addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (dirty && !window.confirm('Aprire un altro progetto? Le modifiche correnti restano disponibili nel salvataggio automatico.')) { event.target.value = ''; return; }
    loadProjectText(await file.text());
    event.target.value = '';
  });
  $('#undo-action').onclick = undo;
  $('#redo-action').onclick = redo;
  $('#restore-autosave').onclick = () => { const autosave = readAutosave(); if (autosave) applyLoadedProject(autosave.project, { dirty: true, message: 'Lavoro automatico ripristinato.' }); };

  const sidebar = $('.sidebar'), inspector = $('#inspector');
  $('#toggle-sidebar').onclick = () => togglePanel(sidebar, $('#toggle-sidebar'), !sidebar.classList.contains('open'));
  $('#toggle-inspector').onclick = () => togglePanel(inspector, $('#toggle-inspector'), !inspector.classList.contains('open'));
  document.addEventListener('keydown', (event) => {
    const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable;
    if (editable) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if (['Delete', 'Backspace'].includes(event.key) && (state.selected || state.selectedLink)) { event.preventDefault(); deleteSelection(); }
  });
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  bindDiagram();
}
renderCatalog(); bind(); syncMetaInputs(); savedProjectSnapshot = JSON.stringify(serializableProject()); render();
const availableAutosave = readAutosave(); $('#restore-autosave').hidden = !availableAutosave; if (availableAutosave?.savedAt) $('#restore-autosave').textContent = `Ripristina lavoro automatico (${new Date(availableAutosave.savedAt).toLocaleString('it-IT')})`;
$('#welcome-dialog').showModal();
