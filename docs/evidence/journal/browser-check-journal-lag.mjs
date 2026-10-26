// The journal in a browser against a store that does what Vercel's documentation
// says a Blob store may: serve an overwritten file as it was for up to 60 seconds,
// and, as a worse case than the documentation promises, leave a file made in the
// last 60 seconds out of a listing. Found on the Preview, 22 October 2026, in two
// rounds: entries vanished a few seconds after being added, one move showed twice,
// and then entries vanished on a refresh with "Could not save that change" shown.
// Run from the repository root:
//   node docs/evidence/journal/browser-check-journal-lag.mjs
// It takes about three minutes, because it works in real time: it adds, edits,
// moves and brings forward while the window keeps asking the server again, then
// waits past the 60 seconds and looks again.
import { startServer, chromium, returnToWindow } from './harness.mjs';
import * as core from '../../../journal/core.js';

const LAG = 60000;
// Cold instances: each request is answered by a function that remembers nothing it wrote.
const server = await startServer({ port: 8773, lagMs: LAG, listLagMs: LAG, coldInstances: true });
const BASE = server.base;
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual) === JSON.stringify(expected) ? '' : `got ${JSON.stringify(actual)} wanted ${JSON.stringify(expected)}`);
const TODAY = '2026-10-22';
const TOMORROW = '2026-10-23';
const YESTERDAY = '2026-10-21';
const OCT = '2026-10';
const NOW = new Date('2026-10-22T09:30:00+01:00');
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Yesterday has two open tasks, in the store long enough to be listed.
for (const [i, text] of ['Call the courier', 'Check the tracker'].entries()) {
  await server.journalStore.preload(core.dayList(YESTERDAY), { id: newId(), type: 'task', state: 'open', text, rev: 1, order: 1000 + i });
}
// What is really stored, whatever a lagging listing would show.
const truth = (month = OCT) => {
  const s = server.journalStore;
  const records = [...s.entries.values()].map((h) => core.normaliseEntryFile(JSON.parse(h.json))).filter((r) => core.parseList(r.list).month === month);
  return core.viewFrom([month], records, [])[month];
};
const day = (file, date) => core.liveEntries((file.days[date] || { entries: [] }).entries);

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
(async () => { while (asking) { await page.evaluate(returnToWindow).catch(() => {}); await sleep(700); } })();

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
  await sleep(2000);
}
// An edit straight after the last add.
{
  const last = page.locator('#list-today li.entry', { hasText: 'Reply to Daniel' });
  await last.locator('.entry-text').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' today');
  await page.keyboard.press('Enter');
  ADDED[4] = 'Reply to Daniel today';
}
await sleep(3000);

const shownEverything = (all) => all.every((s, i) => {
  // Once an entry has been shown it is never missing later (until moved, which happens after this phase).
  const seenBefore = new Set(all.slice(0, i).flatMap((x) => x.shown));
  return [...seenBefore].every((text) => s.shown.includes(text));
});
check('adding: an entry that has been shown is never missing from a later look, though the window kept asking again and the listing is 60 seconds behind', shownEverything(samples));
const lostAt = samples.find((s, i) => { const before = new Set(samples.slice(0, i).flatMap((x) => x.shown)); return [...before].some((t) => !s.shown.includes(t)); });
if (lostAt) console.log('      first missing look shows:', JSON.stringify(lostAt.shown));
check('adding: all five are on screen a few seconds after the last add', ADDED.map((t) => t.replace(/ today$/, '')).every((t) => samples.at(-1).shown.includes(t)), JSON.stringify(samples.at(-1).shown));

// From here every move is made and its answer is lost once, so the window sends it again.
server.control.loseFirstAnswers = '"op":"move"';
// Dragging an entry with the mouse onto a panel or a date line, which is the move a mouse makes.
const dragTo = async (row, target, where = { x: 60, y: 160 }) => {
  await target.scrollIntoViewIfNeeded();
  const from = await row.locator('.bullet').boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x + where.x, to.y + Math.min(where.y, to.height - 4), { steps: 8 });
  await page.mouse.up();
};
// One move, to Tomorrow.
const van = page.locator('#list-today li.entry', { hasText: 'Book the van' });
await dragTo(van, page.locator('#panel-tomorrow'));
await sleep(2500);
check('moving to Tomorrow: the moved line says "1 moved" and the entry is hidden from the list', (await page.textContent('#moved-toggle-today')) === '1 moved' && (await page.locator('#list-today li.entry', { hasText: 'Book the van' }).count()) === 0, await page.textContent('#moved-toggle-today'));
// Bring all forward, straight after the move.
await page.locator('#strip .strip-foot').click();
await sleep(2500);
// A move to a date, through Migrate then Date, to the 28th.
{
  const row = page.locator('#list-today li.entry', { hasText: 'Order labels' });
  await dragTo(row, page.locator('#panel-migrate'));
  await sleep(2500);
  const migrated = page.locator('#list-migrate li.entry', { hasText: 'Order labels' });
  // The Date picker, by keyboard: a mouse drags and has no More button.
  await page.keyboard.press('Tab');
  await migrated.locator('.entry-text').focus();
  await migrated.locator('.entry-actions button', { hasText: 'Date' }).press('Enter');
  await migrated.locator('.pick-day', { hasText: 'Wed 28 Oct' }).click();
  await page.waitForSelector('#flash:not([hidden])');
  check('moving to a date: the message names the day in full and has Undo and Open day', JSON.stringify([await page.textContent('#flash-text'), await page.textContent('#flash-action'), await page.textContent('#flash-also')]) === JSON.stringify(['Moved to Wednesday 28 October.', 'Undo', 'Open day']), await page.textContent('#flash-text'));
  await page.click('#flash-also');
  await page.waitForSelector('#day-view:not([hidden])');
  const there = await page.locator('#list-day li.entry .entry-text').allInnerTexts();
  check('Open day shows the day, with the moved entry in it', (await page.textContent('#day-date')) === 'Wednesday 28 October' && JSON.stringify(there) === JSON.stringify(['Order labels']), JSON.stringify(there));
  await page.click('#day-back');
  await sleep(500);
  // Two more drags, to a panel and to a date line, each with its answer lost once.
  await dragTo(page.locator('#list-today li.entry', { hasText: 'Ring the supplier' }), page.locator('#panel-tomorrow'));
  await sleep(2000);
  await dragTo(page.locator('#list-today li.entry', { hasText: 'Send the batch record' }), page.locator('#date-rows li.date-row[data-date="2026-10-29"]'), { x: 40, y: 10 });
  await sleep(2500);
}

// Let every send and retry finish, with the window still asking, and then go past the 60 seconds.
await sleep(LAG + 3000);
asking = false;
sampling = false;
await sleep(800);

const file = truth();
const today = day(file, TODAY);
const tomorrow = day(file, TOMORROW);
const yesterday = day(file, YESTERDAY);
const all28 = day(file, '2026-10-28');
const all29 = day(file, '2026-10-29');
check('the edit made straight after an add was kept, not refused as a clash', today.some((e) => e.text === 'Reply to Daniel today'), JSON.stringify(today.map((e) => e.text)));
check('the store has all five added entries, each once, as originals or as moved', ADDED.every((t) => today.filter((e) => e.text === t).length === 1), JSON.stringify(today.map((e) => e.text)));
check('a single move to Tomorrow made exactly one copy', tomorrow.filter((e) => e.text === 'Book the van').length === 1, JSON.stringify(tomorrow.map((e) => e.text)));
check('and the original is marked moved exactly once', today.filter((e) => e.text === 'Book the van' && e.state === 'migrated').length === 1, JSON.stringify(today.filter((e) => e.text === 'Book the van').map((e) => e.state)));
check('Bring all forward made exactly one copy of each of yesterday\'s two tasks in Today', ['Call the courier', 'Check the tracker'].every((t) => today.filter((e) => e.text === t && e.state === 'open').length === 1), JSON.stringify(today.map((e) => e.text)));
check('and yesterday\'s originals are each marked moved once', yesterday.filter((e) => e.state === 'migrated').length === 2 && yesterday.length === 2);
check('dragging to Tomorrow, with the answer lost once, made exactly one copy', tomorrow.filter((e) => e.text === 'Ring the supplier' && e.state === 'open').length === 1 && today.filter((e) => e.text === 'Ring the supplier' && e.state === 'migrated').length === 1, JSON.stringify(tomorrow.map((e) => e.text)));
check('dragging to a date line, with the answer lost once, made exactly one copy', all29.filter((e) => e.text === 'Send the batch record' && e.state === 'open').length === 1 && today.filter((e) => e.text === 'Send the batch record' && e.state === 'scheduled').length === 1, JSON.stringify(all29.map((e) => e.text)));
check('the move to the 28th made one copy there, and one in Migrate that was itself moved on', all28.filter((e) => e.text === 'Order labels' && e.state === 'open').length === 1);
const shownNow = await page.evaluate(() => [...document.querySelectorAll('#list-today li.entry:not([data-state="migrated"]):not([data-state="scheduled"]) .entry-text')].map((e) => e.innerText));
check('the screen agrees with the store once everything has settled: no entry missing, none twice', JSON.stringify([...shownNow].sort()) === JSON.stringify(today.filter((e) => e.state !== 'migrated' && e.state !== 'scheduled').map((e) => e.text).sort()), JSON.stringify(shownNow));
check('no message about a failed save is left on screen', await page.locator('#flash').isHidden() || !/Could not save/.test(await page.textContent('#flash-text')), await page.textContent('#flash-text'));
check('the page threw nothing', errors.length === 0, errors.join(' | '));

/* =====================================================================
   A second window, a second device, after the lag. It sees the lot.
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
  await sleep(1500);
  const seen = await page2.evaluate(() => [...document.querySelectorAll('#list-today li.entry:not([data-state="migrated"]):not([data-state="scheduled"]) .entry-text')].map((e) => e.innerText));
  check('a second device, signed in after the lag, sees the same list as the first, each entry once', JSON.stringify([...seen].sort()) === JSON.stringify([...shownNow].sort()), JSON.stringify(seen));
  check('and the same "1 moved" line', (await page2.textContent('#moved-toggle-today')) === (await page.textContent('#moved-toggle-today')));
  check('the second device threw nothing', errors2.length === 0, errors2.join(' | '));
  await other.close();
}

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
  (async () => { while (asking2) { await page2.evaluate(returnToWindow).catch(() => {}); await sleep(400); } })();
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
  check('older reads: all three entries are still on screen when it settles, each once', JSON.stringify(final.filter((t) => typed.includes(t))) === JSON.stringify(typed), JSON.stringify(final));
  check('older reads: the page threw nothing', errors2.length === 0, errors2.join(' | '));
  server.control.staleGets = false;
  await other.close();
}

/* =====================================================================
   Spans: make, edit, resize and delete while the store is 60 seconds behind
   ===================================================================== */
{
  const other = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
  await other.clock.install({ time: NOW });
  const page3 = await other.newPage();
  const errors3 = [];
  page3.on('pageerror', (e) => errors3.push(e.message));
  await page3.goto(BASE + '/journal');
  await page3.fill('#password', server.password);
  await page3.click('#login-submit');
  await page3.waitForSelector('#app:not([hidden])');
  // A line that has been in the store long enough to be listed.
  await server.journalStore.createLine('2026-10-27', 1, 'Possible Germany');
  server.journalStore.lines.get('2026-10-27|1').at = Date.now() - 2 * LAG;
  await page3.reload();
  await page3.waitForSelector('#app:not([hidden])');
  const rowOf = (d) => page3.locator(`.date-row[data-date="${d}"]`);
  // The window keeps asking again, as it does on focus and every 45 seconds.
  let asking3 = true;
  (async () => { while (asking3) { await page3.evaluate(returnToWindow).catch(() => {}); await sleep(500); } })();
  const barsOf = () => page3.evaluate(() => ({ text: (document.querySelector('.date-row[data-date="2026-10-27"] .line-text') || {}).innerText, bars: document.querySelectorAll('.span-bar').length }));
  const spansNow = () => { const out = new Map(); for (const [k, h] of server.journalStore.spanFiles) { const f = core.normaliseSpanFile(JSON.parse(h.json)); if (!out.has(f.id) || f.rev > out.get(f.id).rev) out.set(f.id, f); } return [...out.values()]; };
  const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return false; };
  const drag = async (from, to) => {
    await rowOf(from).hover();
    const hb = await rowOf(from).locator('.span-handle').boundingBox();
    const x = hb.x + hb.width / 2;
    await page3.mouse.move(x, hb.y + hb.height / 2); await page3.mouse.down();
    const t = await rowOf(to).boundingBox();
    await page3.mouse.move(x, t.y + t.height / 2, { steps: 5 }); await page3.mouse.up();
  };
  const shownBars = [];
  let sampling3 = true;
  (async () => { while (sampling3) { shownBars.push(await barsOf().catch(() => null)); await sleep(250); } })();
  await drag('2026-10-27', '2026-10-30');
  check('spans, 60 seconds behind: making one by the handle is saved and shown', await waitFor(() => spansNow().length === 1 && spansNow()[0].end === '2026-10-30') && (await waitFor(async () => (await barsOf()).bars === 3)));
  await rowOf('2026-10-27').locator('.line-text').click();
  await page3.keyboard.press('Control+A'); await page3.keyboard.type('Germany trip'); await page3.keyboard.press('Enter');
  check('editing the words straight after is saved, not refused as a clash', await waitFor(() => spansNow()[0].text === 'Germany trip' && spansNow()[0].rev === 2));
  await drag('2026-10-30', '2026-10-31');
  check('lengthening straight after is saved', await waitFor(() => spansNow()[0].end === '2026-10-31' && spansNow()[0].rev === 3));
  await drag('2026-10-31', '2026-10-29');
  check('and shortening', await waitFor(() => spansNow()[0].end === '2026-10-29' && spansNow()[0].rev === 4));
  await sleep(2500);
  sampling3 = false;
  await sleep(400);
  const lostBars = shownBars.filter(Boolean).find((sample, i, all) => i > 0 && all.slice(0, i).some((b) => b.bars >= 2) && sample.bars === 0);
  check('once shown, the span is never missing from a later look, though the listing is 60 seconds behind and the window kept asking again', !lostBars, JSON.stringify(lostBars));
  eq('one span, four revisions, each its own file, and the line cleared once', [spansNow().length, server.journalStore.spanFiles.size], [1, 4]);
  await rowOf('2026-10-27').locator('.line-text').click();
  await page3.keyboard.press('Control+A'); await page3.keyboard.press('Backspace'); await page3.keyboard.press('Enter');
  check('deleting it is saved, and its Undo is offered', await waitFor(() => spansNow()[0].state === 'removed') && (await page3.textContent('#flash-text')) === 'Span deleted.');
  await page3.click('#flash-action');
  check('Undo makes it again once, as a new span', await waitFor(() => spansNow().filter((x) => x.state === 'open').length === 1) && spansNow().length === 2);
  asking3 = false;
  check('spans: the page threw nothing', errors3.length === 0, errors3.join(' | '));
  // After the lag the listing has caught up, and a fresh look shows the same span.
  await sleep(LAG + 2000);
  await page3.reload();
  await page3.waitForSelector('#app:not([hidden])');
  eq('after 60 seconds a fresh look shows the same span the store holds', await page3.evaluate(() => [document.querySelector('.date-row[data-date="2026-10-27"] .line-text').innerText, document.querySelectorAll('.span-bar').length]), ['Germany trip', 2]);
  await other.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
