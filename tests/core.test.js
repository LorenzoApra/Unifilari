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
  const specialLoads = Array.from({ length: 6 }, (_, index) => node({ ...load, id: `special-load-${index + 1}`, watts: 1000 }));
  const current = project([specialPanel, ...specialLoads]);
  specialLoads.forEach((item, index) => {
    item.socket = Core.availablePanelSockets(current, specialPanel, item)[0].name;
    current.links.push({ id: `special-link-${index + 1}`, from: specialPanel.id, to: item.id, cable: 'socapex', length: 20, socapexGroup: 'special-group' });
  });
  assert.deepEqual(specialLoads.map((item) => item.socket), ['R1', 'S5', 'T9', 'R2', 'S6', 'T10']);
  assert.deepEqual(Object.fromEntries(Object.entries(Core.calculatePhaseLoads(current).phases).map(([phase, value]) => [phase, value.watts])), { R: 2000, S: 2000, T: 2000 });
  assert.equal(Core.socketWarning(current, specialPanel, specialLoads[0], 'R3', current.links[0].id), '');
  assert.match(Core.socketWarning(current, specialPanel, specialLoads[0], 'S5', current.links[0].id), /occupata/);
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
  const normalized = Core.normalizeProject({ meta: { name: 'Test' }, pages: [1], nodes: [load], links: [] });
  assert.equal(normalized.version, Core.SCHEMA_VERSION);
  assert.equal(normalized.meta.name, 'Test');
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

console.log('Core domain tests: OK');
