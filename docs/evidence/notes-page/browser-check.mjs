// Local browser run of the notes page. Run from the repository root:
//   node docs/evidence/notes-page/browser-check.mjs
// It serves the real page and the real API handlers over a throwaway in-memory
// store and a password generated for this run, and drives Chromium through
// Playwright. It proves the page's own code. It does not touch Vercel or Blob.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { memoryStore } from '../../../notes-tests/helpers.js';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = new URL('../../../', import.meta.url).pathname;
const SHOTS = process.env.SHOTS_DIR || '/tmp/notes-shots';
mkdirSync(SHOTS, { recursive: true });
const password = 'pw-' + randomBytes(12).toString('hex');

// The shared in-memory store, which keeps the same promises as the Blob adapter.
const store = memoryStore();
const notes = store.notes;
const api = createNotesApi({ store, env: { [ENVIRONMENT_VARIABLE]: password } });
const routes = { '/api/login': { POST: api.login }, '/api/session': { GET: api.session }, '/api/notes': api.collection, '/api/labels': api.labels, '/api/note': api.item };
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8766');
  const route = routes[url.pathname];
  if (route) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const handler = route[req.method];
    const response = handler
      ? await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }))
      : new Response('', { status: 405 });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const path = url.pathname === '/notes' ? 'notes/index.html' : url.pathname.slice(1);
  const file = ROOT + path;
  if (!existsSync(file) || path.startsWith('..')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8766, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:8766';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await context.newPage();
const status = () => page.locator('#status').textContent();
// Autosave waits for a five second pause in typing (thirty seconds at most), so a check waits for Saved.
const savedWithin = (pg, ms = 12000) => pg.waitForFunction(() => document.getElementById('status').textContent === 'Saved', null, { timeout: ms });
const visible = (sel) => page.locator(sel).isVisible();

// 1. Signed out
const apiHits = [];
page.on('request', (r) => { if (r.url().includes('/api/')) apiHits.push(r.method() + ' ' + new URL(r.url()).pathname); });
await page.goto(BASE + '/notes');
await page.waitForSelector('#login:not([hidden])');
check('signed out: login form shown, list hidden', (await visible('#login')) && !(await visible('#list')));
check('signed out: the only API call is the session check', apiHits.join() === 'GET /api/session', apiHits.join());
await page.screenshot({ path: SHOTS + '/1-login.png' });

// 2. Wrong password, then right password
await page.fill('#password', 'not-the-password');
await page.click('#login-submit');
await page.waitForSelector('#login-error:not([hidden])');
check('wrong password: plain message, still on login', (await page.locator('#login-error').innerText()) === 'That password is incorrect.' && (await visible('#login')));
check('wrong password: no cookie set', (await context.cookies()).length === 0);
await page.fill('#password', password);
await page.click('#login-submit');
await page.waitForSelector('#list:not([hidden])');
const cookie = (await context.cookies())[0];
check('right password: list shown with the empty-state sentence', (await visible('#empty')) && (await page.locator('#empty').innerText()).startsWith('No notes yet'));
check('cookie is HttpOnly, Secure, SameSite=Strict, 30 days, path /api', cookie.httpOnly && cookie.secure && cookie.sameSite === 'Strict' && cookie.path === '/api' && Math.round((cookie.expires - Date.now() / 1000) / 86400) === 30);
check('the page cannot read the cookie from script', (await page.evaluate(() => document.cookie)) === '');

// 3. New note, autosave status
await page.click('#new-note');
await page.waitForSelector('#edit:not([hidden])');
check('new note: edit view, empty, nothing saved yet', (await page.inputValue('#text')) === '' && (await status()) === 'Saved' && notes.size === 0);
const script = '# Deploy script\n\n```bash\n\techo "tab indented"   \n```\n\nКирилица, 日本語, 🙂\n';
await page.fill('#text', script);
check('status reads Not saved straight after typing', (await status()) === 'Not saved');
const seen = new Set();
await sleep(2500);
check('autosave: nothing is saved while the typing pause is under five seconds', (await status()) === 'Not saved' && notes.size === 0);
for (let i = 0; i < 70; i += 1) { seen.add(await status()); if (seen.has('Saved') && notes.size === 1) break; await sleep(100); }
check('autosave: reaches Saved after the five second pause, as one write', seen.has('Saved') && notes.size === 1, [...seen].join(' > '));
check('the address now names the note', /#n\/[0-9a-f]{32}$/.test(page.url()));
check('stored bytes equal the typed text', Buffer.from([...notes.values()][0].bytes).toString('utf8') === script);

// 4. Reload and reopen
await page.reload();
await page.waitForSelector('#edit:not([hidden])');
await page.waitForFunction(() => document.getElementById('text').value.length > 0);
check('reload on the note address: text returns identically', (await page.inputValue('#text')) === script);
await page.click('#back');
await page.waitForSelector('#list:not([hidden])');
check('list shows the first line as the title', (await page.locator('.note-title').first().innerText()) === '# Deploy script');
check('list shows a last-edited date and time', /\d{4}/.test(await page.locator('.note-when').first().innerText()), await page.locator('.note-when').first().innerText());

// 5. Copy
await page.click('.note-link');
await page.waitForFunction(() => document.getElementById('text').value.length > 0);
await page.click('#copy');
check('copy: clipboard holds the full text exactly', (await page.evaluate(() => navigator.clipboard.readText())) === script);
check('copy: button confirms', (await page.locator('#copy').textContent()) === 'Copied');

// 6. Edit existing note, status, then failure and recovery
await page.fill('#text', script + 'second line\n');
await savedWithin(page);
check('edit: saved again in place', (await status()) === 'Saved' && notes.size === 1);
await page.route('**/api/note?*', (route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
await page.fill('#text', script + 'third line\n');
await page.waitForFunction(() => document.getElementById('status').textContent === 'Not saved' && document.getElementById('detail').textContent.includes('Trying again'), null, { timeout: 15000 });
check('storage failure: Not saved with a retry message', (await status()) === 'Not saved' && (await page.locator('#detail').innerText()).includes('Trying again'));
const beforeUnload = [];
page.once('dialog', async (d) => { beforeUnload.push(d.type()); await d.dismiss(); });
await page.close({ runBeforeUnload: true });
await sleep(300);
check('unsaved changes: leaving the page asks first', beforeUnload.join() === 'beforeunload', beforeUnload.join());
// Dismissing the prompt left that page open and still retrying. Its saves keep failing (the route is its own),
// so nothing from it can reach storage while the rest is checked.

const page2 = await context.newPage();
await page2.goto(BASE + '/notes' + '#n/' + [...notes.keys()][0]);
await page2.waitForFunction(() => document.getElementById('text').value.length > 0);
check('the failed edit never reached storage; the last good version is intact', (await page2.inputValue('#text')) === script + 'second line\n');

// 7. Over 1 MB
const puts = [];
page2.on('request', (r) => { if (['PUT', 'POST'].includes(r.method())) puts.push(r.method()); });
await page2.evaluate(() => { const t = document.getElementById('text'); t.value = 'x'.repeat(1024 * 1024 + 10); t.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(6500);
check('over 1 MB: Not saved with the plain message and no request sent', (await page2.locator('#status').textContent()) === 'Not saved' && (await page2.locator('#detail').innerText()).includes('over 1 MB') && puts.length === 0);
check('over 1 MB: the stored note is untouched', Buffer.from([...notes.values()][0].bytes).toString('utf8') === script + 'second line\n', JSON.stringify(Buffer.from([...notes.values()][0].bytes).toString('utf8').slice(0, 60)));
await page2.evaluate(() => { const t = document.getElementById('text'); t.value = 'x'.repeat(900 * 1024); t.dispatchEvent(new Event('input', { bubbles: true })); });
await savedWithin(page2);
check('back under 1 MB: saves again', (await page2.locator('#status').textContent()) === 'Saved' && notes.size === 1 && [...notes.values()][0].bytes.length === 900 * 1024);

// 7b. Another device changes the note: the save is refused, the text stays, nothing is lost
const otherDevice = await page2.evaluate(async () => {
  const id = location.hash.slice(3);
  const current = await fetch('/api/note?id=' + id);
  const base = current.headers.get('X-Note-Updated');
  const saved = await fetch('/api/note?id=' + id, { method: 'PUT', headers: { 'X-Base-Updated': base }, body: 'written on the other device\n' });
  return saved.status;
});
check('another device saved a newer version', otherDevice === 200 && Buffer.from([...notes.values()][0].bytes).toString('utf8') === 'written on the other device\n');
const attempts = [];
page2.on('request', (r) => { if (r.method() === 'PUT') attempts.push(r.method()); });
const mine = 'my unsaved edit, typed on the stale copy\n';
await page2.fill('#text', mine);
await page2.waitForFunction(() => document.getElementById('detail').textContent.includes('another device'), null, { timeout: 15000 });
check('conflict: Not saved with the plain message', (await page2.locator('#status').textContent()) === 'Not saved' && (await page2.locator('#detail').innerText()).includes('your edits were not saved'), await page2.locator('#detail').innerText());
check('conflict: my text is still on screen', (await page2.inputValue('#text')) === mine);
check('conflict: the other device\'s version is untouched in storage', Buffer.from([...notes.values()][0].bytes).toString('utf8') === 'written on the other device\n');
await page2.screenshot({ path: SHOTS + '/5-conflict.png' });
const before = attempts.length;
await page2.fill('#text', mine + 'and some more typing\n');
await sleep(6500);
check('conflict: typing more does not keep hammering the server', attempts.length === before && (await page2.inputValue('#text')) === mine + 'and some more typing\n');
check('conflict: Copy still gives me my text', await (async () => { await page2.click('#copy'); return (await page2.evaluate(() => navigator.clipboard.readText())) === mine + 'and some more typing\n'; })());
const leaving = [];
page2.once('dialog', async (d) => { leaving.push(d.type()); await d.dismiss(); });
await page2.evaluate(() => { window.dispatchEvent(new Event('beforeunload', { cancelable: true })); });
await page2.click('#back');
await sleep(800);
// the in-page leave prompt is a confirm dialog; dismissing it keeps me on the note
check('conflict: leaving asks first and dismissing it keeps the text', (await page2.locator('#edit').isVisible()) && (await page2.inputValue('#text')) === mine + 'and some more typing\n', leaving.join());
page2.on('dialog', (d) => d.accept());
await page2.click('#back');
await page2.waitForSelector('#list:not([hidden])');
await page2.click('.note-link');
await page2.waitForFunction(() => document.getElementById('text').value.startsWith('written on'));
check('reopening shows the latest version and saves normally again', (await page2.inputValue('#text')) === 'written on the other device\n');
await page2.fill('#text', 'written on the other device\nplus my follow up\n');
await savedWithin(page2);
check('after reopening, a save goes through', (await page2.locator('#status').textContent()) === 'Saved' && Buffer.from([...notes.values()][0].bytes).toString('utf8') === 'written on the other device\nplus my follow up\n');

// 8. Delete with confirmation
await page2.click('#delete');
check('delete: asks first, nothing deleted yet', (await page2.locator('#confirm').isVisible()) && notes.size === 1);
await page2.click('#keep');
check('keep: confirmation closes, note stays', !(await page2.locator('#confirm').isVisible()) && notes.size === 1);
await page2.click('#delete');
await page2.click('#confirm-delete');
await page2.waitForSelector('#list:not([hidden])');
await page2.waitForSelector('#empty:not([hidden])');
check('delete: gone from the list and from storage', notes.size === 0 && (await page2.locator('.note-link').count()) === 0);

// 9. Phone width: no sideways scroll on any view, and screenshots
await page2.setViewportSize({ width: 375, height: 700 });
const overflow = async () => page2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
const widths = {};
widths.list = await overflow();
await page2.screenshot({ path: SHOTS + '/2-list-phone.png' });
await page2.click('#new-note');
await page2.waitForSelector('#edit:not([hidden])');
await page2.fill('#text', 'A very long single line with no break to push the box sideways '.repeat(12));
widths.edit = await overflow();
await sleep(300);
await page2.screenshot({ path: SHOTS + '/3-edit-phone.png' });
await page2.setViewportSize({ width: 1100, height: 800 });
await page2.screenshot({ path: SHOTS + '/4-edit-desktop.png' });
check('phone width 375: no sideways scroll on list or edit', !widths.list && !widths.edit, JSON.stringify(widths));

// 10. Signed out again: cookie gone means the API closes and the page returns to login
await context.clearCookies();
await page2.reload();
await page2.waitForSelector('#login:not([hidden])');
check('without the cookie the page falls back to login and shows no note', !(await page2.locator('#list').isVisible()) && !(await page2.locator('#edit').isVisible()));

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length} checks, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
