'use strict';

const assert = require('node:assert/strict');
const Core = require('../core.js');

function node(overrides) {
  return {
    id: overrides.id,
    type: overrides.type,
    page: 1,
    x: 100,
    y: 100,
    title: overrides.id,
    subtitle: '',
    details: '',
    note: '',
    socket: '',
    ...overrides,
  };
}

function project(nodes, links = []) {
  return { version: Core.SCHEMA_VERSION, meta: {}, pages: [1], currentPage: 1, nodes, links };
}

function validateConnection(current, candidate) {
  return Core.validateConnection(current, candidate, { cableName: (id) => id });
}

const supply = node({ id: 'supply-1', type: 'supply', supplyKey: 'supply-key-1', supplyType: 'cee125tri' });
const mainPanel = node({ id: 'panel-1', type: 'panel', panelKey: 'panel-key-1', panelModel: 'PB125A#1', inputType: 'cee125tri', ports: [{ type: 'cee63tri', quantity: 1 }, { type: 'cee16mono', quantity: 2 }] });
const secondaryPanel = node({ id: 'panel-2', type: 'panel', panelKey: 'panel-key-2', panelModel: 'Temporaneo', inputType: 'cee63tri', ports: [{ type: 'cee63tri', quantity: 1 }] });
const load = node({ id: 'load-1', type: 'load', plugType: 'cee16mono', watts: 1000 });

assert.equal(Core.compatibleConnector('powerlock250', 'powerlock400'), true);
assert.equal(Core.compatibleConnector('powerlock400', 'powerlock250'), true);

{
  const specialPanel = node({ ...mainPanel, id: 'panel-pb63-special', panelModel: 'PB63A#1' });
  assert.deepEqual(
    Core.panelSockets(specialPanel).filter((socket) => socket.type === 'cee16mono').map((socket) => socket.name),
    ['R1', 'R2', 'S5', 'S6', 'T9', 'T10', 'R3', 'R4', 'S7', 'S8', 'T11', 'T12'],
  );
  const specialLoads = Array.from({ length: 6 }, (_, index) => node({ ...load, id: `special-load-${index + 1}`, watts: 1000 }));
  const current = project([specialPanel, ...specialLoads]);
  specialLoads.forEach((item, index) => {
    item.socket = Core.availablePanelSockets(current, specialPanel, item)[0].name;
    current.links.push({ id: `special-link-${index + 1}`, from: specialPanel.id, to: item.id, cable: 'socapex', length: 20, socapexGroup: 'special-group' });
  });
  assert.deepEqual(specialLoads.map((item) => item.socket), ['R1', 'R2', 'S5', 'S6', 'T9', 'T10']);
  assert.deepEqual(Object.fromEntries(Object.entries(Core.calculatePhaseLoads(current).phases).map(([phase, value]) => [phase, value.watts])), { R: 2000, S: 2000, T: 2000 });
  assert.equal(Core.socketWarning(current, specialPanel, specialLoads[0], 'R3', current.links[0].id), '');
  assert.match(Core.socketWarning(current, specialPanel, specialLoads[0], 'S5', current.links[0].id), /occupata/);
}

{
  const specialPanelWithLeadingZero = node({ ...mainPanel, id: 'panel-pb63-special-01', panelModel: 'PB63A#01' });
  const standardPanel = node({ ...mainPanel, id: 'panel-pb63-standard-19', panelModel: 'PB63A#19' });
  assert.equal(Core.panelSockets(specialPanelWithLeadingZero)[0].name, 'R1');
  assert.equal(Core.panelSockets(standardPanel)[0].name, 'P1');
}

{
  const current = project([supply, mainPanel]);
  assert.equal(validateConnection(current, { id: 'link-1', from: supply.id, to: mainPanel.id, cable: 'cee125tri' }).ok, true);
}

{
  const supply32 = node({ ...supply, id: 'supply-32-to-63', supplyType: 'cee32tri' });
  const panel63 = node({ ...mainPanel, id: 'panel-63-from-32', inputType: 'cee63tri' });
  const current = project([supply32, panel63]);
  assert.equal(validateConnection(current, { id: 'link-adapter-up', from: supply32.id, to: panel63.id, cable: 'cee63tri' }).ok, true);
  assert.equal(validateConnection(current, { id: 'link-wrong-cable', from: supply32.id, to: panel63.id, cable: 'cee32tri' }).code, 'invalid-cable');
}

{
  const supply63 = node({ ...supply, id: 'supply-63-to-32', supplyType: 'cee63tri' });
  const panel32 = node({ ...mainPanel, id: 'panel-32-from-63', inputType: 'cee32tri' });
  const current = project([supply63, panel32]);
  assert.equal(validateConnection(current, { id: 'link-adapter-down', from: supply63.id, to: panel32.id, cable: 'cee32tri' }).code, 'incompatible-supply');
}

{
  const panel16Output = node({ ...mainPanel, id: 'panel-16-output', panelKey: 'panel-16-output-key', ports: [{ type: 'cee16mono', quantity: 1 }] });
  const panel32Input = node({ ...secondaryPanel, id: 'panel-32-input', panelKey: 'panel-32-input-key', inputType: 'cee32mono' });
  const current = project([panel16Output, panel32Input]);
  const candidate = { id: 'link-panel-adapter-up', from: panel16Output.id, to: panel32Input.id, cable: 'cee32mono', cableSection: 'cee32mono' };
  assert.equal(validateConnection(current, candidate).ok, true);
  assert.equal(Core.availablePanelSockets(current, panel16Output, panel32Input)[0].name, 'P1');
}

{
  const mixedOutput = node({ ...mainPanel, id: 'panel-mixed-output', panelKey: 'panel-mixed-output-key', ports: [{ type: 'cee16mono', quantity: 1 }, { type: 'cee32mono', quantity: 1 }] });
  const panel32Input = node({ ...secondaryPanel, id: 'panel-32-exact', panelKey: 'panel-32-exact-key', inputType: 'cee32mono' });
  const current = project([mixedOutput, panel32Input]);
  assert.equal(Core.availablePanelSockets(current, mixedOutput, panel32Input)[0].name, 'P2');
}

{
  const panel32Output = node({ ...mainPanel, id: 'panel-32-output', panelKey: 'panel-32-output-key', ports: [{ type: 'cee32mono', quantity: 1 }] });
  const panel16Input = node({ ...secondaryPanel, id: 'panel-16-input', panelKey: 'panel-16-input-key', inputType: 'cee16mono' });
  const load32 = node({ ...load, id: 'load-32-no-adapter', plugType: 'cee32mono' });
  assert.equal(validateConnection(project([panel32Output, panel16Input]), { id: 'link-panel-adapter-down', from: panel32Output.id, to: panel16Input.id, cable: 'cee16mono' }).code, 'missing-panel-output');
  assert.equal(validateConnection(project([node({ ...panel32Output, id: 'panel-only-16', panelKey: 'panel-only-16-key', ports: [{ type: 'cee16mono', quantity: 1 }] }), load32]), { id: 'link-load-no-adapter', from: 'panel-only-16', to: load32.id, cable: 'cee32mono' }).code, 'missing-panel-output');
}

{
  const current = project([supply, mainPanel]);
  const result = validateConnection(current, { id: 'link-1', from: supply.id, to: mainPanel.id, cable: 'cee16mono' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid-cable');
}

{
  const current = project([supply, load]);
  const result = validateConnection(current, { id: 'link-1', from: supply.id, to: load.id, cable: 'cee16mono' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid-supply-target');
}

{
  const current = project([mainPanel, load]);
  assert.equal(validateConnection(current, { id: 'link-1', from: mainPanel.id, to: load.id, cable: 'cee16mono' }).ok, true);
  const issues = Core.validateProject({ ...current, links: [{ id: 'link-1', from: mainPanel.id, to: load.id, cable: 'cee16mono', length: 20 }] });
  assert.equal(issues.some((issue) => issue.code === 'missing-socket'), true);
}

{
  const cyclePanel = node({ ...mainPanel, id: 'panel-cycle', panelKey: 'panel-cycle-key', inputType: 'cee63tri', ports: [{ type: 'cee63tri', quantity: 1 }] });
  const first = { id: 'link-1', from: cyclePanel.id, to: secondaryPanel.id, cable: 'cee63tri', length: 20 };
  const current = project([cyclePanel, secondaryPanel], [first]);
  const result = validateConnection(current, { id: 'link-2', from: secondaryPanel.id, to: cyclePanel.id, cable: 'cee63tri' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'cycle');
}

{
  const firstLoad = node({ ...load, id: 'load-a', socket: 'P1' });
  const secondLoad = node({ ...load, id: 'load-b' });
  const onePortPanel = node({ ...mainPanel, id: 'panel-capacity', panelKey: 'panel-capacity-key', ports: [{ type: 'cee16mono', quantity: 1 }] });
  const existing = { id: 'link-a', from: onePortPanel.id, to: firstLoad.id, cable: 'cee16mono', length: 20 };
  const current = project([onePortPanel, firstLoad, secondLoad], [existing]);
  const result = validateConnection(current, { id: 'link-b', from: onePortPanel.id, to: secondLoad.id, cable: 'cee16mono' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'panel-capacity');
}

{
  const firstLoad = node({ ...load, id: 'load-socket-a', socket: 'P1' });
  const secondLoad = node({ ...load, id: 'load-socket-b', socket: 'P1' });
  const twoPortPanel = node({ ...mainPanel, id: 'panel-sockets', panelKey: 'panel-sockets-key', ports: [{ type: 'cee16mono', quantity: 2 }] });
  const current = project([twoPortPanel, firstLoad, secondLoad], [
    { id: 'link-socket-a', from: twoPortPanel.id, to: firstLoad.id, cable: 'cee16mono', length: 20 },
    { id: 'link-socket-b', from: twoPortPanel.id, to: secondLoad.id, cable: 'cee16mono', length: 20 },
  ]);
  const issues = Core.validateProject(current);
  assert.equal(issues.some((issue) => issue.code === 'invalid-socket'), true);
}

{
  const connectedLoad = node({ ...load, id: 'load-current-socket', socket: 'P1' });
  const twoPortPanel = node({ ...mainPanel, id: 'panel-current-socket', panelKey: 'panel-current-socket-key', ports: [{ type: 'cee16mono', quantity: 2 }] });
  const currentLink = { id: 'link-current-socket', from: twoPortPanel.id, to: connectedLoad.id, cable: 'cee16mono', length: 20 };
  const current = project([twoPortPanel, connectedLoad], [currentLink]);
  assert.equal(Core.availablePanelSockets(current, twoPortPanel, connectedLoad, currentLink.id).some((socket) => socket.name === 'P1'), true);
}

{
  assert.throws(
    () => Core.normalizeProject({ meta: {}, pages: [1], nodes: [{ ...load, id: 'unsafe id with spaces' }], links: [] }),
    /identificativo/i,
  );
}

{
  const normalized = Core.normalizeProject({ meta: { name: 'Test', location: 'Via Roma 1, 10121 Torino (Torino)', locationStreet: 'Via Roma 1', locationPostcode: '10121', locationCity: 'Torino', locationProvince: 'Torino' }, pages: [1], nodes: [load], links: [] });
  assert.equal(normalized.version, Core.SCHEMA_VERSION);
  assert.equal(normalized.meta.name, 'Test');
  assert.equal(normalized.meta.locationStreet, 'Via Roma 1');
  assert.equal(normalized.meta.locationPostcode, '10121');
  assert.equal(normalized.meta.locationCity, 'Torino');
  assert.equal(normalized.meta.locationProvince, 'Torino');
  assert.deepEqual(normalized.pages, [1]);
}

{
  const routedLink = { id: 'link-routed', from: mainPanel.id, to: load.id, cable: 'cee16mono', length: 20, routePoints: [{ x: 420, y: 150 }, { x: 420, y: 310 }] };
  const normalized = Core.normalizeProject(project([mainPanel, load], [routedLink]));
  assert.equal(normalized.links[0].cableSection, 'cee16mono');
  assert.deepEqual(normalized.links[0].routePoints, routedLink.routePoints);
  assert.deepEqual(Core.serializeProject(normalized).links[0].routePoints, routedLink.routePoints);
}

{
  const customSectionLink = { id: 'link-custom-section', from: mainPanel.id, to: load.id, cable: 'cee16mono', cableSection: 'cee32mono', length: 20 };
  const normalized = Core.normalizeProject(project([mainPanel, load], [customSectionLink]));
  assert.equal(normalized.links[0].cable, 'cee16mono');
  assert.equal(normalized.links[0].cableSection, 'cee32mono');
  assert.equal(Core.validateConnection(normalized, normalized.links[0], { ignoredLinkId: normalized.links[0].id }).ok, true);
  assert.equal(Core.validateConnection(normalized, { ...normalized.links[0], cableSection: 'cee32tri' }, { ignoredLinkId: normalized.links[0].id }).code, 'invalid-cable-section');
}

{
  const latePageLoad = { ...load, id: 'late-load', page: 99 };
  const normalized = Core.normalizeProject({ meta: {}, pages: [1, 99], currentPage: 99, nodes: [latePageLoad], links: [] });
  assert.deepEqual(normalized.pages, [1, 2]);
  assert.equal(normalized.nodes[0].page, 2);
  assert.equal(normalized.currentPage, 2);
}

{
  const serialized = Core.serializeProject({ ...project([load]), library: [{ secret: true }], selected: load.id });
  assert.equal('library' in serialized, false);
  assert.equal('selected' in serialized, false);
}

{
  const aligned = Core.alignNodesWithoutOverlap([
    { id: 'a', x: 300, y: 200, width: 200, height: 60 },
    { id: 'b', x: 500, y: 200, width: 200, height: 60 },
  ], 'left', { gap: 24 });
  assert.equal(aligned.ok, true);
  assert.equal(aligned.positions[0].x, aligned.positions[1].x);
  assert.ok(Math.abs(aligned.positions[0].y - aligned.positions[1].y) >= 84);
}

{
  const aligned = Core.alignNodesWithoutOverlap([
    { id: 'a', x: 400, y: 180, width: 200, height: 60 },
    { id: 'b', x: 400, y: 420, width: 200, height: 80 },
  ], 'top', { gap: 24 });
  assert.equal(aligned.ok, true);
  const [first, second] = aligned.positions;
  assert.equal(first.y - 30, second.y - 40);
  assert.ok(Math.abs(first.x - second.x) >= 224);
}

{
  const aligned = Core.alignNodesWithoutOverlap(Array.from({ length: 20 }, (_, index) => ({
    id: `item-${index}`,
    x: 300,
    y: 300,
    width: 200,
    height: 60,
  })), 'left', { gap: 24 });
  assert.equal(aligned.ok, false);
  assert.equal(aligned.reason, 'insufficient-space');
}

{
  const phasePanel = node({ ...mainPanel, id: 'panel-phases', panelKey: 'panel-phases-key' });
  const loads = [
    node({ ...load, id: 'load-r', socket: 'P1', watts: 2300 }),
    node({ ...load, id: 'load-s', socket: 'P2', watts: 1150 }),
    node({ ...load, id: 'load-t', socket: 'T9', watts: 460 }),
    node({ ...load, id: 'load-tri', socket: 'P4', plugType: 'cee32tri', watts: 12000 }),
    node({ ...load, id: 'load-free', socket: '', watts: 500 }),
  ];
  const links = loads.slice(0, 4).map((item, index) => ({ id: `phase-link-${index}`, from: phasePanel.id, to: item.id, cable: item.plugType, length: 20 }));
  const summary = Core.calculatePhaseLoads(project([phasePanel, ...loads], links));
  assert.equal(summary.phases.R.watts, 6300);
  assert.equal(summary.phases.S.watts, 5150);
  assert.equal(summary.phases.T.watts, 4460);
  assert.ok(Math.abs(summary.phases.R.amps - (10 + 12000 / (Math.sqrt(3) * 400))) < 0.001);
  assert.equal(summary.unassignedWatts, 500);
  assert.equal(summary.unassignedLoads, 1);
  assert.deepEqual(Core.unconnectedLoadIds(project([phasePanel, ...loads], links)), ['load-free']);
  assert.deepEqual(Core.unconnectedLoadIds(project([phasePanel, ...loads], [...links, { id: 'phase-reference', from: phasePanel.id, to: 'load-free', cable: 'cee16mono', referenceLink: true }])), ['load-free']);
}

{
  const supplyA = node({ ...supply, id: 'supply-phase-a', supplyKey: 'supply-phase-key-a' });
  const supplyB = node({ ...supply, id: 'supply-phase-b', supplyKey: 'supply-phase-key-b' });
  const panelA = node({ ...mainPanel, id: 'panel-phase-a', panelKey: 'panel-phase-key-a' });
  const panelAReference = node({ ...panelA, id: 'panel-phase-a-reference', page: 2 });
  const panelB = node({ ...mainPanel, id: 'panel-phase-b', panelKey: 'panel-phase-key-b' });
  const loadA1 = node({ ...load, id: 'load-phase-a-1', socket: 'P1', watts: 2300 });
  const loadA2 = node({ ...load, id: 'load-phase-a-2', socket: 'P2', watts: 1150, page: 2 });
  const loadB = node({ ...load, id: 'load-phase-b', socket: 'P1', watts: 4600 });
  const current = project([supplyA, supplyB, panelA, panelAReference, panelB, loadA1, loadA2, loadB], [
    { id: 'supply-panel-a', from: supplyA.id, to: panelA.id, cable: 'cee125tri', length: 20 },
    { id: 'panel-load-a-1', from: panelA.id, to: loadA1.id, cable: 'cee16mono', length: 20 },
    { id: 'panel-load-a-2', from: panelAReference.id, to: loadA2.id, cable: 'cee16mono', length: 20 },
    { id: 'supply-panel-b', from: supplyB.id, to: panelB.id, cable: 'cee125tri', length: 20 },
    { id: 'panel-load-b', from: panelB.id, to: loadB.id, cable: 'cee16mono', length: 20 },
  ]);
  const total = Core.calculatePhaseLoads(current);
  const onlyA = Core.calculatePhaseLoads(current, { supplyKey: supplyA.supplyKey });
  const onlyB = Core.calculatePhaseLoads(current, { supplyKey: supplyB.supplyKey });
  assert.equal(total.phases.R.watts, 6900);
  assert.equal(total.phases.S.watts, 1150);
  assert.equal(onlyA.phases.R.watts, 2300);
  assert.equal(onlyA.phases.S.watts, 1150);
  assert.equal(onlyB.phases.R.watts, 4600);
  assert.equal(onlyB.phases.S.watts, 0);
}

{
  const ids = new Set(Array.from({ length: 100 }, () => Core.createId({ getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })));
  assert.equal(ids.size, 100);
  ids.forEach((id) => assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
}

{
  const legacy = {
    version: 5, meta: {}, pages: [1],
    nodes: [mainPanel, { id: 'legacy-socapex', type: 'socapex', page: 1 }, load],
    links: [
      { id: 'legacy-in', from: mainPanel.id, to: 'legacy-socapex', cable: 'socapex', length: 0, labelX: 300, labelY: 80 },
      { id: 'legacy-out', from: 'legacy-socapex', to: load.id, cable: 'cee16mono' },
    ],
  };
  const original = JSON.stringify(legacy);
  const migrated = Core.normalizeProject(legacy);
  assert.equal(migrated.nodes.length, 2);
  assert.equal(migrated.links.length, 1);
  assert.equal(migrated.links[0].from, mainPanel.id);
  assert.equal(migrated.links[0].to, load.id);
  assert.equal(migrated.links[0].cable, 'socapex');
  assert.equal(migrated.links[0].length, 0);
  assert.equal(migrated.links[0].labelX, 300);
  assert.ok(migrated.links[0].socapexGroup);
  assert.equal(JSON.stringify(legacy), original, 'La migrazione non deve modificare il file originale');
}

{
  const oldSupply = { ...supply, supplyType: 'powerlock' };
  const oldPanel = { ...mainPanel, inputType: 'powerlock' };
  const migrated = Core.normalizeProject({ ...project([oldSupply, oldPanel], [{ id: 'old-powerlock', from: supply.id, to: mainPanel.id, cable: 'powerlock' }]), version: 5 });
  assert.equal(migrated.nodes[0].supplyType, 'powerlock250');
  assert.equal(migrated.links[0].cable, 'powerlock250');
  assert.equal(Core.validateProject(migrated).length, 0);
  const current = Core.normalizeProject(project([supply, mainPanel], [{ id: 'invalid-current-cable', from: supply.id, to: mainPanel.id, cable: 'cee16mono' }]));
  assert.equal(current.links[0].cable, 'cee16mono', 'Un progetto attuale non deve essere riscritto dalle migrazioni');
  assert.equal(Core.validateProject(current)[0].code, 'invalid-cable');
}

{
  assert.throws(() => Core.normalizeProject({}), /elenchi/);
  assert.throws(() => Core.normalizeProject({ ...project([]), version: Core.SCHEMA_VERSION + 1 }), /versione/i);
  assert.throws(() => Core.normalizeProject({ ...project([]), nodes: [null] }), /non valido/i);
}

{
  const supplyReference = { ...supply, id: 'supply-reference', page: 2 };
  const otherPanel = { ...mainPanel, id: 'other-panel', panelKey: 'other-panel-key' };
  const current = project([supply, supplyReference, mainPanel, otherPanel], [{ id: 'supply-used', from: supply.id, to: mainPanel.id, cable: 'cee125tri' }]);
  assert.equal(validateConnection(current, { id: 'second-supply-use', from: supplyReference.id, to: otherPanel.id, cable: 'cee125tri' }).code, 'supply-already-used');
}

{
  const panelA = { ...secondaryPanel, id: 'cycle-a', panelKey: 'physical-cycle-a' };
  const panelB = { ...secondaryPanel, id: 'cycle-b', panelKey: 'physical-cycle-b' };
  const referenceA = { ...panelA, id: 'cycle-a-reference', page: 2 };
  const referenceB = { ...panelB, id: 'cycle-b-reference', page: 2 };
  const current = project([panelA, panelB, referenceA, referenceB], [{ id: 'cycle-forward', from: panelA.id, to: panelB.id, cable: 'cee63tri' }]);
  assert.equal(validateConnection(current, { id: 'cycle-return', from: referenceB.id, to: referenceA.id, cable: 'cee63tri' }).code, 'cycle');
}

{
  const panel = { ...mainPanel, panelModel: 'PB63A#6' };
  const firstBank = ['R1', 'R2', 'S5', 'S6', 'T9'];
  const loads = firstBank.map((socket, index) => ({ ...load, id: `first-bank-${index}`, socket }));
  const current = project([panel, ...loads], loads.map((item, index) => ({ id: `first-bank-link-${index}`, from: panel.id, to: item.id, cable: 'socapex', socapexGroup: 'socapex-first' })));
  assert.equal(Core.availablePanelSockets(current, panel, load)[0].name, 'T10');
  assert.deepEqual(Core.availableSocapexSockets(current, panel).map((socket) => socket.name), ['R3', 'R4', 'S7', 'S8', 'T11', 'T12']);
  const recalled = { ...panel, id: 'socapex-panel-reference', page: 2 };
  current.nodes.push(recalled);
  assert.equal(Core.availableSocapexSockets(current, recalled)[0].name, 'R3');
  assert.equal(Core.availableSocapexSockets(current, recalled, 'socapex-first')[0].name, 'R1');
  current.nodes.push({ ...load, id: 'second-bank-load', socket: 'R3' });
  current.links.push({ id: 'second-bank-link', from: recalled.id, to: 'second-bank-load', cable: 'socapex', socapexGroup: 'socapex-second' });
  assert.deepEqual(Core.availableSocapexSockets(current, panel), [], 'Due Socapex parziali mantengono i due banchi separati');
  current.links = current.links.filter((link) => link.socapexGroup !== 'socapex-first');
  assert.equal(Core.availableSocapexSockets(current, panel)[0].name, 'R1');
}

{
  const raw = project([mainPanel, load], [{ id: 'hidden-label', from: mainPanel.id, to: load.id, cable: 'cee16mono', cableSection: 'cee32mono', length: 25, hideCableSection: true, hideLength: true }]);
  const saved = Core.serializeProject(Core.normalizeProject(raw));
  const reopened = Core.normalizeProject(saved);
  assert.equal(reopened.links[0].hideCableSection, true);
  assert.equal(reopened.links[0].hideLength, true);
  assert.equal(reopened.links[0].cableSection, 'cee32mono');
  assert.equal(reopened.links[0].length, 25);
  assert.equal(Core.normalizeProject(project([])).meta.company, '');
}

{
  const items = [
    { id: 'space-a', x: 300, y: 100, width: 200, height: 50 },
    { id: 'space-b', x: 300, y: 200, width: 200, height: 80 },
    { id: 'space-c', x: 300, y: 500, width: 200, height: 60 },
  ];
  const before = JSON.stringify(items);
  const result = Core.distributeNodes(items, 'y');
  assert.equal(result.ok, true);
  const positions = result.positions;
  const firstGap = positions[1].y - 40 - (positions[0].y + 25);
  const secondGap = positions[2].y - 30 - (positions[1].y + 40);
  assert.equal(firstGap, secondGap);
  assert.equal(positions[0].y, 100);
  assert.equal(positions[2].y, 500);
  assert.equal(JSON.stringify(items), before);
  assert.equal(Core.distributeNodes(items.map((item) => ({ ...item, height: 300 })), 'y').reason, 'insufficient-space');
}

{
  const named = Core.normalizeProject({ version: 6, meta: {}, pages: [4, 9], currentPage: 9, pageNames: { 4: ' Palco ', 9: 'Regia', 999: 'Da scartare' }, nodes: [{ ...load, page: 9 }], links: [] });
  assert.deepEqual(named.pageNames, { 1: 'Palco', 2: 'Regia' });
  assert.equal(named.currentPage, 2);
  const reopened = Core.normalizeProject(Core.serializeProject(named));
  assert.deepEqual(reopened.pageNames, named.pageNames);
  assert.equal(Core.serializeProject(project([])).pageNames, undefined);
}

console.log('Core domain tests: OK');
