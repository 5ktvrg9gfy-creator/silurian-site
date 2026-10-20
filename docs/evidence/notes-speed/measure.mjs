// Speed measurement for the notes page. Run from the repository root:
//   node docs/evidence/notes-speed/measure.mjs [label]
// The real page, the real API handlers and the real Blob adapter (store.js),
// over a counting stand-in for the Blob package, in Chromium through Playwright.
// For each user action it prints how many API requests the page made, how many
// Blob calls those requests made, and how long the screen took to show the
// result. BLOB_MS is a delay put on every Blob call and NET_MS a delay put on
// every API request, to stand in for distance to the store and to the function.
// The numbers are relative: they show what an action costs, not what Vercel
// answers in.
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { createBlobStore } from '../../../api/_lib/store.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const LABEL = process.argv[2] || 'run';
const BLOB_MS = Number(process.env.BLOB_MS ?? 40);
const NET_MS = Number(process.env.NET_MS ?? 60);
const NOTE_COUNT = Number(process.env.NOTE_COUNT ?? 40);
const PORT = 8771;
const BASE = `http://127.0.0.1:${PORT}`;
const password = 'pw-' + randomBytes(12).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- a counting stand-in for @vercel/blob ---------- */

class BlobNotFoundError extends Error {}
const blobs = new Map();
let etags = 0; // the real store gives a blob a new etag on every write
const counts = { get: 0, head: 0, put: 0, del: 0, list: 0 };
// Each request has its own counter, so requests that run side by side are not
// counted against each other.
const current = new AsyncLocalStorage();
const bump = async (kind) => { counts[kind] += 1; const mine = current.getStore(); if (mine) mine[kind] += 1; if (BLOB_MS) await sleep(BLOB_MS); };
const sdk = {
  BlobNotFoundError,
  async get(path) {
    await bump('get');
    const b = blobs.get(path);
    if (!b) throw new BlobNotFoundError('missing');
    return { statusCode: 200, stream: new Response(b.bytes).body, blob: { uploadedAt: b.uploadedAt } };
  },
  async head(path) {
    await bump('head');
    const b = blobs.get(path);
    if (!b) throw new BlobNotFoundError('missing');
    return { uploadedAt: b.uploadedAt };
  },
  async put(path, body) {
    await bump('put');
    const bytes = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
    blobs.set(path, { bytes, uploadedAt: new Date(), etag: `etag-${++etags}` });
  },
  async del(path) {
    await bump('del');
    blobs.delete(path);
  },
  async list({ prefix }) {
    await bump('list');
    return { blobs: [...blobs].filter(([p]) => p.startsWith(prefix)).map(([pathname, b]) => ({ pathname, uploadedAt: b.uploadedAt, etag: b.etag })), hasMore: false };
  },
};

const api = createNotesApi({ store: createBlobStore(sdk), env: { [ENVIRONMENT_VARIABLE]: password } });
const routes = {
  '/api/login': { POST: api.login },
  '/api/session': { GET: api.session, DELETE: api.signOut },
  '/api/notes': api.collection,
  '/api/labels': api.labels,
  '/api/note': api.item,
};

// Every API request the page makes, with the Blob calls it cost.
let log = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const route = routes[url.pathname];
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const mine = { get: 0, head: 0, put: 0, del: 0, list: 0 };
    if (NET_MS) await sleep(NET_MS);
    const handler = route[req.method];
    const quiet = console.error; console.error = () => {};
    let response;
    try {
      response = handler
        ? await current.run(mine, () => handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : body })))
        : new Response('', { status: 405 });
    } finally { console.error = quiet; }
    const blobCalls = Object.values(mine).reduce((a, b) => a + b, 0);
    log.push({ what: `${req.method} ${url.pathname}${url.search}`.replace(/[0-9a-f]{32}/g, '<id>'), blobCalls, status: response.status });
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
  const types = { '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---------- seeding straight through the API, free of delay ---------- */

let cookie = '';
async function http(method, path, { body, headers = {} } = {}) {
  const response = await fetch(BASE + path, { method, headers: { cookie, ...headers }, body });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text };
}
async function seed() {
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const names = ['Work', 'Home', 'Ideas', 'Travel', 'Recipes', 'Spare'];
  const label = {};
  for (const name of names) {
    const now = await http('GET', '/api/labels');
    const made = await http('POST', '/api/labels', { body: JSON.stringify({ name }), headers: { 'x-base-labels': now.json.updatedAt, 'content-type': 'application/json' } });
    label[name] = made.json.id;
  }
  const ids = [];
  for (let i = 0; i < NOTE_COUNT; i += 1) {
    const text = `Note ${i}\n${'a line of ordinary text for note ' + i + '\n'.repeat(1)}`.repeat(3);
    const made = await http('POST', '/api/notes', { body: text, headers: { 'content-type': 'text/plain' } });
    await sleep(3);
    const mine = [names[i % 6]];
    if (i % 3 === 0) mine.push(names[(i + 1) % 6]);
    const patched = await http('PATCH', '/api/note?id=' + made.json.id, { body: JSON.stringify({ labels: mine.map((n) => label[n]), archived: i % 10 === 9 }), headers: { 'x-base-updated': made.json.updatedAt, 'content-type': 'application/json' } });
    if (patched.status !== 200) throw new Error('seed ' + patched.status);
    ids.push(made.json.id);
    await sleep(3);
  }
  return { label, ids };
}

/* ---------- the actions ---------- */

const results = [];
async function act(page, name, doIt, until, arg) {
  await sleep(300);
  log = [];
  const start = Date.now();
  await doIt();
  await page.waitForFunction(until, arg, { timeout: 15000 });
  const shown = Date.now() - start;
  await sleep(900); // let background requests finish so they are counted
  const requests = log.length;
  const blobCalls = log.reduce((a, r) => a + r.blobCalls, 0);
  results.push({ name, requests, blobCalls, shownMs: shown, detail: log.map((r) => `${r.what} (${r.blobCalls})`).join('; ') });
  console.log(`${name.padEnd(34)} requests ${String(requests).padStart(2)}   blob calls ${String(blobCalls).padStart(4)}   screen ${String(shown).padStart(5)} ms`);
}

const { label, ids } = await seed();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const { COOKIE_NAME } = await import('../../../api/_lib/gate.js');
await context.addCookies([{ name: COOKIE_NAME, value: cookie.slice(COOKIE_NAME.length + 1), url: BASE }]);
const page = await context.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
// Predicates run inside the page, so the helpers are installed there.
await page.addInitScript(() => {
  window.listShown = () => !document.getElementById('list').hidden && document.querySelectorAll('#notes .note-row').length > 0;
  window.headingIs = (h) => document.getElementById('list-heading').textContent === h && window.listShown();
});
const listShown = () => window.listShown();
const headingIs = (h) => window.headingIs(h);

await act(page, 'open list (first load)', () => page.goto(BASE + '/notes'), listShown);
await act(page, 'open note from list', () => page.locator('#notes .note-link').nth(1).click(), () => !document.getElementById('edit').hidden && document.getElementById('text').value.length > 0);
await act(page, 'back to list', () => page.click('#back'), listShown);
await act(page, 'open a second note', () => page.locator('#notes .note-link').nth(2).click(), () => !document.getElementById('edit').hidden && document.getElementById('text').value.length > 0);
await page.click('#back');
await page.waitForFunction(() => window.listShown());
await sleep(1200);
await act(page, 'open the same note again', () => page.locator('#notes .note-link').nth(2).click(), () => !document.getElementById('edit').hidden && document.getElementById('text').value.length > 0);
await page.click('#labels-button');
await page.waitForSelector('#labels-panel:not([hidden])');
const chips = await page.locator('#note-strip .chip').count();
await act(page, 'tick a label (chip on screen)', () => page.locator('#panel-list input[type=checkbox]:not(:checked)').first().check(), (n) => document.querySelectorAll('#note-strip .chip').length > n, chips);
await act(page, 'untick the label (chip gone)', () => page.locator('#panel-list input[type=checkbox]:checked').first().uncheck(), (n) => document.querySelectorAll('#note-strip .chip').length === n, chips);
await sleep(300);
await page.click('#panel-done');
await act(page, 'archive from the open note', () => page.click('#archive'), () => !document.getElementById('list').hidden && !document.getElementById('flash').hidden);
await act(page, 'archive from a list row', () => page.locator('#notes .row-actions button[aria-label^="Archive note"]').first().click(), () => !document.getElementById('flash').hidden && document.getElementById('flash-text').textContent === 'Note archived.' && !document.getElementById('flash-undo').disabled);
await act(page, 'switch view: a label', () => page.click(`#menu a[data-key="label:${label.Work}"]`), headingIs, 'Work');
await act(page, 'switch view: Archive', () => page.click('#menu a[data-key="archive"]'), headingIs, 'Archive');
await act(page, 'switch view: Notes', () => page.click('#menu a[data-key="notes"]'), headingIs, 'Notes');
await act(page, 'search (one word, typed)', () => page.fill('#search', 'Note 17'), () => document.getElementById('list-heading').textContent === 'Search results' && document.querySelectorAll('#notes .note-row').length > 0);
await page.close().catch(() => {});

const out = { label: LABEL, BLOB_MS, NET_MS, NOTE_COUNT, results };
mkdirSync(ROOT + 'docs/evidence/notes-speed', { recursive: true });
writeFileSync(ROOT + `docs/evidence/notes-speed/measure-${LABEL}.json`, JSON.stringify(out, null, 2));
await browser.close();
server.close();
console.log(errors.length ? 'PAGE ERRORS ' + errors.join('|') : 'no page errors');
