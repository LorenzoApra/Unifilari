'use strict';

const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

function sampleProject(name = 'Prova browser') {
  return {
    version: 6,
    meta: { name, location: 'Torino', type: 'Allestimento Luci', revision: '1.0', company: 'ATS Srl' },
    pages: [1, 2],
    nodes: [
      { id: 'supply', type: 'supply', supplyKey: 'physical-supply', supplyType: 'cee63tri', title: 'Fornitura', page: 1, x: 110, y: 180 },
      { id: 'panel', type: 'panel', panelKey: 'physical-panel', inputType: 'cee63tri', ports: [{ type: 'cee16mono', quantity: 6 }], title: 'Quadro', page: 1, x: 450, y: 180 },
      { id: 'load', type: 'load', plugType: 'cee16mono', watts: 2300, socket: 'P1', title: 'Luce R', page: 1, x: 900, y: 250 },
      { id: 'panel-reference', type: 'panel', panelKey: 'physical-panel', inputType: 'cee63tri', ports: [{ type: 'cee16mono', quantity: 6 }], title: 'Quadro', page: 2, x: 450, y: 180 },
      { id: 'load-2', type: 'load', plugType: 'cee16mono', watts: 1150, socket: 'P2', title: 'Luce S', page: 2, x: 900, y: 300 },
    ],
    links: [
      { id: 'supply-panel', from: 'supply', to: 'panel', cable: 'cee63tri', length: 5 },
      { id: 'panel-load', from: 'panel', to: 'load', cable: 'cee16mono', length: 20 },
      { id: 'panel-load-2', from: 'panel-reference', to: 'load-2', cable: 'cee16mono', length: 10 },
    ],
  };
}

async function openProject(page, project = sampleProject(), input = '#welcome-open-project') {
  await page.locator(input).setInputFiles({ name: 'progetto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#project-name')).toHaveText(project.meta.name);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

async function createProject(page) {
  await page.locator('#welcome-new-project').click();
  await page.locator('#project-event-name').fill('Prova browser');
  await page.locator('#project-location-street').fill('Via Roma 1');
  await page.locator('#confirm-project').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  page.__appErrors = errors;
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  expect(page.__appErrors).toEqual([]);
});

test('creazione, quadro temporaneo, collegamento e download JSON', async ({ page }) => {
  await createProject(page);
  await page.locator('#add-temp-panel').click();
  await expect(page.locator('#confirm-temporary-panel')).toHaveText('Aggiungi quadro');
  await page.locator('#confirm-temporary-panel').click();
  await page.locator('#add-load').click();
  await page.locator('#property-form [name="watts"]').fill('2300');
  await page.locator('#property-form [name="watts"]').press('Tab');
  await page.getByRole('button', { name: 'Collegamenti', exact: true }).click();
  await page.locator('#add-link').click();
  await page.locator('#confirm-link').click();
  await expect(page.locator('#diagram .link')).toHaveCount(1);
  await expect(page.locator('#phase-r-power')).toHaveText('2,3 kW');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-project').click();
  const download = await downloadPromise;
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(saved.nodes).toHaveLength(2);
  expect(saved.links).toHaveLength(1);
  expect(saved.nodes.find((node) => node.type === 'load').socket).toBe('P1');
  expect(saved.library).toBeUndefined();
});

test('trascinamento, annulla, focus da tastiera e cancellazione singola', async ({ page }) => {
  await openProject(page);
  const node = page.locator('#diagram .node[data-id="load"]');
  const before = await node.boundingBox();
  const originalX = Number(await node.locator('rect').getAttribute('x'));
  await page.mouse.move(before.x + 30, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 100, before.y + before.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  expect(Number(await node.locator('rect').getAttribute('x'))).toBeGreaterThan(originalX + 50);
  await page.locator('#undo-action').click();
  expect((await node.boundingBox()).x).toBeCloseTo(before.x, 0);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toBeFocused();
  let confirmations = 0;
  page.removeAllListeners('dialog');
  page.on('dialog', async (dialog) => { confirmations++; await dialog.dismiss(); });
  await page.keyboard.press('Delete');
  expect(confirmations).toBe(1);
  await expect(node).toHaveCount(1);
});

test('recupero autosalvataggio e apertura senza sovrascrivere il recupero', async ({ page }) => {
  await createProject(page);
  await page.locator('#add-load').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unifilari.autosave.v6'))?.project.nodes.length)).toBe(1);
  await page.reload();
  await expect(page.locator('#autosave-recovery')).toBeVisible();
  await page.locator('#restore-autosave').click();
  await expect(page.locator('#diagram .node')).toHaveCount(1);
  await openProject(page, sampleProject('Altro progetto'), '#open-project');
  await page.reload();
  await expect(page.locator('#autosave-description')).toContainText('Prova browser');
});

test('stampa multipagina conservata fino ad afterprint, con ID SVG univoci', async ({ page }) => {
  await openProject(page);
  await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')); });
  await page.locator('#print-project').click();
  await expect(page.locator('#print-pages > article')).toHaveCount(5);
  await expect(page.locator('#print-project')).toBeDisabled();
  await page.waitForTimeout(100);
  await expect(page.locator('#print-pages > article')).toHaveCount(5);
  expect(await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    return ids.length === new Set(ids).size;
  })).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.cover-sheet')).toBeVisible();
  const sheets = await page.locator('#print-pages > article').evaluateAll((elements) => elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
  sheets.forEach((sheet) => { expect(sheet.width).toBeCloseTo(1122.5, 0); expect(sheet.height).toBeCloseTo(793.7, 0); });
  const note = await page.locator('.phase-report-note p').boundingBox();
  const reportFooter = await page.locator('.phase-report-sheet .title-block').boundingBox();
  expect(note.y + note.height).toBeLessThan(reportFooter.y - 5);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#print-pages > article')).toHaveCount(0);
  await expect(page.locator('#print-project')).toBeEnabled();
  await expect(page).toHaveTitle('Unifilari ATS');
});

test('Capture CSV italiano e distribuzione automatica su nuove pagine', async ({ page }) => {
  await createProject(page);
  const rows = ['Fixture;Wattage;Circuit', ...Array.from({ length: 19 }, (_, i) => `Luce ${i + 1};650,5;L${i + 1}`)];
  await page.locator('#capture-file').setInputFiles({ name: 'capture.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.join('\n')) });
  await expect(page.locator('#capture-circuit-list input:checked')).toHaveCount(19);
  await page.locator('#confirm-capture-import').click();
  await expect(page.locator('#diagram .node.load')).toHaveCount(18);
  await page.locator('#next-page').click();
  await expect(page.locator('#diagram .node.load')).toHaveCount(1);
  await expect(page.locator('#unconnected-count')).toHaveText('19 utenze non collegate');
});

test('apertura locale e creazione con randomUUID non disponibile', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }));
  await page.goto(pathToFileURL(resolve(__dirname, '../index.html')).href);
  await createProject(page);
  await page.locator('#add-supply').click();
  await expect(page.locator('#diagram .node.supply')).toHaveCount(1);
});

test('barra strumenti e finestre accessibili su schermi piccoli', async ({ page }) => {
  await openProject(page);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#print-project')).toBeInViewport();
    if (width < 760) {
      await page.locator('#toggle-sidebar').click();
      await expect(page.locator('#add-supply')).toBeInViewport();
      await page.locator('#toggle-sidebar').click();
    }
    await page.locator('#edit-project').click();
    const dialog = await page.locator('#project-dialog').boundingBox();
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
    await page.locator('#cancel-project').click();
  }
});

test('apertura del selettore file da tastiera', async ({ page }) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-file-input="welcome-open-project"]').focus();
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'progetto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sampleProject())) });
  await expect(page.locator('#project-name')).toHaveText('Prova browser');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('un gesto interrotto non crea collegamenti al rilascio', async ({ page }) => {
  const project = sampleProject();
  project.links = project.links.filter((link) => link.id !== 'panel-load');
  project.nodes.find((node) => node.id === 'load').socket = '';
  await openProject(page, project);
  await page.locator('#diagram').evaluate((svg) => svg.addEventListener('pointerdown', (event) => { window.__testPointerId = event.pointerId; }, { once: true }));
  const handle = await page.locator('.node[data-id="panel"] .link-handle').boundingBox();
  const target = await page.locator('.node[data-id="load"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 5 });
  await page.locator('#diagram').dispatchEvent('pointercancel', { pointerId: await page.evaluate(() => window.__testPointerId) });
  await page.mouse.up();
  await expect(page.locator('#diagram .link')).toHaveCount(1);
  await expect(page.locator('#diagram > path.connector')).toHaveCount(0);
  // Una nuova interazione deve funzionare dopo la cancellazione del gesto.
  await page.locator('.node[data-id="load"]').click();
  await expect(page.locator('#inspector')).toBeVisible();
});

function socapexProject(previouslyMisassigned = false) {
  const project = sampleProject('Socapex PB63A');
  project.pages = [1];
  project.nodes = project.nodes.filter((node) => ['supply', 'panel'].includes(node.id));
  const panel = project.nodes.find((node) => node.id === 'panel');
  Object.assign(panel, { panelModel: 'PB63A#6', ports: [{ type: 'cee16mono', quantity: 12 }, { type: 'cee32mono', quantity: 3 }] });
  project.links = project.links.filter((link) => link.id === 'supply-panel');
  const first = ['R1', 'R2', 'S5', 'S6', 'T9'];
  const oldSecond = ['T10', 'R3', 'R4', 'S7', 'S8', 'T11'];
  for (let index = 0; index < 11; index++) {
    const number = index < 5 ? index + 1 : index + 2;
    const socket = index < 5 ? first[index] : previouslyMisassigned ? oldSecond[index - 5] : '';
    const id = `soc-load-${number}`;
    project.nodes.push({ id, type: 'load', plugType: 'cee16mono', title: `Utenza ${number}`, watts: 1500, socket, page: 1, x: 900, y: 75 + index * 60 });
    if (socket) project.links.push({ id: `soc-link-${number}`, from: panel.id, to: id, cable: 'socapex', length: 20, socapexGroup: index < 5 ? 'bank-first' : 'bank-second' });
  }
  return project;
}

test('un secondo Socapex parte da R3 anche se T10 è rimasta libera', async ({ page }) => {
  await openProject(page, socapexProject());
  await page.getByRole('button', { name: 'Collegamenti', exact: true }).click();
  await page.locator('#group-socapex').click();
  await page.locator('#socapex-select-all').click();
  await page.locator('#confirm-socapex').click();
  const expected = ['R3', 'R4', 'S7', 'S8', 'T11', 'T12'];
  for (let index = 0; index < expected.length; index++) {
    await expect(page.locator(`.node[data-id="soc-load-${index + 7}"]`)).toContainText(`Presa ${expected[index]}`);
  }
});

test('riassegnazione esplicita corregge un Socapex esistente partito da T10', async ({ page }) => {
  await openProject(page, socapexProject(true));
  await page.locator('#diagram > .link[data-link-id="soc-link-7"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#reassign-socapex-sockets').click();
  await expect(page.locator('.node[data-id="soc-load-7"]')).toContainText('Presa R3');
  await expect(page.locator('.node[data-id="soc-load-12"]')).toContainText('Presa T12');
  await expect(page.locator('.node[data-id="soc-load-5"]')).toContainText('Presa T9');
});

test('PowerLock corretto nelle proprietà e dettagli nascondibili anche in stampa', async ({ page }) => {
  const project = sampleProject();
  project.nodes.find((node) => node.id === 'supply').supplyType = 'powerlock250';
  project.nodes.filter((node) => node.type === 'panel').forEach((node) => { node.inputType = 'powerlock'; });
  project.links[0].cable = 'powerlock';
  await openProject(page, project);
  await page.locator('#diagram > .link[data-link-id="supply-panel"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[name="cable"]')).toHaveValue('powerlock');
  await expect(page.locator('[name="cable"] option:checked')).toHaveText('PowerLock');
  await page.locator('[name="hideCableSection"]').uncheck();
  await page.locator('[name="hideLength"]').uncheck();
  await expect(page.locator('#diagram > .link[data-link-id="supply-panel"]')).not.toContainText('metri');
  await expect(page.locator('#diagram > .link[data-link-id="supply-panel"]')).not.toContainText('mm²');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-project').click();
  const saved = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(saved.links[0].length).toBe(5);
  expect(saved.links[0].hideLength).toBe(true);
  expect(saved.links[0].hideCableSection).toBe(true);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  const printed = page.locator('#print-pages .link[data-link-id="supply-panel"]');
  await expect(printed).toContainText('PowerLock');
  await expect(printed).not.toContainText('metri');
  await expect(printed).not.toContainText('mm²');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
});

test('ditta e sottotitolo vuoti, con rubrica richiamata solo su scelta', async ({ page }) => {
  await page.locator('#welcome-new-project').click();
  await expect(page.locator('#project-company-name')).toHaveValue('');
  await expect(page.locator('#project-company-address')).toHaveValue('');
  await page.locator('#project-event-name').fill('Rubrica di prova');
  await page.locator('#project-location-street').fill('Torino');
  await page.locator('#project-company-name').fill('Ditta di prova');
  await page.locator('#project-company-address').fill('Via Roma 1\n10121 Torino');
  await page.locator('#project-company-vat').fill('00123456789');
  await page.locator('#save-company').click();
  await expect(page.locator('#company-book-status')).toContainText('salvata');
  await page.locator('#confirm-project').click();
  await page.locator('#add-panel').click();
  await page.locator('#confirm-panel').click();
  await expect(page.locator('#property-form [name="subtitle"]')).toHaveValue('');
  await expect(page.locator('#diagram')).not.toContainText('Da denominare');
  await page.locator('#new-project').click();
  await expect(page.locator('#project-company-name')).toHaveValue('');
  await expect(page.locator('#project-company-address')).toHaveValue('');
  await page.locator('#company-book').selectOption({ label: 'Ditta di prova · 00123456789' });
  await expect(page.locator('#project-company-address')).toHaveValue('Via Roma 1\n10121 Torino');
  await page.locator('#cancel-project').click();
  await page.reload();
  await page.locator('#welcome-new-project').click();
  await expect(page.locator('#project-company-name')).toHaveValue('');
  await expect(page.locator('#company-book option')).toHaveCount(2);
});

test('cartiglio completo e proprietà affiancate o sotto al foglio', async ({ page }) => {
  const project = sampleProject();
  Object.assign(project.meta, { companyAddress: 'Via Vittorio Emanuele III\n12036 Revello CN', companyVat: '00123456789' });
  await openProject(page, project);
  for (const width of [1218, 897, 390]) {
    await page.setViewportSize({ width, height: 768 });
    await page.locator('.node[data-id="load"]').focus();
    await page.keyboard.press('Enter');
    const workspace = await page.locator('.workspace').boundingBox(), inspector = await page.locator('#inspector').boundingBox();
    expect(inspector.x >= workspace.x + workspace.width - 1 || inspector.y >= workspace.y + workspace.height - 1).toBe(true);
    const fits = await page.locator('#drawing-sheet .title-block > div').evaluateAll((cells) => cells.every((cell) => cell.scrollHeight <= cell.clientHeight + 1 && cell.scrollWidth <= cell.clientWidth + 1));
    expect(fits).toBe(true);
    const footer = await page.locator('#drawing-sheet .title-block').boundingBox(), sheet = await page.locator('#drawing-sheet').boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(sheet.y + sheet.height);
    await page.locator('#close-inspector').click();
  }
});

test('spaziatura uniforme fra utenze con altezze diverse', async ({ page }) => {
  const project = sampleProject();
  project.pages = [1];
  project.nodes = project.nodes.filter((node) => node.page === 1);
  project.links = project.links.filter((link) => link.id !== 'panel-load-2');
  project.nodes.push(
    { id: 'space-second', type: 'load', page: 1, x: 900, y: 350, title: 'Utenza con nota', note: 'Una nota abbastanza lunga da occupare diverse righe nello schema', plugType: 'cee16mono' },
    { id: 'space-third', type: 'load', page: 1, x: 900, y: 620, title: 'Ultima utenza', plugType: 'cee16mono' },
  );
  await openProject(page, project);
  await page.getByRole('button', { name: 'Disponi', exact: true }).click();
  await page.locator('#distribute-vertical').click();
  const rectangles = await page.locator('#diagram .node.load > rect').evaluateAll((elements) => elements.map((rect) => ({ y: Number(rect.getAttribute('y')), height: Number(rect.getAttribute('height')) })).sort((a, b) => a.y - b.y));
  const gaps = [rectangles[1].y - rectangles[0].y - rectangles[0].height, rectangles[2].y - rectangles[1].y - rectangles[1].height];
  expect(gaps[0]).toBeCloseTo(gaps[1], 5);
  await page.locator('#undo-action').click();
  expect(Number(await page.locator('.node[data-id="space-second"] > rect').getAttribute('y'))).not.toBeCloseTo(rectangles[1].y, 0);
});

test('ricerca da Via su file locale, recupero dopo errore e selezione indirizzo', async ({ page }) => {
  let requests = 0;
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    requests++;
    expect(new URL(route.request().url()).searchParams.get('q')).toBe('Piazza Castello Torino');
    if (requests === 1) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.fulfill({ json: { features: [{ properties: { type: 'street', name: 'Piazza Castello', city: 'Torino', postcode: '10123', county: 'Torino' } }] } });
  });
  await page.goto(pathToFileURL(resolve(__dirname, '../index.html')).href);
  await page.locator('#welcome-new-project').click();
  await page.locator('#project-location-street').fill('Piazza Castello Torino');
  await page.locator('#search-project-location').click();
  await expect(page.locator('#project-location-search-status')).toContainText('non disponibile');
  await expect(page.locator('#search-project-location')).toBeEnabled();
  await page.locator('#search-project-location').click();
  await page.locator('.project-location-result').click();
  await expect(page.locator('#project-location-street')).toHaveValue('Piazza Castello');
  await expect(page.locator('#project-location-city')).toHaveValue('Torino');
  await expect(page.locator('#project-location-postcode')).toHaveValue('10123');
});

test('guida iniziale fino al primo collegamento compatibile', async ({ page }) => {
  await createProject(page);
  await expect(page.locator('#empty-canvas')).toBeVisible();
  await page.locator('#empty-canvas [data-start-action="supply"]').click();
  await expect(page.locator('#empty-canvas')).toBeHidden();
  await page.locator('#workflow-guide [data-start-action="panel"]').click();
  await expect(page.locator('#panel-input-filter')).toHaveValue('cee125tri');
  await page.locator('#confirm-panel').click();
  await page.locator('#workflow-guide [data-start-action="link"]').click();
  await page.locator('#confirm-link').click();
  await expect(page.locator('#diagram > .link')).toHaveCount(1);
  await expect(page.locator('#workflow-guide [data-start-action="loads"]')).toBeVisible();
});

test('zoom, spostamento del foglio e adattamento senza modificare il progetto', async ({ page }) => {
  await openProject(page);
  const geometry = await page.locator('#diagram .node > rect').evaluateAll((rects) => rects.map((rect) => [rect.getAttribute('x'), rect.getAttribute('y')]));
  await page.locator('#zoom-level').selectOption('1.5');
  expect((await page.locator('#sheet-stage').boundingBox()).width).toBeCloseTo(1800, 0);
  await page.locator('#pan-tool').click();
  await expect(page.locator('#pan-tool')).toHaveAttribute('aria-pressed', 'true');
  const viewport = await page.locator('#sheet-wrapper').boundingBox();
  const before = await page.locator('#sheet-wrapper').evaluate((element) => element.scrollLeft);
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 - 100, viewport.y + viewport.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await page.locator('#sheet-wrapper').evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 80);
  expect(await page.locator('#diagram .node > rect').evaluateAll((rects) => rects.map((rect) => [rect.getAttribute('x'), rect.getAttribute('y')]))).toEqual(geometry);
  await expect(page.locator('#save-state')).toHaveText('Salvato');
  await page.locator('#pan-tool').click();
  await page.locator('#fit-sheet').click();
  await expect(page.locator('#zoom-level')).toHaveValue('fit');
  const stage = await page.locator('#sheet-stage').boundingBox();
  expect(stage.width).toBeLessThan(viewport.width);
  expect(stage.height).toBeLessThan(viewport.height);
});

test('zoom a 200% escluso dalle pagine di stampa', async ({ page }) => {
  await openProject(page);
  await page.locator('#zoom-level').selectOption('2');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  await page.emulateMedia({ media: 'print' });
  const printed = page.locator('#print-pages .drawing-sheet').first();
  expect(await printed.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  expect((await printed.boundingBox()).width).toBeCloseTo(1122.5, 0);
  await expect(page.locator('#sheet-stage')).toBeHidden();
  await expect(page.locator('.view-toolbar')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#zoom-level')).toHaveValue('2');
});

test('errori e avvisi navigabili fino alla presa da correggere', async ({ page }) => {
  const project = sampleProject();
  project.nodes.find((node) => node.id === 'load-2').socket = '';
  project.nodes.push({ id: 'unconnected-extra', type: 'load', title: 'Utenza libera', plugType: 'cee16mono', page: 1, x: 900, y: 500 });
  await openProject(page, project);
  await expect(page.locator('#status-message')).toHaveAttribute('data-kind', 'warning');
  await page.locator('#save-project').click();
  await expect(page.locator('#status-message')).toHaveAttribute('data-kind', 'error');
  await page.locator('#show-issues').click();
  await expect(page.locator('.issue-card[data-kind="error"]')).toHaveCount(1);
  await expect(page.locator('.issue-card[data-kind="warning"]')).toHaveCount(1);
  await page.locator('.issue-card[data-kind="error"] button').click();
  await expect(page.locator('#issues-dialog')).not.toBeVisible();
  await expect(page.locator('#page-select')).toHaveValue('2');
  await expect(page.locator('#inspector-title')).toHaveText('Luce S');
  await page.locator('#property-form [name="socket"]').selectOption('P2');
  await expect(page.locator('#status-message')).toHaveAttribute('data-kind', 'success');
  await expect(page.locator('#issues-count')).toHaveText('1');
  await page.locator('#show-issues').click();
  await page.locator('.issue-card[data-kind="warning"] button').click();
  await expect(page.locator('#page-select')).toHaveValue('1');
  await expect(page.locator('#inspector-title')).toHaveText('Utenza libera');
});

test('ricerca quadri, filtro ingresso e disponibilità dei quadri già in uso', async ({ page }) => {
  await openProject(page, socapexProject());
  await page.locator('#add-panel').click();
  await page.locator('#panel-search').fill('PB63A#6');
  await expect(page.locator('#confirm-panel')).toBeDisabled();
  await page.locator('#panel-include-used').check();
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('7/12');
  await expect(page.locator('[data-choose-panel="PB63A#6"]')).toBeDisabled();
  await page.locator('#panel-search').fill('PB32AM#9');
  await page.locator('#panel-input-filter').selectOption('cee32mono');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await page.locator('#panel-search').press('Enter');
  await expect(page.locator('#panel-dialog')).toBeVisible();
  await page.locator('[data-choose-panel="PB32AM#9"]').click();
  await page.locator('#confirm-panel').click();
  await expect(page.locator('#diagram')).toContainText('PB32AM#9');
  await expect(page.locator('#property-form .socket-summary')).toContainText('6/6');
});

test('barra contestuale con motivi per le azioni incompatibili', async ({ page }) => {
  await openProject(page);
  await page.locator('.node[data-id="supply"]').click();
  await page.locator('.node[data-id="panel"]').click({ modifiers: ['Shift'] });
  await expect(page.locator('#selection-toolbar')).toBeVisible();
  await expect(page.locator('[data-selection-action="connect"]')).toBeDisabled();
  await expect(page.locator('#selection-reason-connect')).toContainText('Seleziona almeno un’utenza');
  await expect(page.locator('[data-selection-action="duplicate"]')).toBeDisabled();
  await expect(page.locator('[data-selection-action="align"]')).toBeEnabled();
  await page.locator('[data-selection-action="align"]').click();
  await expect(page.locator('#align-dialog')).toBeVisible();
});

test('duplica e collega più utenze dalla barra contestuale', async ({ page }) => {
  const project = sampleProject();
  project.nodes.push({ id: 'load-extra', type: 'load', plugType: 'cee16mono', title: 'Seconda utenza', page: 1, x: 900, y: 500 });
  await openProject(page, project);
  await page.locator('.node[data-id="load"]').click();
  await page.locator('.node[data-id="load-extra"]').click({ modifiers: ['Shift'] });
  await page.locator('[data-selection-action="duplicate"]').click();
  await expect(page.locator('#diagram .node.load')).toHaveCount(4);
  await page.locator('[data-selection-action="connect"]').click();
  await expect(page.locator('[data-bulk-connect-load]:checked')).toHaveCount(2);
  await page.locator('#confirm-bulk-connect').click();
  await expect(page.locator('#diagram > .link')).toHaveCount(4);
  await expect(page.locator('#unconnected-count')).toHaveText('1 utenza non collegata');
});

test('nomi e miniature delle pagine seguono inserimento, eliminazione e annulla', async ({ page }) => {
  await openProject(page);
  await page.locator('#manage-pages').click();
  await expect(page.locator('.page-thumbnail')).toHaveCount(2);
  await page.locator('[data-page-name="2"]').fill('Regia');
  await page.locator('[data-page-name="2"]').press('Enter');
  await page.locator('[data-open-page="2"]').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 2 · Regia');
  await page.locator('#previous-page').click();
  await page.locator('#new-page').click();
  await expect(page.locator('#page-select option[value="3"]')).toHaveText('Pagina 3 · Regia');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-project').click();
  const saved = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(saved.pageNames).toEqual({ 3: 'Regia' });
  await page.locator('#delete-page').click();
  await expect(page.locator('#page-select option[value="2"]')).toHaveText('Pagina 2 · Regia');
  await page.locator('#undo-action').click();
  await expect(page.locator('#page-select option[value="3"]')).toHaveText('Pagina 3 · Regia');
  await page.reload();
  await page.locator('#restore-autosave').click();
  await expect(page.locator('#page-select option[value="3"]')).toHaveText('Pagina 3 · Regia');
});

test('comandi leggibili e aree di tocco di almeno 44 pixel', async ({ page }) => {
  await openProject(page);
  for (const selector of ['#add-supply', '#add-temp-panel', '#previous-page', '#page-select', '#zoom-level', '#zoom-in', '#fit-sheet', '#print-project']) {
    const button = page.locator(selector);
    const styles = await button.evaluate((element) => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
    expect(styles.font).toBeGreaterThanOrEqual(14);
    expect(styles.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#toggle-sidebar').click();
  await expect(page.locator('#sidebar')).not.toHaveAttribute('inert', '');
  await page.locator('#toggle-sidebar').click();
  await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  await page.locator('#fit-sheet').click();
  await expect(page.locator('#zoom-level')).toHaveValue('fit');
});

test('descrizione del collegamento trascinabile con adattamento e proprietà aperte', async ({ page }) => {
  await openProject(page);
  const label = page.locator('#diagram .link-label[data-link-id="panel-load"]');
  const original = Number(await label.locator('.line-label').first().getAttribute('x'));
  const bounds = await label.boundingBox();
  await page.mouse.move(bounds.x + 12, bounds.y + 10);
  await page.mouse.down();
  const scale = await page.locator('#diagram').evaluate((svg) => svg.getScreenCTM().a);
  await page.mouse.move(bounds.x + 52, bounds.y + 10, { steps: 6 });
  await page.mouse.up();
  expect(Number(await label.locator('.line-label').first().getAttribute('x'))).toBeCloseTo(original + 40 / scale, 0);
});

function printDistributionProject(count, longNames = false) {
  const project = { version: 6, meta: { name: 'Riepilogo forniture', revision: '2.0', company: 'Ditta prova', companyAddress: 'Via Roma 1\n10100 Torino', companyVat: '01234567890', type: 'Allestimento Audio Luci' }, pages: [], nodes: [], links: [] };
  for (let i = 1; i <= count; i++) {
    project.pages.push(i);
    const title = `Fornitura ${i}${longNames ? ' - '.repeat(2) + 'Distribuzione area spettacolo e servizi '.repeat(4) : ''}`;
    project.nodes.push(
      { id: `s${i}`, type: 'supply', supplyKey: `supply-${i}`, supplyType: 'cee63tri', title, page: i, x: 110, y: 100 },
      { id: `p${i}`, type: 'panel', panelKey: `panel-${i}`, inputType: 'cee63tri', ports: [{ type: 'cee16mono', quantity: 3 }], title: `Quadro ${i}`, page: i, x: 450, y: 100 },
      { id: `u${i}`, type: 'load', plugType: 'cee16mono', watts: 2300, socket: 'P1', title: `Utenza ${i}`, page: i, x: 900, y: 200 },
    );
    project.links.push({ id: `sp${i}`, from: `s${i}`, to: `p${i}`, cable: 'cee63tri', length: 0 }, { id: `pu${i}`, from: `p${i}`, to: `u${i}`, cable: 'cee16mono', length: 20 });
  }
  return project;
}

async function assertPrintLayout(page) {
  await page.emulateMedia({ media: 'print' });
  const problems = await page.locator('#print-pages > article').evaluateAll((sheets) => sheets.flatMap((sheet, index) => {
    const errors = [], bounds = sheet.getBoundingClientRect();
    if (Number(sheet.dataset.printPage) !== index + 1) errors.push(`Numerazione ${index + 1}`);
    if (!sheet.classList.contains('print-sheet')) return errors;
    const content = sheet.querySelector('.print-content').getBoundingClientRect();
    sheet.querySelectorAll('.print-table tbody tr').forEach((row) => {
      if (row.getBoundingClientRect().bottom > content.bottom + 1) errors.push(`Riga oltre il contenuto ${index + 1}`);
    });
    const footer = sheet.querySelector('.title-block').getBoundingClientRect();
    if (footer.bottom > bounds.bottom || footer.top < content.bottom) errors.push(`Cartiglio ${index + 1}`);
    sheet.querySelectorAll('a[href^="#print-page-"]').forEach((link) => {
      if (!document.getElementById(link.hash.slice(1))) errors.push(`Destinazione ${link.hash}`);
    });
    return errors;
  }));
  expect(problems).toEqual([]);
}

test('riepilogo approvato con percentuali reali, sole potenze collegate e dettaglio multipagina', async ({ page }) => {
  const project = sampleProject();
  project.nodes.push({ id: 'excluded', type: 'load', title: 'UTENZA DA ESCLUDERE', plugType: 'cee16mono', watts: 50000, page: 1, x: 900, y: 600 });
  await openProject(page, project);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  const report = page.locator('.phase-report-sheet');
  await expect(report).toHaveCount(1);
  await expect(report.locator('h1')).toHaveText('Riepilogo carichi e distribuzione fasi');
  await expect(report.locator('.phase-report-total > strong')).toHaveText('3,45 kW');
  await expect(report.locator('.phase-share > strong')).toHaveText(['66,7%', '33,3%', '0,0%']);
  expect(await report.locator('.phase-report-r .phase-report-track span').evaluate((el) => parseFloat(el.style.width))).toBeCloseTo(66.6667, 3);
  await expect(report.locator('.supply-table tbody tr')).toHaveCount(1);
  await expect(report.locator('.supply-table tbody td').first()).toHaveText('3,45 kW');
  await expect(report.locator('.supply-table tbody td').last()).toHaveText('3-4');
  expect(await report.innerText()).not.toMatch(/UTENZA DA ESCLUDERE|utenze|dati da completare|nota progetto/i);
  await assertPrintLayout(page);
});

test('indice compatto con quindici alimentazioni, quadro residente e collegamenti rinumerati', async ({ page }) => {
  const project = printDistributionProject(15);
  project.nodes = project.nodes.filter((node) => node.id !== 's11');
  project.links = project.links.filter((link) => link.id !== 'sp11');
  project.nodes.find((node) => node.id === 'p11').title = 'Quadro Residente Cucina';
  await openProject(page, project);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  await expect(page.locator('.index-sheet')).toHaveCount(1);
  await expect(page.locator('.index-table tbody tr')).toHaveCount(15);
  await expect(page.locator('.index-table tr').filter({ hasText: 'Quadro Residente Cucina' })).toHaveCount(1);
  await expect(page.locator('.index-table tbody tr').first().locator('td').last()).toHaveText('3');
  await expect(page.locator('.index-table tbody tr').last().locator('td').last()).toHaveText('17');
  await expect(page.locator('.phase-report-total > strong')).toHaveText('34,50 kW');
  await expect(page.locator('.supply-table tbody tr')).toHaveCount(15);
  await assertPrintLayout(page);
});

test('indice e dettagli lunghi continuano su più pagine senza tagli e con cartigli completi', async ({ page }) => {
  const project = printDistributionProject(35, true);
  project.meta.companyAddress = 'Indirizzo della ditta '.repeat(18);
  project.meta.name = 'Evento con descrizione lunga '.repeat(6);
  await openProject(page, project);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  expect(await page.locator('.index-sheet').count()).toBeGreaterThan(1);
  expect(await page.locator('.phase-report-sheet').count()).toBeGreaterThan(1);
  await expect(page.locator('.index-table tbody tr')).toHaveCount(35);
  await expect(page.locator('.supply-table tbody tr')).toHaveCount(35);
  await expect(page.locator('.phase-report-total > strong')).toHaveText('80,50 kW');
  const total = await page.locator('#print-pages > article').count();
  await expect(page.locator('#print-pages > article').last().locator('.title-block')).toContainText(`Pagina ${total} di ${total}`);
  await assertPrintLayout(page);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#print-pages > article')).toHaveCount(0);
  await expect(page.locator('#save-state')).toHaveText('Salvato');
});

test('stampa da tastiera senza carichi assegnati, indice delle pagine e riepilogo a zero', async ({ page }) => {
  const project = { version: 6, meta: { name: 'Solo utenze libere' }, pages: [1, 2], nodes: [1, 2].map((n) => ({ id: `free-${n}`, type: 'load', title: `Nome escluso ${n}`, plugType: 'cee16mono', watts: 1000, page: n, x: 900, y: 250 })), links: [] };
  await openProject(page, project);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('.index-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.phase-report-total > strong')).toHaveText('0,00 kW');
  await expect(page.locator('.phase-share > strong')).toHaveText(['0,0%', '0,0%', '0,0%']);
  await expect(page.locator('.supply-table')).toHaveCount(0);
  expect(await page.locator('.phase-report-sheet').innerText()).not.toMatch(/Nome escluso|NaN|Infinity|utenze/i);
  await assertPrintLayout(page);
});

test('richiami tra pagine rinumerati nel PDF senza modificare i numeri dell’editor', async ({ page }) => {
  const project = sampleProject();
  project.pages = [1, 2, 3];
  project.nodes = project.nodes.filter((node) => node.id !== 'panel-reference');
  project.nodes.filter((node) => node.type !== 'supply').forEach((node) => { node.page = 2; });
  project.links.find((link) => link.id === 'panel-load-2').from = 'panel';
  project.nodes.push({ id: 'free-on-third', type: 'load', plugType: 'cee16mono', watts: 500, title: 'Fuori riepilogo', page: 3, x: 900, y: 300 });
  await openProject(page, project);
  await expect(page.locator('#diagram .page-jump-text')).toHaveText('Pagina 2');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  await expect(page.locator('#print-page-3 .page-jump-text')).toHaveText('Pagina 4');
  await expect(page.locator('.index-table tbody tr').first().locator('td').last()).toHaveText('3-4');
  await expect(page.locator('.index-table tbody tr').last().locator('td').last()).toHaveText('5');
  await assertPrintLayout(page);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#diagram .page-jump-text')).toHaveText('Pagina 2');
  await expect(page.locator('#save-state')).toHaveText('Salvato');
});

test('riordino prima e dopo conserva pagina aperta, nomi e una modifica annullabile per ogni passo', async ({ page }) => {
  const project = sampleProject(); project.pageNames = { 1: 'Palco', 2: 'Regia' };
  await openProject(page, project);
  await page.locator('#next-page').click();
  await page.locator('#manage-pages').click();
  await expect(page.locator('[data-page-step="1"][data-direction="-1"]')).toBeDisabled();
  await expect(page.locator('[data-page-step="2"][data-direction="1"]')).toBeDisabled();
  await page.locator('[data-page-step="2"][data-direction="-1"]').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 1 · Regia');
  await expect(page.locator('.page-card.current [data-open-page] strong')).toHaveText('Pagina 1 · Regia');
  await expect(page.locator('#page-order-message')).toContainText('Regia spostata dalla pagina 2 alla 1');
  await page.locator('#pages-undo').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 2 · Regia');
  await page.locator('#pages-redo').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 1 · Regia');
  await page.locator('[data-page-step="1"][data-direction="1"]').click();
  await page.locator('#pages-undo').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 1 · Regia');
  await page.locator('[data-page-name="1"]').fill('Regia aggiornata');
  await page.locator('[data-page-step="1"][data-direction="1"]').click();
  await expect(page.locator('#page-label')).toHaveText('Pagina 2 · Regia aggiornata');
  await page.locator('#pages-dialog button[value="close"]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#save-project').click();
  const saved = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(saved.links).toEqual(project.links.map((link) => ({ ...link, cableSection: link.cable })));
  expect(saved.nodes.find((node) => node.id === 'load-2').page).toBe(2);
  expect(saved.pageNames).toEqual({ 1: 'Palco', 2: 'Regia aggiornata' });
});

test('spostamento diretto 8 a 3, tastiera, recupero e riferimenti del PDF coerenti', async ({ page }) => {
  const project = printDistributionProject(8); project.pageNames = { 1: 'Palco', 8: 'Regia' };
  await openProject(page, project);
  await page.locator('#manage-pages').click();
  await page.locator('[data-page-drag="8"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#page-position-dialog')).toBeVisible();
  await expect(page.locator('#confirm-page-position')).toBeDisabled();
  await page.locator('#page-position-choice').selectOption('3');
  await page.locator('#confirm-page-position').click();
  await expect(page.locator('[data-page-name="3"]')).toHaveValue('Regia');
  await expect(page.locator('#page-label')).toHaveText('Pagina 1 · Palco');
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-page-name="8"]')).toHaveValue('Regia');
  await page.locator('#pages-redo').click();
  await expect(page.locator('[data-page-name="3"]')).toHaveValue('Regia');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unifilari.autosave.v6'))?.project.nodes.find((node) => node.id === 's8').page)).toBe(3);
  await page.reload();
  await page.locator('#restore-autosave').click();
  await expect(page.locator('#page-select option[value="3"]')).toHaveText('Pagina 3 · Regia');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#print-project').click();
  await expect(page.locator('#print-page-5 .node[data-id="s8"]')).toHaveCount(1);
  await expect(page.locator('.index-table tbody tr').filter({ hasText: 'Fornitura 8' }).locator('td').last()).toHaveText('5');
  await expect(page.locator('.supply-table tbody tr').filter({ hasText: 'Fornitura 8' }).locator('td').last()).toHaveText('5');
  await assertPrintLayout(page);
});

test('trascinamento delle miniature nella griglia ed Escape annullano senza perdere i nomi', async ({ page }) => {
  const project = printDistributionProject(3); project.pageNames = { 1: 'Palco', 2: 'Regia', 3: 'Esterni' };
  await openProject(page, project);
  await page.locator('#manage-pages').click();
  const start = await page.locator('[data-page-drag="1"]').boundingBox();
  const target = await page.locator('.page-card[data-page="3"]').boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width * .8, target.y + target.height * .4, { steps: 10 });
  await expect(page.locator('.page-drag-ghost')).toBeVisible();
  await expect(page.locator('.page-card.drop-after')).toHaveAttribute('data-page', '3');
  await page.mouse.up();
  await expect(page.locator('[data-page-name="3"]')).toHaveValue('Palco');
  await expect(page.locator('#page-label')).toHaveText('Pagina 3 · Palco');
  await expect(page.locator('.page-drag-ghost')).toHaveCount(0);
  const again = await page.locator('[data-page-drag="3"]').boundingBox();
  const first = await page.locator('.page-card[data-page="1"]').boundingBox();
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + 10, first.y + first.height * .4, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('#pages-dialog')).toBeVisible();
  await expect(page.locator('[data-page-name="3"]')).toHaveValue('Palco');
  await expect(page.locator('.page-drag-ghost, .drop-before, .drop-after')).toHaveCount(0);
  await page.locator('#pages-undo').click();
  await expect(page.locator('[data-page-name="1"]')).toHaveValue('Palco');
});

test('riordino su schermo stretto con scorrimento automatico e annullamento della scelta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const project = printDistributionProject(8); project.pageNames = { 1: 'Prima pagina' };
  await openProject(page, project);
  await page.locator('#manage-pages').click();
  const handle = page.locator('[data-page-drag="1"]');
  expect(await handle.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none');
  const start = await handle.boundingBox(), dialog = await page.locator('#pages-dialog').boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(dialog.x + dialog.width / 2, dialog.y + dialog.height - 10, { steps: 8 });
  await expect.poll(() => page.locator('#pages-dialog').evaluate((element) => element.scrollTop)).toBeGreaterThan(300);
  await page.mouse.move(dialog.x + dialog.width / 2, dialog.y + dialog.height - 120);
  const message = await page.locator('#page-order-message').textContent();
  const destination = Number(message.match(/posizione (\d+)/)[1]);
  expect(destination).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(page.locator(`[data-page-name="${destination}"]`)).toHaveValue('Prima pagina');
  await page.locator(`[data-page-position="${destination}"]`).click();
  await page.locator('#page-position-choice').selectOption('1');
  await page.locator('#cancel-page-position').click();
  await expect(page.locator(`[data-page-name="${destination}"]`)).toHaveValue('Prima pagina');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
