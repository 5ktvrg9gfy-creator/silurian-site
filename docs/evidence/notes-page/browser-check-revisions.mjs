// Local browser run of notes save safety: two devices, an older copy coming back
// from storage, and what the page does with it. Run from the repository root:
//   node docs/evidence/notes-page/browser-check-revisions.mjs
// The real page and the real API over the real Blob adapter, on the stand-in that
// serves an overwritten file as it was for 60 seconds, in Chromium through
// Playwright. Two browser contexts are two devices. Each request goes to a function
// that remembers nothing. While a device is "behind", the server answers its reads
// with the first answer it gave for that address, as a store that shows an older
// file would. It proves the page's own code and the adapter. It does not touch Vercel.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { createBlobStore } from '../../../api/_lib/store.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { staleSdk } from '../../../notes-tests/stale-sdk.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const password = 'pw-' + randomBytes(12).toString('hex');
const clock = { get now() { return Date.now(); } };
const sdk = staleSdk({ clock, lagMs: 60000, listLagMs: 0 });
const env = { [ENVIRONMENT_VARIABLE]: password };
const fresh = () => createNotesApi({ store: createBlobStore(sdk, { now: () => Date.now() }), env });
const routes = { '/api/login': 'login', '/api/session': 'session', '/api/notes': 'collection', '/api/labels': 'labels', '/api/note': 'item' };
const behind = { B: false, C: false };   // a device that is behind is answered from what it was told before
const frozen = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8769');
  const name = routes[url.pathname];
  if (name) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const api = fresh();
    const route = name === 'login' ? { POST: api.login } : name === 'session' ? { GET: api.session, DELETE: api.signOut } : api[name];
    const handler = route[req.method];
    const device = req.headers['x-device'];
    const key = device + ' ' + req.method + ' ' + req.url;
    let status; let headers; let payload;
    const older = req.method === 'GET' && /^\/api\/notes?[?]?/.test(req.url);   // lists and notes, not the session or the labels
    if (older && behind[device] && frozen.has(key)) {
      ({ status, headers, payload } = frozen.get(key));
    } else {
      const quiet = console.error; console.error = () => {};
      let response;
      try {
        response = handler
          ? await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : body }))
          : new Response('', { status: 405 });
      } finally { console.error = quiet; }
      status = response.status; headers = Object.fromEntries(response.headers); payload = Buffer.from(await response.arrayBuffer());
      if (older && !behind[device] && status === 200) frozen.set(key, { status, headers, payload });
    }
    res.writeHead(status, headers);
    res.end(payload);
    return;
  }
  const path = url.pathname === '/notes' ? 'notes/index.html' : url.pathname.slice(1);
  const file = ROOT + path;
  if (!existsSync(file) || path.startsWith('..')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8769, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8769';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function device(label) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, extraHTTPHeaders: { 'x-device': label } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#list:not([hidden])');
  return { page, context, errors };
}
const rows = (d) => d.page.locator('#notes > li');
const titles = (d) => d.page.locator('#notes .note-title').allInnerTexts();
const saved = (d) => d.page.waitForFunction(() => document.getElementById('status').textContent === 'Saved', null, { timeout: 8000 });
async function create(d, text) {
  await d.page.click('#new-note');
  await d.page.waitForSelector('#edit:not([hidden])');
  await d.page.fill('#text', text);
  await d.page.waitForFunction(() => document.getElementById('status').textContent === 'Saved' && location.hash.startsWith('#n/'), null, { timeout: 8000 });
  await d.page.click('#back');
  await d.page.waitForSelector('#list:not([hidden])');
}
async function open(d, title) {
  await d.page.locator('#notes .note-link', { hasText: title }).click();
  await d.page.waitForSelector('#edit:not([hidden])');
  await d.page.waitForFunction((t) => document.getElementById('text').value.startsWith(t), title);
}
const storedText = async () => {
  const v = await fresh().item.GET(new Request(BASE + '/api/note?id=' + ID, { headers: { cookie: await cookieOf() } }));
  return v.text();
};
let ID = null;
let cookieA = null;
const cookieOf = async () => cookieA;

const A = await device('A');
cookieA = (await A.context.cookies()).map((c) => c.name + '=' + c.value).join('; ');
await create(A, 'Alpha v1');
ID = await A.page.evaluate(() => null) || (await (await fresh().collection.GET(new Request(BASE + '/api/notes', { headers: { cookie: cookieA } }))).json()).notes[0].id;
const B = await device('B');
check('device B sees the note device A made', (await titles(B)).includes('Alpha v1'), JSON.stringify(await titles(B)));
await open(B, 'Alpha v1');

// Device A edits. Device B's answers now come from before that.
await open(A, 'Alpha v1');
await A.page.fill('#text', 'Alpha v2 from A');
await saved(A);
check('device A saved a newer version', (await storedText()) === 'Alpha v2 from A');
behind.B = true;

// Device B, which holds the first version and is shown the first version again when it asks, edits it.
await B.page.fill('#text', 'Alpha v2 from B, written over A');
await sleep(2500);
const message = await B.page.locator('#detail').textContent();
check('device B is refused: the note changed on another device, with its text kept on screen', (await B.page.locator('#status').textContent()) === 'Not saved' && /changed on another device/.test(message) && (await B.page.inputValue('#text')) === 'Alpha v2 from B, written over A', message);
check('and device A\'s version is what is stored', (await storedText()) === 'Alpha v2 from A', await storedText());
check('no file of a note was overwritten by any of it', sdk.calls.filter((c) => c.op === 'put' && c.options.allowOverwrite === true).every((c) => c.pathname === 'notes-index.json'));

// A third device is shown an older list every time it asks. Nothing it has done goes missing or reverts.
const C = await device('C');
const first = await titles(C);
check('device C starts with the list as it is', first.includes('Alpha v2 from A') && first.length === 1, JSON.stringify(first));
behind.C = true;
await create(C, 'Bravo made on C');
await sleep(1500);
const afterCreate = await titles(C);
check('device C made a note, and the older list it is then shown does not take it away', afterCreate.includes('Bravo made on C') && afterCreate.includes('Alpha v2 from A'), JSON.stringify(afterCreate));
await open(C, 'Bravo made on C');
await C.page.fill('#text', 'Bravo v2 on C');
await saved(C);
await C.page.click('#back');
await C.page.waitForSelector('#list:not([hidden])');
await sleep(1500);
const afterEdit = await titles(C);
check('device C edited it, and the older list does not put the old title back', afterEdit.includes('Bravo v2 on C') && !afterEdit.includes('Bravo made on C'), JSON.stringify(afterEdit));
const alphaRow = rows(C).filter({ hasText: 'Alpha v2 from A' });
await alphaRow.locator('.row-delete').click();
await alphaRow.getByRole('button', { name: 'Delete note', exact: true }).click();
await C.page.waitForFunction(() => ![...document.querySelectorAll('#notes .note-title')].some((e) => e.textContent.startsWith('Alpha')));
await create(C, 'Charlie made on C');
await sleep(1500);
const afterDelete = await titles(C);
check('device C deleted a note, and the older list, which still has it, does not bring it back', !afterDelete.some((t) => t.startsWith('Alpha')) && afterDelete.includes('Bravo v2 on C') && afterDelete.includes('Charlie made on C'), JSON.stringify(afterDelete));
behind.C = false;
await C.page.reload();
await C.page.waitForSelector('#list:not([hidden])');
await sleep(800);
const settled = await titles(C);
check('and when the store has caught up, the list is the same', JSON.stringify([...settled].sort()) === JSON.stringify(['Bravo v2 on C', 'Charlie made on C']), JSON.stringify(settled));
check('device A (which deleted nothing and held Alpha) learns it is gone when it next asks', await (async () => {
  await A.page.click('#back').catch(() => {});
  await A.page.waitForSelector('#list:not([hidden])');
  await A.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await A.page.reload();
  await A.page.waitForSelector('#list:not([hidden])');
  await sleep(800);
  const list = await titles(A);
  return !list.some((t) => t.startsWith('Alpha')) && list.includes('Bravo v2 on C');
})());
check('no device threw anything', [A, B, C].every((d) => d.errors.length === 0), [A, B, C].map((d) => d.errors.join('|')).join(' / '));

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
