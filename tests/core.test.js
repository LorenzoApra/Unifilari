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

{
  const current = project([supply, mainPanel]);
  assert.equal(validateConnection(current, { id: 'link-1', from: supply.id, to: mainPanel.id, cable: 'cee125tri' }).ok, true);
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

console.log('Core domain tests: OK');
