// Local browser run for notes-v3: the Spud Notes look, light and dark.
// Run from the repository root:  node docs/evidence/notes-page/browser-check-v3.mjs
// Real page, real API handlers, an in-memory store and a password made for the
// run, in Chromium through Playwright. Writes the screenshots to
// docs/evidence/notes-v3/ and prints one PASS or FAIL line per check.
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
const SHOTS = process.env.SHOTS_DIR || ROOT + 'docs/evidence/notes-v3';
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
  const url = new URL(req.url, 'http://127.0.0.1:8769');
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
await new Promise((r) => server.listen(8769, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8769';


const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const TITLES = [
  ['Deploy runbook', 'ssh deploy@host && run zephyrine --force\nsecond line'],
  ['Shopping', 'milk\neggs'],
  ['A very long note title that has to be cut off with an ellipsis at a phone width because it does not fit on one line', 'body of the long one'],
];

async function run(width, theme) {
  const narrow = width === 320;
  const tag = `${width}-${theme}`;
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 800 }, colorScheme: 'light' });
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, fullPage: true });
  const noSideways = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const colour = (selector, property) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, property]);

  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  if (theme === 'dark') {
    await page.click('#theme-switch');
  }
  const switchLabel = await page.getAttribute('#theme-switch', 'aria-label');
  check(`${tag}: theme switch label matches the page`, switchLabel === (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'), switchLabel);
  check(`${tag}: theme switch visible on sign in`, await page.locator('#theme-switch').isVisible());
  const ground = await colour('body', 'backgroundColor');
  check(`${tag}: page ground is the ${theme} ground`, ground === (theme === 'dark' ? 'rgb(38, 36, 34)' : 'rgb(250, 248, 245)'), ground);
  check(`${tag}: sign in has no sideways scroll`, await noSideways());
  await shot('1-sign-in');

  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#list:not([hidden])');
  await page.waitForSelector('#notes .note-row');
  check(`${tag}: three rows`, (await page.locator('#notes .note-row').count()) === 3);
  check(`${tag}: no sideways scroll on the list`, await noSideways());
  const labels = await page.$$eval('.row-delete', (els) => els.map((e) => e.getAttribute('aria-label')));
  check(`${tag}: every row bin has aria-label "Delete note: title"`, labels.length === 3 && labels.every((l) => l.startsWith('Delete note: ')) && labels.some((l) => l === 'Delete note: Shopping'));
  const bin = await page.locator('.row-delete').first().boundingBox();
  check(`${tag}: bin hit area is 44px square`, Math.round(bin.width) === 44 && Math.round(bin.height) === 44, `${bin.width}x${bin.height}`);
  const titleBox = await page.evaluate(() => { const el = [...document.querySelectorAll('.note-title')].find((e) => e.textContent.startsWith('A very long')); return { cut: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).textOverflow }; });
  check(`${tag}: the long title is cut with an ellipsis`, titleBox.cut && titleBox.overflow === 'ellipsis');
  await shot('2-list');

  await page.fill('#search', 'zephyrine');
  await page.waitForFunction(() => document.querySelectorAll('#notes .note-row').length === 1);
  check(`${tag}: search shows the matching line`, (await page.locator('.note-line').count()) === 1);
  await shot('3-list-search');
  await page.fill('#search', '');
  await page.waitForFunction(() => document.querySelectorAll('#notes .note-row').length === 3);

  await page.locator('#notes .note-row', { hasText: 'Shopping' }).locator('.row-delete').click();
  await page.waitForSelector('#notes .confirm:not([hidden])');
  const redBorders = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && getComputedStyle(e).borderTopWidth === '1px' && getComputedStyle(e).borderTopColor === getComputedStyle(document.querySelector('.confirm-yes')).borderTopColor).length);
  check(`${tag}: the confirm button is the only red-bordered element`, redBorders === 1, String(redBorders));
  await shot('4-row-delete-confirm');
  await page.locator('#notes .confirm:not([hidden]) >> text=Keep').click();

  await page.locator('#notes .note-row', { hasText: 'Deploy runbook' }).locator('.note-link').click();
  await page.waitForSelector('#edit:not([hidden])');
  await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  check(`${tag}: edit view has no sideways scroll`, await noSideways());
  check(`${tag}: note box is still monospace`, /mono|Menlo|Consolas/i.test(await colour('#text', 'fontFamily')));
  await page.keyboard.type(' more');
  const dotState = await page.getAttribute('#status', 'data-state');
  check(`${tag}: status carries a state word`, ['unsaved', 'saving', 'saved'].includes(dotState) && (await page.locator('#status').innerText()).length > 2);
  await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved');
  await shot('5-edit');

  if (theme === 'dark') {
    // The choice is the device's, not a note, and survives sign out.
    // At phone width Sign out is a row in the menu (notes version 4).
    if (narrow) { await page.click('#menu-button'); await page.click('#menu-sign-out'); } else { await page.click('#sign-out'); }
    await page.waitForSelector('#login:not([hidden])');
    check(`${tag}: sign out leaves the theme choice alone`, (await page.getAttribute('html', 'data-theme')) === 'dark' && (await page.evaluate(() => localStorage.getItem('silurian-notes-theme'))) === 'dark');
    await page.reload();
    await page.waitForSelector('#login:not([hidden])');
    check(`${tag}: reload keeps dark`, (await colour('body', 'backgroundColor')) === 'rgb(38, 36, 34)');
  }
  await context.close();
}

for (const width of [320, 1280]) for (const theme of ['light', 'dark']) {
  if (width === 320 && theme === 'light') {
    // seed once, through the real API
    const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    for (const [title, text] of [...TITLES].reverse()) {
      await fetch(BASE + '/api/notes', { method: 'POST', headers: { cookie, 'content-type': 'text/plain; charset=utf-8' }, body: title + '\n' + text });
      await sleep(15);
    }
  }
  await run(width, theme);
}

// Following the device with no saved choice, and a blocked store.
{
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  check('device dark, no saved choice: page is dark and the switch offers light', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(38, 36, 34)' && (await page.getAttribute('#theme-switch', 'aria-label')) === 'Switch to light mode');
  check('device dark: the sun shows, the moon does not', await page.locator('#theme-switch .icon-sun').isVisible() && !(await page.locator('#theme-switch .icon-moon').isVisible()));
  await page.click('#theme-switch');
  check('pressing it goes light and saves "light"', (await page.getAttribute('html', 'data-theme')) === 'light' && (await page.evaluate(() => localStorage.getItem('silurian-notes-theme'))) === 'light' && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(250, 248, 245)');
  await context.close();

  const blocked = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 800 } });
  await blocked.addInitScript(() => {
    const boom = () => { throw new Error('storage blocked'); };
    Object.defineProperty(window, 'localStorage', { get: boom, configurable: true });
  });
  const p2 = await blocked.newPage();
  const errors = [];
  p2.on('pageerror', (e) => errors.push(String(e)));
  await p2.goto(BASE + '/notes');
  await p2.waitForSelector('#login:not([hidden])');
  await p2.click('#theme-switch');
  check('storage blocked: the switch still goes dark for this visit', (await p2.getAttribute('html', 'data-theme')) === 'dark' && (await p2.getAttribute('#theme-switch', 'aria-label')) === 'Switch to light mode');
  check('storage blocked: no page error', errors.length === 0, errors.join(' | '));
  await blocked.close();

  const saved = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 800 } });
  await saved.addInitScript(() => { try { localStorage.setItem('silurian-notes-theme', 'dark'); } catch (e) {} });
  const p3 = await saved.newPage();
  await p3.addInitScript(() => {
    new MutationObserver(() => {}).observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { window.__themeAtParse = document.documentElement.getAttribute('data-theme'); });
  });
  await p3.goto(BASE + '/notes');
  check('a saved dark choice is applied on load', (await p3.evaluate(() => window.__themeAtParse)) === 'dark');
  await saved.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
