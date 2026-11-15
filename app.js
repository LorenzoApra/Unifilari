'use strict';

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
const CABLE_INDEX = new Map(CABLES.map((cable) => [cable.id, cable]));
const LINE_CABLES = CABLES.filter((cable) => cable.id !== 'socapex' && !cable.internal);
const LOAD_PLUGS = LINE_CABLES.filter((cable) => !cable.supplyOnly);
const PANEL_PORTS = CABLES.filter((cable) => cable.id !== 'socapex' && !cable.supplyOnly);
const CABLE_SECTION_GROUPS = {
  mono: ['cee16mono', 'cee32mono'],
  tri: ['cee16tri', 'cee32tri', 'cee63tri', 'cee125tri'],
  powerlock: ['powerlock250', 'powerlock400'],
  socapex: ['socapex'],
};
// Libreria standard derivata da Quadri.xlsx: viene gestita nel codice dell'app, non nell'interfaccia utente.
const portList = (...items) => items.map(([type, quantity]) => ({ type, quantity }));
const panelModels = (prefix, numbers, inputType, ports) => numbers.map((number) => ({ matricola: `${prefix}#${number}`, inputType, ports }));
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
const uid = () => Core.createId();
const NODE_HALF = 100;
const AUTOSAVE_KEY = 'unifilari.autosave.v6';
const COMPANY_BOOK_KEY = 'unifilari.companies.v1';
const HISTORY_LIMIT = 80;
const MAX_LOADS_PER_PAGE = 18;
let state = { version: Core.SCHEMA_VERSION, meta: { name: '', location: '', locationStreet: '', locationPostcode: '', locationCity: '', locationProvince: '', type: 'Allestimento Luci', revision: '1.0', company: '', companyAddress: '', companyVat: '' }, pages: [1], currentPage: 1, selected: null, selectedIds: [], selectedLink: null, nodes: [], links: [] };
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
let recoverableAutosave = null;
let renderFrame = null;
let projectDialogMode = 'edit';
let phaseSupplyFilter = '';
let projectLocationResults = [];
let projectLocationController = null;
const projectLocationCache = new Map();
let companyBook = [];
let canvasViewport = null;

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
  state = { ...normalized, selected: null, selectedIds: [], selectedLink: null };
  fillProjectForm(state.meta);
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
  if (saveState) saveState.textContent = dirty ? 'Modifiche non salvate' : state.meta.name ? 'Salvato' : 'Nessuna modifica';
  if ($('#undo-action')) $('#undo-action').disabled = historyPast.length === 0;
  if ($('#redo-action')) $('#redo-action').disabled = historyFuture.length === 0;
}
function flushAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), project: serializableProject() }));
  } catch {
    showStatus('Salvataggio automatico non disponibile in questo browser.', 'warning');
  }
}
function offerAutosaveRecovery() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    if (!saved?.project) return;
    const project = Core.normalizeProject(saved.project);
    recoverableAutosave = project;
    const date = new Date(saved.savedAt);
    const when = Number.isFinite(date.getTime()) ? ` · ${date.toLocaleString('it-IT')}` : '';
    $('#autosave-description').textContent = `${project.meta.name || 'Progetto senza nome'}${when}`;
    $('#autosave-recovery').hidden = false;
  } catch {
    showStatus('Nessun autosalvataggio leggibile disponibile. Puoi aprire un file progetto.', 'warning');
  }
}
function flushPendingAutosave() {
  if (autosaveTimer !== null) flushAutosave();
}
function markChanged(message = '') {
  dirty = JSON.stringify(serializableProject()) !== savedProjectSnapshot;
  updateDirtyUi();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(flushAutosave, 350);
  if (message) showStatus(message, 'success');
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
function projectIssues() {
  return Core.validateProject(state, { cableName: (id) => cableById(id).name });
}

function pageLabel(page) { return state.pageNames?.[page] ? `Pagina ${page} · ${state.pageNames[page]}` : `Pagina ${page}`; }
function goToPage(page) {
  if (!sortedPages().includes(page)) return;
  state.currentPage = page; state.selected = null; state.selectedIds = []; state.selectedLink = null;
  render(); canvasViewport?.resetScroll();
}
function diagramSelectionElement() {
  if (state.selected) return $(`#diagram .node[data-id="${state.selected}"]`);
  const link = linkById(state.selectedLink), master = link?.socapexGroup ? socapexGroupLinks(link)[0] : link;
  return master ? $(`#diagram > .link[data-link-id="${master.id}"]`) : null;
}
function renderWorkflowGuide() {
  const nodes = pageNodes(), empty = !nodes.length;
  $('#empty-canvas').hidden = !empty;
  $('#sheet-wrapper').classList.toggle('is-empty', empty);
  const guide = $('#workflow-guide');
  let message = '', action = '', label = '';
  if (!empty && !nodes.some((node) => node.type === 'panel')) {
    message = 'Scegli un quadro per distribuire l’alimentazione.'; action = 'panel'; label = 'Scegli quadro';
  } else if (!empty && !nodes.some((node) => node.type === 'supply') && !state.links.some((link) => nodes.some((node) => node.id === link.to))) {
    message = 'Aggiungi una fornitura per alimentare il quadro.'; action = 'supply'; label = 'Aggiungi fornitura';
  } else if (!empty && !state.links.some((link) => !isReferenceLink(link) && nodes.some((node) => node.id === link.from))) {
    message = 'Collega la fornitura al quadro: ti mostreremo le destinazioni compatibili.'; action = 'link'; label = 'Crea collegamento';
  } else if (!empty && !nodes.some((node) => node.type === 'load')) {
    message = 'Ora puoi aggiungere le utenze o importarle da Capture.'; action = 'loads'; label = 'Aggiungi utenze';
  }
  guide.hidden = !message;
  guide.innerHTML = message ? `<span>${esc(message)}</span><button type="button" class="button" data-start-action="${action}">${label}</button>` : '';
}
function runStartAction(action) {
  closeMobileSidebar();
  if (action === 'supply') addNode('supply');
  if (action === 'panel') openPanelDialog();
  if (action === 'link') showLinkDialog();
  if (action === 'loads') openBulkLoadDialog();
}
function renderSelectionToolbar() {
  const nodes = selectedNodes().filter((node) => node.page === state.currentPage), bar = $('#selection-toolbar');
  bar.hidden = nodes.length < 2;
  if (bar.hidden) { bar.replaceChildren(); return; }
  const loads = nodes.filter((node) => node.type === 'load'), available = loads.some((node) => !state.links.some((link) => !isReferenceLink(link) && link.to === node.id));
  const hasPanel = pageNodes().some((node) => node.type === 'panel');
  const actions = [
    { id: 'connect', label: 'Collega', reason: !loads.length ? 'Seleziona almeno un’utenza.' : !available ? 'Le utenze selezionate sono già collegate.' : !hasPanel ? 'Aggiungi prima un quadro.' : '' },
    { id: 'arrange', label: 'Ordina', reason: '' },
    { id: 'align', label: 'Allinea', reason: '' },
    { id: 'duplicate', label: loads.length ? `Duplica ${loads.length} utenz${loads.length === 1 ? 'a' : 'e'}` : 'Duplica', reason: !loads.length ? 'La duplicazione è disponibile per le utenze.' : '' },
    { id: 'delete', label: 'Elimina', reason: '' },
  ];
  bar.innerHTML = `<strong>${nodes.length} elementi selezionati</strong><div class="selection-actions">${actions.map((action) => `<div><button type="button" class="button ${action.id === 'delete' ? 'danger' : ''}" data-selection-action="${action.id}" ${action.reason ? `disabled aria-describedby="selection-reason-${action.id}"` : ''}>${action.label}</button>${action.reason ? `<small id="selection-reason-${action.id}">${action.reason}</small>` : ''}</div>`).join('')}</div>`;
}
function editorIssues() {
  const errors = projectIssues().map((issue) => {
    const link = linkById(issue.linkId);
    return { ...issue, kind: 'error', nodeId: issue.nodeId || (['missing-socket', 'invalid-socket'].includes(issue.code) ? link?.to : null) };
  });
  return [...errors, ...Core.unconnectedLoadIds(state).map((id) => ({ kind: 'warning', code: 'unconnected-load', nodeId: id, message: `${nodeById(id).title}: utenza non collegata, esclusa dal calcolo delle fasi.` }))];
}
function renderDiagnostics() {
  const issues = editorIssues(), errors = issues.filter((issue) => issue.kind === 'error').length;
  $('#issues-count').textContent = issues.length;
  $('#show-issues').dataset.kind = errors ? 'error' : issues.length ? 'warning' : 'success';
  $('#show-issues').setAttribute('aria-label', issues.length ? `Controlli: ${errors} errori e ${issues.length - errors} avvisi` : 'Controlli: nessuna anomalia');
  if (!$('#issues-dialog').open) return;
  $('#issues-list').innerHTML = issues.length ? issues.map((issue, index) => {
    const link = linkById(issue.linkId), node = nodeById(issue.nodeId) || (link && nodeById(link.from));
    return `<article class="issue-card" data-kind="${issue.kind}"><div><strong>${issue.kind === 'error' ? 'Errore' : 'Avviso'}${node ? ` · ${esc(pageLabel(node.page))}` : ''}</strong><p>${esc(issue.message)}</p></div>${node || link ? `<button type="button" class="button" data-issue-index="${index}">Vai all’elemento</button>` : ''}</article>`;
  }).join('') : '<div class="checks-empty"><strong>Nessuna anomalia</strong><p>Collegamenti e prese del progetto sono coerenti e tutte le utenze sono collegate.</p></div>';
}
function goToIssue(index) {
  const issue = editorIssues()[index];
  if (!issue) return;
  const link = linkById(issue.linkId), node = nodeById(issue.nodeId) || (link && nodeById(link.from));
  if (!node) return;
  $('#issues-dialog').close();
  state.currentPage = node.page;
  if (issue.nodeId) selectNode(node.id);
  else { state.selectedLink = link.id; state.selected = null; state.selectedIds = []; }
  render();
  const element = diagramSelectionElement();
  canvasViewport?.reveal(element); element?.focus({ preventScroll: true });
  showStatus(issue.message, issue.kind);
}
function pageThumbnail(page) {
  const nodes = state.nodes.filter((node) => node.page === page), byId = new Map(nodes.map((node) => [node.id, node]));
  const paths = state.links.filter((link) => byId.has(link.from) && byId.has(link.to)).map((link) => {
    const from = byId.get(link.from), to = byId.get(link.to), middle = (from.x + to.x) / 2;
    return `<path d="M${from.x + NODE_HALF},${from.y} H${middle} V${to.y} H${to.x - NODE_HALF}"/>`;
  }).join('');
  return `<svg viewBox="0 0 1200 780" aria-hidden="true" class="page-thumbnail">${paths}${nodes.map((node) => `<rect class="thumbnail-${node.type}" x="${node.x - NODE_HALF}" y="${node.y - nodeDisplayHeight(node) / 2}" width="${NODE_HALF * 2}" height="${nodeDisplayHeight(node)}" rx="8"/>`).join('')}</svg>`;
}
function renderPageOverview() {
  if (!$('#pages-dialog').open) return;
  $('#page-cards').innerHTML = sortedPages().map((page) => {
    const nodes = state.nodes.filter((node) => node.page === page), loads = nodes.filter((node) => node.type === 'load').length;
    return `<article class="page-card ${page === state.currentPage ? 'current' : ''}"><button type="button" class="page-preview-button" data-open-page="${page}" aria-label="Apri ${esc(pageLabel(page))}">${pageThumbnail(page)}<strong>${esc(pageLabel(page))}</strong><span>${loads} utenze · ${nodes.length} elementi</span></button><label>Nome pagina ${page}<input data-page-name="${page}" value="${esc(state.pageNames?.[page] || '')}" placeholder="Es. Palco, Regia, Esterni" maxlength="80" /></label></article>`;
  }).join('');
}
function renamePage(page, value) {
  const name = value.trim().slice(0, 80);
  if ((state.pageNames?.[page] || '') === name) return;
  checkpoint(`rename-page-${page}`);
  state.pageNames ||= {};
  if (name) state.pageNames[page] = name; else delete state.pageNames[page];
  markChanged('Nome pagina aggiornato.'); render();
}
function closeMobileSidebar() {
  if (window.matchMedia('(max-width: 760px)').matches) togglePanel($('.sidebar'), $('#toggle-sidebar'), false);
}

function nodeById(id) { return state.nodes.find((node) => node.id === id); }
function isReferenceLink(link) { return !!link?.referenceLink; }
function supplyKey(node) { return node?.supplyKey || node?.id; }
function supplyGroup(node) { return state.nodes.filter((item) => item.type === 'supply' && supplyKey(item) === supplyKey(node)); }
function uniqueSupplies() { return [...new Map(state.nodes.filter((node) => node.type === 'supply').map((node) => [supplyKey(node), node])).values()]; }
function panelKey(node) { return node?.panelKey || node?.id; }
function panelGroup(node) { return state.nodes.filter((item) => item.type === 'panel' && panelKey(item) === panelKey(node)); }
function uniquePanels() { return [...new Map(state.nodes.filter((node) => node.type === 'panel').map((node) => [panelKey(node), node])).values()]; }
function firstNodeAppearance(node) {
  const group = node?.type === 'supply' ? supplyGroup(node) : node?.type === 'panel' ? panelGroup(node) : [node];
  return group.reduce((first, item) => !first || item.page < first.page ? item : first, null) || node;
}
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
function cableById(id) { return CABLE_INDEX.get(id) || CABLES[0]; }
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
function nodeDisplayHeight(node) {
  const compact = node.type === 'load', lineHeight = compact ? 14 : 20;
  return Math.max(compact ? 50 : 58, textLines(node).length * lineHeight + (compact ? 10 : 16));
}
function cableShortLabel(cable) { return cable.name.replace(/ monofase| trifase/gi, '').replace(/ (\d+) A$/, ' $1A'); }
function linkLabel(link) {
  const cable = cableById(link.cable);
  const section = cableById(link.cableSection || link.cable);
  const lines = isPowerLock(cable.id) ? ['Cavo singolo polo PowerLock'] : [cableShortLabel(cable)];
  if (!link.hideCableSection) lines.push(isPowerLock(cable.id) ? section.cable : `Cavo ${section.cable}`);
  if (!link.hideLength) lines.push(`Lunghezza linea ${link.length || 0} metri`);
  return lines;
}
function linkDisplayOptions(link, disabled = false) {
  return `<fieldset class="link-display-options"><legend>Testo nello schema e nel PDF</legend><label class="inline-option"><input type="checkbox" name="hideCableSection" ${link.hideCableSection ? '' : 'checked'} ${disabled ? 'disabled' : ''}/>Mostra sezione cavo</label><label class="inline-option"><input type="checkbox" name="hideLength" ${link.hideLength ? '' : 'checked'} ${disabled ? 'disabled' : ''}/>Mostra lunghezza</label></fieldset>`;
}
function linkLabelPosition(link, from, to) {
  const startX = from.x + NODE_HALF, endX = to.x - NODE_HALF, midX = Math.round((startX + endX) / 2), lines = linkLabel(link).flatMap((line) => wrapText(line, 29));
  return { x: link.labelX ?? Math.min(midX + 16, 790), y: link.labelY ?? Math.max(22, Math.min(from.y, to.y) - lines.length * 19 - 7), lines };
}
function linkLaneX(link, from, siblings, nodeIndex) {
  if (siblings.length < 2) return Math.round((from.x + NODE_HALF + (nodeIndex.get(link.to)?.x || 0) - NODE_HALF) / 2);
  const index = siblings.findIndex((item) => item.id === link.id), startX = from.x + NODE_HALF, closestTargetX = Math.min(...siblings.map((item) => (nodeIndex.get(item.to)?.x || 0) - NODE_HALF));
  return Math.round(startX + 28 + ((index + 1) * Math.max(24, closestTargetX - startX - 56)) / (siblings.length + 1));
}
function directLinkSiblings(link, nodeIndex) {
  const targetPage = nodeIndex.get(link.to)?.page;
  return state.links
    .filter((item) => !item.socapexGroup && item.from === link.from && nodeIndex.get(item.to)?.page === targetPage)
    .sort((first, second) => (nodeIndex.get(first.to)?.y || 0) - (nodeIndex.get(second.to)?.y || 0));
}
function linkRoutePoints(link, from, to, nodeIndex, siblings = directLinkSiblings(link, nodeIndex)) {
  const start = { x: from.x + NODE_HALF, y: from.y }, end = { x: to.x - NODE_HALF, y: to.y };
  if (!Array.isArray(link.routePoints) || link.routePoints.length < 2) {
    const midX = linkLaneX(link, from, siblings, nodeIndex);
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }
  const route = link.routePoints.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  route[0].y = start.y;
  route[route.length - 1].y = end.y;
  return [start, ...route, end];
}
function routePath(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`).join(' ');
}
function routeHandlesMarkup(link, points) {
  if (state.selectedLink !== link.id || link.socapexGroup) return '';
  return points.slice(1, -2).map((point, offset) => {
    const segmentIndex = offset + 1, next = points[segmentIndex + 1], dx = next.x - point.x, dy = next.y - point.y;
    if (Math.hypot(dx, dy) < 8) return '';
    const vertical = Math.abs(dy) >= Math.abs(dx), x = (point.x + next.x) / 2, y = (point.y + next.y) / 2;
    return `<rect class="route-handle ${vertical ? 'vertical' : 'horizontal'}" data-link-id="${link.id}" data-segment-index="${segmentIndex}" data-orientation="${vertical ? 'vertical' : 'horizontal'}" x="${x - (vertical ? 6 : 10)}" y="${y - (vertical ? 10 : 6)}" width="${vertical ? 12 : 20}" height="${vertical ? 20 : 12}" rx="3"><title>Trascina per spostare questo tratto</title></rect>`;
  }).join('');
}
function addLinkDetour(link) {
  const from = nodeById(link.from), to = nodeById(link.to); if (!from || !to || link.socapexGroup) return false;
  const nodeIndex = new Map(state.nodes.map((node) => [node.id, node])), points = linkRoutePoints(link, from, to, nodeIndex);
  const candidates = [];
  for (let index = 1; index < points.length - 2; index += 1) {
    const first = points[index], second = points[index + 1], length = Math.hypot(second.x - first.x, second.y - first.y);
    if (length >= 12) candidates.push({ index, first, second, length });
  }
  if (!candidates.length) {
    const start = points[0], end = points.at(-1), firstX = start.x + (end.x - start.x) * .3, secondX = start.x + (end.x - start.x) * .7;
    const direction = start.y > 660 ? -1 : 1, detourY = Math.max(20, Math.min(760, start.y + direction * 80));
    link.routePoints = [{ x: firstX, y: start.y }, { x: firstX, y: detourY }, { x: secondX, y: detourY }, { x: secondX, y: end.y }];
    return true;
  }
  const chosen = candidates.sort((first, second) => second.length - first.length)[0], full = points.map((point) => ({ ...point }));
  const vertical = Math.abs(chosen.second.y - chosen.first.y) >= Math.abs(chosen.second.x - chosen.first.x);
  if (vertical) {
    const middle = (chosen.first.y + chosen.second.y) / 2, direction = chosen.first.x > 1050 ? -1 : 1, sideX = Math.max(20, Math.min(1180, chosen.first.x + direction * 70));
    full.splice(chosen.index + 1, 0, { x: chosen.first.x, y: middle }, { x: sideX, y: middle }, { x: sideX, y: chosen.second.y });
  } else {
    const middle = (chosen.first.x + chosen.second.x) / 2, direction = chosen.first.y > 660 ? -1 : 1, sideY = Math.max(20, Math.min(760, chosen.first.y + direction * 70));
    full.splice(chosen.index + 1, 0, { x: middle, y: chosen.first.y }, { x: middle, y: sideY }, { x: chosen.second.x, y: sideY });
  }
  link.routePoints = full.slice(1, -1);
  return true;
}
function cableOptionMarkup(cables, selected) { return cables.map((cable) => `<option value="${cable.id}" ${cable.id === selected ? 'selected' : ''}>${cable.name}</option>`).join(''); }
function cableSectionGroup(connectorId) {
  if (connectorId === 'socapex') return CABLE_SECTION_GROUPS.socapex;
  if (isPowerLock(connectorId)) return CABLE_SECTION_GROUPS.powerlock;
  if (connectorId.endsWith('mono')) return CABLE_SECTION_GROUPS.mono;
  return CABLE_SECTION_GROUPS.tri;
}
function cableSectionOptions(connectorId, selected) {
  const ids = cableSectionGroup(connectorId);
  const selectedId = ids.includes(selected) ? selected : connectorId;
  return ids.map((id) => { const cable = cableById(id); return `<option value="${cable.id}" ${cable.id === selectedId ? 'selected' : ''}>${esc(cable.cable)}</option>`; }).join('');
}
function nodeOptions(selected) { return pageNodes().map((node) => `<option value="${node.id}" ${node.id === selected ? 'selected' : ''}>${esc(node.title)}${node.socket ? ` (${node.socket})` : ''}</option>`).join(''); }
function cableOptions(selected) { return cableOptionMarkup(LINE_CABLES, selected); }
function linkCableOptions(link) {
  const target = nodeById(link.to), required = requiredPlug(target);
  const choices = CABLES.filter((cable) => (cable.id === link.cable || !cable.internal) && compatibleConnector(cable.id, required));
  return cableOptionMarkup(choices.some((cable) => cable.id === link.cable) ? choices : [cableById(link.cable), ...choices], link.cable);
}
function plugOptions(selected) { return cableOptionMarkup(LOAD_PLUGS, selected); }
function panelPortOptions(selected) { return cableOptionMarkup(PANEL_PORTS, selected); }
function isPowerLock(id) { return Core.isPowerLock(id); }
function compatibleConnector(first, second) { return Core.compatibleConnector(first, second); }
function connectorCanFeedInput(first, second) { return Core.connectorCanFeedInput(first, second); }
function requiredPlug(node) { return Core.requiredPlug(node); }
function availablePanelSockets(panel, target, ignoredLink = null) { return Core.availablePanelSockets(state, panel, target, ignoredLink); }
function socketWarning(panel, target, socket, ignoredLink = null) { return Core.socketWarning(state, panel, target, socket, ignoredLink, (id) => cableById(id).name); }
function assignFirstFreeSocket(from, to) {
  if (from.type !== 'panel') return true;
  const socket = availablePanelSockets(from, to)[0];
  if (!socket) { showStatus(`Collegamento bloccato: non ci sono prese ${cableById(requiredPlug(to)).name} libere sul quadro ${from.title}.`, 'error'); return false; }
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
function showStatus(message = '', kind = 'info') {
  const banner = $('#status-message');
  banner.textContent = message; banner.hidden = !message; banner.dataset.kind = kind;
  banner.setAttribute('role', kind === 'error' ? 'alert' : 'status');
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
  if (status) { status.textContent = message; status.hidden = !message; status.dataset.kind = kind; status.setAttribute('role', kind === 'error' ? 'alert' : 'status'); }
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
function tryAddLink(fromId, toId, cable, length, recordHistory = true, recordChange = true, cableSection = null) {
  const from = nodeById(fromId), to = nodeById(toId); if (!from || !to || fromId === toId) return false;
  const lineCable = cable || requiredPlug(to) || 'cee16mono';
  const warning = compatibilityWarning(from, to, null, lineCable); if (warning) { showStatus(warning, 'error'); return false; }
  if (recordHistory) checkpoint('add-link');
  if (!assignFirstFreeSocket(from, to)) { if (recordHistory) dropNoopHistory(); return false; }
  state.links.push({ id: uid(), from: fromId, to: toId, cable: lineCable, cableSection: cableSection || requiredPlug(to) || lineCable, length: Number.isFinite(Number(length)) ? Math.max(0, Number(length)) : 20 });
  updatePanelNumbering(from, to);
  if (recordChange) { markChanged(); showStatus(''); }
  return true;
}

function socapexLinkKey(link) {
  return link?.socapexGroup ? `${link.socapexGroup}:${link.from}:${isReferenceLink(link) ? 'reference' : 'physical'}` : '';
}
function socapexGroupLinks(link) {
  const key = socapexLinkKey(link);
  return key ? state.links.filter((item) => socapexLinkKey(item) === key) : [];
}

function formatPhasePower(watts) {
  if (watts >= 1000) return `${(watts / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kW`;
  return `${Math.round(watts).toLocaleString('it-IT')} W`;
}

function renderPhaseSummary() {
  const supplies = uniqueSupplies();
  const supplyFilter = $('#phase-supply-filter');
  const selectedSupply = supplies.find((supply) => supplyKey(supply) === phaseSupplyFilter);
  if (phaseSupplyFilter && !selectedSupply) phaseSupplyFilter = '';
  supplyFilter.hidden = supplies.length <= 1;
  supplyFilter.innerHTML = `<option value="">Totale progetto</option>${supplies.map((supply) => `<option value="${esc(supplyKey(supply))}" ${supplyKey(supply) === phaseSupplyFilter ? 'selected' : ''}>${esc(supply.title || 'Fornitura')}</option>`).join('')}`;
  const activeSupply = supplies.find((supply) => supplyKey(supply) === phaseSupplyFilter);
  const summary = Core.calculatePhaseLoads(state, activeSupply ? { supplyKey: phaseSupplyFilter } : {});
  const phaseNames = ['R', 'S', 'T'];
  const maximum = Math.max(1, ...phaseNames.map((name) => summary.phases[name].watts));
  let totalWatts = 0;
  phaseNames.forEach((name) => {
    const phase = summary.phases[name], key = name.toLowerCase();
    totalWatts += phase.watts;
    $(`#phase-${key}-power`).textContent = formatPhasePower(phase.watts);
    $(`#phase-${key}-current`).textContent = `${phase.amps.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A`;
    $(`#phase-${key}-meter`).style.width = `${phase.watts > 0 ? Math.max(3, (phase.watts / maximum) * 100) : 0}%`;
  });
  $('#phase-total').textContent = formatPhasePower(totalWatts);
  $('#phase-scope-label').textContent = activeSupply?.title || 'Totale progetto';
  const unconnected = Core.unconnectedLoadIds(state), alert = $('#unconnected-alert');
  alert.hidden = unconnected.length === 0;
  $('#unconnected-count').textContent = unconnected.length === 1 ? '1 utenza non collegata' : `${unconnected.length} utenze non collegate`;
}

function showUnconnectedLoads() {
  const ids = Core.unconnectedLoadIds(state);
  if (!ids.length) return;
  const loads = ids.map(nodeById).filter(Boolean), currentPageIds = loads.filter((load) => load.page === state.currentPage).map((load) => load.id);
  const targetPage = currentPageIds.length ? state.currentPage : Math.min(...loads.map((load) => load.page));
  const selectedIds = loads.filter((load) => load.page === targetPage).map((load) => load.id);
  state.currentPage = targetPage; state.selectedIds = selectedIds; state.selected = selectedIds.at(-1) || null; state.selectedLink = null;
  render();
  showStatus(`${ids.length === 1 ? '1 utenza non collegata' : `${ids.length} utenze non collegate`} nel progetto. ${selectedIds.length === 1 ? 'Selezionata' : 'Selezionate'} nella pagina ${targetPage}.`);
}

function render() {
  if (renderFrame !== null) { cancelAnimationFrame(renderFrame); renderFrame = null; }
  const pages = sortedPages(), maxPages = pagesCount();
  if (!pages.includes(state.currentPage)) state.currentPage = pages[0] || 1;
  const nodeIndex = new Map(state.nodes.map((node) => [node.id, node]));
  state.selectedIds = state.selectedIds.filter((id) => nodeIndex.has(id));
  if (state.selected && !state.selectedIds.includes(state.selected)) state.selected = state.selectedIds.at(-1) || null;
  const svg = $('#diagram'); const nodes = pageNodes(); const ids = new Set(nodes.map((node) => node.id));
  const focused = svg.contains(document.activeElement) ? document.activeElement.closest('.node, .link') : null;
  const focusSelector = focused?.dataset.id ? `[data-id="${focused.dataset.id}"]` : focused?.dataset.linkId ? `.link[data-link-id="${focused.dataset.linkId}"]` : null;
  const selectedIds = new Set(state.selectedIds), socapexGroups = new Map(), outgoingDirect = new Map();
  state.links.forEach((link) => {
    if (link.socapexGroup) {
      const key = socapexLinkKey(link);
      if (!socapexGroups.has(key)) socapexGroups.set(key, []);
      socapexGroups.get(key).push(link);
      return;
    }
    if (nodeIndex.get(link.to)?.page !== state.currentPage) return;
    if (!outgoingDirect.has(link.from)) outgoingDirect.set(link.from, []);
    outgoingDirect.get(link.from).push(link);
  });
  outgoingDirect.forEach((links) => links.sort((first, second) => (nodeIndex.get(first.to)?.y || 0) - (nodeIndex.get(second.to)?.y || 0)));
  let markup = '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#1c1c1c"/></marker></defs>';
  markup += alignmentGuides.map((guide) => guide.axis === 'x' ? `<path class="alignment-guide" d="M${guide.value},5 V775"/>` : `<path class="alignment-guide" d="M35,${guide.value} H1165"/>`).join('');
  const renderedSocapexGroups = new Set();
  state.links.forEach((link) => {
    if (link.socapexGroup) {
      const groupKey = socapexLinkKey(link);
      if (renderedSocapexGroups.has(groupKey)) return;
      renderedSocapexGroups.add(groupKey);
      const group = socapexGroups.get(groupKey) || [];
      const from = nodeIndex.get(group[0]?.from), visibleTargets = group.map((item) => ({ link: item, node: nodeIndex.get(item.to) })).filter(({ node }) => node && ids.has(node.id));
      if (!from || !ids.has(from.id) || !visibleTargets.length) return;
      const startX = from.x + NODE_HALF, endX = Math.min(...visibleTargets.map(({ node }) => node.x - NODE_HALF)), busX = Math.round((startX + endX) / 2), ys = visibleTargets.map(({ node }) => node.y), master = group[0], label = linkLabelPosition(master, from, visibleTargets[0].node);
      const labelMarkup = `<g class="link-label" data-link-id="${master.id}"><rect class="label-hit" x="${label.x - 5}" y="${label.y - 17}" width="310" height="${label.lines.length * 19 + 10}"/>${label.lines.map((line, index) => `<text class="line-label" x="${label.x}" y="${label.y + index * 19}">${esc(line)}</text>`).join('')}</g>`;
      markup += `<g class="link ${group.some((item) => item.id === state.selectedLink) ? 'selected' : ''}" data-link-id="${master.id}" tabindex="0" role="button" aria-label="Collegamento Socapex da ${esc(from.title)}"><path class="socapex-bus" d="M${startX},${from.y} H${busX} V${Math.min(...ys)} M${busX},${Math.min(...ys)} V${Math.max(...ys)}"/>${visibleTargets.map(({ node }) => `<path class="connector" marker-end="url(#arrow)" d="M${busX},${node.y} H${node.x - NODE_HALF}"/>`).join('')}${labelMarkup}</g>`;
      return;
    }
    const from = nodeIndex.get(link.from), to = nodeIndex.get(link.to); if (!from || !to || !ids.has(from.id)) return;
    if (!ids.has(to.id)) { const pageNumber = printPageNumbers?.get(to.page) ?? to.page; markup += `<g class="link" data-link-id="${link.id}"><path class="connector" marker-end="url(#arrow)" d="M${from.x + NODE_HALF},${from.y} H1050"/><rect class="page-jump" x="1060" y="${from.y - 22}" width="105" height="44"/><text class="page-jump-text" x="1112" y="${from.y + 5}">Pagina ${pageNumber}</text></g>`; return; }
    const points = linkRoutePoints(link, from, to, nodeIndex, outgoingDirect.get(from.id) || [link]), path = routePath(points), label = linkLabelPosition(link, from, to);
    const labelMarkup = `<g class="link-label" data-link-id="${link.id}"><rect class="label-hit" x="${label.x - 5}" y="${label.y - 17}" width="310" height="${label.lines.length * 19 + 10}"/>${label.lines.map((line, index) => `<text class="line-label" x="${label.x}" y="${label.y + index * 19}">${esc(line)}</text>`).join('')}</g>`;
    markup += `<g class="link ${state.selectedLink === link.id ? 'selected' : ''}" data-link-id="${link.id}" tabindex="0" role="button" aria-label="Collegamento da ${esc(from.title)} a ${esc(to.title)}"><path class="connector-hit" d="${path}"/><path class="connector" marker-end="url(#arrow)" d="${path}"/>${routeHandlesMarkup(link, points)}${labelMarkup}</g>`;
  });
  nodes.forEach((node) => {
    const lines = textLines(node), compact = node.type === 'load', lineHeight = compact ? 14 : 20, topPadding = compact ? 14 : 21, height = nodeDisplayHeight(node);
    const texts = lines.map((line, index) => `<text class="${index === 0 || (node.type === 'panel' && line === node.details) ? 'node-title' : ''}" x="${node.x}" y="${node.y - height / 2 + topPadding + index * lineHeight}">${esc(line)}</text>`).join('');
    markup += `<g class="node ${node.type} ${selectedIds.has(node.id) ? 'selected' : ''}" data-id="${node.id}" tabindex="0" role="button" aria-label="${esc(node.title)}"><rect x="${node.x - NODE_HALF}" y="${node.y - height / 2}" width="${NODE_HALF * 2}" height="${height}"/>${texts}<circle class="link-handle" data-source="${node.id}" cx="${node.x + NODE_HALF}" cy="${node.y}" r="7" aria-hidden="true"/></g>`;
  });
  svg.innerHTML = markup;
  if (focusSelector) svg.querySelector(focusSelector)?.focus({ preventScroll: true });
  $('#page-label').textContent = pageLabel(state.currentPage); $('#page-summary').textContent = `${nodes.length} elementi`;
  $('#page-select').innerHTML = pages.map((page) => `<option value="${page}" ${page === state.currentPage ? 'selected' : ''}>${esc(pageLabel(page))}</option>`).join('');
  const pageIndex = pages.indexOf(state.currentPage);
  $('#previous-page').disabled = pageIndex <= 0;
  $('#next-page').disabled = pageIndex < 0 || pageIndex >= pages.length - 1;
  $('#delete-page').disabled = pages.length <= 1;
  $('#block-event').textContent = state.meta.name || '—'; $('#block-location').textContent = state.meta.location || '—'; $('#block-type').textContent = state.meta.type || '—'; $('#block-version').textContent = state.meta.revision || '1.0'; $('#block-company').textContent = state.meta.company || '—'; $('#block-company-address').textContent = state.meta.companyAddress || '—'; $('#block-company-vat').textContent = state.meta.companyVat ? `P. IVA ${state.meta.companyVat}` : ''; $('#block-page').textContent = `Pagina ${state.currentPage} di ${maxPages}`; $('#project-name').textContent = state.meta.name || 'Nuovo progetto';
  renderPhaseSummary();
  renderInspector();
  renderWorkflowGuide();
  renderSelectionToolbar();
  renderDiagnostics();
  renderPageOverview();
  canvasViewport?.refresh();
  updateDirtyUi();
}
function requestRender() {
  if (renderFrame !== null) return;
  renderFrame = requestAnimationFrame(() => { renderFrame = null; render(); });
}
function renderInspector() {
  const inspector = $('#inspector'), form = $('#property-form'), node = nodeById(state.selected), link = linkById(state.selectedLink);
  const selected = node || link;
  inspector.hidden = !selected;
  $('.app-shell').classList.toggle('has-inspector', Boolean(selected));
  if (!selected) { form.replaceChildren(); return; }
  $('#inspector-title').textContent = link ? (link.socapexGroup ? 'Collegamento Socapex' : 'Collegamento') : state.selectedIds.length > 1 ? `${state.selectedIds.length} elementi` : node.title || 'Proprietà';
  if (link) {
    const from = nodeById(link.from), to = nodeById(link.to), reference = isReferenceLink(link);
    if (link.socapexGroup) {
      const group = socapexGroupLinks(link);
      const socketRows = group.map((member) => {
        const target = nodeById(member.to);
        const sockets = from?.type === 'panel' && target ? availablePanelSockets(from, target, member.id) : [];
        return `<label>${esc(target?.title || 'Utenza')}<select name="socapexSocket:${member.id}" ${reference || !sockets.length ? 'disabled' : ''}>${sockets.length ? sockets.map((socket) => `<option value="${socket.name}" ${socket.name === target?.socket ? 'selected' : ''}>${socket.name} · ${cableById(socket.type).name}</option>`).join('') : '<option value="">Nessuna presa compatibile libera</option>'}</select></label>`;
      }).join('');
      form.innerHTML = `${reference ? '<div class="read-only">Collegamento Socapex richiamato: le prese si modificano sul collegamento originale.</div>' : ''}<label>Da<div class="read-only">${esc(from?.title || '—')}</div></label><label>Linea<div class="read-only">Socapex · ${group.length} utenz${group.length === 1 ? 'a' : 'e'}</div></label><label>Lunghezza (m)<input name="socapexLength" type="number" min="0" step="0.5" value="${link.length}" ${reference ? 'disabled' : ''}/></label>${linkDisplayOptions(link)}<fieldset class="socapex-socket-editor"><legend>Prese del quadro</legend>${socketRows}${reference ? '' : '<button type="button" class="button" id="reassign-socapex-sockets">Riassegna prese al banco libero</button>'}</fieldset><span class="field-help">Ogni menu mostra soltanto le prese CEE 16 A monofase compatibili e libere.</span>`;
      return;
    }
    const routeEditor = !link.socapexGroup && from && to && from.page === to.page
      ? `<div class="route-editor"><strong>Percorso linea</strong><span>Trascina le maniglie blu sui tratti della linea per cambiarne il giro.</span><div><button type="button" class="button" id="add-link-detour">Aggiungi deviazione</button><button type="button" class="button" id="reset-link-route" ${link.routePoints ? '' : 'disabled'}>Percorso automatico</button></div></div>`
      : '';
    form.innerHTML = `${reference ? `<div class="read-only">Collegamento richiamato: non impegna ulteriormente prese o ingressi.</div><label>Da<div class="read-only">${esc(from?.title || '—')}</div></label><label>A<div class="read-only">${esc(to?.title || '—')}</div></label>` : `<label>Da<select name="from">${nodeOptions(link.from)}</select></label><label>A<select name="to">${nodeOptions(link.to)}</select></label>`}<label>Tipo di collegamento<select name="cable">${linkCableOptions(link)}</select></label><label>Sezione cavo<select name="cableSection">${cableSectionOptions(link.cable, link.cableSection || link.cable)}</select></label><label>Lunghezza (m)<input name="length" type="number" min="0" step="0.5" value="${link.length}" /></label>${linkDisplayOptions(link)}${routeEditor}<span class="field-help">La sezione del cavo può essere modificata senza cambiare la spina. Puoi spostare la descrizione trascinandola.</span>`;
    return;
  }
  const hasIncoming = state.links.some((item) => item.to === node.id);
  const incoming = state.links.find((item) => item.to === node.id), source = incoming && nodeById(incoming.from);
  const connectorControl = node.type === 'load' ? `<label>Spina utenza<select name="plugType">${plugOptions(node.plugType)}</select></label>` : node.type === 'supply' ? `<label>Fornitura<select name="supplyType">${cableOptions(node.supplyType || 'cee125tri')}</select></label>` : '';
  const sockets = source?.type === 'panel' ? availablePanelSockets(source, node, incoming.id) : [], socketControl = node.type === 'supply' ? '' : source?.type === 'panel' ? `<label>Presa disponibile<select name="socket" ${sockets.length ? '' : 'disabled'}>${!node.socket && sockets.length ? '<option value="" selected disabled>Seleziona una presa</option>' : ''}${sockets.length ? sockets.map((item) => `<option value="${item.name}" ${item.name === node.socket ? 'selected' : ''}>${item.name} · ${cableById(item.type).name}</option>`).join('') : '<option value="">Nessuna presa compatibile libera</option>'}</select></label><label>Oppure scrivi presa<input name="manualSocket" list="socket-list-${node.id}" value="${esc(node.socket || '')}" placeholder="Es. P1" /><datalist id="socket-list-${node.id}">${sockets.map((item) => `<option value="${item.name}">${cableById(item.type).name}</option>`).join('')}</datalist></label>` : `<label>Presa<input name="socket" value="${esc(node.socket || '')}" placeholder="Es. P1" /></label>`;
  const sharedSupply = node.type === 'supply' && supplyGroup(node).length > 1 ? `<div class="read-only">Fornitura condivisa su ${supplyGroup(node).length} pagine: nome, tipo e dettaglio vengono mantenuti uguali.</div>` : '';
  const sharedPanel = node.type === 'panel' && panelGroup(node).length > 1 ? `<div class="read-only">Quadro condiviso su ${panelGroup(node).length} pagine: uscite, nome e matricola sono condivisi.</div>` : '';
  const temporaryEdit = node.type === 'panel' && node.panelModel === 'Temporaneo' ? '<button type="button" class="button" id="edit-temporary-panel">Modifica configurazione quadro temporaneo</button>' : '';
  const duplicateLoad = node.type === 'load' ? '<button type="button" class="button" id="duplicate-load">Duplica utenza</button>' : '';
  const pageOptions = sortedPages().map((page) => `<option value="${page}" ${page === node.page ? 'selected' : ''}>${esc(pageLabel(page))}</option>`).join('');
  const detailControl = node.type === 'load'
    ? `<label>Assorbimento (W)<input name="watts" type="number" min="0" step="1" value="${esc(node.watts || 0)}" /></label><label>Nota<input name="note" value="${esc(node.note || '')}" /></label>`
    : `<label>Dettaglio / matricola<input name="details" value="${esc(node.details || '')}" /></label>`;
  form.innerHTML = `${state.selectedIds.length > 1 ? `<div class="read-only">${state.selectedIds.length} elementi selezionati. Trascina uno dei blocchi per spostarli insieme.</div>` : ''}<label>Tipo<div class="read-only">${node.type === 'supply' ? 'Fornitura' : node.type === 'panel' ? 'Quadro' : 'Utenza'}</div></label>${sharedSupply}${sharedPanel}${node.type === 'panel' ? panelSocketSummaryMarkup(node) : ''}${node.type === 'panel' && node.panelModel ? `<label>Modello database<div class="read-only">${esc(node.panelModel)}</div></label>` : ''}${temporaryEdit}${duplicateLoad}<label>Pagina<select name="page">${pageOptions}</select></label><label>Titolo<input name="title" value="${esc(node.title)}" /></label>${connectorControl}${node.type === 'panel' ? '<label>Sottotitolo<input name="subtitle" value="' + esc(node.subtitle) + '" /></label>' : ''}${socketControl}${detailControl}${hasIncoming ? '<button type="button" class="button" id="unlink-selected">Scollega dal quadro / fornitura</button>' : ''}<span class="field-help">⇧/⌘ + clic per aggiungere o togliere un blocco dalla selezione. Trascina un blocco selezionato per spostarli insieme.</span>`;
}
function addNode(type) {
  checkpoint(`add-${type}`);
  const page = state.currentPage, same = pageNodes().filter((node) => node.type === type).length;
  const supplyNumber = uniqueSupplies().length + 1;
  const defaults = { supply: [`Fornitura #${supplyNumber}`, '63 A', '', 90, Math.min(650, 135 + same * 95)], load: ['Nuova utenza', 'CEE P+N+T 230 V 16 A', 'Assorbimento 0,0 kW', 835, 135 + same * 92] }[type];
  const node = { id: uid(), type, page, title: defaults[0], subtitle: defaults[1], details: defaults[2], x: defaults[3], y: defaults[4], socket: '', watts: 0 };
  if (type === 'supply') { node.supplyKey = uid(); node.supplyType = 'cee125tri'; node.subtitle = CABLES.find((cable) => cable.id === node.supplyType).plug; }
  if (type === 'load') { node.plugType = 'cee16mono'; node.subtitle = CABLES.find((cable) => cable.id === node.plugType).plug; }
  state.nodes.push(node); const extraPages = type === 'load' ? ensureLoadPageCapacity(page, [node.id]) : 0; if (extraPages) state.currentPage = node.page; state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; markChanged(); render(); if (extraPages) showStatus(`Utenza aggiunta e nuova pagina ${pagesCount()} creata automaticamente.`);
}
function openSupplyReferenceDialog() {
  const supplies = uniqueSupplies().filter((supply) => !pageNodes().some((node) => node.type === 'supply' && supplyKey(node) === supplyKey(supply)));
  if (!supplies.length) return showStatus('Non ci sono forniture da richiamare in questa pagina.', 'warning');
  $('#supply-reference-choice').innerHTML = supplies.map((supply) => `<option value="${supplyKey(supply)}">${esc(supply.title)} - ${esc(cableById(supply.supplyType).name)}</option>`).join('');
  $('#supply-reference-dialog').showModal();
}
function addSupplyReference() {
  const original = uniqueSupplies().find((supply) => supplyKey(supply) === $('#supply-reference-choice').value);
  if (!original) return;
  checkpoint('add-supply-reference'); original.supplyKey ||= original.id;
  const firstSupplyAppearance = firstNodeAppearance(original);
  const supplyReference = { ...firstSupplyAppearance, id: uid(), page: state.currentPage, x: firstSupplyAppearance.x, y: firstSupplyAppearance.y, socket: '' };
  const originalSupplyIds = new Set(supplyGroup(original).map((supply) => supply.id));
  const supplyLink = state.links.find((link) => !isReferenceLink(link) && originalSupplyIds.has(link.from) && nodeById(link.to)?.type === 'panel');
  const connectedPanel = supplyLink && nodeById(supplyLink.to);
  let panelReference = connectedPanel && pageNodes().find((node) => node.type === 'panel' && panelKey(node) === panelKey(connectedPanel));
  state.nodes.push(supplyReference);
  if (connectedPanel && !panelReference) {
    connectedPanel.panelKey ||= connectedPanel.id;
    const firstPanelAppearance = firstNodeAppearance(connectedPanel);
    panelReference = { ...firstPanelAppearance, id: uid(), page: state.currentPage, x: firstPanelAppearance.x, y: firstPanelAppearance.y, socket: '' };
    state.nodes.push(panelReference);
  }
  autoRecallConnections();
  state.selected = supplyReference.id; state.selectedIds = panelReference ? [supplyReference.id, panelReference.id] : [supplyReference.id]; state.selectedLink = null;
  $('#supply-reference-dialog').close(); markChanged(connectedPanel ? 'Fornitura, quadro e collegamento richiamati.' : 'Fornitura richiamata: non risulta collegata a un quadro.'); render();
}
function linkReferenceCandidates() {
  const nodes = pageNodes();
  return state.links.filter((link) => !isReferenceLink(link)).map((link) => {
    const originalFrom = nodeById(link.from), originalTo = nodeById(link.to);
    const from = nodes.find((node) => Core.samePhysicalNode(node, originalFrom)), to = nodes.find((node) => Core.samePhysicalNode(node, originalTo));
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
  if (!pendingLinkReferences.length) return showStatus('Richiama prima nella pagina sia l’origine sia la destinazione del collegamento.', 'warning');
  $('#link-reference-choice').innerHTML = pendingLinkReferences.map((item, index) => `<option value="${index}">${esc(item.originalFrom.title)} → ${esc(item.originalTo.title)} · ${esc(cableById(item.link.cable).name)}</option>`).join('');
  $('#link-reference-dialog').showModal();
}
function addLinkReference() {
  const item = pendingLinkReferences[Number($('#link-reference-choice').value)];
  if (!item) return;
  checkpoint('add-link-reference'); const link = addLinkReferenceItem(item); if (!link) return;
  $('#link-reference-dialog').close(); state.selectedLink = link.id; state.selected = null; state.selectedIds = []; markChanged(); render(); showStatus('Collegamento richiamato.', 'success');
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
  let linked = 0; nodes.forEach((node) => { if (parentId && tryAddLink(parentId, node.id, plugType, 20, false, false)) linked++; });
  const extraPages = ensureLoadPageCapacity(state.currentPage, nodes.map((node) => node.id));
  $('#bulk-load-dialog').close(); state.selectedIds = nodes.filter((node) => node.page === state.currentPage).map((node) => node.id); state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; markChanged(); render(); showStatus(`Aggiunte ${count} utenze${parentId ? `, collegate ${linked}` : ''}${extraPages ? ` e distribuite su ${extraPages + 1} pagine` : ''}.`, parentId && linked < count ? 'warning' : 'success');
}
function addPanelFromLibrary(matricola) {
  if (isPanelMatricolaUsed(matricola)) { showStatus(`Il quadro con matricola ${matricola} è già presente nel progetto.`, 'warning'); return; }
  const config = PANEL_LIBRARY.find((item) => item.matricola === matricola); if (!config) return showStatus('Configurazione quadro non disponibile.', 'warning');
  checkpoint('add-panel'); const index = pageNodes().filter((node) => node.type === 'panel').length + 1;
  const position = panelPosition(index - 1);
  const node = { id: uid(), panelKey: uid(), type: 'panel', page: state.currentPage, x: position.x, y: position.y, title: `Quadro #${index}`, subtitle: '', details: matricola, panelModel: matricola, inputType: config.inputType, socket: '', ports: config.ports.map((port) => ({ ...port })) };
  state.nodes.push(node); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#panel-dialog').close(); markChanged(); render();
}
function panelPosition(index) { return { x: Math.min(520, 280 + Math.floor(index / 5) * 240), y: 165 + (index % 5) * 110 }; }
function renderTemporaryPorts() { $('#temporary-panel-ports').innerHTML = temporaryPorts.map((port, index) => `<div class="temporary-port"><label>Uscita<select data-port-type="${index}">${panelPortOptions(port.type)}</select></label><label>Quantità<input data-port-quantity="${index}" type="number" min="1" value="${port.quantity}" /></label>${temporaryPorts.length > 1 ? `<button type="button" data-remove-port="${index}">Rimuovi</button>` : ''}</div>`).join(''); }
function openTemporaryPanelDialog(node = null) { editingTemporaryPanelId = node?.id || null; temporaryPorts = node?.ports?.map((port) => ({ ...port })) || [{ type: 'cee16mono', quantity: 1 }]; $('#temporary-panel-input').innerHTML = cableOptions(node?.inputType || 'cee63tri'); $('#temporary-panel-name').value = node?.title || 'Quadro temporaneo'; $('#temporary-panel-code').value = node?.details || ''; $('#confirm-temporary-panel').textContent = node ? 'Salva modifiche' : 'Aggiungi quadro'; renderTemporaryPorts(); $('#temporary-panel-dialog').showModal(); }
function addTemporaryPanel() {
  const existing = nodeById(editingTemporaryPanelId), inputType = $('#temporary-panel-input').value, title = $('#temporary-panel-name').value || 'Quadro temporaneo', details = $('#temporary-panel-code').value || 'Quadro temporaneo', ports = temporaryPorts.map((port) => ({ ...port }));
  if (existing) {
    const before = historySnapshot(); checkpoint('edit-temporary-panel');
    panelGroup(existing).forEach((panel) => { panel.title = title; panel.details = details; panel.inputType = inputType; panel.ports = ports.map((port) => ({ ...port })); });
    const issue = projectIssues()[0];
    if (issue) { restoreHistorySnapshot(before); dropNoopHistory(); showStatus(`Modifica annullata: ${issue.message}`, 'error'); return; }
    state.selected = existing.id; state.selectedIds = [existing.id]; editingTemporaryPanelId = null; $('#temporary-panel-dialog').close(); markChanged(); render(); return;
  }
  checkpoint('add-temporary-panel');
  const index = pageNodes().filter((node) => node.type === 'panel').length + 1, position = panelPosition(index - 1); const node = { id: uid(), panelKey: uid(), type: 'panel', page: state.currentPage, x: position.x, y: position.y, title, subtitle: '', details, panelModel: 'Temporaneo', inputType, socket: '', ports }; state.nodes.push(node); state.selected = node.id; state.selectedIds = [node.id]; state.selectedLink = null; $('#temporary-panel-dialog').close(); render();
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
  const rows = Math.min(loadGrid ? 6 : 4, items.length), columns = Math.ceil(items.length / rows), stepX = loadGrid ? 245 : 220, stepY = loadGrid ? Math.min(120, rows > 1 ? 620 / (rows - 1) : 100) : 132;
  const minCenter = 110 + ((columns - 1) * stepX) / 2, maxCenter = 1090 - ((columns - 1) * stepX) / 2, centerX = Math.max(minCenter, Math.min(maxCenter, anchorX)), startX = centerX - ((columns - 1) * stepX) / 2, startY = 390 - ((rows - 1) * stepY) / 2;
  items.forEach((node, index) => { const column = Math.floor(index / rows), row = index % rows; node.x = startX + column * stepX; node.y = startY + row * stepY; });
}
function placeNewLoads(nodes, page) {
  const movingIds = new Set(nodes.map((node) => node.id));
  const occupied = state.nodes.filter((node) => node.page === page && !movingIds.has(node.id)).map((node) => ({ x: node.x, y: node.y, height: nodeDisplayHeight(node) }));
  const preferredX = [835, 1080, 590, 345, 110];
  const preferredY = [115, 225, 335, 445, 555, 665];
  nodes.forEach((node) => {
    const height = nodeDisplayHeight(node);
    const isFree = (x, y) => x >= 110 && x <= 1090 && y - height / 2 >= 15 && y + height / 2 <= 735 && !occupied.some((item) => Math.abs(x - item.x) < NODE_HALF * 2 + 18 && Math.abs(y - item.y) < (height + item.height) / 2 + 18);
    const preferred = [{ x: node.x, y: node.y }, ...preferredX.flatMap((x) => preferredY.map((y) => ({ x, y })))];
    let position = preferred.find((candidate) => isFree(candidate.x, candidate.y));
    if (!position) {
      search: for (let x = 110; x <= 1090; x += 35) {
        for (let y = Math.ceil(15 + height / 2); y <= Math.floor(735 - height / 2); y += 25) {
          if (isFree(x, y)) { position = { x, y }; break search; }
        }
      }
    }
    if (position) { node.x = position.x; node.y = position.y; }
    occupied.push({ x: node.x, y: node.y, height });
  });
}
function createPhysicalReference(source, page) {
  const existing = state.nodes.find((node) => node.page === page && Core.samePhysicalNode(node, source));
  if (existing) return existing;
  const index = state.nodes.filter((node) => node.page === page && node.type === source.type).length;
  const position = source.type === 'supply' ? { x: 90, y: 135 + index * 95 } : panelPosition(index);
  const reference = { ...source, id: uid(), page, x: position.x, y: position.y, socket: '' };
  state.nodes.push(reference);
  return reference;
}
function ensureLoadPageCapacity(page, addedIds = []) {
  const loads = state.nodes.filter((node) => node.type === 'load' && node.page === page);
  const added = new Set(addedIds);
  if (loads.length <= MAX_LOADS_PER_PAGE) { placeNewLoads(loads.filter((node) => added.has(node.id)), page); return 0; }
  const existing = loads.filter((node) => !added.has(node.id));
  const candidates = loads.filter((node) => added.has(node.id));
  if (!candidates.length) candidates.push(...loads.slice(MAX_LOADS_PER_PAGE));
  const units = [], grouped = new Set();
  candidates.forEach((load) => {
    const link = state.links.find((item) => !isReferenceLink(item) && item.to === load.id);
    if (link?.socapexGroup) {
      if (grouped.has(link.socapexGroup)) return;
      grouped.add(link.socapexGroup);
      units.push(candidates.filter((item) => state.links.some((candidate) => candidate.socapexGroup === link.socapexGroup && candidate.to === item.id)));
    } else units.push([load]);
  });
  const kept = [], chunks = [];
  let available = Math.max(0, MAX_LOADS_PER_PAGE - existing.length);
  units.forEach((unit) => {
    if (unit.length <= available) { kept.push(...unit); available -= unit.length; return; }
    if (!chunks.length || chunks.at(-1).length + unit.length > MAX_LOADS_PER_PAGE) chunks.push([]);
    chunks.at(-1).push(...unit);
  });
  placeNewLoads(kept, page);
  let createdPages = 0;
  chunks.forEach((chunk) => {
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
  $('#capture-use-socapex').closest('.inline-option').classList.toggle('is-disabled', !enabled);
  if (!enabled) $('#capture-use-socapex').checked = false;
  $('#capture-socapex-help').textContent = enabled ? 'I circuiti CEE 16 A monofase saranno raggruppati automaticamente, fino a 6 per ogni Socapex.' : 'Scegli prima un quadro per attivare il collegamento tramite Socapex.';
}
function connectLoadsAsSocapex(parentId, loadIds, length = 20) {
  const parent = nodeById(parentId), eligibleIds = loadIds.filter((id) => { const load = nodeById(id); return load?.type === 'load' && load.plugType === 'cee16mono' && !state.links.some((link) => !isReferenceLink(link) && link.to === id); });
  if (!parent || parent.type !== 'panel') return { linked: 0, groups: 0 };
  let linked = 0, groups = 0;
  for (let offset = 0; offset < eligibleIds.length;) {
    const sockets = Core.availableSocapexSockets(state, parent);
    if (!sockets.length) break;
    const groupIds = eligibleIds.slice(offset, offset + Math.min(6, sockets.length)), groupId = uid();
    groupIds.forEach((loadId, index) => { const load = nodeById(loadId); load.socket = sockets[index].name; state.links.push({ id: uid(), from: parentId, to: loadId, cable: 'socapex', length, socapexGroup: groupId }); });
    linked += groupIds.length; groups++; offset += groupIds.length;
  }
  return { linked, groups };
}
function importSelectedCaptureGroups() {
  const selected = [...document.querySelectorAll('[data-capture-index]:checked')].map((input) => pendingCaptureGroups[Number(input.dataset.captureIndex)]), parent = $('#capture-parent').value, useSocapex = parent && $('#capture-use-socapex').checked; let index = pageNodes().filter((node) => node.type === 'load').length, linked = 0, socapexGroups = 0; const importedIds = [];
  if (!selected.length) return showStatus('Seleziona almeno un circuito da importare.', 'warning');
  checkpoint('import-capture');
  selected.forEach((group) => { index++; const node = { id: uid(), type: 'load', page: state.currentPage, x: 835, y: Math.min(650, 120 + index * 75), title: `Circuito ${group.circuit}`, subtitle: CABLES[0].plug, plugType: 'cee16mono', details: `Assorbimento ${(group.watts / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kW`, socket: '', watts: group.watts, fixtures: group.fixtures }; state.nodes.push(node); importedIds.push(node.id); });
  if (useSocapex) ({ linked, groups: socapexGroups } = connectLoadsAsSocapex(parent, importedIds));
  else if (parent) importedIds.forEach((id) => { if (tryAddLink(parent, id, 'cee16mono', 20, false, false)) linked++; });
  const extraPages = ensureLoadPageCapacity(state.currentPage, importedIds);
  $('#capture-import-dialog').close(); state.selectedIds = importedIds.filter((id) => nodeById(id)?.page === state.currentPage); state.selected = state.selectedIds.at(-1) || null; markChanged(); render(); showStatus(`Importati ${selected.length} circuiti${parent ? `, collegati ${linked}${useSocapex ? ` in ${socapexGroups} Socapex` : ''}` : ''}${parent && linked < selected.length ? `; ${selected.length - linked} senza collegamento per mancanza di prese libere` : ''}${extraPages ? `, distribuiti su ${extraPages + 1} pagine` : ''}.`, parent && linked < selected.length ? 'warning' : 'success');
}
function openSocapexDialog() {
  const panels = pageNodes().filter((node) => node.type === 'panel');
  const loads = pageNodes().filter((node) => node.type === 'load' && node.plugType === 'cee16mono' && !state.links.some((link) => link.to === node.id));
  $('#socapex-parent').innerHTML = panels.map((node) => `<option value="${node.id}">${esc(node.title)}${node.details ? ` (${esc(node.details)})` : ''}</option>`).join('');
  const prefixes = [...new Set(loads.map((node) => circuitPrefix(node.title)))];
  $('#socapex-prefix-actions').innerHTML = prefixes.map((prefix) => `<button type="button" data-socapex-prefix="${esc(prefix)}">Solo ${esc(prefix)}</button>`).join('');
  $('#socapex-load-list').innerHTML = loads.length ? loads.map((node) => `<label class="capture-circuit"><input type="checkbox" data-socapex-load="${node.id}" /><span><strong>${esc(node.title)}</strong><br />${esc(node.socket ? `Presa ${node.socket} · ` : '')}${esc(node.details || '')}</span></label>`).join('') : '<p class="help">Non ci sono utenze CEE 16 A monofase non ancora collegate in questa pagina.</p>';
  if (!panels.length) { showStatus('Aggiungi prima un quadro a questa pagina.', 'warning'); return; }
  $('#socapex-dialog').showModal();
}
function createSocapexGroup() {
  const parentId = $('#socapex-parent').value, loadIds = [...document.querySelectorAll('[data-socapex-load]:checked')].map((input) => input.dataset.socapexLoad), parent = nodeById(parentId);
  if (!parent || !loadIds.length) return showStatus('Seleziona un quadro e almeno un’utenza.', 'warning');
  if (loadIds.length > 6) return showStatus('Un Socapex può raggruppare al massimo 6 utenze CEE 16 A monofase.', 'warning');
  const capacity = (parent.ports || []).filter((port) => port.type === 'cee16mono').reduce((sum, port) => sum + port.quantity, 0), used = state.links.filter((link) => !isReferenceLink(link) && panelKey(nodeById(link.from)) === panelKey(parent) && requiredPlug(nodeById(link.to)) === 'cee16mono').length;
  if (used + loadIds.length > capacity) return showStatus(`Collegamento bloccato: le prese CEE 16 A monofase del quadro ${parent.title} non bastano (${used}/${capacity} già impegnate).`, 'error');
  const sockets = Core.availableSocapexSockets(state, parent);
  if (sockets.length < loadIds.length) return showStatus(`Collegamento bloccato: non c’è un banco Socapex con abbastanza prese libere sul quadro ${parent.title}.`, 'error');
  checkpoint('create-socapex'); connectLoadsAsSocapex(parentId, loadIds);
  $('#socapex-dialog').close(); state.selected = loadIds.at(-1); state.selectedIds = loadIds; state.selectedLink = null; markChanged(); render(); showStatus(`Creato Socapex unico per ${loadIds.length} utenz${loadIds.length === 1 ? 'a' : 'e'}.`, 'success');
}
function reassignSocapexSockets() {
  const link = linkById(state.selectedLink), parent = link && nodeById(link.from);
  if (!link?.socapexGroup || isReferenceLink(link) || !parent) return;
  const group = socapexGroupLinks(link), sockets = Core.availableSocapexSockets(state, parent, link.socapexGroup);
  if (sockets.length < group.length) return showStatus('Non c’è un banco libero sufficiente per questo Socapex.', 'warning');
  checkpoint('reassign-socapex');
  group.forEach((member, index) => { nodeById(member.to).socket = sockets[index].name; });
  markChanged(`Prese del Socapex riassegnate: ${sockets.slice(0, group.length).map((socket) => socket.name).join(', ')}.`);
  render();
}
function openBulkConnectDialog() {
  const sources = pageNodes().filter((node) => node.type === 'panel'), selectedIds = new Set(state.selectedIds), loads = pageNodes().filter((node) => node.type === 'load' && !state.links.some((link) => link.to === node.id));
  $('#bulk-connect-parent').innerHTML = sources.map((node) => `<option value="${node.id}" ${selectedIds.has(node.id) ? 'selected' : ''}>Quadro: ${esc(node.title)}</option>`).join('');
  $('#bulk-connect-load-list').innerHTML = loads.length ? loads.map((node) => `<label class="capture-circuit"><input type="checkbox" data-bulk-connect-load="${node.id}" ${selectedIds.has(node.id) ? 'checked' : ''}/><span><strong>${esc(node.title)}</strong><br />${esc(node.socket ? `Presa ${node.socket} · ` : '')}${esc(cableById(node.plugType).name)}</span></label>`).join('') : '<p class="help">Non ci sono utenze non ancora collegate in questa pagina.</p>';
  if (!sources.length) { showStatus('Aggiungi prima un quadro a questa pagina.', 'warning'); return; }
  $('#bulk-connect-dialog').showModal();
}
function createBulkConnections() {
  const parentId = $('#bulk-connect-parent').value, targetIds = [...document.querySelectorAll('[data-bulk-connect-load]:checked')].map((input) => input.dataset.bulkConnectLoad), parent = nodeById(parentId);
  if (!parent || !targetIds.length) return showStatus('Seleziona un quadro e almeno un’utenza.', 'warning');
  const targets = targetIds.map(nodeById).filter(Boolean), requirements = new Map();
  targets.forEach((node) => requirements.set(requiredPlug(node), (requirements.get(requiredPlug(node)) || 0) + 1));
  if (parent.type === 'panel') {
    for (const [plug, count] of requirements) {
      const capacity = (parent.ports || []).filter((port) => port.type === plug).reduce((sum, port) => sum + port.quantity, 0), used = state.links.filter((link) => !isReferenceLink(link) && panelKey(nodeById(link.from)) === panelKey(parent) && requiredPlug(nodeById(link.to)) === plug).length;
      if (used + count > capacity) return showStatus(`Collegamento bloccato: le prese ${cableById(plug).name} del quadro ${parent.title} non bastano (${used}/${capacity} già impegnate).`, 'error');
    }
  }
  const incompatible = targets.map((node) => compatibilityWarning(parent, node)).find(Boolean); if (incompatible) return showStatus(incompatible, 'error');
  checkpoint('bulk-connect'); targets.forEach((node) => tryAddLink(parent.id, node.id, requiredPlug(node), 20, false, false));
  $('#bulk-connect-dialog').close(); state.selectedIds = [parent.id, ...targetIds]; state.selected = parent.id; state.selectedLink = null; markChanged(); render(); showStatus(`Collegate ${targetIds.length} utenz${targetIds.length === 1 ? 'a' : 'e'}.`, 'success');
}
function openArrangeDialog() {
  const targets = selectedNodes();
  if (!targets.length) { showStatus('Seleziona gli elementi da ordinare, oppure disegna un riquadro attorno a loro.', 'warning'); return; }
  const references = pageNodes().filter((node) => !state.selectedIds.includes(node.id));
  $('#arrange-reference').innerHTML = references.map((node) => `<option value="${node.id}">${node.type === 'panel' ? 'Quadro' : node.type === 'supply' ? 'Fornitura' : 'Utenza'}: ${esc(node.title)}</option>`).join('');
  $('#arrange-reference-row').hidden = true; $('#arrange-mode').value = 'center'; $('#arrange-dialog').showModal();
}
function arrangeSelectedNodes() {
  const targets = selectedNodes(), mode = $('#arrange-mode').value, reference = nodeById($('#arrange-reference').value);
  if (!targets.length) return;
  checkpoint('arrange'); arrangeNodes(targets, mode === 'relative' && reference ? reference.x + 310 : 600);
  $('#arrange-dialog').close(); markChanged(); render(); showStatus(`${targets.length} elementi ordinati.`, 'success');
}
function openAlignDialog() { if (!selectedNodes().length) return showStatus('Seleziona gli elementi da allineare.', 'warning'); $('#align-dialog').showModal(); }
function distributeSelectedNodes(axis) {
  const nodes = selectedNodes().length ? selectedNodes() : pageNodes().filter((node) => node.type === 'load');
  if (nodes.length < 3) return showStatus('Seleziona almeno tre elementi da spaziare, oppure togli la selezione per spaziare tutte le utenze della pagina.', 'warning');
  const result = Core.distributeNodes(nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: NODE_HALF * 2, height: nodeDisplayHeight(node) })), axis);
  if (!result.ok) return showStatus('Spazio insufficiente per distanziare questi elementi su una sola riga o colonna. Usa “Ordina selezionati”.', 'warning');
  checkpoint(`distribute-${axis}`);
  result.positions.forEach((position) => Object.assign(nodeById(position.id), { x: position.x, y: position.y }));
  markChanged(`Spaziatura uniforme applicata a ${nodes.length} elementi.`); render();
}
function alignSelectedNodes() {
  const nodes = selectedNodes(); if (nodes.length < 2) return showStatus('Seleziona almeno due elementi da allineare.', 'warning');
  const mode = $('#align-mode').value;
  const aligned = Core.alignNodesWithoutOverlap(nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: NODE_HALF * 2, height: nodeDisplayHeight(node) })), mode, { gap: 24 });
  if (!aligned.ok) return showStatus('Non c’è spazio sufficiente per allineare questi elementi senza sovrapporli. Usa “Ordina selezionati” oppure riduci la selezione.', 'warning');
  checkpoint('align');
  const positions = new Map(aligned.positions.map((position) => [position.id, position]));
  nodes.forEach((node) => { const position = positions.get(node.id); node.x = position.x; node.y = position.y; });
  $('#align-dialog').close(); markChanged(); render(); showStatus(`${nodes.length} elementi allineati e distanziati.`, 'success');
}
function duplicateSelectedLoads() {
  const originals = selectedNodes().filter((node) => node.type === 'load');
  if (!originals.length) return showStatus('Seleziona almeno un’utenza da duplicare.', 'warning');
  checkpoint('duplicate-loads'); const duplicates = originals.map((original, index) => {
    const baseTitle = original.title.replace(/\s+copia(?:\s+\d+)?$/i, ''), sameTitles = state.nodes.filter((node) => node.type === 'load' && node.page === state.currentPage && node.title.startsWith(`${baseTitle} copia`)).length;
    return { ...original, id: uid(), title: `${baseTitle} copia${sameTitles + index ? ` ${sameTitles + index + 1}` : ''}`, socket: '', x: original.x + 20, y: original.y + 20 };
  });
  state.nodes.push(...duplicates); const extraPages = ensureLoadPageCapacity(state.currentPage, duplicates.map((node) => node.id)); state.selectedIds = duplicates.filter((node) => node.page === state.currentPage).map((node) => node.id); state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; markChanged(); render(); showStatus(`Duplicate ${duplicates.length} utenz${duplicates.length === 1 ? 'a' : 'e'}${extraPages ? ` su ${extraPages + 1} pagine` : ''}.`, 'success');
}
function applyLoadedProject(raw, options = {}) {
  const normalized = Core.normalizeProject(raw);
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  state = { ...normalized, selected: null, selectedIds: [], selectedLink: null };
  phaseSupplyFilter = '';
  fillProjectForm(state.meta); resetHistory(); $('#welcome-dialog').close();
  savedProjectSnapshot = options.dirty ? null : JSON.stringify(serializableProject());
  dirty = Boolean(options.dirty);
  updateDirtyUi(); render();
  const issues = projectIssues();
  if (issues.length) showStatus(`Progetto aperto con ${issues.length} anomalie: ${issues[0].message}`, 'warning');
  else showStatus(options.message || 'Progetto aperto correttamente.', 'success');
  if (options.dirty) flushAutosave();
}
function loadProjectText(text, options = {}) {
  try {
    applyLoadedProject(JSON.parse(text), options);
    return true;
  } catch (error) {
    showStatus(`Impossibile aprire il progetto: ${error.message}`, 'error');
    return false;
  }
}
function formatProjectLocation(street, postcode, city, province) {
  const locality = [postcode, city].filter(Boolean).join(' ');
  return [street, locality && province ? `${locality} (${province})` : locality || province].filter(Boolean).join(', ');
}
function loadCompanyBook() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPANY_BOOK_KEY) || '[]');
    companyBook = Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === 'string' && typeof item.company === 'string').slice(0, 300).map((item) => ({
      id: item.id, company: item.company.slice(0, 200), companyAddress: String(item.companyAddress || '').slice(0, 500), companyVat: String(item.companyVat || '').slice(0, 100),
    })) : [];
  } catch { companyBook = []; }
  renderCompanyBook();
}
function renderCompanyBook(selected = '') {
  $('#company-book').innerHTML = '<option value="">Compila una nuova ditta</option>' + [...companyBook].sort((a, b) => a.company.localeCompare(b.company, 'it')).map((item) => `<option value="${esc(item.id)}">${esc(item.company)}${item.companyVat ? ` · ${esc(item.companyVat)}` : ''}</option>`).join('');
  $('#company-book').value = selected;
  $('#remove-company').disabled = !selected;
}
function saveCompanyToBook() {
  const company = $('#project-company-name').value.trim(), status = $('#company-book-status');
  if (!company) { status.textContent = 'Scrivi la denominazione della ditta prima di salvarla.'; return; }
  const companyVat = $('#project-company-vat').value.trim();
  const existing = companyBook.find((item) => item.id === $('#company-book').value) || companyBook.find((item) => item.company.toLocaleLowerCase('it') === company.toLocaleLowerCase('it') && item.companyVat === companyVat);
  const entry = { id: existing?.id || uid(), company, companyAddress: $('#project-company-address').value.trim(), companyVat };
  const next = [...companyBook.filter((item) => item.id !== entry.id), entry];
  try {
    localStorage.setItem(COMPANY_BOOK_KEY, JSON.stringify(next));
    companyBook = next;
    renderCompanyBook(entry.id);
    status.textContent = existing ? 'Ditta aggiornata in rubrica.' : 'Ditta salvata in rubrica.';
  } catch { status.textContent = 'Rubrica non disponibile in questo browser. Puoi comunque salvare la ditta nel progetto.'; }
}
function selectCompanyFromBook() {
  const entry = companyBook.find((item) => item.id === $('#company-book').value);
  ['company', 'companyAddress', 'companyVat'].forEach((key) => {
    const id = { company: 'project-company-name', companyAddress: 'project-company-address', companyVat: 'project-company-vat' }[key];
    $(`#${id}`).value = entry?.[key] || '';
  });
  $('#remove-company').disabled = !entry;
  $('#company-book-status').textContent = entry ? 'Ditta selezionata. Puoi modificarne i dati per questo progetto.' : 'La rubrica viene conservata in questo browser.';
}
function removeCompanyFromBook() {
  const id = $('#company-book').value;
  if (!id) return;
  const next = companyBook.filter((item) => item.id !== id);
  try {
    localStorage.setItem(COMPANY_BOOK_KEY, JSON.stringify(next)); companyBook = next; renderCompanyBook();
    $('#company-book-status').textContent = 'Ditta rimossa dalla rubrica. I dati compilati nel progetto restano disponibili.';
  } catch { $('#company-book-status').textContent = 'Impossibile aggiornare la rubrica in questo browser.'; }
}
function resetProjectLocationSearch() {
  projectLocationController?.abort(); projectLocationController = null; projectLocationResults = [];
  const search = $('#project-location-search'), results = $('#project-location-results'), status = $('#project-location-search-status');
  if (search) search.value = '';
  if (results) { results.innerHTML = ''; results.hidden = true; }
  if (status) status.textContent = '';
  $('#search-project-location').disabled = false;
}
function normalizeProvince(value) {
  return String(value || '').replace(/^(?:Provincia|Città metropolitana) di\s+/i, '').replace(/^Metropolitan City of\s+/i, '').trim();
}
function photonLocation(feature) {
  const properties = feature?.properties || {};
  const namedStreet = properties.street || (properties.type === 'street' ? properties.name : '');
  const street = [namedStreet || properties.name, properties.housenumber].filter(Boolean).join(' ').trim();
  const city = properties.city || properties.town || properties.village || properties.municipality || properties.locality || '';
  const province = normalizeProvince(properties.county || properties.state);
  const postcode = properties.postcode || '';
  const venue = properties.name && properties.name !== namedStreet && properties.name !== street ? properties.name : '';
  const label = [venue, street, [postcode, city].filter(Boolean).join(' '), province].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ');
  return { street, postcode, city, province, venue, label: label || properties.name || 'Indirizzo' };
}
function renderProjectLocationResults(results) {
  const container = $('#project-location-results'); projectLocationResults = results;
  container.innerHTML = results.map((result, index) => `<button type="button" class="project-location-result" data-location-index="${index}"><strong>${esc(result.venue || result.street || result.label)}</strong><span>${esc([result.venue ? result.street : '', result.postcode, result.city, result.province].filter(Boolean).join(' · '))}</span></button>`).join('');
  container.hidden = !results.length;
  $('#project-location-search-status').textContent = results.length ? `${results.length} risultat${results.length === 1 ? 'o' : 'i'}: scegli l’indirizzo corretto.` : 'Nessun indirizzo trovato. Puoi compilare i campi manualmente.';
}
async function searchProjectLocation() {
  const query = $('#project-location-search').value.trim() || ['street', 'postcode', 'city', 'province'].map((part) => $(`#project-location-${part}`).value.trim()).filter(Boolean).join(' ');
  const status = $('#project-location-search-status'), button = $('#search-project-location');
  if (query.length < 3) { status.textContent = 'Scrivi l’indirizzo da cercare qui sopra oppure nel campo Via / Strada / Piazza.'; $('#project-location-search').focus(); return; }
  projectLocationController?.abort();
  projectLocationController = null;
  const cacheKey = query.toLocaleLowerCase('it-IT');
  if (projectLocationCache.has(cacheKey)) { button.disabled = false; renderProjectLocationResults(projectLocationCache.get(cacheKey)); return; }
  const controller = new AbortController(); projectLocationController = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
  button.disabled = true; status.textContent = 'Ricerca indirizzo in corso…'; $('#project-location-results').hidden = true;
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query); url.searchParams.set('limit', '6'); url.searchParams.set('bbox', '6.4,35.3,18.8,47.2');
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const results = (Array.isArray(data.features) ? data.features : []).map(photonLocation).filter((result) => result.street || result.city);
    projectLocationCache.set(cacheKey, results);
    if (projectLocationCache.size > 30) projectLocationCache.delete(projectLocationCache.keys().next().value);
    if (projectLocationController === controller) renderProjectLocationResults(results);
  } catch (error) {
    if (projectLocationController === controller && (timedOut || error.name !== 'AbortError')) status.textContent = 'Ricerca momentaneamente non disponibile. Puoi compilare i campi manualmente.';
  } finally {
    clearTimeout(timeout);
    if (projectLocationController === controller) { projectLocationController = null; button.disabled = false; }
  }
}
function selectProjectLocation(index) {
  const result = projectLocationResults[index]; if (!result) return;
  $('#project-location-street').value = result.street;
  $('#project-location-postcode').value = result.postcode;
  $('#project-location-city').value = result.city;
  $('#project-location-province').value = result.province;
  $('#project-location-results').hidden = true;
  $('#project-location-search-status').textContent = 'Indirizzo selezionato. Puoi correggere manualmente i campi prima di salvare.';
}
function projectMetaFromForm() {
  const locationStreet = $('#project-location-street').value.trim();
  const locationPostcode = $('#project-location-postcode').value.trim();
  const locationCity = $('#project-location-city').value.trim();
  const locationProvince = $('#project-location-province').value.trim();
  return {
    name: $('#project-event-name').value.trim(),
    location: formatProjectLocation(locationStreet, locationPostcode, locationCity, locationProvince),
    locationStreet,
    locationPostcode,
    locationCity,
    locationProvince,
    type: $('#project-type').value.trim(),
    revision: $('#project-version').value.trim(),
    company: $('#project-company-name').value.trim(),
    companyAddress: $('#project-company-address').value.trim(),
    companyVat: $('#project-company-vat').value.trim(),
  };
}
function fillProjectForm(meta) {
  renderCompanyBook();
  $('#company-book-status').textContent = 'La rubrica viene conservata in questo browser.';
  const ids = { name: 'project-event-name', type: 'project-type', revision: 'project-version', company: 'project-company-name', companyAddress: 'project-company-address', companyVat: 'project-company-vat' };
  Object.entries(ids).forEach(([key, id]) => { $(`#${id}`).value = meta[key] || ''; });
  const hasStructuredLocation = Boolean(meta.locationStreet || meta.locationPostcode || meta.locationCity || meta.locationProvince);
  $('#project-location-street').value = meta.locationStreet || (!hasStructuredLocation ? meta.location || '' : '');
  $('#project-location-postcode').value = meta.locationPostcode || '';
  $('#project-location-city').value = meta.locationCity || '';
  $('#project-location-province').value = meta.locationProvince || '';
  resetProjectLocationSearch();
}
function openProjectDialog(mode = 'edit') {
  projectDialogMode = mode;
  const creating = mode === 'new';
  const defaults = creating
    ? { name: '', location: '', locationStreet: '', locationPostcode: '', locationCity: '', locationProvince: '', type: 'Allestimento Luci', revision: '1.0', company: '', companyAddress: '', companyVat: '' }
    : state.meta;
  fillProjectForm(defaults);
  $('#project-dialog-title').textContent = creating ? 'Nuovo progetto' : 'Proprietà progetto';
  $('#confirm-project').textContent = creating ? 'Crea progetto' : 'Salva modifiche';
  $('#project-dialog').showModal();
  $('#project-event-name').focus();
}
function createNewProject() {
  if (dirty && !window.confirm('Creare un nuovo progetto? Salva prima il progetto corrente se vuoi conservarlo.')) return;
  openProjectDialog('new');
}
function confirmProjectProperties() {
  const form = $('#project-dialog-form');
  if (!form.reportValidity()) return;
  const meta = projectMetaFromForm();
  if (projectDialogMode === 'new') {
    const normalized = Core.normalizeProject({ version: Core.SCHEMA_VERSION, meta, pages: [1], nodes: [], links: [] });
    state = { ...normalized, selected: null, selectedIds: [], selectedLink: null };
    resetHistory(); savedProjectSnapshot = null; $('#welcome-dialog').close(); $('#project-dialog').close(); fillProjectForm(state.meta); markChanged('Nuovo progetto creato.'); render();
    return;
  }
  checkpoint('edit-project'); state.meta = meta; $('#project-dialog').close(); fillProjectForm(state.meta); markChanged('Proprietà progetto aggiornate.'); render();
}
function panelTypeCode(matricola) { return matricola.match(/^[A-Z]+\d+[A-Z]*/)?.[0] || matricola; }
function panelTypeLabel(code) { return ({ PB250A: 'Quadro 250 A', PB125A: 'Quadro 125 A', PB63A: 'Quadro 63 A', PB32AT: 'Quadro 32 A trifase', PB32AM: 'Quadro 32 A monofase' })[code] || code; }
function panelSocketCounts(panel) {
  const sockets = Core.panelSockets(panel), key = panelKey(panel);
  const occupied = new Set(state.links.filter((link) => !isReferenceLink(link) && panelKey(nodeById(link.from)) === key).map((link) => nodeById(link.to)?.socket));
  const types = [...new Set(sockets.map((socket) => socket.type))];
  return types.map((type) => ({ type, total: sockets.filter((socket) => socket.type === type).length, free: sockets.filter((socket) => socket.type === type && !occupied.has(socket.name)).length }));
}
function panelSocketSummaryMarkup(panel) {
  return `<div class="socket-summary"><strong>Prese libere / totali</strong>${panelSocketCounts(panel).map((count) => `<span><b>${count.free}/${count.total}</b> ${esc(cableById(count.type).name)}</span>`).join('')}</div>`;
}
function updatePanelMatricolaChoices() {
  const query = $('#panel-search').value.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
  const type = $('#panel-type').value, input = $('#panel-input-filter').value, includeUsed = $('#panel-include-used').checked;
  const models = PANEL_LIBRARY.filter((model) => {
    const used = isPanelMatricolaUsed(model.matricola);
    const text = `${model.matricola} ${panelTypeLabel(panelTypeCode(model.matricola))} ${cableById(model.inputType).name} ${cableById(model.inputType).plug}`.toLocaleLowerCase('it');
    return (!type || panelTypeCode(model.matricola) === type) && (!input || model.inputType === input) && (includeUsed || !used) && query.every((word) => text.includes(word));
  });
  const selected = $('#panel-choice').value, available = models.filter((model) => !isPanelMatricolaUsed(model.matricola));
  $('#panel-choice').innerHTML = available.length ? available.map((model) => `<option value="${model.matricola}" ${model.matricola === selected ? 'selected' : ''}>${model.matricola}</option>`).join('') : '<option value="">Nessuna matricola disponibile</option>';
  $('#panel-results-count').textContent = `${models.length} quadri trovati · ${available.length} disponibili`;
  $('#panel-results').innerHTML = models.length ? models.map((model) => {
    const existing = state.nodes.find((node) => node.type === 'panel' && node.panelModel === model.matricola);
    const panel = existing || { id: `catalog:${model.matricola}`, panelModel: model.matricola, ports: model.ports };
    return `<article class="catalog-card"><div><strong>${esc(model.matricola)}</strong><span>${esc(cableById(model.inputType).name)} in ingresso</span></div>${panelSocketSummaryMarkup(panel)}<button type="button" class="button" data-choose-panel="${esc(model.matricola)}" ${existing ? 'disabled' : ''}>${existing ? `Già in uso · pagina ${existing.page}` : 'Scegli questo quadro'}</button></article>`;
  }).join('') : '<p class="catalog-empty">Nessun quadro corrisponde ai filtri. Prova una matricola o un ingresso diverso.</p>';
  updatePanelChoiceDetails();
}
function openPanelDialog() {
  const types = [...new Set(PANEL_LIBRARY.map((model) => panelTypeCode(model.matricola)))];
  $('#panel-search').value = '';
  $('#panel-include-used').checked = false;
  $('#panel-type').innerHTML = '<option value="">Tutti i quadri</option>' + types.map((type) => `<option value="${type}">${panelTypeLabel(type)}</option>`).join('');
  const inputs = [...new Set(PANEL_LIBRARY.map((model) => model.inputType))];
  $('#panel-input-filter').innerHTML = '<option value="">Tutti gli ingressi</option>' + cableOptionMarkup(inputs.map(cableById), '');
  const selectedSupply = nodeById(state.selected)?.type === 'supply' ? nodeById(state.selected) : pageNodes().find((node) => node.type === 'supply' && !state.links.some((link) => !isReferenceLink(link) && link.from === node.id));
  if (selectedSupply) $('#panel-input-filter').value = inputs.find((input) => input === selectedSupply.supplyType) || inputs.find((input) => connectorCanFeedInput(selectedSupply.supplyType, input)) || '';
  updatePanelMatricolaChoices();
  $('#panel-dialog').showModal();
  $('#panel-search').focus();
}
function updatePanelChoiceDetails() {
  const model = PANEL_LIBRARY.find((row) => row.matricola === $('#panel-choice').value);
  $('#confirm-panel').disabled = !model || isPanelMatricolaUsed(model.matricola);
  $('#panel-choice-details').textContent = model ? `Selezionato ${model.matricola} · ${cableById(model.inputType).name} in ingresso` : 'Nessuna matricola disponibile con questi filtri.';
  $('#panel-results').querySelectorAll('.catalog-card').forEach((card) => card.classList.toggle('chosen', card.querySelector('[data-choose-panel]').dataset.choosePanel === model?.matricola));
}
function refreshLinkDialog() {
  const source = nodeById($('#link-from').value);
  const targets = pageNodes().filter((node) => {
    if (!source || node.id === source.id || !['panel', 'load'].includes(node.type)) return false;
    return !compatibilityWarning(source, node, null, requiredPlug(node));
  });
  const previousTarget = $('#link-to').value;
  $('#link-to').innerHTML = targets.map((node) => `<option value="${node.id}" ${node.id === previousTarget ? 'selected' : ''}>${esc(node.title)}</option>`).join('');
  const target = nodeById($('#link-to').value), required = requiredPlug(target), previousCable = $('#link-cable').value;
  const allowed = target ? CABLES.filter((cable) => {
    if (cable.internal || cable.id === 'socapex') return false;
    if (!compatibleConnector(cable.id, required)) return false;
    if (source.type === 'supply') return true;
    return (source.ports || []).some((port) => (target.type === 'panel' ? connectorCanFeedInput(port.type, required) : compatibleConnector(port.type, required)) && compatibleConnector(cable.id, required));
  }) : [];
  $('#link-cable').innerHTML = allowed.map((cable) => `<option value="${cable.id}" ${cable.id === previousCable ? 'selected' : ''}>${cable.name}</option>`).join('');
  const selectedCable = $('#link-cable').value || required;
  $('#link-section').innerHTML = selectedCable ? cableSectionOptions(selectedCable, required) : '';
  $('#confirm-link').disabled = !source || !target || !allowed.length;
}
function showLinkDialog() {
  const sources = pageNodes().filter((node) => ['supply', 'panel'].includes(node.type));
  if (!sources.length) return showStatus('Aggiungi prima una fornitura o un quadro.', 'warning');
  $('#link-from').innerHTML = sources.map((node) => `<option value="${node.id}">${esc(node.title)}</option>`).join('');
  refreshLinkDialog();
  if (!$('#link-to').options.length) return showStatus('Non ci sono destinazioni compatibili e libere in questa pagina.', 'warning');
  $('#link-dialog').showModal();
}
function save() {
  const issues = projectIssues();
  if (issues.length) return showStatus(`Salvataggio bloccato: ${issues[0].message}`, 'error');
  const blob = new Blob([JSON.stringify(serializableProject(), null, 2)], { type: 'application/json' }), filename = [state.meta.name || 'unifilare', state.meta.revision].filter(Boolean).join(' ').replace(/[^\w]+/g, '-').toLowerCase(), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${filename}.json`; anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  markSaved(); showStatus('File progetto esportato.', 'success');
}
function coverMarkup() {
  const company = [state.meta.company, state.meta.companyAddress, state.meta.companyVat ? `P. IVA ${state.meta.companyVat}` : ''].filter(Boolean).join('\n');
  const rows = [['Nome Evento', state.meta.name || '—'], ['Location', state.meta.location || '—'], ['Descrizione Allestimento', state.meta.type || '—'], ['Versione', state.meta.revision || '—'], ['Ditta esecutrice', company || '—']];
  return `<article class="cover-sheet" data-print-page="1"><div class="cover-heading">Schema unifilare di distribuzione elettrica</div><div class="cover-grid">${rows.map(([label, value]) => `<div class="cover-row"><div class="cover-label">${esc(label)}</div><div class="cover-value ${label === 'Ditta esecutrice' ? 'cover-company' : ''}">${esc(value)}</div></div>`).join('')}</div></article>`;
}
function titleBlockMarkup(page, total) {
  return `<footer class="title-block"><div><small>Ditta esecutrice</small><strong>${esc(state.meta.company || '—')}</strong><span>${esc(state.meta.companyAddress || '—')}</span>${state.meta.companyVat ? `<span>P. IVA ${esc(state.meta.companyVat)}</span>` : ''}</div><div><small>Descrizione</small><strong>${esc(state.meta.type || '—')}</strong></div><div><small>Evento</small><strong>${esc(state.meta.name || '—')}</strong></div><div><small>Luogo</small><strong>${esc(state.meta.location || '—')}</strong></div><div><small>Versione</small><strong>${esc(state.meta.revision || '1.0')}</strong><small>Pagina ${page} di ${total}</small></div></footer>`;
}
function compactPageRanges(pages) {
  const numbers = [...new Set(pages)].sort((a, b) => a - b), ranges = [];
  for (let i = 0; i < numbers.length; i += 1) {
    const first = numbers[i]; let last = first;
    while (numbers[i + 1] === last + 1) last = numbers[++i];
    ranges.push({ first, label: first === last ? String(first) : `${first}-${last}` });
  }
  return ranges;
}
function printedEntryRows(entries, pageNumbers) {
  return entries.flatMap((entry) => {
    const pages = entry.pages.map((page) => pageNumbers.get(page)).filter(Boolean), groups = [];
    let group = [];
    pages.forEach((page) => {
      if (group.length && compactPageRanges([...group, page]).map((range) => range.label).join(', ').length > 44) {
        groups.push(group); group = [];
      }
      group.push(page);
    });
    if (group.length) groups.push(group);
    return groups.map((printedPages, index) => ({ ...entry, printedPages, continued: index > 0 }));
  });
}
function printPageLinks(pages) {
  return compactPageRanges(pages).map(({ first, label }) => `<a href="#print-page-${first}">${label}</a>`).join(', ');
}
function printSheetMarkup(className, title, page, total, content, note = '') {
  const subtitle = [state.meta.name, state.meta.type].filter(Boolean).join(' · ');
  return `<article class="print-sheet ${className}" id="print-page-${page}" data-print-page="${page}"><div class="print-frame"><header class="print-heading"><div class="print-kicker"><span>UNIFILARI / DISTRIBUZIONE ELETTRICA</span><span>VERSIONE ${esc(state.meta.revision || '1.0')}</span></div><h1>${title}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</header><div class="print-content">${content}</div>${note}${titleBlockMarkup(page, total)}</div></article>`;
}
function indexMarkup(entries, page, total, continued = false) {
  const rows = entries.map((entry) => `<tr data-root="${esc(entry.rootKey)}"><td><a href="#print-page-${entry.printedPages[0]}">${esc(entry.node?.title || entry.title || 'Fornitura')}${entry.continued ? ' (segue)' : ''}</a></td><td>${printPageLinks(entry.printedPages)}</td></tr>`).join('');
  const table = `<table class="print-table index-table"><thead><tr><th>Fornitura / quadro</th><th>Pagine del PDF</th></tr></thead><tbody>${rows}</tbody></table>`;
  return printSheetMarkup('index-sheet', `Indice degli schemi${continued ? ' (segue)' : ''}`, page, total, table, '<p class="print-note index-hint">Seleziona un nome o un numero di pagina per aprire lo schema. Gli intervalli comprendono tutte le pagine indicate.</p>');
}
const printKW = (watts) => `${(watts / 1000).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;
const printAmps = (amps) => `${amps.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A`;
const printPercent = (value) => `${value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
function phaseReportMarkup(entries, page, total, summary, continued = false) {
  const names = ['R', 'S', 'T'], values = names.map((name) => summary.phases[name]);
  const totalWatts = values.reduce((sum, phase) => sum + phase.watts, 0), averageWatts = totalWatts / 3;
  const wattDifference = Math.max(...values.map((phase) => phase.watts)) - Math.min(...values.map((phase) => phase.watts));
  const ampDifference = Math.max(...values.map((phase) => phase.amps)) - Math.min(...values.map((phase) => phase.amps));
  const deviation = averageWatts > 0 ? Math.max(...values.map((phase) => Math.abs(phase.watts - averageWatts))) / averageWatts * 100 : 0;
  const maximumAmps = Math.max(...values.map((phase) => phase.amps));
  const mostLoaded = maximumAmps > 0 ? names.filter((name) => Math.abs(summary.phases[name].amps - maximumAmps) < 0.000001).join(', ') : '—';
  const phaseRows = names.map((name) => {
    const phase = summary.phases[name], share = totalWatts > 0 ? phase.watts / totalWatts * 100 : 0;
    return `<tr class="phase-report-${name.toLowerCase()}"><th><span class="phase-report-badge">${name}</span></th><td><div class="phase-share"><div class="phase-report-track"><span style="width:${share.toFixed(4)}%"></span></div><strong>${printPercent(share)}</strong></div></td><td>${printKW(phase.watts)}</td><td>${printAmps(phase.amps)}</td></tr>`;
  }).join('');
  const overview = `<section class="phase-report-total"><div><span>Potenza totale assegnata</span><p>Somma dei carichi collegati con fase identificata</p></div><strong>${printKW(totalWatts)}</strong></section><div class="phase-report-grid"><section><h2>Ripartizione sulle tre fasi</h2><table class="phase-table"><thead><tr><th>Fase</th><th>Quota della potenza assegnata</th><th>Potenza</th><th>Corrente stimata</th></tr></thead><tbody>${phaseRows}</tbody></table><p class="phase-scale">Barre su scala 0-100% del totale assegnato. Percentuali arrotondate.</p></section><aside class="phase-report-details"><h2>Sbilanciamento</h2><div><span>Fase più caricata${mostLoaded.includes(',') ? ' (a pari carico)' : ''}</span><strong>${mostLoaded}${maximumAmps > 0 ? ` · ${printAmps(maximumAmps)}` : ''}</strong></div><div><span>Differenza tra fase più e meno caricata</span><strong>${printAmps(ampDifference)}</strong><small>corrispondenti a ${printKW(wattDifference)}</small></div><div><span>Scostamento massimo dalla media</span><strong>${printPercent(deviation)}</strong><small>Media per fase: ${printKW(averageWatts)}</small></div></aside></div>`;
  const rows = entries.map((entry) => {
    const phases = entry.summary.phases, watts = names.reduce((sum, name) => sum + phases[name].watts, 0);
    return `<tr data-root="${esc(entry.rootKey)}"><th scope="row">${esc(entry.node.title || 'Fornitura')}${entry.continued ? ' (segue)' : ''}</th><td>${entry.continued ? '' : printKW(watts)}</td>${names.map((name) => `<td>${entry.continued ? '' : phases[name].amps.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>`).join('')}<td>${printPageLinks(entry.printedPages)}</td></tr>`;
  }).join('');
  const table = `<section class="supply-report"><h2>Dettaglio per fornitura / quadro</h2><table class="print-table supply-table"><thead><tr><th>Fornitura / quadro</th><th>Potenza</th><th>R (A)</th><th>S (A)</th><th>T (A)</th><th>Tavole PDF</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  const note = '<div class="print-note phase-report-note"><strong>Criteri di calcolo</strong><p>Stima: 230/400 V, cos φ = 1. Carichi trifase ripartiti in parti uguali su R, S e T.<br>Scostamento: massimo scarto assoluto dalla media, diviso per la media.</p></div>';
  return printSheetMarkup('phase-report-sheet', `Riepilogo carichi e distribuzione fasi${continued ? ' (segue)' : ''}`, page, total, (continued ? '' : overview) + (entries.length ? table : ''), note);
}
function paginatePrintRows(entries, firstMarkup, nextMarkup = firstMarkup, allowEmptyFirst = false) {
  if (!entries.length) return [[]];
  const measure = (markup) => {
    $('#print-pages').insertAdjacentHTML('beforeend', markup);
    const sheet = $('#print-pages').lastElementChild;
    try {
      const rows = [...sheet.querySelectorAll('.print-table tbody tr')];
      return { capacity: sheet.querySelector('.print-content').getBoundingClientRect().bottom - rows[0].getBoundingClientRect().top - 2, heights: rows.map((row) => row.getBoundingClientRect().height) };
    } finally { sheet.remove(); }
  };
  const first = measure(firstMarkup()), next = measure(nextMarkup()), groups = [];
  let group = [], height = 0, capacity = first.capacity;
  entries.forEach((entry, index) => {
    const rowHeight = first.heights[index];
    if (height + rowHeight > capacity) {
      if (group.length || (allowEmptyFirst && !groups.length)) groups.push(group);
      group = []; height = 0; capacity = next.capacity;
    }
    if (rowHeight > capacity) throw new Error('Il testo di una riga è troppo lungo per la pagina. Riduci il nome della fornitura o i dati del cartiglio.');
    group.push(entry); height += rowHeight;
  });
  if (group.length) groups.push(group);
  return groups;
}
let printSession = null;
function buildPrintPages() {
  if (printSession) return true;
  const issues = projectIssues();
  if (issues.length) { showStatus(`Esportazione bloccata: ${issues[0].message}`, 'error'); return false; }
  const currentPage = state.currentPage, printPages = $('#print-pages');
  const diagramPages = sortedPages().filter((page) => state.nodes.some((node) => node.page === page));
  const exportedPages = diagramPages.length ? diagramPages : [1];
  const entries = Core.distributionEntries(state);
  const coveredPages = new Set(entries.flatMap((entry) => entry.pages));
  const indexEntries = [...entries, ...exportedPages.filter((page) => !coveredPages.has(page)).map((page) => ({ rootKey: `page:${page}`, title: state.pageNames?.[page] || `Schema ${page}`, pages: [page] }))]
    .sort((a, b) => a.pages[0] - b.pages[0]);
  const summary = Core.calculatePhaseLoads(state);
  const reportEntries = entries.map((entry) => ({ ...entry, summary: Core.calculatePhaseLoads(state, { loadIds: entry.loadIds }) }));
  printSession = { previousTitle: document.title, totalPages: 0, diagrams: exportedPages.length, reports: 0 };
  $('#print-project').disabled = true;
  try {
    document.body.classList.add('preparing-print');
    let indexGroups = [], expectedIndexes = exportedPages.length > 1 ? 1 : 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      printPageNumbers = new Map(exportedPages.map((page, index) => [page, index + expectedIndexes + 2]));
      const rows = printedEntryRows(indexEntries, printPageNumbers);
      indexGroups = exportedPages.length > 1 ? paginatePrintRows(rows, () => indexMarkup(rows, 0, 99999)) : [];
      if (indexGroups.length === expectedIndexes) break;
      expectedIndexes = indexGroups.length;
      if (attempt === 7) throw new Error('Non è stato possibile impaginare l’indice.');
    }
    const reportRows = printedEntryRows(reportEntries, printPageNumbers);
    const reportGroups = paginatePrintRows(reportRows, () => phaseReportMarkup(reportRows, 0, 99999, summary), () => phaseReportMarkup(reportRows, 0, 99999, summary, true), true);
    const pageOffset = 1 + indexGroups.length, totalPages = exportedPages.length + pageOffset + reportGroups.length;
    Object.assign(printSession, { totalPages, reports: reportGroups.length });
    printPages.innerHTML = coverMarkup() + indexGroups.map((group, index) => indexMarkup(group, index + 2, totalPages, index > 0)).join('');
    exportedPages.forEach((page, index) => {
      const printPage = index + pageOffset + 1;
      state.currentPage = page;
      render();
      const sheet = $('#drawing-sheet').cloneNode(true);
      sheet.dataset.sourcePage = page;
      sheet.dataset.printPage = printPage;
      sheet.querySelector('#block-page').textContent = `Pagina ${printPage} di ${totalPages}`;
      // Ogni SVG stampato deve riferirsi al proprio marker, con un ID univoco.
      sheet.querySelector('#arrow').id = `print-arrow-${printPage}`;
      sheet.querySelectorAll('.connector').forEach((path) => path.setAttribute('marker-end', `url(#print-arrow-${printPage})`));
      sheet.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
      sheet.querySelectorAll('.alignment-guide, .route-handle, .link-handle, .connector-hit').forEach((element) => element.remove());
      sheet.querySelectorAll('[tabindex]').forEach((element) => { element.removeAttribute('tabindex'); element.removeAttribute('role'); });
      sheet.removeAttribute('id');
      sheet.querySelectorAll('[id]:not(marker)').forEach((element) => element.removeAttribute('id'));
      sheet.id = `print-page-${printPage}`;
      printPages.append(sheet);
    });
    printPages.insertAdjacentHTML('beforeend', reportGroups.map((group, index) => phaseReportMarkup(group, exportedPages.length + pageOffset + index + 1, totalPages, summary, index > 0)).join(''));
    const renderedPages = [...printPages.children];
    if (renderedPages.length !== totalPages || renderedPages.some((sheet, index) => Number(sheet.dataset.printPage) !== index + 1)) {
      throw new Error('La numerazione delle pagine non è completa.');
    }
    renderedPages.filter((sheet) => sheet.classList.contains('print-sheet')).forEach((sheet) => {
      const content = sheet.querySelector('.print-content'), bottom = content.getBoundingClientRect().bottom;
      if ([...content.children].some((child) => child.getBoundingClientRect().bottom > bottom + 1)) {
        throw new Error('I dati del cartiglio occupano troppo spazio. Riduci i testi nelle proprietà del progetto.');
      }
    });
    document.title = `Unifilare ${state.meta.name || 'Progetto'} ${state.meta.revision || ''}`.trim();
    return true;
  } catch (error) {
    finishPrint(false);
    showStatus(`Esportazione non riuscita: ${error.message}`, 'error');
    return false;
  } finally {
    printPageNumbers = null;
    state.currentPage = currentPage;
    render();
  }
}
function finishPrint(notify = true) {
  if (!printSession) return;
  const { previousTitle, totalPages, diagrams, reports } = printSession;
  printSession = null;
  document.title = previousTitle;
  document.body.classList.remove('preparing-print');
  $('#print-pages').replaceChildren();
  $('#print-project').disabled = false;
  if (notify) showStatus(`Documento preparato: ${totalPages} pagine totali, di cui ${diagrams} schemi e ${reports} ${reports === 1 ? 'pagina di riepilogo carichi' : 'pagine di riepilogo carichi'}.`, 'success');
}
function preparePrint() {
  if (printSession || !buildPrintPages()) return;
  try { window.print(); }
  catch (error) { finishPrint(false); showStatus(`Stampa non disponibile: ${error.message}`, 'error'); }
  // Safari può restituire il controllo prima della chiusura della stampa.
  // Le pagine vengono rimosse solo all'evento afterprint.
}
function svgPoint(event) { const svg = $('#diagram'), point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform(svg.getScreenCTM().inverse()); }
function snapToAlignmentGuides(node, references) {
  const threshold = 12, closest = (value, axis) => references.reduce((best, item) => best === undefined || Math.abs(item[axis] - value) < Math.abs(best - value) ? item[axis] : best, undefined);
  const guideX = closest(node.x, 'x'), guideY = closest(node.y, 'y');
  if (guideX !== undefined && Math.abs(guideX - node.x) <= threshold) { node.x = guideX; alignmentGuides.push({ axis: 'x', value: guideX }); }
  if (guideY !== undefined && Math.abs(guideY - node.y) <= threshold) { node.y = guideY; alignmentGuides.push({ axis: 'y', value: guideY }); }
}
// La cattura resta sull'SVG, che non viene sostituito durante il rendering.
function trackDiagramPointer(event, onMove, onFinish) {
  const svg = $('#diagram'), pointerId = event.pointerId;
  const move = (next) => { if (next.pointerId === pointerId) onMove(next); };
  const finish = (next, cancelled = false) => {
    if (next.pointerId !== undefined && next.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', cancel);
    svg.removeEventListener('lostpointercapture', cancel);
    if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
    onFinish(next, cancelled);
  };
  const up = (next) => finish(next);
  const cancel = (next) => finish(next, true);
  svg.setPointerCapture(pointerId);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  svg.addEventListener('lostpointercapture', cancel);
}
function beginRouteSegmentDrag(event, handle) {
  const link = linkById(handle.dataset.linkId), from = nodeById(link?.from), to = nodeById(link?.to);
  if (!link || !from || !to || link.socapexGroup) return;
  const nodeIndex = new Map(state.nodes.map((node) => [node.id, node]));
  const basePoints = linkRoutePoints(link, from, to, nodeIndex).map((point) => ({ ...point }));
  const segmentIndex = Number(handle.dataset.segmentIndex), vertical = handle.dataset.orientation === 'vertical', start = svgPoint(event);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 1 || segmentIndex >= basePoints.length - 2) return;
  checkpoint(`move-link-route-${link.id}`);
  state.selectedLink = link.id; state.selected = null; state.selectedIds = [];
  let moved = false;
  trackDiagramPointer(event, (next) => {
    const point = svgPoint(next), delta = vertical ? point.x - start.x : point.y - start.y;
    if (Math.abs(delta) < .5) return;
    const updated = basePoints.map((item) => ({ ...item }));
    moved = true;
    if (vertical) {
      const x = Math.max(20, Math.min(1180, basePoints[segmentIndex].x + delta));
      updated[segmentIndex].x = x; updated[segmentIndex + 1].x = x;
    } else {
      const y = Math.max(20, Math.min(760, basePoints[segmentIndex].y + delta));
      updated[segmentIndex].y = y; updated[segmentIndex + 1].y = y;
    }
    link.routePoints = updated.slice(1, -1);
    requestRender();
  }, () => {
    if (moved) markChanged('Percorso della linea aggiornato.'); else dropNoopHistory();
    render();
  });
}
function bindDiagram() {
  $('#diagram').addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || printSession) return;
    const routeHandle = event.target.closest('.route-handle'), handle = event.target.closest('.link-handle');
    const labelGroup = event.target.closest('.link-label'), linkGroup = event.target.closest('.link'), nodeGroup = event.target.closest('.node');
    // Sullo sfondo i gesti touch restano disponibili per scorrere il foglio.
    if (event.pointerType === 'touch' && !routeHandle && !handle && !labelGroup && !linkGroup && !nodeGroup) return;
    event.preventDefault();
    if (routeHandle) { beginRouteSegmentDrag(event, routeHandle); return; }
    if (handle) {
      const source = handle.dataset.source, svg = $('#diagram'), from = nodeById(source);
      const draft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      draft.setAttribute('class', 'connector');
      draft.setAttribute('d', `M${from.x + NODE_HALF},${from.y} L${from.x + NODE_HALF},${from.y}`);
      svg.append(draft);
      trackDiagramPointer(event, (next) => {
        const point = svgPoint(next);
        draft.setAttribute('d', `M${from.x + NODE_HALF},${from.y} L${point.x},${point.y}`);
      }, (next, cancelled) => {
        draft.remove();
        const target = !cancelled && document.elementFromPoint(next.clientX, next.clientY)?.closest('.node')?.dataset.id;
        if (target && target !== source && !state.links.some((link) => link.from === source && link.to === target)) {
          tryAddLink(source, target, requiredPlug(nodeById(target)) || from.supplyType || 'cee16mono', 20);
        }
        render();
      });
      return;
    }
    if (labelGroup) {
      const link = linkById(labelGroup.dataset.linkId), from = nodeById(link.from), to = nodeById(link.to);
      checkpoint('move-link-label');
      state.selectedLink = link.id; state.selected = null; state.selectedIds = [];
      render();
      const current = linkLabelPosition(link, from, to), start = svgPoint(event);
      const offset = { x: start.x - current.x, y: start.y - current.y };
      let moved = false;
      trackDiagramPointer(event, (next) => {
        moved = true;
        const point = svgPoint(next);
        link.labelX = Math.max(10, Math.min(875, point.x - offset.x));
        link.labelY = Math.max(22, Math.min(720, point.y - offset.y));
        requestRender();
      }, () => { if (moved) markChanged(); else dropNoopHistory(); render(); });
      render();
      return;
    }
    if (linkGroup) {
      state.selectedLink = linkGroup.dataset.linkId; state.selected = null; state.selectedIds = [];
      render();
      return;
    }
    if (!nodeGroup) {
      const svg = $('#diagram'), start = svgPoint(event), box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      box.setAttribute('class', 'selection-box');
      box.setAttribute('pointer-events', 'none');
      svg.append(box);
      trackDiagramPointer(event, (next) => {
        const point = svgPoint(next), x = Math.min(start.x, point.x), y = Math.min(start.y, point.y);
        box.setAttribute('x', x); box.setAttribute('y', y);
        box.setAttribute('width', Math.abs(point.x - start.x)); box.setAttribute('height', Math.abs(point.y - start.y));
      }, (next, cancelled) => {
        box.remove();
        if (!cancelled) {
          const point = svgPoint(next), minX = Math.min(start.x, point.x), maxX = Math.max(start.x, point.x);
          const minY = Math.min(start.y, point.y), maxY = Math.max(start.y, point.y);
          const inside = pageNodes().filter((item) => item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY).map((item) => item.id);
          state.selectedIds = additive ? [...new Set([...state.selectedIds, ...inside])] : inside;
          state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null;
        }
        render();
      });
      return;
    }
    const nodeId = nodeGroup.dataset.id, additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (additive) { selectNode(nodeId, true); render(); return; }
    if (!state.selectedIds.includes(nodeId)) selectNode(nodeId);
    else { state.selected = nodeId; state.selectedLink = null; }
    // L'ispettore può cambiare le dimensioni del foglio: misura dopo il layout.
    render();
    const start = svgPoint(event), positions = selectedNodes().map((item) => ({ node: item, x: item.x, y: item.y }));
    const references = pageNodes().filter((item) => !state.selectedIds.includes(item.id));
    let moved = false;
    checkpoint('move-nodes');
    trackDiagramPointer(event, (next) => {
      const point = svgPoint(next), dx = point.x - start.x, dy = point.y - start.y;
      if (!moved && Math.hypot(dx, dy) < 2) return;
      moved = true;
      alignmentGuides = [];
      positions.forEach(({ node: item, x, y }) => {
        item.x = Math.max(85, Math.min(1115, x + dx)); item.y = Math.max(40, Math.min(740, y + dy));
        snapToAlignmentGuides(item, references);
      });
      alignmentGuides = alignmentGuides.filter((guide, index, guides) => guides.findIndex((item) => item.axis === guide.axis && item.value === guide.value) === index);
      requestRender();
    }, () => {
      if (moved) markChanged(); else dropNoopHistory();
      alignmentGuides = [];
      render();
    });
    render();
  });
  $('#diagram').addEventListener('keydown', (event) => {
    const nodeGroup = event.target.closest('.node'), linkGroup = event.target.closest('.link');
    if (!nodeGroup && !linkGroup) return;
    if (['Enter', ' ', 'Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (nodeGroup) {
        if (event.key === 'Enter' || event.key === ' ' || !state.selectedIds.includes(nodeGroup.dataset.id)) selectNode(nodeGroup.dataset.id);
      } else { state.selectedLink = linkGroup.dataset.linkId; state.selected = null; state.selectedIds = []; }
      if (['Delete', 'Backspace'].includes(event.key)) deleteSelection();
      else render();
    }
  });
}
function removeLinksAndReleaseSockets(predicate) {
  const removed = state.links.filter(predicate);
  removed.forEach((link) => {
    if (isReferenceLink(link)) return;
    const source = nodeById(link.from), target = nodeById(link.to);
    if (source?.type === 'panel' && target) target.socket = '';
  });
  const removedIds = new Set(removed.map((link) => link.id));
  state.links = state.links.filter((link) => !removedIds.has(link.id));
  return removed;
}
function deleteSelection() {
  const selectedLink = linkById(state.selectedLink);
  const deletedIds = state.selected ? (state.selectedIds.length > 1 ? state.selectedIds : [state.selected]) : [];
  const connected = deletedIds.some((id) => state.links.some((link) => link.from === id || link.to === id));
  if ((selectedLink || deletedIds.length) && (connected || deletedIds.length > 1) && !window.confirm(`Eliminare ${selectedLink ? 'il collegamento selezionato' : `${deletedIds.length} elementi selezionati`}? L’operazione può essere annullata.`)) return;
  if (!selectedLink && !deletedIds.length) return;
  checkpoint('delete');
  if (selectedLink) {
    const groupKey = socapexLinkKey(selectedLink);
    removeLinksAndReleaseSockets((link) => link.id === selectedLink.id || (groupKey && socapexLinkKey(link) === groupKey));
    state.selectedLink = null;
  } else {
    const deleted = new Set(deletedIds);
    removeLinksAndReleaseSockets((link) => deleted.has(link.from) || deleted.has(link.to));
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
  removeLinksAndReleaseSockets((link) => removedIds.has(link.from) || removedIds.has(link.to));
  state.nodes = state.nodes.filter((node) => node.page !== removedPage);
  state.nodes.forEach((node) => { if (node.page > removedPage) node.page--; });
  state.pages = pages.filter((page) => page !== removedPage).map((page) => page > removedPage ? page - 1 : page);
  state.pageNames = Object.fromEntries(Object.entries(state.pageNames || {}).filter(([key]) => Number(key) !== removedPage).map(([key, name]) => [Number(key) > removedPage ? Number(key) - 1 : key, name]));
  state.currentPage = Math.max(1, Math.min(removedPage, pagesCount()));
  state.selected = null; state.selectedIds = []; state.selectedLink = null; markChanged(`Pagina ${removedPage} eliminata.`); render();
}
function createPageAfter(page, atEnd = false) {
  const pages = sortedPages(), lastPage = pages.at(-1) || 1, afterPage = atEnd ? lastPage : page;
  const newPage = afterPage + 1;
  checkpoint(atEnd ? 'append-page' : 'insert-page');
  if (afterPage < lastPage) {
    state.pageNames = Object.fromEntries(Object.entries(state.pageNames || {}).map(([key, name]) => [Number(key) > afterPage ? Number(key) + 1 : key, name]));
    state.nodes.forEach((node) => { if (node.page > afterPage) node.page++; });
    state.pages = pages.map((item) => item > afterPage ? item + 1 : item);
  } else state.pages = [...pages];
  if (!state.pages.includes(newPage)) state.pages.push(newPage);
  state.pages.sort((first, second) => first - second);
  state.currentPage = newPage; state.selected = null; state.selectedIds = []; state.selectedLink = null;
  markChanged(atEnd || afterPage === lastPage ? `Pagina ${newPage} aggiunta in fondo.` : `Pagina ${newPage} inserita nel documento.`); render();
}
function togglePanel(element, button, open) {
  element.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
  const concealed = window.matchMedia('(max-width: 760px)').matches && !open;
  element.inert = concealed;
  if (concealed) element.setAttribute('aria-hidden', 'true'); else element.removeAttribute('aria-hidden');
}
function bind() {
  canvasViewport = window.UnifilariViewport({ container: $('#sheet-wrapper'), stage: $('#sheet-stage'), zoomSelect: $('#zoom-level'), readout: $('#zoom-readout'), panButton: $('#pan-tool'), zoomIn: $('#zoom-in'), zoomOut: $('#zoom-out'), fitButton: $('#fit-sheet') });
  document.addEventListener('click', (event) => {
    const start = event.target.closest('[data-start-action]');
    if (start) runStartAction(start.dataset.startAction);
  });
  $('#selection-toolbar').onclick = (event) => {
    const button = event.target.closest('[data-selection-action]');
    if (!button || button.disabled) return;
    const actions = { connect: openBulkConnectDialog, arrange: openArrangeDialog, align: openAlignDialog, duplicate: duplicateSelectedLoads, delete: deleteSelection };
    actions[button.dataset.selectionAction]?.();
  };
  $('#show-issues').onclick = () => { $('#issues-dialog').showModal(); renderDiagnostics(); };
  $('#issues-list').onclick = (event) => { const button = event.target.closest('[data-issue-index]'); if (button) goToIssue(Number(button.dataset.issueIndex)); };
  $('#manage-pages').onclick = () => { $('#pages-dialog').showModal(); renderPageOverview(); };
  $('#page-cards').onclick = (event) => {
    const button = event.target.closest('[data-open-page]');
    if (button) { $('#pages-dialog').close(); goToPage(Number(button.dataset.openPage)); }
  };
  $('#page-cards').addEventListener('change', (event) => { if (event.target.dataset.pageName) renamePage(Number(event.target.dataset.pageName), event.target.value); });
  $('#page-cards').addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target.dataset.pageName) { event.preventDefault(); event.target.blur(); } });
  $('#overview-add-page').onclick = () => { createPageAfter(state.currentPage, true); renderPageOverview(); };
  loadCompanyBook();
  $('#company-book').onchange = selectCompanyFromBook;
  $('#save-company').onclick = saveCompanyToBook;
  $('#remove-company').onclick = removeCompanyFromBook;
  document.querySelectorAll('[data-file-input]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.fileInput).click());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    const heading = dialog.querySelector('h2');
    heading.id ||= `${dialog.id}-title`;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.addEventListener('close', () => {
      dialog.querySelector('.dialog-status')?.remove();
      if (dialog.id === 'project-dialog') resetProjectLocationSearch();
    });
  });
  $('#edit-project').onclick = () => openProjectDialog('edit');
  $('#project-dialog-form').addEventListener('submit', (event) => { event.preventDefault(); confirmProjectProperties(); });
  $('#cancel-project').onclick = () => $('#project-dialog').close();
  $('#search-project-location').onclick = searchProjectLocation;
  $('#project-location-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); searchProjectLocation(); } });
  $('#project-location-results').onclick = (event) => { const button = event.target.closest('[data-location-index]'); if (button) selectProjectLocation(Number(button.dataset.locationIndex)); };

  $('#add-supply').onclick = () => addNode('supply');
  $('#reuse-supply').onclick = openSupplyReferenceDialog;
  $('#confirm-supply-reference').onclick = (event) => { event.preventDefault(); addSupplyReference(); };
  $('#add-panel').onclick = openPanelDialog;
  $('#reuse-link').onclick = openLinkReferenceDialog;
  $('#confirm-link-reference').onclick = (event) => { event.preventDefault(); addLinkReference(); };
  $('#add-temp-panel').onclick = () => openTemporaryPanelDialog();
  $('#group-socapex').onclick = openSocapexDialog;
  $('#add-load').onclick = () => addNode('load');
  $('#add-bulk-loads').onclick = openBulkLoadDialog;
  $('#confirm-bulk-loads').onclick = (event) => { event.preventDefault(); addBulkLoads(); };
  $('#add-link').onclick = showLinkDialog;
  $('#connect-selected').onclick = openBulkConnectDialog;
  $('#arrange-selected').onclick = openArrangeDialog;
  $('#align-selected').onclick = openAlignDialog;
  $('#distribute-vertical').onclick = () => distributeSelectedNodes('y');
  $('#distribute-horizontal').onclick = () => distributeSelectedNodes('x');
  $('#confirm-align').onclick = (event) => { event.preventDefault(); alignSelectedNodes(); };
  $('#panel-type').onchange = updatePanelMatricolaChoices;
  $('#panel-search').oninput = updatePanelMatricolaChoices;
  $('#panel-search').onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#panel-choice').focus(); } };
  $('#panel-input-filter').onchange = updatePanelMatricolaChoices;
  $('#panel-include-used').onchange = updatePanelMatricolaChoices;
  $('#panel-results').onclick = (event) => {
    const button = event.target.closest('[data-choose-panel]');
    if (button && !button.disabled) { $('#panel-choice').value = button.dataset.choosePanel; updatePanelChoiceDetails(); }
  };
  $('#panel-choice').onchange = updatePanelChoiceDetails;
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

  $('#previous-page').onclick = () => { const pages = sortedPages(), index = pages.indexOf(state.currentPage); if (index > 0) goToPage(pages[index - 1]); };
  $('#next-page').onclick = () => { const pages = sortedPages(), index = pages.indexOf(state.currentPage); if (index >= 0 && index < pages.length - 1) goToPage(pages[index + 1]); };
  $('#page-select').onchange = (event) => goToPage(Number(event.target.value));
  $('#new-page').onclick = () => createPageAfter(state.currentPage);
  $('#append-page').onclick = () => createPageAfter(state.currentPage, true);
  $('#delete-page').onclick = removeCurrentPage;

  $('#property-form').addEventListener('input', (event) => {
    const node = nodeById(state.selected), name = event.target.name;
    if (!node || !name || ['socket', 'manualSocket'].includes(name)) return;
    const pages = sortedPages(), value = ['page', 'watts'].includes(name) ? Number(event.target.value) : event.target.value;
    if (name === 'page' && !pages.includes(value)) { event.target.value = node.page; return showStatus('Scegli una pagina esistente.', 'warning'); }
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
        dropNoopHistory(); showStatus(`Modifica annullata: ${issue.message}`, 'error'); render(); return;
      }
    }
    if (name === 'page') state.currentPage = value;
    markChanged();
    if (['page', 'supplyType', 'plugType'].includes(name)) render();
  });
  $('#property-form').addEventListener('change', (event) => {
    const link = linkById(state.selectedLink), node = nodeById(state.selected), name = event.target.name;
    if (link) {
      if (['hideCableSection', 'hideLength'].includes(name)) {
        checkpoint(`link-display-${link.id}-${name}`);
        (link.socapexGroup ? socapexGroupLinks(link) : [link]).forEach((member) => {
          if (event.target.checked) delete member[name];
          else member[name] = true;
        });
        markChanged('Testo del collegamento aggiornato nello schema e nel PDF.'); render(); return;
      }
      if (link.socapexGroup && name === 'socapexLength') {
        const length = Math.max(0, Number(event.target.value) || 0);
        checkpoint(`socapex-length-${link.socapexGroup}`);
        socapexGroupLinks(link).forEach((member) => { member.length = length; });
        markChanged('Lunghezza del Socapex aggiornata.'); render(); return;
      }
      if (link.socapexGroup && name.startsWith('socapexSocket:')) {
        const member = linkById(name.slice('socapexSocket:'.length)), target = member && nodeById(member.to), source = member && nodeById(member.from);
        const proposed = event.target.value.trim().toUpperCase(), warning = socketWarning(source, target, proposed, member?.id);
        if (!member || !target || warning) { showStatus(warning || 'Presa Socapex non disponibile.', 'error'); render(); return; }
        checkpoint(`socapex-socket-${member.id}`); target.socket = proposed;
        markChanged('Presa del Socapex aggiornata.'); render(); return;
      }
      const before = { ...link }, oldTarget = nodeById(link.to), oldSocket = oldTarget?.socket || '', changesEndpoint = ['from', 'to'].includes(name);
      checkpoint(`link-${link.id}-${name}`);
      if (changesEndpoint && oldTarget && !isReferenceLink(link)) oldTarget.socket = '';
      link[name] = name === 'length' ? Math.max(0, Number(event.target.value) || 0) : event.target.value;
      if (name === 'to') {
        const destinationConnector = requiredPlug(nodeById(link.to));
        if (destinationConnector) { link.cable = destinationConnector; link.cableSection = destinationConnector; }
      }
      if (name === 'cable' && !cableSectionGroup(link.cable).includes(link.cableSection)) link.cableSection = link.cable;
      const newTarget = nodeById(link.to), newTargetSocket = newTarget?.socket || '';
      const warning = isReferenceLink(link) ? '' : compatibilityWarning(nodeById(link.from), newTarget, link.id, link.cable);
      if (warning || (!isReferenceLink(link) && changesEndpoint && !assignFirstFreeSocket(nodeById(link.from), newTarget))) {
        Object.assign(link, before); if (oldTarget) oldTarget.socket = oldSocket; if (newTarget && newTarget !== oldTarget) newTarget.socket = newTargetSocket;
        dropNoopHistory(); showStatus(warning || 'Modifica del collegamento non valida.', 'error'); render(); return;
      }
      if (changesEndpoint) delete link.routePoints;
      markChanged(); showStatus('Collegamento aggiornato.', 'success'); render(); return;
    }
    if (node && ['socket', 'manualSocket'].includes(name)) {
      const incoming = state.links.find((item) => item.to === node.id), source = incoming && nodeById(incoming.from), proposed = event.target.value.trim().toUpperCase(), warning = socketWarning(source, node, proposed, incoming?.id);
      if (warning) { showStatus(warning, 'error'); render(); return; }
      checkpoint(`socket-${node.id}`); node.socket = proposed; markChanged(); showStatus('Presa aggiornata.', 'success'); render(); return;
    }
    if (node) { markChanged(); render(); }
  });
  $('#property-form').addEventListener('click', (event) => {
    if (event.target.id === 'reassign-socapex-sockets') reassignSocapexSockets();
    if (event.target.id === 'add-link-detour') {
      const link = linkById(state.selectedLink); if (!link) return;
      checkpoint(`add-link-detour-${link.id}`);
      if (addLinkDetour(link)) { markChanged('Deviazione aggiunta: trascina le maniglie blu per regolarla.'); render(); }
      else dropNoopHistory();
    }
    if (event.target.id === 'reset-link-route') {
      const link = linkById(state.selectedLink); if (!link?.routePoints) return;
      checkpoint(`reset-link-route-${link.id}`); delete link.routePoints; markChanged('Ripristinato il percorso automatico.'); render();
    }
    if (event.target.id === 'edit-temporary-panel') { const node = nodeById(state.selected); if (node) openTemporaryPanelDialog(node); }
    if (event.target.id === 'duplicate-load') duplicateSelectedLoads();
    if (event.target.id === 'unlink-selected') {
      checkpoint('unlink');
      removeLinksAndReleaseSockets((link) => link.to === state.selected); markChanged('Elemento scollegato.'); render();
    }
  });
  $('#delete-selected').onclick = deleteSelection;

  const importCaptureFile = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try { prepareCaptureImport(await file.text()); }
    catch (error) { showStatus(`Importazione non riuscita: ${error.message}`, 'error'); }
    finally { event.target.value = ''; }
  };
  $('#capture-file').addEventListener('change', importCaptureFile);
  $('#welcome-new-project').onclick = createNewProject;
  $('#restore-autosave').onclick = () => {
    if (recoverableAutosave) applyLoadedProject(recoverableAutosave, { dirty: true, message: 'Lavoro recuperato. Esporta il progetto per conservarne una copia.' });
  };
  $('#welcome-dialog').addEventListener('cancel', (event) => event.preventDefault());
  $('#capture-parent').onchange = updateCaptureSocapexAvailability;
  $('#confirm-capture-import').onclick = (event) => { event.preventDefault(); importSelectedCaptureGroups(); };
  $('#capture-select-all').onclick = () => document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = true; });
  $('#capture-select-none').onclick = () => document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = false; });
  $('#capture-prefix-actions').onclick = (event) => { const prefix = event.target.dataset.capturePrefix; if (!prefix) return; document.querySelectorAll('[data-capture-index]').forEach((input) => { input.checked = circuitPrefix(pendingCaptureGroups[Number(input.dataset.captureIndex)].circuit) === prefix; }); };

  $('#link-from').onchange = refreshLinkDialog;
  $('#link-to').onchange = refreshLinkDialog;
  $('#link-cable').onchange = () => { $('#link-section').innerHTML = cableSectionOptions($('#link-cable').value, $('#link-cable').value); };
  $('#confirm-link').onclick = (event) => { event.preventDefault(); const from = $('#link-from').value, to = $('#link-to').value; if (tryAddLink(from, to, $('#link-cable').value, Number($('#link-length').value) || 0, true, true, $('#link-section').value)) $('#link-dialog').close(); render(); };
  $('#new-project').onclick = createNewProject;
  $('#save-project').onclick = save;
  $('#print-project').onclick = preparePrint;
  $('#show-unconnected-loads').onclick = showUnconnectedLoads;
  $('#phase-supply-filter').onchange = (event) => { phaseSupplyFilter = event.target.value; renderPhaseSummary(); };
  const openProjectFile = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (dirty && !window.confirm('Aprire un altro progetto? Le modifiche correnti restano nel recupero automatico fino alla prossima modifica o esportazione.')) { event.target.value = ''; return; }
    flushPendingAutosave();
    try { loadProjectText(await file.text()); }
    catch (error) { showStatus(`Impossibile leggere il file: ${error.message}`, 'error'); }
    finally { event.target.value = ''; }
  };
  $('#open-project').addEventListener('change', openProjectFile);
  $('#welcome-open-project').addEventListener('change', openProjectFile);
  $('#undo-action').onclick = undo;
  $('#redo-action').onclick = redo;

  const sidebar = $('.sidebar');
  const sidebarMedia = window.matchMedia('(max-width: 760px)');
  const syncSidebar = () => togglePanel(sidebar, $('#toggle-sidebar'), sidebar.classList.contains('open'));
  sidebarMedia.addEventListener('change', syncSidebar); syncSidebar();
  $('.workspace').addEventListener('pointerdown', closeMobileSidebar, { capture: true });
  document.querySelectorAll('.sidebar-group-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('.sidebar-group'), opening = !group.classList.contains('open');
      document.querySelectorAll('.sidebar-group').forEach((item) => { item.classList.remove('open'); item.querySelector('.sidebar-group-toggle').setAttribute('aria-expanded', 'false'); });
      if (opening) { group.classList.add('open'); button.setAttribute('aria-expanded', 'true'); }
    });
  });
  $('#toggle-sidebar').onclick = () => togglePanel(sidebar, $('#toggle-sidebar'), !sidebar.classList.contains('open'));
  $('#close-inspector').onclick = () => { state.selected = null; state.selectedIds = []; state.selectedLink = null; render(); };
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('dialog[open]')) return;
    const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable;
    if (editable) return;
    if (event.key === 'Escape') { closeMobileSidebar(); canvasViewport.cancelPan(); state.selected = null; state.selectedIds = []; state.selectedLink = null; render(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && event.target.closest('#sheet-wrapper')) {
      event.preventDefault(); state.selectedIds = pageNodes().map((node) => node.id); state.selected = state.selectedIds.at(-1) || null; state.selectedLink = null; render();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if (['Delete', 'Backspace'].includes(event.key) && (state.selected || state.selectedLink)) { event.preventDefault(); deleteSelection(); }
  });
  window.addEventListener('beforeunload', (event) => { if (dirty) event.preventDefault(); });
  window.addEventListener('pagehide', flushPendingAutosave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPendingAutosave(); });
  window.addEventListener('beforeprint', buildPrintPages);
  window.addEventListener('afterprint', () => finishPrint());
  bindDiagram();
}
bind(); fillProjectForm(state.meta); savedProjectSnapshot = JSON.stringify(serializableProject()); render();
offerAutosaveRecovery();
$('#welcome-dialog').showModal();
