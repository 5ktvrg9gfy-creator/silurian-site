// Local browser run of notes version 2: sign out, delete from the list, search.
// Run from the repository root:
//   node docs/evidence/notes-page/browser-check-v2.mjs
// The same setup as browser-check.mjs: the real page and the real API handlers
// over a throwaway in-memory store and a password generated for this run,
// driven in Chromium through Playwright. It proves the page's own code. It does
// not touch Vercel or Blob.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const SHOTS = process.env.SHOTS_DIR || '/tmp/notes-shots-v2';
mkdirSync(SHOTS, { recursive: true });
const password = 'pw-' + randomBytes(12).toString('hex');

const notes = new Map();
let failRemove = false;
const store = {
  async list() { return [...notes].map(([id, n]) => ({ id, title: n.meta.title, updatedAt: n.meta.updatedAt })); },
  async read(id) { const n = notes.get(id); return n ? { bytes: n.bytes, updatedAt: n.meta.updatedAt } : null; },
  async stamp(id) { const n = notes.get(id); return n ? n.meta.updatedAt : null; },
  async write(id, bytes, meta) { notes.set(id, { bytes: new Uint8Array(bytes), meta }); },
  async remove(id) { if (failRemove) throw new Error('refused'); notes.delete(id); },
};
const api = createNotesApi({ store, env: { [ENVIRONMENT_VARIABLE]: password } });
const routes = {
  '/api/login': { POST: api.login },
  '/api/session': { GET: api.session, DELETE: api.signOut },
  '/api/notes': api.collection,
  '/api/note': api.item,
};
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const searchHeaders = [];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8767');
  const route = routes[url.pathname];
  if (route) {
    if (req.headers['x-note-search']) searchHeaders.push({ url: req.url, header: req.headers['x-note-search'] });
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
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const path = url.pathname === '/notes' ? 'notes/index.html' : url.pathname.slice(1);
  const file = ROOT + path;
  if (!existsSync(file) || path.startsWith('..')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8767, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8767';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await context.newPage();
const visible = (sel) => page.locator(sel).isVisible();
const rows = () => page.locator('#notes > li');
const pageText = () => page.evaluate(() => document.body.innerText + '\n' + document.getElementById('text').value);

async function signIn() {
  await page.waitForSelector('#login:not([hidden])');
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#list:not([hidden])');
}
async function newNote(text) {
  await page.click('#new-note');
  await page.waitForSelector('#edit:not([hidden])');
  await page.fill('#text', text);
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved' && location.hash.startsWith('#n/'), null, { timeout: 5000 });
  await page.click('#back');
  await page.waitForSelector('#list:not([hidden])');
}
async function typeSearch(value) {
  await page.fill('#search', value);
  await sleep(600);
}

await page.goto(BASE + '/notes');
await signIn();

// Fixtures through the page itself.
const deep = 'Deploy runbook\n' + 'lorem ipsum dolor sit amet\n'.repeat(1900) + '  ssh deploy@host && run zephyrine --force\nend';
await newNote(deep);
await newNote('Shopping\nmilk\neggs');
await newNote('Symbols\nrun `npm ci` first\n# heading line\nglob **/*.js here\narray[0] (group)');
check('three notes listed', (await rows().count()) === 3, String(await rows().count()));

// 3. Search
await typeSearch('ZEPHYRINE');
check('search: a word deep in a 50,000 character note, any case, finds it', (await rows().count()) === 1
  && (await page.locator('#notes .note-title').first().innerText()) === 'Deploy runbook'
  && (await page.locator('#notes .note-line').first().innerText()) === 'ssh deploy@host && run zephyrine --force');
check('search: the text goes in a header, never the address', searchHeaders.length > 0 && searchHeaders.every((s) => !/zephyrine/i.test(s.url)), JSON.stringify(searchHeaders.at(-1)));
await page.screenshot({ path: SHOTS + '/1-search-result.png' });
for (const [query, line] of [['`npm ci`', 'run `npm ci` first'], ['# heading', '# heading line'], ['**/*.js', 'glob **/*.js here'], ['array[0] (group)', 'array[0] (group)']]) {
  await typeSearch(query);
  const ok = (await rows().count()) === 1 && (await page.locator('#notes .note-line').first().innerText()) === line;
  check(`search: symbols are plain characters: ${query}`, ok);
}
await typeSearch('nothing-like-this');
check('search: no results says "No notes contain" and the text', (await rows().count()) === 0
  && (await page.locator('#empty').innerText()) === 'No notes contain nothing-like-this');
await page.screenshot({ path: SHOTS + '/2-no-results.png' });
await typeSearch('');
check('search: clearing the box restores the full list', (await rows().count()) === 3 && !(await visible('#empty'))
  && (await page.locator('#notes .note-line').count()) === 0);

// 2. Delete from the list
const shoppingRow = rows().filter({ hasText: 'Shopping' });
await shoppingRow.locator('.row-delete').click();
check('delete: the same confirmation step as the edit view', await shoppingRow.locator('.confirm').isVisible()
  && (await shoppingRow.locator('.confirm p').innerText()) === 'Delete this note? This cannot be undone.');
await page.screenshot({ path: SHOTS + '/3-row-confirm.png' });
await shoppingRow.getByRole('button', { name: 'Keep' }).click();
check('delete: Keep closes the confirmation and keeps the row', !(await shoppingRow.locator('.confirm').isVisible()) && (await rows().count()) === 3);

failRemove = true;
await shoppingRow.locator('.row-delete').click();
await shoppingRow.getByRole('button', { name: 'Delete note' }).click();
await page.waitForSelector('.note-row-message:not([hidden])');
check('delete failed: the row stays with a plain message', (await rows().count()) === 3
  && (await shoppingRow.locator('.note-row-message').innerText()) === 'Could not delete this note. Nothing was changed. Try again.'
  && notes.size === 3);
await page.screenshot({ path: SHOTS + '/4-delete-failed.png' });

failRemove = false;
await shoppingRow.locator('.row-delete').click();
await shoppingRow.getByRole('button', { name: 'Delete note' }).click();
await page.waitForFunction(() => document.querySelectorAll('#notes > li').length === 2);
check('delete: the row disappears and the note is gone from storage', (await rows().count()) === 2
  && ![...notes.values()].some((n) => new TextDecoder().decode(n.bytes).startsWith('Shopping')));
await page.reload();
await page.waitForSelector('#list:not([hidden])');
await sleep(300);
check('delete: still gone after a reload', (await rows().count()) === 2);

// 1. Sign out, with unsaved edits first
await page.locator('#notes .note-link', { hasText: 'Symbols' }).click();
await page.waitForSelector('#edit:not([hidden])');
await page.waitForFunction(() => document.getElementById('text').value.startsWith('Symbols'));
check('sign out: the button shows on the edit view', await visible('#sign-out'));
// Make the next save fail. Sign out must save first, and when that save fails
// it must not sign out and must not offer to leave anyway (changed 18 October
// 2026 by the sign out fix: before, a "Leave anyway" warning was the design).
await page.route('**/api/note?**', (route) => route.request().method() === 'PUT' ? route.abort() : route.continue());
await page.fill('#text', 'Symbols\nUNSAVED EDIT');
let dialogText = null;
page.once('dialog', async (dialog) => { dialogText = dialog.message(); await dialog.accept(); });
await page.click('#sign-out');
await sleep(800);
check('sign out with an unsaved edit whose save fails: no offer to leave anyway', dialogText === null, String(dialogText));
check('sign out with a failed save: still signed in, edit still on screen with the plain message', (await visible('#edit')) && (await page.inputValue('#text')).includes('UNSAVED EDIT')
  && (await page.locator('#status').textContent()) === 'Not saved' && (await page.locator('#detail').textContent()) !== '');
await page.unroute('**/api/note?**');
await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved', null, { timeout: 8000 });

const cookiesBefore = (await context.cookies()).map((c) => c.name);
await page.click('#sign-out');
await page.waitForSelector('#login:not([hidden])');
const cookiesAfter = (await context.cookies()).map((c) => c.name);
check('sign out: returns to the sign-in screen', (await visible('#login')) && !(await visible('#list')) && !(await visible('#edit')));
check('sign out: the server cleared the cookie', cookiesBefore.includes('silurian_notes') && !cookiesAfter.includes('silurian_notes'), `${cookiesBefore} -> ${cookiesAfter}`);
const afterText = await pageText();
check('sign out: no note content left in the page', !/Symbols|zephyrine|Deploy runbook|UNSAVED/.test(afterText));
await page.screenshot({ path: SHOTS + '/5-signed-out.png' });

// Step Back through the whole history, which includes the notes' own #n/
// addresses, and look for note content at every step.
const visited = [];
let leaked = false;
// Record every address the page passes through, and every time the list, the
// editor or the signed-in buttons are shown at all, with what they held. This
// closes the gap Production found on 18 October 2026: these checks looked only
// at where each Back step settled, half a second later, so a notes screen shown
// for a moment and then replaced by sign in was never seen.
await page.evaluate(() => {
  window.__seen = [];
  window.__shown = [];
  window.addEventListener('hashchange', () => window.__seen.push(location.hash));
  ['list', 'edit', 'bar-actions'].forEach((id) => {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (!el.hidden) window.__shown.push({ view: id, text: el.innerText.slice(0, 120) + document.getElementById('text').value.slice(0, 120) }); })
      .observe(el, { attributes: true, attributeFilter: ['hidden'] });
  });
});
const depth = await page.evaluate(() => history.length);
const seen = [];
const shownDuringBack = [];
for (let step = 0; step < depth - 1; step += 1) {
  await page.goBack().catch(() => null);
  await sleep(500);
  // Stop at the first entry before the notes page, the browser's blank start.
  if (!page.url().startsWith(BASE + '/notes')) { await page.goForward().catch(() => null); await sleep(300); break; }
  // Collected after every step: leaving the page would lose them.
  const records = await page.evaluate(() => { const r = { seen: window.__seen.splice(0), shown: window.__shown.splice(0) }; return r; });
  seen.push(...records.seen);
  shownDuringBack.push(...records.shown);
  visited.push(page.url().replace(BASE, ''));
  const text = await pageText();
  if (/Symbols|zephyrine|Deploy runbook|lorem|npm ci/.test(text) || !(await visible('#login'))) leaked = true;
}
const noteSteps = seen.filter((h) => /^#n\/[0-9a-f]{32}$/.test(h)).length;
check('after sign out, every Back step settles on sign in with no note content', !leaked && noteSteps > 0, `${visited.length} steps, ${noteSteps} of them to a note's own address`);
check('after sign out, no Back step shows the notes screen even for a moment', shownDuringBack.length === 0, JSON.stringify(shownDuringBack.slice(0, 3)));
await page.reload();
await page.waitForSelector('#login:not([hidden])');
check('after sign out, refresh shows the sign-in screen and no note content', !/Symbols|zephyrine|Deploy runbook|lorem/.test(await pageText()));

// Signing back in works, and the search box starts empty.
await signIn();
check('sign in again: full list, empty search box', (await rows().count()) === 2 && (await page.inputValue('#search')) === '');

// Narrow screen: the delete control sits beside each row and nothing overflows.
await page.setViewportSize({ width: 360, height: 740 });
await sleep(200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('narrow screen: no sideways scroll', !overflow);
await page.screenshot({ path: SHOTS + '/6-narrow.png', fullPage: true });

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
