// Local browser run for notes version 4: menu bar, labels and archive.
// Run from the repository root:  node docs/evidence/notes-page/browser-check-v4.mjs
// The real page and the real API handlers over an in-memory store and a
// password made for the run, in Chromium through Playwright. Writes the
// screenshots to docs/evidence/notes-v4/ and prints one PASS or FAIL line per
// check.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { memoryStore } from '../../../notes-tests/helpers.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium, devices } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const PAGE_FILE = process.env.NOTES_PAGE_FILE || ROOT + 'notes/index.html';
const SHOTS = process.env.SHOTS_DIR || ROOT + 'docs/evidence/notes-v4';
mkdirSync(SHOTS, { recursive: true });
const password = 'pw-' + randomBytes(12).toString('hex');

// The shared in-memory store, which keeps the same promises as the Blob adapter.
const store = memoryStore();
const notes = store.notes;
const api = createNotesApi({ store, env: { [ENVIRONMENT_VARIABLE]: password } });
const routes = {
  '/api/login': { POST: api.login },
  '/api/session': { GET: api.session, DELETE: api.signOut },
  '/api/notes': api.collection,
  '/api/labels': api.labels,
  '/api/note': api.item,
};
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
// No-store can be switched off, on the page and on the API answers, to stand
// in for a browser that keeps such pages in its back-forward cache anyway.
// Chrome on a computer refuses to cache a page that is no-store or that fetched
// a no-store answer, so without this the cache case could never be exercised.
let pageNoStore = true;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8770');
  const route = routes[url.pathname];
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const handler = route[req.method];
    const quiet = console.error; console.error = () => {};
    let response;
    try {
      response = handler
        ? await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : body }))
        : new Response('', { status: 405 });
    } finally { console.error = quiet; }
    const headers = Object.fromEntries(response.headers);
    if (!pageNoStore) delete headers['cache-control'];
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  if (url.pathname === '/notes') {
    res.writeHead(200, { 'content-type': 'text/html', ...(pageNoStore ? { 'cache-control': 'no-store' } : {}) });
    res.end(readFileSync(PAGE_FILE));
    return;
  }
  if (url.pathname === '/elsewhere') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>elsewhere</title><p>Another page</p>');
    return;
  }
  const path = url.pathname.slice(1);
  const file = ROOT + path;
  if (!existsSync(file) || path.startsWith('..')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8770, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8770';


const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- seeding through the real API ---------- */

let cookie = '';
async function http(method, path, { body, headers = {} } = {}) {
  const response = await fetch(BASE + path, { method, headers: { cookie, ...headers }, body });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, headers: response.headers, text };
}
async function signInForSeeding() {
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
}
async function addLabel(name) {
  const now = await http('GET', '/api/labels');
  const made = await http('POST', '/api/labels', { body: JSON.stringify({ name }), headers: { 'x-base-labels': now.json.updatedAt, 'content-type': 'application/json' } });
  return made.json.id;
}
async function addNote(text, { labels = [], archived = false } = {}) {
  const made = await http('POST', '/api/notes', { body: text, headers: { 'content-type': 'text/plain' } });
  await sleep(12);
  if (labels.length || archived) {
    const patched = await http('PATCH', '/api/note?id=' + made.json.id, { body: JSON.stringify({ labels, archived }), headers: { 'x-base-updated': made.json.updatedAt, 'content-type': 'application/json' } });
    if (patched.status !== 200) throw new Error('seed patch ' + patched.status);
  }
  await sleep(12);
  return made.json.id;
}
const wipe = () => { notes.clear(); store.state.labelsFile = null; };
const labelNames = () => (store.state.labelsFile ? store.state.labelsFile.labels.map((l) => l.name) : []);
const idOf = (name) => store.state.labelsFile.labels.find((l) => l.name === name).id;
const stored = (id) => notes.get(id).meta;

let ids = {};
async function seedMain() {
  wipe();
  const L = {};
  for (const name of ['Work', 'Home', 'Ideas', 'Travel', 'Recipes', 'Spare', 'Zeta']) L[name] = await addLabel(name);
  ids = {
    plain: await addNote('Plain note\nnothing special\n'),
    shopping: await addNote('Shopping\nmilk\neggs\n', { labels: [L.Home] }),
    trip: await addNote('Trip plan\nflights and hotels\n', { labels: [L.Home, L.Ideas, L.Recipes, L.Travel, L.Work] }),
    old: await addNote('Old budget\nan old zephyrine plan\n', { labels: [L.Work, L.Zeta], archived: true }),
    deploy: await addNote('Deploy runbook\nssh deploy@host && run zephyrine --force\nsecond line\n', { labels: [L.Work] }),
  };
  return L;
}

const browser = await chromium.launch();
await signInForSeeding();

/* ---------- screenshots, light and dark, narrow and wide ---------- */

async function openMenuIfNarrow(page, narrow) {
  if (narrow) { await page.click('#menu-button'); await page.waitForSelector('#menu[data-open="true"]'); }
}

async function shots(width, theme) {
  const narrow = width === 320;
  const tag = `${width}-${theme}`;
  const L = await seedMain();
  const context = await browser.newContext({ viewport: { width, height: narrow ? 760 : 860 }, colorScheme: 'light' });
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png` });
  const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const settle = () => sleep(250);

  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  if (theme === 'dark') await page.click('#theme-switch');
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#list:not([hidden])');
  await page.waitForSelector('#notes .note-row');
  await settle();
  check(`${tag}: Notes list, no sideways scroll`, await noSideways());
  await shot('01-notes-with-labels');

  // A label view.
  await page.goto(`${BASE}/notes#l/${L.Work}`);
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Work');
  await settle();
  check(`${tag}: label view, no sideways scroll`, await noSideways());
  await shot('02-label-view');

  // The phone menu open (the wide layout shows its menu bar in every shot).
  if (narrow) {
    await page.click('#menu-button');
    await page.waitForSelector('#menu[data-open="true"]');
    await settle();
    check(`${tag}: open menu, no sideways scroll`, await noSideways());
    await shot('03-phone-menu-open');
    await page.keyboard.press('Escape');
  }

  // The edit view with the Labels panel open.
  await page.goto(`${BASE}/notes#n/${ids.trip}`);
  await page.waitForSelector('#edit:not([hidden])');
  await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  await page.click('#labels-button');
  await page.waitForSelector('#labels-panel:not([hidden])');
  await settle();
  check(`${tag}: edit view with the Labels panel, no sideways scroll`, await noSideways());
  await shot('04-edit-labels-panel');

  // Edit labels with a rename and a delete confirmation open.
  await page.goto(`${BASE}/notes#labels`);
  await page.waitForSelector('#labels:not([hidden])');
  await page.waitForSelector('#label-list .label-row');
  await page.locator('#label-list li', { hasText: 'Ideas' }).locator('.label-rename').click();
  await page.locator('#label-list li', { hasText: 'Spare' }).locator('.label-delete').click();
  await page.waitForSelector('#label-list .confirm');
  await settle();
  check(`${tag}: Edit labels shows a rename and a delete confirmation at once`, (await page.locator('#label-list .renaming input').count()) === 1 && (await page.locator('#label-list .confirm').count()) === 1);
  check(`${tag}: Edit labels with a rename and a delete confirmation, no sideways scroll`, await noSideways());
  await shot('05-edit-labels-rename-and-delete');

  // Archive.
  await page.goto(`${BASE}/notes#archive`);
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Archive');
  await page.waitForSelector('#notes .note-row');
  await settle();
  check(`${tag}: Archive, no sideways scroll`, await noSideways());
  await shot('06-archive');

  // A search that returns an archived note.
  await page.goto(`${BASE}/notes`);
  await page.waitForSelector('#notes .note-row');
  await page.fill('#search', 'zephyrine');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Search results' && document.querySelectorAll('#notes .note-row').length === 2);
  await settle();
  check(`${tag}: search with an archived result, no sideways scroll`, await noSideways());
  await shot('07-search-with-archived-result');

  // Empty states.
  wipe();
  await page.goto(`${BASE}/notes#labels`);
  await page.reload();
  await page.waitForSelector('#labels:not([hidden])');
  await settle();
  check(`${tag}: empty Edit labels says the briefed sentence`, (await page.locator('#labels-empty').innerText()) === 'No labels yet. Type a name above and press Create.');
  await shot('08-empty-edit-labels');
  await page.goto(`${BASE}/notes#archive`);
  await page.reload();
  await page.waitForSelector('#empty:not([hidden])');
  check(`${tag}: empty Archive says the briefed sentence`, (await page.locator('#empty').innerText()) === 'Nothing archived. Archive a note to take it out of your notes without deleting it.');
  await shot('09-empty-archive');
  await page.goto(`${BASE}/notes`);
  await page.reload();
  await page.waitForSelector('#empty:not([hidden])');
  check(`${tag}: empty Notes keeps its sentence`, (await page.locator('#empty').innerText()) === 'No notes yet. Press New note to write the first one.');
  await shot('10-empty-notes');
  await page.fill('#search', 'nothing-like-this');
  await page.waitForFunction(() => document.getElementById('empty').textContent.startsWith('No notes contain'));
  await shot('11-empty-search');
  await page.fill('#search', '');
  await page.goto(`${BASE}/notes#new`);
  await page.reload();
  await page.waitForSelector('#edit:not([hidden])');
  await page.click('#labels-button');
  await page.waitForSelector('#labels-panel:not([hidden])');
  check(`${tag}: empty Labels panel says the briefed sentence`, (await page.locator('#panel-empty').innerText()) === 'No labels yet. Type a name to create one.');
  await shot('12-empty-labels-panel');

  const spare = await addLabel('Spare');
  await page.goto(`${BASE}/notes#l/${spare}`);
  await page.reload();
  await page.waitForSelector('#empty:not([hidden])');
  await sleep(300);
  check(`${tag}: empty label view says the briefed sentence`, (await page.locator('#empty').innerText()) === 'No notes have the label Spare. Open a note and press Labels to add it.');
  await shot('13-empty-label-view');
  await addNote('Kept away\n', { labels: [spare], archived: true });
  await page.reload();
  await page.waitForSelector('#empty:not([hidden])');
  await page.waitForFunction(() => document.getElementById('empty').textContent.includes('under Archive'));
  check(`${tag}: empty label view adds the Archive sentence when archived notes carry it`, (await page.locator('#empty').innerText()) === 'No notes have the label Spare. Open a note and press Labels to add it. Archived notes with this label are under Archive.');
  await shot('14-empty-label-view-with-archived');
  await context.close();
}

for (const width of [320, 1280]) for (const theme of ['light', 'dark']) await shots(width, theme);

/* ---------- behaviour, wide ---------- */

{
  const L = await seedMain();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const rows = () => page.locator('#notes .note-row');
  const titles = () => page.$$eval('#notes .note-title', (els) => els.map((e) => e.textContent));
  const heading = () => page.locator('#list-heading').innerText();
  const active = () => page.$$eval('#menu a[aria-current="page"]', (els) => els.map((e) => e.getAttribute('data-key')));
  const waitList = async (h) => page.waitForFunction((x) => document.getElementById('list-heading').textContent === x && !document.getElementById('list').hidden, h);
  const status = () => page.locator('#status').innerText();

  await page.goto(BASE + '/notes');
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#notes .note-row');

  // Layout.
  const menuBox = await page.locator('#menu').boundingBox();
  check('wide: the menu bar is 240px wide and flush to the left edge', Math.round(menuBox.x) === 0 && Math.round(menuBox.width) === 240, JSON.stringify(menuBox));
  const barBox = await page.locator('.bar').boundingBox();
  check('wide: the header spans the whole window', Math.round(barBox.width) === 1280);
  const mainBox = await page.locator('main').boundingBox();
  check('wide: the content is at most 800px with 24px side padding', Math.round(mainBox.width) <= 800 && (await page.locator('main').evaluate((e) => getComputedStyle(e).paddingLeft)) === '24px', String(mainBox.width));
  check('wide: no menu button, New note keeps its label, Sign out and the theme switch are in the header', !(await page.locator('#menu-button').isVisible()) && (await page.locator('#new-note').innerText()).trim() === 'New note' && await page.locator('#sign-out').isVisible() && await page.locator('#theme-switch').isVisible());
  check('wide: the menu is a nav called Notes menu', (await page.locator('nav#menu').getAttribute('aria-label')) === 'Notes menu');
  const items = await page.$$eval('#menu .menu-item', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  check('wide: items in order, labels alphabetical ignoring case', JSON.stringify(items.slice(0, 9)) === JSON.stringify(['Notes', 'Home', 'Ideas', 'Recipes', 'Spare', 'Travel', 'Work', 'Zeta', 'Edit labels']) && items[9] === 'Archive', JSON.stringify(items));
  const itemBox = await page.locator('#menu a[data-key="notes"]').boundingBox();
  check('wide: a menu item is 44px tall with 8px margins (240px less the 1px border and 16px of margin)', Math.round(itemBox.height) === 44 && Math.round(itemBox.x) === 8 && Math.round(itemBox.width) === 223, JSON.stringify(itemBox));
  check('wide: Notes is the active item', JSON.stringify(await active()) === '["notes"]');
  const sticky = await page.locator('#menu').evaluate((e) => getComputedStyle(e).position);
  check('wide: the menu bar is sticky under the header', sticky === 'sticky');

  // Notes leaves archived out, chips, speech text.
  check('Notes leaves the archived note out', !(await titles()).includes('Old budget') && (await rows().count()) === 4, JSON.stringify(await titles()));
  const trip = page.locator('#notes li', { hasText: 'Trip plan' });
  const chipTexts = await trip.locator('.chips .chip:visible').allInnerTexts();
  check('wide: a note with 5 labels shows 3 chips and +2', JSON.stringify(chipTexts) === JSON.stringify(['Home', 'Ideas', 'Recipes', '+2']), JSON.stringify(chipTexts));
  check('the chips are hidden from screen readers and the link says every label', (await trip.locator('.chips').getAttribute('aria-hidden')) === 'true' && (await trip.locator('.note-link .sr-only').innerText()) === 'Labels: Home, Ideas, Recipes, Travel, Work');
  const chipMetrics = await trip.locator('.chips .chip').first().evaluate((e) => { const s = getComputedStyle(e); return [e.getBoundingClientRect().height, s.borderRadius, s.borderTopWidth, s.fontSize, s.fontWeight]; });
  check('a chip is 22px tall with 6px corners, a 1px border, 12px type at weight 600', chipMetrics[0] === 22 && chipMetrics[1] === '6px' && chipMetrics[2] === '1px' && chipMetrics[3] === '12px' && chipMetrics[4] === '600', JSON.stringify(chipMetrics));
  check('a note with no labels has no chip line', (await page.locator('#notes li', { hasText: 'Plain note' }).locator('.chips').count()) === 0);
  const rowButtons = await trip.locator('.row-actions button').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]));
  check('each row has an archive button left of the bin, both 44px', JSON.stringify(rowButtons) === JSON.stringify([['Archive note: Trip plan', 44, 44], ['Delete note: Trip plan', 44, 44]]), JSON.stringify(rowButtons));

  // Label view and addresses.
  await page.click('#menu a[data-key="label:' + L.Work + '"]');
  await waitList('Work');
  check('a label view holds only its non-archived notes', JSON.stringify((await titles()).sort()) === JSON.stringify(['Deploy runbook', 'Trip plan']), JSON.stringify(await titles()));
  check('the address is the label id, and the item is active', page.url().endsWith('#l/' + L.Work) && JSON.stringify(await active()) === '["label:' + L.Work + '"]');
  await page.reload(); await page.waitForSelector('#notes .note-row');
  check('refresh keeps the label view', (await heading()) === 'Work');

  // Archive view, unarchive row.
  await page.click('#menu a[data-key="archive"]');
  await waitList('Archive');
  check('Archive lists only archived notes, with an Unarchive button', JSON.stringify(await titles()) === '["Old budget"]' && (await page.locator('.row-archive').getAttribute('aria-label')) === 'Unarchive note: Old budget');
  await page.reload(); await page.waitForSelector('#notes .note-row');
  check('refresh keeps the Archive view', (await heading()) === 'Archive' && JSON.stringify(await active()) === '["archive"]');

  // Search from a label view covers everything.
  await page.click('#menu a[data-key="label:' + L.Work + '"]');
  await waitList('Work');
  await page.fill('#search', 'zephyrine');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Search results' && document.querySelectorAll('#notes .note-row').length === 2);
  const marker = await page.locator('#notes li', { hasText: 'Old budget' }).locator('.archived-marker').innerText();
  check('search from a label view finds archived notes, marked Archived, newest edit first', marker.trim() === 'Archived' && (await titles())[0] === 'Deploy runbook' && (await titles())[1] === 'Old budget', JSON.stringify(await titles()));
  check('while a search is running no menu item is active', (await active()).length === 0);
  const markerFirst = await page.locator('#notes li', { hasText: 'Old budget' }).locator('.chips .chip').first().getAttribute('class');
  check('the Archived marker sits first in the chip line', markerFirst.includes('archived-marker'));
  await page.fill('#search', '');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Work');

  // Archive from a row, then Undo.
  await page.click('#menu a[data-key="notes"]');
  await waitList('Notes');
  await page.locator('#notes li', { hasText: 'Shopping' }).locator('.row-archive').click();
  await page.waitForFunction(() => !document.getElementById('flash').hidden);
  check('archiving a row shows the message and an Undo, and the row leaves the list', (await page.locator('#flash-text').innerText()) === 'Note archived.' && !(await titles()).includes('Shopping') && (await page.locator('#flash').getAttribute('role')) === 'status');
  check('the note is archived in storage with its text untouched', stored(ids.shopping).archived === true && Buffer.from(notes.get(ids.shopping).bytes).toString() === 'Shopping\nmilk\neggs\n');
  await page.click('#flash-undo');
  await page.waitForFunction(() => document.getElementById('flash').hidden);
  await page.waitForFunction(() => [...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Shopping'));
  check('Undo puts it back, and the message goes', stored(ids.shopping).archived === false);
  await page.locator('#notes li', { hasText: 'Shopping' }).locator('.row-archive').click();
  await page.waitForFunction(() => !document.getElementById('flash').hidden);
  await page.fill('#search', 'x');
  check('the message goes when anything else is done', await page.locator('#flash').isHidden());
  await page.fill('#search', '');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Notes');
  // put Shopping back for later checks
  await page.click('#menu a[data-key="archive"]'); await waitList('Archive');
  await page.locator('#notes li', { hasText: 'Shopping' }).locator('.row-archive').click();
  await page.waitForFunction(() => document.getElementById('flash-text').textContent === 'Note unarchived.');
  check('Unarchive from the Archive view says so', stored(ids.shopping).archived === false);

  // Edit view: toolbar, strip, panel.
  await page.click('#menu a[data-key="notes"]'); await waitList('Notes');
  await page.locator('#notes li', { hasText: 'Deploy runbook' }).locator('.note-link').click();
  await page.waitForSelector('#edit:not([hidden])');
  await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  const toolbar = await page.$$eval('.toolbar > .row:last-child > button', (els) => els.map((e) => e.textContent.trim()));
  check('edit toolbar right group: Labels, Copy, Archive, Delete', JSON.stringify(toolbar) === '["Labels","Copy","Archive","Delete"]', JSON.stringify(toolbar));
  check('the strip shows the note\'s label', (await page.locator('#note-strip .chip').allInnerTexts()).join() === 'Work');
  check('the menu keeps the list the note came from active', JSON.stringify(await active()) === '["notes"]');
  await page.click('#labels-button');
  await page.waitForSelector('#labels-panel:not([hidden])');
  check('the panel opens with its field focused and the toolbar button expanded', (await page.evaluate(() => document.activeElement.id)) === 'label-find' && (await page.getAttribute('#labels-button', 'aria-expanded')) === 'true');
  const checks = await page.$$eval('#panel-list .check-row', (els) => els.map((e) => [e.textContent.trim(), e.querySelector('input').checked]));
  check('every label is a row with a checkbox, ticked when the note has it', JSON.stringify(checks) === JSON.stringify([['Home', false], ['Ideas', false], ['Recipes', false], ['Spare', false], ['Travel', false], ['Work', true], ['Zeta', false]]), JSON.stringify(checks));
  await page.fill('#label-find', 'REC');
  check('typing filters the list, ignoring case', JSON.stringify(await page.$$eval('#panel-list .check-row', (els) => els.map((e) => e.textContent.trim()))) === '["Recipes"]');
  await page.fill('#label-find', '');
  await page.locator('#panel-list .check-row', { hasText: 'Home' }).locator('input').check();
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved');
  check('ticking saves at once through the status, without the text', JSON.stringify(stored(ids.deploy).labels.sort()) === JSON.stringify([idOf('Home'), idOf('Work')].sort()) && Buffer.from(notes.get(ids.deploy).bytes).toString().startsWith('Deploy runbook'));
  await page.locator('#panel-list .check-row', { hasText: 'Home' }).locator('input').uncheck();
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved');
  check('unticking saves too', JSON.stringify(stored(ids.deploy).labels) === JSON.stringify([idOf('Work')]));
  await page.fill('#label-find', 'Brand new');
  const createText = await page.locator('#panel-create').innerText();
  check('a name with no exact match offers Create label "name"', createText.trim() === 'Create label "Brand new"', createText);
  await page.fill('#label-find', 'work');
  check('an exact match, ignoring case, offers no create row', (await page.locator('#panel-create').count()) === 0);
  await page.fill('#label-find', 'Brand new');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved' && [...document.querySelectorAll('#note-strip .chip')].some((e) => e.textContent === 'Brand new'));
  check('Enter creates the label and ticks it', labelNames().includes('Brand new') && stored(ids.deploy).labels.includes(idOf('Brand new')));
  await page.keyboard.press('Escape');
  check('Escape closes the panel and focus returns to Labels', await page.locator('#labels-panel').isHidden() && (await page.evaluate(() => document.activeElement.id)) === 'labels-button');
  await page.click('#labels-button'); await page.click('#panel-done');
  check('Done closes it', await page.locator('#labels-panel').isHidden());

  // Archive from the edit view.
  await page.click('#archive');
  await page.waitForFunction(() => !document.getElementById('flash').hidden && !document.getElementById('list').hidden);
  check('Archive in the edit view goes to the list the note left, with the message', (await heading()) === 'Notes' && (await page.locator('#flash-text').innerText()) === 'Note archived.' && stored(ids.deploy).archived === true);
  await page.click('#menu a[data-key="archive"]'); await waitList('Archive');
  await page.locator('#notes li', { hasText: 'Deploy runbook' }).locator('.note-link').click();
  await page.waitForSelector('#edit:not([hidden])');
  await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  check('an archived note opens with the Archived marker and an Unarchive button', (await page.locator('#note-strip .archived-marker').count()) === 1 && (await page.locator('#archive').innerText()).trim() === 'Unarchive');
  await page.fill('#text', 'Deploy runbook\nedited while archived\n');
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved');
  check('saving does not unarchive', stored(ids.deploy).archived === true && Buffer.from(notes.get(ids.deploy).bytes).toString().includes('edited while archived'));
  await page.click('#archive');
  await page.waitForFunction(() => document.getElementById('flash-text').textContent === 'Note unarchived.');
  check('Unarchive from the edit view returns to the Archive list', (await heading()) === 'Archive' && stored(ids.deploy).archived === false);

  // New note from a label view starts with that label.
  await page.click('#menu a[data-key="label:' + L.Work + '"]'); await waitList('Work');
  await page.click('#new-note');
  await page.waitForSelector('#edit:not([hidden])');
  check('a new note from a label view starts with that label', (await page.locator('#note-strip .chip').allInnerTexts()).join() === 'Work' && (await page.locator('#archive').isDisabled()));
  await page.fill('#text', 'Made from the Work view\n');
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved' && location.hash.startsWith('#n/'));
  const newest = [...notes].find(([, n]) => Buffer.from(n.bytes).toString().startsWith('Made from the Work view'));
  check('and it is saved with that label', newest && newest[1].meta.labels.join() === L.Work);

  // Edit labels screen.
  await page.click('#menu a[data-key="labels"]');
  await page.waitForSelector('#labels:not([hidden])');
  check('Edit labels is the active item and has the New label field and a disabled Create', JSON.stringify(await active()) === '["labels"]' && await page.locator('#create-label').isDisabled() && (await page.locator('label[for="new-label"]').innerText()) === 'New label');
  await page.fill('#new-label', 'Zed');
  check('Create enables once there is text', await page.locator('#create-label').isEnabled());
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#label-list .label-name')].some((e) => e.textContent === 'Zed'));
  check('Enter creates a label', labelNames().includes('Zed'));
  await page.fill('#new-label', 'WORK');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#label-error:not([hidden])');
  check('a clash shows the briefed sentence and creates nothing', (await page.locator('#label-error').innerText()) === 'There is already a label called WORK.' && labelNames().filter((n) => n.toLowerCase() === 'work').length === 1);
  await page.fill('#new-label', '');
  const rowLabels = await page.$$eval('#label-list .label-row', (els) => els.map((e) => [...e.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))));
  check('each label row has Rename label: and Delete label: buttons', rowLabels.every((r) => r.length === 2 && r[0].startsWith('Rename label: ') && r[1].startsWith('Delete label: ')) && rowLabels.length === labelNames().length);
  await page.locator('#label-list li', { hasText: 'Zed' }).locator('.label-rename').click();
  await page.waitForSelector('#label-list .renaming input');
  check('rename turns the row into a field with the name selected, plus Save and Cancel', (await page.evaluate(() => { const i = document.querySelector('#label-list .renaming input'); return i.selectionStart === 0 && i.selectionEnd === i.value.length && document.activeElement === i; })) && (await page.locator('#label-list .renaming button').allInnerTexts()).join() === 'Save,Cancel');
  await page.keyboard.press('Escape');
  check('Escape cancels the rename', (await page.locator('#label-list .renaming').count()) === 0 && labelNames().includes('Zed'));
  await page.locator('#label-list li', { hasText: 'Zed' }).locator('.label-rename').click();
  await page.fill('#label-list .renaming input', 'Zed two');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#label-list .label-name')].some((e) => e.textContent === 'Zed two'));
  check('Enter saves the rename, the id stays', labelNames().includes('Zed two') && !labelNames().includes('Zed'));
  await page.locator('#label-list li', { hasText: 'Zed two' }).locator('.label-rename').click();
  await page.fill('#label-list .renaming input', 'work');
  await page.keyboard.press('Enter');
  check('renaming onto another name, ignoring case, is refused in words', (await page.locator('#label-error').innerText()) === 'There is already a label called work.');
  await page.keyboard.press('Escape');

  for (const [name, expected] of [['Spare', 'Delete the label Spare? No notes carry it. The notes stay.']]) {
    await page.locator('#label-list li', { hasText: name }).locator('.label-delete').click();
    await page.waitForSelector('#label-list .confirm');
    await page.waitForFunction((t) => document.querySelector('#label-list .confirm p').textContent === t, expected);
    check(`delete confirmation for a label on no notes: "${expected}"`, true);
    await page.locator('#label-list .confirm >> text=Keep').click();
    check('Keep closes it and the label stays', labelNames().includes(name) && (await page.locator('#label-list .confirm').count()) === 0);
  }
  const solo = await addLabel('Solo');
  const soloNote = await addNote('Holds Solo\n', { labels: [solo] });
  await page.reload();
  await page.waitForSelector('#label-list .label-row');
  await page.locator('#label-list li', { hasText: 'Solo' }).locator('.label-delete').click();
  await page.waitForFunction(() => document.querySelector('#label-list .confirm p')?.textContent === 'Delete the label Solo? It is on 1 note. The notes stay.');
  check('delete confirmation for exactly one note says "It is on 1 note."', true);
  const redConfirm = await page.locator('#label-list .confirm-yes').evaluate((e) => [e.textContent, getComputedStyle(e).borderTopWidth]);
  check('the Delete label button is the red-bordered confirm style', redConfirm[0] === 'Delete label' && redConfirm[1] === '1px');
  const textBefore = Buffer.from(notes.get(soloNote).bytes).toString();
  await page.click('#label-list .confirm-yes');
  await page.waitForFunction(() => ![...document.querySelectorAll('#label-list .label-name')].some((e) => e.textContent === 'Solo'));
  check('deleting a label removes it from the list only, the note and its text stay', !labelNames().includes('Solo') && Buffer.from(notes.get(soloNote).bytes).toString() === textBefore && stored(soloNote).labels.join() === solo);
  const holdsTwo = store.state.labelsFile.labels.find((l) => [...notes.values()].filter((n) => n.meta.labels?.includes(l.id)).length === 2);
  if (holdsTwo) {
    await page.locator('#label-list li', { hasText: holdsTwo.name }).locator('.label-delete').click();
    await page.waitForFunction((n) => document.querySelector('#label-list .confirm p')?.textContent === `Delete the label ${n}? It is on 2 notes. The notes stay.`, holdsTwo.name);
    check('delete confirmation for several notes says "It is on N notes."', true);
    await page.locator('#label-list .confirm >> text=Keep').click();
  }

  // The label view of a deleted or unknown id shows Notes.
  await page.goto(`${BASE}/notes#l/${solo}`);
  await page.waitForSelector('#list:not([hidden])');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Notes');
  check('a deleted label id shows the Notes list', (await heading()) === 'Notes' && JSON.stringify(await active()) === '["notes"]');
  await page.goto(`${BASE}/notes#l/${'f'.repeat(32)}`);
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Notes' && !document.getElementById('list').hidden);
  check('an unknown label id shows the Notes list', (await heading()) === 'Notes');

  // Two devices changing labels at once.
  await page.click('#menu a[data-key="labels"]');
  await page.waitForSelector('#labels:not([hidden])');
  const otherDevice = await addLabel('Added elsewhere');
  await page.fill('#new-label', 'From this device');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#label-error:not([hidden])');
  check('two devices at once: the stale change is refused, in words, and nothing is lost', (await page.locator('#label-error').innerText()).startsWith('Labels were changed on another device') && labelNames().includes('Added elsewhere') && !labelNames().includes('From this device'));
  await page.waitForFunction(() => [...document.querySelectorAll('#label-list .label-name')].some((e) => e.textContent === 'Added elsewhere'));
  check('and the list shows the other device\'s label now', true);
  check('then the same change goes through', await (async () => { await page.keyboard.press('Enter'); await page.waitForFunction(() => [...document.querySelectorAll('#label-list .label-name')].some((e) => e.textContent === 'From this device')); return labelNames().includes('From this device'); })());
  void otherDevice;

  // Menu items choose a view and leave a search behind.
  await page.click('#menu a[data-key="notes"]');
  await waitList('Notes');
  await page.fill('#search', 'zephyrine');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Search results');
  await page.click('#menu a[data-key="notes"]');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Notes');
  check('choosing Notes while searching clears the search', (await page.inputValue('#search')) === '' && JSON.stringify(await active()) === '["notes"]');
  check('no page error in the wide run', errors.length === 0, errors.join(' | '));
  await context.close();
}

/* ---------- behaviour, phone ---------- */

{
  const L = await seedMain();
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const menuOpen = () => page.locator('#menu').evaluate((e) => getComputedStyle(e).display !== 'none');
  const focusId = () => page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('data-key') || document.activeElement.tagName);

  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  check('signed out at phone width: no menu button and no menu, the theme switch stays in the header', !(await page.locator('#menu-button').isVisible()) && !(await menuOpen()) && await page.locator('#theme-switch').isVisible());
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#notes .note-row');

  check('phone: the menu bar is hidden and the menu button shows', !(await menuOpen()) && await page.locator('#menu-button').isVisible());
  const header = await page.evaluate(() => [...document.querySelectorAll('.bar-inner > *')].map((el) => el.className));
  check('phone: header holds the menu button, stone mark, wordmark, then only New note', (await page.locator('.bar-inner').evaluate((el) => { const kids = [...el.querySelectorAll('button, img, .wordmark')].filter((e) => e.offsetParent !== null).map((e) => e.id || e.className || e.tagName); return JSON.stringify(kids); })) === JSON.stringify(['menu-button', 'mark', 'wordmark', 'new-note']), JSON.stringify(header));
  const nb = await page.locator('#new-note').boundingBox();
  check('phone: New note is a 44px icon button with an accessible name', Math.round(nb.width) === 44 && Math.round(nb.height) === 44 && (await page.getAttribute('#new-note', 'aria-label')) === 'New note' && !(await page.locator('#new-note .btn-label').isVisible()));
  check('phone: Sign out and the theme switch have left the header', !(await page.locator('#sign-out').isVisible()) && !(await page.locator('#theme-switch').isVisible()));
  check('phone: no sideways scroll on the list', await noSideways());
  const trip = page.locator('#notes li', { hasText: 'Trip plan' });
  check('phone: a note with 5 labels shows 2 chips and +3', (await trip.locator('.chips .chip:visible').allInnerTexts()).join() === 'Home,Ideas,+3');
  const oneLine = await trip.locator('.chips').evaluate((el) => { const tops = [...el.children].filter((c) => c.offsetParent !== null).map((c) => c.getBoundingClientRect().top); return new Set(tops).size === 1 && el.scrollWidth <= el.clientWidth; });
  check('phone: the chip line never wraps or overflows the row', oneLine);
  const longRow = await page.evaluate(() => { const r = [...document.querySelectorAll('#notes .note-row')].find((e) => e.textContent.includes('Trip plan')); const a = r.querySelector('.row-actions').getBoundingClientRect(); const row = r.getBoundingClientRect(); return a.right <= row.right + 0.5; });
  check('phone: the row buttons stay on the right inside the row', longRow);

  await page.click('#menu-button');
  await page.waitForSelector('#menu[data-open="true"]');
  const mb = await page.locator('#menu').boundingBox();
  check('phone: the open menu is 280px wide at most 85vw, below the header, from the left edge', Math.round(mb.x) === 0 && Math.round(mb.width) === Math.min(280, Math.floor(320 * 0.85)) && Math.round(mb.y) === 65, JSON.stringify(mb));
  check('phone: aria-expanded and the button name follow', (await page.getAttribute('#menu-button', 'aria-expanded')) === 'true' && (await page.getAttribute('#menu-button', 'aria-label')) === 'Close menu' && (await page.getAttribute('#menu-button', 'aria-controls')) === 'menu');
  check('phone: focus moves to the active item and the content is inert', (await focusId()) === 'notes' && (await page.locator('main').evaluate((e) => e.inert)));
  check('phone: the scrim covers the rest and uses the scrim colour', (await page.locator('#scrim').evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgba(26, 25, 24, 0.4)');
  const foot = await page.$$eval('.menu-foot .menu-item', (els) => els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')));
  check('phone: below a rule the menu has the theme row and Sign out', JSON.stringify(foot) === JSON.stringify(['Dark mode', 'Sign out']), JSON.stringify(foot));
  check('phone: the open menu has no sideways scroll', await noSideways());
  await page.keyboard.press('Escape');
  check('phone: Escape closes it and focus returns to the menu button', !(await menuOpen()) && (await focusId()) === 'menu-button' && (await page.getAttribute('#menu-button', 'aria-expanded')) === 'false' && (await page.getAttribute('#menu-button', 'aria-label')) === 'Open menu');
  await page.click('#menu-button');
  await page.mouse.click(310, 400);
  check('phone: tapping the scrim closes it', !(await menuOpen()) && !(await page.locator('main').evaluate((e) => e.inert)));
  await page.click('#menu-button');
  await page.click('#menu a[data-key="label:' + L.Work + '"]');
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Work');
  check('phone: choosing an item goes there and closes the menu', !(await menuOpen()));
  await page.click('#menu-button');
  check('phone: the chosen item is the focus and the active one', (await focusId()) === 'label:' + L.Work);
  await page.click('#menu-theme');
  check('phone: the theme row switches to dark, closes the menu and keeps the choice', (await page.getAttribute('html', 'data-theme')) === 'dark' && (await page.evaluate(() => localStorage.getItem('silurian-notes-theme'))) === 'dark' && !(await menuOpen()));
  await page.click('#menu-button');
  const row = (await page.$$eval('.menu-foot .menu-item', (els) => els.map((e) => e.innerText.trim())))[0];
  check('phone: the theme row now offers Light mode', row === 'Light mode', row);
  await page.click('#menu-theme');
  await page.click('#menu-button');
  await page.setViewportSize({ width: 900, height: 700 });
  await sleep(150);
  check('phone: widening past 760px closes the open menu, and the menu bar shows', !(await page.locator('#scrim').isVisible()) && !(await page.locator('main').evaluate((e) => e.inert)) && (await page.locator('#menu').boundingBox()).width === 240);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('#menu-button');
  await page.locator('#menu a[data-key="notes"]').click();
  await page.waitForFunction(() => document.getElementById('list-heading').textContent === 'Notes');
  await page.locator('#notes li', { hasText: 'Deploy runbook' }).locator('.note-link').click();
  await page.waitForSelector('#edit:not([hidden])');
  check('phone: opening a note leaves the menu closed', !(await menuOpen()));
  check('phone: the edit view wraps without sideways scroll', await noSideways());
  await page.click('#menu-button');
  await page.click('#menu-sign-out');
  await page.waitForSelector('#login:not([hidden])');
  check('phone: Sign out in the menu signs out, hides the menu and shows the theme switch in the header', !(await page.locator('#menu-button').isVisible()) && await page.locator('#theme-switch').isVisible() && !(await menuOpen()) && (await page.getAttribute('html', 'data-theme')) === 'light');
  check('no page error in the phone run', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
