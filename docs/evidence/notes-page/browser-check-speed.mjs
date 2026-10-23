// Local browser run for the notes speed work. Run from the repository root:
//   node docs/evidence/notes-page/browser-check-speed.mjs
// The real page and the real API handlers over an in-memory store and a
// password made for the run, in Chromium through Playwright. The server is made
// slow on purpose (a second or more per answer) so that anything the page shows
// sooner than that can only have come from what it already held, and the store
// can be made to refuse writes so that a background save fails. Prints one PASS
// or FAIL line per check.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { memoryStore } from '../../../notes-tests/helpers.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const PORT = 8772;
const BASE = `http://127.0.0.1:${PORT}`;
const password = 'pw-' + randomBytes(12).toString('hex');
const MARKER = 'MARKER' + randomBytes(8).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- the server: real handlers, in-memory store, controls ---------- */

// The shared in-memory store, which keeps the same promises as the Blob adapter.
const store = memoryStore();
const notes = store.notes;
const control = { delay: {}, failMetaWrites: false };
const requests = [];
{
  const real = store.writeMeta;
  store.writeMeta = async (...args) => { if (control.failMetaWrites) throw new Error('refused'); return real(...args); };
}
const api = createNotesApi({ store, env: { [ENVIRONMENT_VARIABLE]: password } });
const routes = {
  '/api/login': { POST: api.login },
  '/api/session': { GET: api.session, DELETE: api.signOut },
  '/api/notes': api.collection,
  '/api/labels': api.labels,
  '/api/note': api.item,
};
const types = { '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const route = routes[url.pathname];
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const key = `${req.method} ${url.pathname}`;
    requests.push(key + url.search.replace(/[0-9a-f]{32}/g, '<id>'));
    const wait = control.delay[key] || 0;
    if (wait) await sleep(wait);
    const handler = route[req.method];
    const quiet = console.error; console.error = () => {};
    let response;
    try {
      response = handler
        ? await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : body }))
        : new Response('', { status: 405 });
    } finally { console.error = quiet; }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  if (url.pathname === '/notes') {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end(readFileSync(ROOT + 'notes/index.html'));
    return;
  }
  const file = ROOT + url.pathname.slice(1);
  if (!existsSync(file) || url.pathname.includes('..')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };

/* ---------- seeding through the real API ---------- */

let cookie = '';
async function http(method, path, { body, headers = {} } = {}) {
  const response = await fetch(BASE + path, { method, headers: { cookie, ...headers }, body });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, headers: response.headers, text };
}
async function seedLogin() {
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
}
async function addLabel(name) {
  const now = await http('GET', '/api/labels');
  if (now.status !== 200) throw new Error('seeding is not signed in');
  const made = await http('POST', '/api/labels', { body: JSON.stringify({ name }), headers: { 'x-base-labels': now.json.updatedAt, 'content-type': 'application/json' } });
  return made.json.id;
}
async function addNote(text, { labels = [], archived = false } = {}) {
  const made = await http('POST', '/api/notes', { body: text, headers: { 'content-type': 'text/plain' } });
  await sleep(12);
  if (labels.length || archived) {
    await http('PATCH', '/api/note?id=' + made.json.id, { body: JSON.stringify({ labels, archived }), headers: { 'x-base-updated': made.json.updatedAt, 'content-type': 'application/json' } });
  }
  await sleep(12);
  return made.json.id;
}
// Another device edits a note: a text save from the version it has.
async function editElsewhere(id, text) {
  const now = await http('GET', '/api/note?id=' + id);
  const saved = await http('PUT', '/api/note?id=' + id, { body: text, headers: { 'x-base-updated': now.headers.get('x-note-updated') } });
  if (saved.status !== 200) throw new Error('edit elsewhere ' + saved.status);
  await sleep(12);
}
let L = {}; let ids = {};
async function seed() {
  if (!cookie) await seedLogin();
  notes.clear(); store.state.labelsFile = null;
  control.delay = {}; control.failMetaWrites = false;
  L = { Work: await addLabel('Work'), Home: await addLabel('Home'), Ideas: await addLabel('Ideas') };
  ids = {
    alpha: await addNote(`Alpha\nthe first note ${MARKER}\n`, { labels: [L.Work] }),
    bravo: await addNote('Bravo\nthe second note\n', { labels: [L.Home] }),
    charlie: await addNote('Charlie\nthe third note\n'),
    delta: await addNote('Delta\nan archived note\n', { labels: [L.Work], archived: true }),
  };
}
const serverNote = (id) => notes.get(id).meta;

/* ---------- page helpers ---------- */

const browser = await chromium.launch();
async function signedInPage(width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 860 } });
  const page = await context.newPage();
  page.errors = []; page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(BASE + '/notes');
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForFunction(() => !document.getElementById('list').hidden && document.querySelectorAll('#notes .note-row').length > 0);
  return { page, context };
}
// Milliseconds until the page satisfies fn, or null if it takes longer than limit.
async function within(page, fn, arg, limit = 4000) {
  const start = Date.now();
  try { await page.waitForFunction(fn, arg, { timeout: limit, polling: 'raf' }); } catch { return null; }
  return Date.now() - start;
}
const titles = (page) => page.$$eval('#notes .note-title', (els) => els.map((e) => e.textContent));
const headingIs = (h) => document.getElementById('list-heading').textContent === h && !document.getElementById('list').hidden;
async function chooseView(page, phone, key) {
  if (phone) { await page.click('#menu-button'); await page.waitForSelector('#menu[data-open="true"]'); }
  await page.click(`#menu a[data-key="${key}"]`);
}
const count = (pattern) => requests.filter((r) => pattern.test(r)).length;
const FAST = 350; // what the screen must beat while the server takes a second or more

for (const phone of [false, true]) {
  const tag = phone ? 'phone' : 'computer';
  await seed();
  const { page, context } = await signedInPage(phone ? 390 : 1280);

  /* ---- switching views shows at once and asks the server again ---- */
  // Chromium holds a second request for the same address behind a slow first one,
  // so the delay is short and the wait below covers all three.
  control.delay['GET /api/notes'] = 800;
  requests.length = 0;
  await chooseView(page, phone, 'archive');
  let ms = await within(page, () => document.getElementById('list-heading').textContent === 'Archive' && [...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Delta'), null, 2000);
  check(`${tag}: switching to Archive shows its notes while the server is still answering`, ms !== null && ms < FAST, `${ms} ms`);
  await chooseView(page, phone, 'notes');
  ms = await within(page, () => document.getElementById('list-heading').textContent === 'Notes' && document.querySelectorAll('#notes .note-title').length === 3, null, 2000);
  check(`${tag}: switching back to Notes shows its notes at once, archived left out`, ms !== null && ms < FAST, `${ms} ms; ${JSON.stringify(await titles(page))}`);
  await chooseView(page, phone, `label:${L.Work}`);
  ms = await within(page, (w) => document.getElementById('list-heading').textContent === w && document.querySelectorAll('#notes .note-title').length === 1, 'Work', 2000);
  check(`${tag}: a label view shows at once and holds only that label's unarchived notes`, ms !== null && ms < FAST && JSON.stringify(await titles(page)) === '["Alpha"]', `${ms} ms; ${JSON.stringify(await titles(page))}`);
  await sleep(3200);
  check(`${tag}: each switch still asked the server (quietly), one list request each`, count(/^GET \/api\/notes\?view=all$/) === 3, JSON.stringify(requests.filter((r) => r.includes('/api/notes'))));
  check(`${tag}: the label list was not asked for again after a switch the user made`, count(/GET \/api\/labels/) === 3, `${count(/GET \/api\/labels/)} label requests`);
  control.delay = {};

  /* ---- archive from a row: instant, then confirmed ---- */
  await chooseView(page, phone, 'notes');
  await page.waitForFunction(headingIs, 'Notes');
  await sleep(500); // the quiet refresh of that switch has been asked for by now
  control.delay['PATCH /api/note'] = 1200;
  requests.length = 0;
  const rowOf = (name) => page.locator('#notes li', { hasText: name });
  await rowOf('Alpha').locator('button[aria-label^="Archive note"]').click();
  ms = await within(page, () => ![...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Alpha') && !document.getElementById('flash').hidden && document.getElementById('flash-text').textContent === 'Note archived.', null, 2000);
  check(`${tag}: archiving from a row takes the row off and shows the message at once, before the server answers`, ms !== null && ms < FAST && serverNote(ids.alpha).archived !== true, `${ms} ms`);
  await sleep(1600);
  check(`${tag}: the server then holds the change, with one change request and one list refresh`, serverNote(ids.alpha).archived === true && count(/^PATCH \/api\/note/) === 1 && count(/^GET \/api\/notes\?view=all$/) === 1, JSON.stringify(requests));
  await chooseView(page, phone, 'archive');
  await page.waitForFunction(headingIs, 'Archive');
  check(`${tag}: and Archive lists it`, (await titles(page)).includes('Alpha'), JSON.stringify(await titles(page)));
  control.delay = {};

  /* ---- a refused change in the background puts the row back with the server's message ---- */
  await chooseView(page, phone, 'notes');
  await page.waitForFunction(headingIs, 'Notes');
  control.failMetaWrites = true;
  control.delay['PATCH /api/note'] = 700;
  await rowOf('Bravo').locator('button[aria-label^="Archive note"]').click();
  ms = await within(page, () => ![...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Bravo'), null, 2000);
  check(`${tag}: a change the server is about to refuse still takes the row off at once`, ms !== null && ms < FAST, `${ms} ms`);
  await page.waitForFunction(() => [...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Bravo'), null, { timeout: 4000 });
  const refusedText = await rowOf('Bravo').locator('.note-row-message').innerText();
  check(`${tag}: when refused, the row comes back with the server's message and the archived message is gone`, refusedText.includes('Nothing was changed') && (await page.locator('#flash').isHidden()), refusedText);
  check(`${tag}: and nothing changed on the server`, serverNote(ids.bravo).archived !== true);
  control.failMetaWrites = false; control.delay = {};

  /* ---- a change that conflicts does the same ---- */
  await editElsewhere(ids.charlie, 'Charlie\nchanged on another device\n');
  control.delay['PATCH /api/note'] = 500;
  await rowOf('Charlie').locator('button[aria-label^="Archive note"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('#notes .note-row-message')].some((e) => !e.hidden), null, { timeout: 4000 });
  const conflictText = await rowOf('Charlie').locator('.note-row-message').innerText();
  check(`${tag}: a change from a stale list is refused with the changed-elsewhere message and the row returns`, conflictText.startsWith('This note was changed on another device') && serverNote(ids.charlie).archived !== true, conflictText);
  control.delay = {};

  check(`${tag}: no script errors`, page.errors.length === 0, page.errors.join('|'));
  await context.close();
}

/* ---------- archive from the open note ---------- */
{
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Bravo' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Bravo'));
  control.delay['PATCH /api/note'] = 1200;
  await page.click('#archive');
  let ms = await within(page, () => !document.getElementById('list').hidden && !document.getElementById('flash').hidden && ![...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Bravo'), null, 2000);
  check('open note: archiving shows the list with the message at once, the note already out of Notes', ms !== null && ms < FAST && serverNote(ids.bravo).archived !== true, `${ms} ms`);
  await sleep(1500);
  check('open note: the server then holds the change', serverNote(ids.bravo).archived === true);

  // Opening it again before the change lands waits for the change.
  await seed();
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#notes .note-row').length > 0);
  await page.locator('#notes .note-link', { hasText: 'Bravo' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Bravo'));
  control.failMetaWrites = true; control.delay = { 'PATCH /api/note': 600 };
  await page.click('#archive');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  await page.waitForFunction(() => [...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent === 'Bravo') && document.getElementById('flash-text').textContent.includes('Nothing was changed'), null, { timeout: 4000 });
  check('open note: a refused archive puts the note back in Notes and shows the server\'s message', serverNote(ids.bravo).archived !== true && (await page.locator('#flash-undo').isHidden()), await page.locator('#flash-text').innerText());
  control.failMetaWrites = false; control.delay = {};

  // A conflict.
  await page.locator('#notes .note-link', { hasText: 'Charlie' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Charlie'));
  await editElsewhere(ids.charlie, 'Charlie\nchanged on another device\n');
  await page.click('#archive');
  await page.waitForFunction(() => document.getElementById('flash-text').textContent.startsWith('This note was changed on another device'), null, { timeout: 4000 });
  check('open note: an archive from a stale copy is refused, the note stays in Notes and the message shows', serverNote(ids.charlie).archived !== true && (await titles(page)).includes('Charlie'), await page.locator('#flash-text').innerText());

  // Unsaved text still saves first, as before.
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Alpha'));
  await page.fill('#text', 'Alpha\nretyped before archiving\n');
  await page.click('#archive');
  await page.waitForFunction(() => !document.getElementById('list').hidden && document.getElementById('flash-text').textContent === 'Note archived.', null, { timeout: 5000 });
  await sleep(300);
  check('open note: with unsaved text, the text is saved first and then the note is archived', new TextDecoder().decode(notes.get(ids.alpha).bytes).includes('retyped before archiving') && serverNote(ids.alpha).archived === true);
  await context.close();
}

/* ---------- ticking labels ---------- */
{
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Alpha'));
  await page.click('#labels-button');
  await page.waitForSelector('#labels-panel:not([hidden])');
  const chips = () => page.$$eval('#note-strip .chip', (els) => els.map((e) => e.textContent));
  const box = (name) => page.locator('#panel-list label', { hasText: name }).locator('input');

  control.delay['PATCH /api/note'] = 1000;
  requests.length = 0;
  await box('Home').check();
  let ms = await within(page, () => [...document.querySelectorAll('#note-strip .chip')].some((e) => e.textContent === 'Home'), null, 2000);
  check('labels: a tick shows its chip at once, before the server answers', ms !== null && ms < 200 && serverNote(ids.alpha).labels.length === 1, `${ms} ms`);
  await box('Ideas').check();
  await box('Work').uncheck();
  check('labels: further ticks while a save is on its way show at once too', JSON.stringify((await chips()).sort()) === '["Home","Ideas"]', JSON.stringify(await chips()));
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved', null, { timeout: 6000 });
  await sleep(300);
  check('labels: three quick ticks are sent as two saves, and the server ends with the final set', count(/^PATCH \/api\/note/) === 2 && JSON.stringify([...serverNote(ids.alpha).labels].sort()) === JSON.stringify([L.Home, L.Ideas].sort()), `${count(/^PATCH \/api\/note/)} saves; ${serverNote(ids.alpha).labels.length} labels`);
  control.delay = {};

  // Refused: the chips go back to what the server confirmed, with its message.
  control.failMetaWrites = true;
  await box('Work').check();
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'failed', null, { timeout: 4000 });
  const statusText = await page.locator('#detail').innerText();
  check('labels: a refused tick goes back to the confirmed labels and says why', JSON.stringify((await chips()).sort()) === '["Home","Ideas"]' && !(await box('Work').isChecked()) && statusText.includes('Nothing was changed'), statusText + ' ' + JSON.stringify(await chips()));
  control.failMetaWrites = false;

  // Conflict: the note moved on elsewhere.
  await editElsewhere(ids.alpha, 'Alpha\nchanged on another device\n');
  await box('Work').check();
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'failed' && document.getElementById('detail').textContent.includes('changed on another device'), null, { timeout: 4000 });
  check('labels: a tick from a stale copy goes back and shows the changed-elsewhere message', JSON.stringify((await chips()).sort()) === '["Home","Ideas"]' && !(await box('Work').isChecked()), await page.locator('#detail').innerText());
  check('labels: no script errors', page.errors.length === 0, page.errors.join('|'));
  await context.close();
}

/* ---------- opening a note again ---------- */
{
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Alpha'));
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  control.delay['GET /api/note'] = 1200;
  requests.length = 0;
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  let ms = await within(page, () => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Alpha'), null, 2000);
  check('reopen: a note opened before shows at once while the server is asked again', ms !== null && ms < FAST && count(/^GET \/api\/note\?id=/) === 1, `${ms} ms`);
  // Changed elsewhere, not touched here: the quiet answer replaces it.
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  await editElsewhere(ids.alpha, 'Alpha\nnew words from another device\n');
  control.delay['GET /api/note'] = 700;
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden);
  const first = await page.inputValue('#text');
  await page.waitForFunction(() => document.getElementById('text').value.includes('new words from another device'), null, { timeout: 4000 });
  check('reopen: a note changed elsewhere and not touched here updates when the server answers', first.includes(MARKER) && (await page.inputValue('#text')).includes('new words'), first.slice(0, 20));
  // Typing already under way is never replaced.
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  await editElsewhere(ids.alpha, 'Alpha\nyet another change elsewhere\n');
  control.delay['GET /api/note'] = 900;
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden);
  await page.fill('#text', 'Alpha\nmy own typing\n');
  await sleep(1300);
  check('reopen: text typed before the server answers stays, and the save is refused as changed elsewhere', (await page.inputValue('#text')).includes('my own typing'));
  await page.waitForFunction(() => document.getElementById('status').dataset.state === 'failed' && document.getElementById('detail').textContent.includes('changed on another device'), null, { timeout: 5000 });
  check('reopen: so no edit is lost and none overwrites the newer version', new TextDecoder().decode(notes.get(ids.alpha).bytes).includes('yet another change'), '');
  await context.close();
}

/* ---------- memory is gone after sign out, a 401 and leaving the page ---------- */
async function heapHas(page, needle) {
  const client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.enable');
  await client.send('HeapProfiler.collectGarbage');
  let found = false;
  let tail = '';
  client.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => {
    if ((tail + chunk).includes(needle)) found = true;
    tail = chunk.slice(-needle.length);
  });
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await client.detach();
  return found;
}
{
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Alpha'));
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  await chooseView(page, false, 'archive');
  await page.waitForFunction(headingIs, 'Archive');
  check('sign out: before signing out the page holds the note text in memory (the heap search can see it)', await heapHas(page, MARKER));
  await page.click('#sign-out');
  await page.waitForSelector('#login:not([hidden])');
  check('sign out: after signing out no copy of the note text is left in the page\'s memory', !(await heapHas(page, MARKER)));
  const body = await page.evaluate(() => document.body.innerText + document.getElementById('text').value);
  check('sign out: and none is on screen', !body.includes('Alpha') && !body.includes('Bravo') && !body.includes(MARKER));
  // Sign in again with a slow list: nothing may be drawn from before.
  control.delay['GET /api/notes'] = 1500;
  await page.fill('#password', password);
  await page.click('#login-submit');
  await sleep(700);
  const early = await page.evaluate(() => ({ listHidden: document.getElementById('list').hidden, rows: document.querySelectorAll('#notes .note-row').length, editHidden: document.getElementById('edit').hidden }));
  check('sign out: signing back in shows no list from before while the server is still answering', early.rows === 0, JSON.stringify(early));
  await page.waitForFunction(() => document.querySelectorAll('#notes .note-row').length > 0, null, { timeout: 5000 });
  control.delay = {};
  await context.close();
}
{
  // The session ends under the page (a 401): the next call goes to sign in and memory is dropped.
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden);
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  // Open another note, so Alpha's text is held only by the page's memory of
  // opened notes and not by the editor box (which a 401 leaves as it was).
  await page.locator('#notes .note-link', { hasText: 'Bravo' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden && document.getElementById('text').value.startsWith('Bravo'));
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  check('401: before the session ends the page holds the first note\'s text in memory', await heapHas(page, MARKER));
  await context.clearCookies();
  await chooseView(page, false, 'archive');
  // The cached Archive may flash for the moment before the answer; what matters is where it ends and that nothing is kept.
  await page.waitForSelector('#login:not([hidden])', { timeout: 5000 });
  check('401: the page ends on sign in, with no note on screen', await page.evaluate(() => document.querySelectorAll('#notes .note-row').length === 0 && document.getElementById('list').hidden && document.getElementById('edit').hidden));
  check('401: and no copy of the opened notes is left in the page\'s memory', !(await heapHas(page, MARKER)));
  control.delay['GET /api/notes'] = 1500;
  await page.fill('#password', password);
  await page.click('#login-submit');
  await sleep(700);
  check('401: signing back in draws nothing from before', await page.evaluate(() => document.querySelectorAll('#notes .note-row').length === 0));
  await context.close();
}
{
  // Leaving the page empties it, so a page kept by the browser shows nothing.
  await seed();
  const { page, context } = await signedInPage();
  await page.locator('#notes .note-link', { hasText: 'Alpha' }).click();
  await page.waitForFunction(() => !document.getElementById('edit').hidden);
  await page.click('#back');
  await page.waitForFunction(() => !document.getElementById('list').hidden);
  check('leaving: before leaving the page holds the note text', await heapHas(page, MARKER));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  check('leaving: after pagehide no copy of the note text is in memory', !(await heapHas(page, MARKER)));
  check('leaving: and nothing is on screen but the loading line', await page.evaluate(() => document.querySelectorAll('#notes .note-row').length === 0 && !document.body.innerText.includes('Alpha')));
  await context.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
