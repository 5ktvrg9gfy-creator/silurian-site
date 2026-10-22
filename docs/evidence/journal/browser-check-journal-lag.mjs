// The journal in a browser against a store whose reads lag behind its writes by
// five seconds, which the real Blob store may do and the in-memory stand-in does
// not. Found on the Preview, 22 October 2026: entries vanished a few seconds
// after being added, and one move showed twice. Run from the repository root:
//   node docs/evidence/journal/browser-check-journal-lag.mjs
// It takes about a minute and a half, because it works in real time: it adds,
// moves and brings forward while the window keeps asking the server again.
import { startServer, chromium } from './harness.mjs';
import * as core from '../../../journal/core.js';

const LAG = 5000;
// Cold instances: each request is answered by a function that remembers nothing it wrote.
const server = await startServer({ port: 8773, lagMs: LAG, coldInstances: true });
const BASE = server.base;
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TODAY = '2026-10-22';
const TOMORROW = '2026-10-23';
const YESTERDAY = '2026-10-21';
const OCT = '2026-10';
const NOW = new Date('2026-10-22T09:30:00+01:00');
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Yesterday has two open tasks, in the store long enough to be read.
{
  const file = core.emptyMonth();
  for (const text of ['Call the courier', 'Check the tracker']) core.applyOp({ [OCT]: file }, { op: 'add', list: core.dayList(YESTERDAY), entry: { id: newId(), type: 'task', text } });
  await server.journalStore.preload(OCT, file);
}
const truth = () => JSON.parse(server.journalStore.inner.files.get(OCT).json);

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.clock.install({ time: NOW });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE + '/journal');
await page.waitForSelector('#login:not([hidden])');
await page.fill('#password', server.password);
await page.click('#login-submit');
await page.waitForSelector('#app:not([hidden])');

// The window keeps asking again, as it does on focus and every 45 seconds.
let asking = true;
(async () => { while (asking) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))).catch(() => {}); await sleep(700); } })();

// Every 300ms: what Today shows, as the texts of its entries.
const samples = [];
let sampling = true;
(async () => {
  while (sampling) {
    const shown = await page.evaluate(() => [...document.querySelectorAll('#list-today li.entry:not([data-state="migrated"]):not([data-state="scheduled"]) .entry-text')].map((e) => e.innerText)).catch(() => null);
    // An entry is the same entry after the edit that adds " today" to it.
    if (shown) samples.push({ at: Date.now(), shown: shown.map((t) => t.replace(/ today$/, '')) });
    await sleep(300);
  }
})();

const ADDED = ['Order labels', 'Ring the supplier', 'Book the van', 'Send the batch record', 'Reply to Daniel'];
const addBar = page.locator('#addbar-today .editor-line');
for (const text of ADDED) {
  await addBar.click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await sleep(1200);
}
// An edit straight after the last add, which the server may only see as the file was a few seconds ago.
{
  const last = page.locator('#list-today li.entry', { hasText: 'Reply to Daniel' });
  await last.locator('.entry-text').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' today');
  await page.keyboard.press('Enter');
  ADDED[4] = 'Reply to Daniel today';
}
// The window gets no rest: more asking again, then the moves.
await sleep(3000);

const seenEveryAdded = samples.filter((s) => s.at > 0).every((s, i, all) => {
  // Once an entry has been shown it is never missing later (until moved, which happens after this phase).
  const seenBefore = new Set(all.slice(0, i).flatMap((x) => x.shown));
  return [...seenBefore].every((text) => s.shown.includes(text));
});
check('adding: an entry that has been shown is never missing from a later look, though the window kept asking again', seenEveryAdded);
const lostAt = samples.find((s, i) => { const before = new Set(samples.slice(0, i).flatMap((x) => x.shown)); return [...before].some((t) => !s.shown.includes(t)); });
if (lostAt) console.log('      first missing look shows:', JSON.stringify(lostAt.shown));

// From here every move is made and its answer is lost once, so the window sends it again.
server.control.loseFirstAnswers = '"op":"move"';
// One move.
const van = page.locator('#list-today li.entry', { hasText: 'Book the van' });
await van.locator('.more').click();
await van.locator('.entry-actions button', { hasText: 'Tomorrow' }).click();
await sleep(1500);
// Bring all forward, straight after the move.
await page.locator('#strip .strip-foot').click();
await sleep(1000);

// Let every send and retry finish, with the window still asking.
await sleep(45000);
asking = false;
sampling = false;
await sleep(800);

const today = truth().days[TODAY]?.entries || [];
const tomorrow = truth().days[TOMORROW]?.entries || [];
const yesterday = truth().days[YESTERDAY]?.entries || [];
check('the edit made straight after an add was kept, not refused as a clash', today.some((e) => e.text === 'Reply to Daniel today'), JSON.stringify(today.map((e) => e.text)));
check('the store has all five added entries, each once', ADDED.every((t) => today.filter((e) => e.text === t).length === 1), JSON.stringify(today.map((e) => e.text)));
check('a single move made exactly one copy in Tomorrow', tomorrow.filter((e) => e.text === 'Book the van').length === 1, JSON.stringify(tomorrow.map((e) => e.text)));
check('and the original is marked moved exactly once', today.filter((e) => e.text === 'Book the van' && e.state === 'migrated').length === 1 && today.filter((e) => e.text === 'Book the van').length === 1 + (0), JSON.stringify(today.filter((e) => e.text === 'Book the van').map((e) => e.state)));
check('Bring all forward made exactly one copy of each of yesterday\'s two tasks in Today', ['Call the courier', 'Check the tracker'].every((t) => today.filter((e) => e.text === t).length === 1), JSON.stringify(today.map((e) => e.text)));
check('and yesterday\'s originals are each marked moved once', yesterday.filter((e) => e.state === 'migrated').length === 2 && yesterday.length === 2);
const shownNow = await page.evaluate(() => [...document.querySelectorAll('#list-today li.entry:not([data-state="migrated"]):not([data-state="scheduled"]) .entry-text')].map((e) => e.innerText));
check('the screen agrees with the store once everything has settled: no entry missing, none twice', JSON.stringify([...shownNow].sort()) === JSON.stringify(today.filter((e) => e.state !== 'migrated' && e.state !== 'scheduled').map((e) => e.text).sort()), JSON.stringify(shownNow));
check('no message about a failed save is left on screen', await page.locator('#flash').isHidden() || !/Could not save/.test(await page.textContent('#flash-text')), await page.textContent('#flash-text'));
check('the page threw nothing', errors.length === 0, errors.join(' | '));

await context.close();

/* =====================================================================
   Older reads of the whole list. Every read the window makes answers with
   what the journal was before this window's last saves.
   ===================================================================== */
{
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await other.clock.install({ time: NOW });
  const page2 = await other.newPage();
  const errors2 = [];
  page2.on('pageerror', (e) => errors2.push(e.message));
  await page2.goto(BASE + '/journal');
  await page2.waitForSelector('#login:not([hidden])');
  await page2.fill('#password', server.password);
  await page2.click('#login-submit');
  await page2.waitForSelector('#app:not([hidden])');
  // Switch the stale reads on, with the answers as the journal is now.
  server.control.staleGets = true;
  const cookie = (await other.cookies()).map((c) => c.name + '=' + c.value).join('; ');
  await fetch(BASE + '/api/journal?view=home&today=' + TODAY, { headers: { cookie } });
  await fetch(BASE + '/api/journal?view=months&months=' + OCT, { headers: { cookie } });
  let asking2 = true;
  (async () => { while (asking2) { await page2.evaluate(() => window.dispatchEvent(new Event('focus'))).catch(() => {}); await sleep(400); } })();
  const seen2 = [];
  let sampling2 = true;
  (async () => { while (sampling2) { const t = await page2.evaluate(() => [...document.querySelectorAll('#list-migrate li.entry .entry-text')].map((e) => e.innerText)).catch(() => null); if (t) seen2.push(t); await sleep(250); } })();
  const bar = page2.locator('#addbar-migrate .editor-line');
  const typed = ['Older read one', 'Older read two', 'Older read three'];
  for (const text of typed) { await bar.click(); await page2.keyboard.type(text); await page2.keyboard.press('Enter'); await sleep(1500); }
  await sleep(4000);
  asking2 = false; sampling2 = false;
  await sleep(500);
  const lost = seen2.find((list, i) => { const before = new Set(seen2.slice(0, i).flat()); return [...before].some((x) => !list.includes(x)); });
  check('older reads: an entry shown after a save is never replaced by an older read, though the window asked again every 400ms', !lost, lost ? JSON.stringify(lost) : '');
  const final = await page2.evaluate(() => [...document.querySelectorAll('#list-migrate li.entry .entry-text')].map((e) => e.innerText));
  check('older reads: all three entries are still on screen when it settles, each once', JSON.stringify(final) === JSON.stringify(typed), JSON.stringify(final));
  check('older reads: the page threw nothing', errors2.length === 0, errors2.join(' | '));
  server.control.staleGets = false;
  await other.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
