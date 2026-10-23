// Local browser run for the sign out fix: Production items 5 and 6.
// Run from the repository root:
//   node docs/evidence/notes-page/browser-check-signout.mjs
// To run the same checks against another version of the page, for example the
// one on main before the fix:
//   NOTES_PAGE_FILE=/path/to/index.html node docs/evidence/notes-page/browser-check-signout.mjs
//
// The real page and the real API handlers over a throwaway in-memory store and a
// password generated for this run, in Chromium through Playwright, once as a
// computer and once as a phone (touch, small screen, mobile user agent).
//
// Why this exists. The earlier checks looked at the screen only after it had
// settled, half a second later, so a notes view painted for a moment and then
// replaced by sign in never showed up in them. These checks record every time a
// notes view is shown at all, from the moment each page loads, and what it held.
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
const SHOTS = process.env.SHOTS_DIR || '/tmp/notes-shots-signout';
mkdirSync(SHOTS, { recursive: true });
const password = 'pw-' + randomBytes(12).toString('hex');

// The shared in-memory store, which keeps the same promises as the Blob adapter.
const store = memoryStore();
const notes = store.notes;
const control = { failWrites: false, writeDelayMs: 0 };
{
  const real = store.write;
  store.write = async (...args) => {
    if (control.writeDelayMs) await new Promise((r) => setTimeout(r, control.writeDelayMs));
    if (control.failWrites) throw new Error('refused');
    return real(...args);
  };
}
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
  const url = new URL(req.url, 'http://127.0.0.1:8768');
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
await new Promise((r) => server.listen(8768, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8768';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (id) => new TextDecoder().decode(notes.get(id).bytes);

// Installed in every document the browser loads, before the page's own script.
// Records each time the list, the editor or the signed-in buttons are shown,
// with what they held at that moment, and what was on screen when a page came
// back from the back-forward cache.
const RECORDER = `
  window.__shown = [];
  window.__restores = [];
  (function () {
    function snapshot(el) {
      var list = document.getElementById('notes');
      var text = document.getElementById('text');
      return { view: el.id, titles: list ? list.innerText.trim().slice(0, 200) : '', editor: text ? text.value.slice(0, 200) : '' };
    }
    function watch() {
      ['list', 'edit', 'bar-actions'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!el.hidden) window.__shown.push(snapshot(el));
        new MutationObserver(function () { if (!el.hidden) window.__shown.push(snapshot(el)); })
          .observe(el, { attributes: true, attributeFilter: ['hidden'] });
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true }); else watch();
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      var on = ['list', 'edit', 'bar-actions'].filter(function (id) { var el = document.getElementById(id); return el && !el.hidden; });
      var list = document.getElementById('notes');
      window.__restores.push({ visible: on, titles: list ? list.innerText.trim().slice(0, 200) : '' });
    });
  })();
`;

async function run(label, contextOptions) {
  // Playwright switches the back-forward cache off by default. A check of a
  // cache restore that never restores anything passes on nothing, so it goes
  // back on here, and a separate check below proves a restore happened.
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
  });
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(RECORDER);
  const page = await context.newPage();
  // Chrome says why it did not keep a page in the back-forward cache.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  const notCached = [];
  cdp.on('Page.backForwardCacheNotUsed', (e) => notCached.push(e.notRestoredExplanations.map((x) => x.reason).join(',')));
  // At phone width Sign out is a row in the menu (notes version 4), not a header button.
  const press = async (sel) => {
    if (sel === '#sign-out' && contextOptions.hasTouch) { await page.tap('#menu-button'); return page.tap('#menu-sign-out'); }
    return contextOptions.hasTouch ? page.tap(sel) : page.click(sel);
  };
  const visible = (sel) => page.locator(sel).isVisible();
  const shown = () => page.evaluate(() => window.__shown.slice());
  const clearShown = () => page.evaluate(() => { window.__shown.length = 0; });
  let dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });

  notes.clear();
  control.failWrites = false; control.writeDelayMs = 0;

  async function signIn() {
    await page.waitForSelector('#login:not([hidden])');
    await page.fill('#password', password);
    await press('#login-submit');
    await page.waitForSelector('#list:not([hidden])');
  }
  async function makeNote(text) {
    await press('#new-note');
    await page.waitForSelector('#edit:not([hidden])');
    await page.fill('#text', text);
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved' && location.hash.startsWith('#n/'), null, { timeout: 5000 });
    const id = (await page.evaluate(() => location.hash)).slice(3);
    await press('#back');
    await page.waitForSelector('#list:not([hidden])');
    return id;
  }
  async function openNote(id) {
    await page.locator(`a[href="#n/${id}"]`).first().click();
    await page.waitForFunction((want) => document.getElementById('text').value.startsWith(want), textOf(id).slice(0, 10));
    await sleep(100);
  }

  await page.goto(BASE + '/notes');
  await signIn();
  const a = await makeNote('Alpha title\nfirst text');
  const b = await makeNote('Bravo title\nsecond text');

  // ---- Item 5: a typed change, then Sign out straight away ----
  await openNote(a);
  dialogs = [];
  await page.locator('#text').press('End');
  await page.type('#text', ' EDIT-ONE');
  await press('#sign-out');
  await page.waitForSelector('#login:not([hidden])', { timeout: 8000 });
  check(`${label} item 5: typed change then immediate Sign out is in storage afterwards`, textOf(a).endsWith(' EDIT-ONE'), JSON.stringify(textOf(a).slice(-12)));
  check(`${label} item 5: no warning dialog when the save succeeds`, dialogs.length === 0, dialogs.join(' | '));
  await signIn();

  // A slow save: Sign out waits for it rather than leaving it behind.
  await openNote(a);
  control.writeDelayMs = 1500;
  await page.type('#text', ' EDIT-SLOW');
  await press('#sign-out');
  const midway = await page.locator('#status').textContent();
  await page.waitForSelector('#login:not([hidden])', { timeout: 8000 });
  control.writeDelayMs = 0;
  check(`${label} item 5: a slow save finishes before signing out`, textOf(a).endsWith(' EDIT-SLOW'), `status while waiting: ${midway}`);
  await signIn();

  // A failed save: stay signed in on the note, text kept, existing message.
  await openNote(b);
  dialogs = [];
  control.failWrites = true;
  await page.type('#text', ' MUST-STAY');
  await press('#sign-out');
  await sleep(1500);
  const failState = {
    login: await visible('#login'),
    edit: await visible('#edit'),
    text: await page.inputValue('#text'),
    status: await page.locator('#status').textContent(),
    detail: await page.locator('#detail').textContent(),
  };
  check(`${label} item 5: a failed save keeps the user signed in on the note with the text`,
    !failState.login && failState.edit && failState.text.endsWith(' MUST-STAY') && failState.status === 'Not saved' && failState.detail !== '',
    JSON.stringify({ ...failState, dialogs }));
  const stillSignedIn = await page.evaluate(() => fetch('/api/session').then((r) => r.status));
  check(`${label} item 5: after the failed save the session is still valid`, stillSignedIn === 200, String(stillSignedIn));
  await page.screenshot({ path: `${SHOTS}/${label}-failed-save.png` });
  control.failWrites = false;
  // Let the page's own retry save it, so the conflict case starts clean.
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved', null, { timeout: 10000 }).catch(() => {});

  // A conflict: the note changed on another device. Stay, text kept.
  if (!(await visible('#login'))) {
    dialogs = [];
    const base = notes.get(b).meta.updatedAt;
    notes.set(b, { bytes: new TextEncoder().encode('Bravo title\nchanged elsewhere'), meta: { title: 'Bravo title', updatedAt: new Date(Date.parse(base) + 5000).toISOString() } });
    await page.type('#text', ' CONFLICTED');
    await press('#sign-out');
    await sleep(1200);
    const c = { login: await visible('#login'), text: await page.inputValue('#text'), detail: await page.locator('#detail').textContent() };
    check(`${label} item 5: a conflict keeps the user signed in on the note with the text`,
      !c.login && c.text.endsWith(' CONFLICTED') && /changed on another device/.test(c.detail), JSON.stringify({ ...c, dialogs }));
    // Clear the conflict for what follows: go back to the list, accepting the loss.
    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => { await d.accept(); });
    await press('#back');
    await page.waitForSelector('#list:not([hidden])');
    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  } else {
    check(`${label} item 5: a conflict keeps the user signed in on the note with the text`, false, 'already signed out by the failed save case');
    await signIn();
  }

  // ---- Item 6: after Sign out, Back, Forward and refresh paint only sign in ----
  await openNote(a);
  await press('#back');
  await page.waitForSelector('#list:not([hidden])');
  await openNote(b);
  await press('#sign-out');
  await page.waitForSelector('#login:not([hidden])');
  await clearShown();
  const depth = await page.evaluate(() => history.length);
  for (let i = 0; i < depth - 1; i += 1) { await page.goBack({ waitUntil: 'commit' }).catch(() => null); await sleep(400); }
  const afterBack = await shown();
  check(`${label} item 6: after Sign out, Back never shows the notes screen`, afterBack.length === 0, JSON.stringify(afterBack.slice(0, 3)));
  const leaked = afterBack.filter((s) => /Alpha|Bravo|first text|second text/.test(s.titles + s.editor));
  check(`${label} item 6: and never shows a note title or text`, leaked.length === 0, JSON.stringify(leaked.slice(0, 2)));
  await clearShown();
  for (let i = 0; i < depth - 1; i += 1) { await page.goForward({ waitUntil: 'commit' }).catch(() => null); await sleep(400); }
  const afterForward = await shown();
  check(`${label} item 6: after Sign out, Forward never shows the notes screen`, afterForward.length === 0, JSON.stringify(afterForward.slice(0, 3)));
  await page.reload();
  await page.waitForSelector('#login:not([hidden])');
  await sleep(300);
  const afterReload = await shown();
  check(`${label} item 6: after Sign out, refresh never shows the notes screen`, afterReload.length === 0, JSON.stringify(afterReload.slice(0, 3)));
  await page.screenshot({ path: `${SHOTS}/${label}-after-signout.png` });

  // ---- Item 6: a page restored from the back-forward cache ----
  // Signed in on the list, leave for another page, sign out from a second tab,
  // then come Back. The no-store header is off here, standing in for a browser
  // that keeps such a page in its back-forward cache anyway.
  pageNoStore = false;
  // A fresh document, loaded without no-store, so Chrome may cache it.
  await page.goto(BASE + '/notes');
  await signIn();
  await page.waitForFunction(() => document.querySelectorAll('#notes > li').length >= 2);
  await page.goto(BASE + '/elsewhere');
  const other = await context.newPage();
  await other.goto(BASE + '/notes');
  await other.waitForSelector('#list:not([hidden])');
  if (contextOptions.hasTouch) { await other.tap('#menu-button'); await other.tap('#menu-sign-out'); } else { await other.click('#sign-out'); }
  await other.waitForSelector('#login:not([hidden])');
  await other.close();
  // A restore from the cache fires no load event, so wait for the commit only.
  await page.goBack({ waitUntil: 'commit' });
  await sleep(800);
  const restores = await page.evaluate(() => window.__restores || null);
  const restored = Array.isArray(restores) && restores.length > 0;
  const atRestore = restored ? restores[0] : null;
  check(`${label} item 6: the back-forward cache did restore the page, so the next check saw something`, restored, restored ? '' : `Chrome did not cache it: ${notCached.join(' | ')}`);
  check(`${label} item 6: a page restored from the back-forward cache shows no notes view and no title`,
    restored && atRestore.visible.length === 0 && !/Alpha|Bravo/.test(atRestore.titles), JSON.stringify(atRestore));
  check(`${label} item 6: and then settles on sign in`, await visible('#login'));
  pageNoStore = true;

  await browser.close();
}

await run('computer', { viewport: { width: 1100, height: 800 } });
const phone = { ...devices['Pixel 7'] };
delete phone.defaultBrowserType;
await run('phone', phone);

server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
