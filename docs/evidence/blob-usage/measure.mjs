// Counts the Blob operations the journal and the notes page cost, for the code in
// the checkout it is run from. Run from the repository root:
//
//   LABEL=before node docs/evidence/blob-usage/measure.mjs            (cold instances)
//   LABEL=before node docs/evidence/blob-usage/measure.mjs --warm
//
// The real pages in Chromium, the real route code and the real Blob adapters, over
// notes-tests/counting-sdk.js, which counts every call. Time is the page's own clock,
// moved with Playwright's clock so an idle hour takes seconds. "Cold" means every
// request is answered by a function that has just started and remembers nothing it
// read or wrote (the most it can cost). "Warm" means one instance answers everything
// and keeps what it has read (the least it can cost). A real deployment sits between.
//
// Advanced = put + copy + list. Simple = get + head, every get counted as a cache miss
// (the adapters read with useCache: false). del is counted on its own line. See
// notes-tests/counting-sdk.js for what Vercel's pricing page says.
import { writeFileSync, mkdirSync } from 'node:fs';
import { startServer, chromium, ROOT } from '../journal/harness.mjs';
import { countingSdk } from '../../../notes-tests/counting-sdk.js';
import * as core from '../../../journal/core.js';

const WARM = process.argv.includes('--warm');
const LABEL = process.env.LABEL || 'run';
const MODE = WARM ? 'warm' : 'cold';
const OUT = ROOT + 'docs/evidence/blob-usage';
mkdirSync(OUT, { recursive: true });

const clock = { get now() { return Date.now(); } };
const counter = countingSdk({ clock });
const server = await startServer({ port: 8795, sdk: counter.sdk, cold: !WARM });
const BASE = server.base;
const browser = await chromium.launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOW = new Date('2026-10-22T09:30:00+01:00');
const TODAY = '2026-10-22';
const results = [];
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- seeding, through the real API ---------- */

const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: server.password }) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const call = (method, path, { body, headers = {} } = {}) => fetch(BASE + path, { method, headers: { cookie, ...headers }, body }).then(async (r) => { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t, headers: r.headers }; });
const journal = (op) => call('POST', '/api/journal', { body: JSON.stringify(op), headers: { 'content-type': 'application/json' } });
let at = 1_790_000_000_000;
const entry = async (list, text, type = 'task') => { const id = newId(); const r = await journal({ op: 'add', list, at: (at += 1000), entry: { id, type, text } }); if (r.status !== 200) throw new Error('seed ' + r.status); return id; };

// A believable journal: this month and last month with a few weeks of entries.
for (let d = 1; d <= 23; d += 1) {
  const date = `2026-10-${String(d).padStart(2, '0')}`;
  for (let i = 0; i < 2 + (d % 3); i += 1) await entry(core.dayList(date), `Task ${d}.${i}`, i === 2 ? 'event' : 'task');
  if (d % 3 === 0) await journal({ op: 'line', date, rev: 0, text: `Line for ${d}` });
}
for (let d = 1; d <= 30; d += 1) {
  const date = `2026-09-${String(d).padStart(2, '0')}`;
  for (let i = 0; i < 1 + (d % 3); i += 1) await entry(core.dayList(date), `Sept ${d}.${i}`);
}
for (let i = 0; i < 6; i += 1) await entry(core.migrateList('2026-10'), `Migrate ${i}`);
for (let i = 0; i < 3; i += 1) await entry(core.migrateList('2026-09'), `Old migrate ${i}`);
for (const [start, end, text] of [['2026-10-26', '2026-10-29', 'Site visit'], ['2026-11-03', '2026-11-05', 'Away']]) await journal({ op: 'spanAdd', span: { id: newId(), start, end, text } });
await call('PUT', '/api/journal?part=quick', { body: 'Quick note text', headers: { 'x-base-updated': 'none' } });
// Notes: forty notes, five labels, a few notes with several revisions.
const labelIds = [];
for (const name of ['Home', 'Work', 'Ideas', 'Travel', 'Recipes']) {
  const now = await call('GET', '/api/labels');
  const made = await call('POST', '/api/labels', { body: JSON.stringify({ name }), headers: { 'content-type': 'application/json', 'x-base-labels': now.json.updatedAt } });
  labelIds.push(made.json.labels.find((l) => l.name === name).id);
}
const noteIds = [];
for (let i = 0; i < 40; i += 1) {
  const made = await call('POST', '/api/notes', { body: `Note ${i}\nsome words for the note ${i} about zephyrine and plans\n`, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  noteIds.push({ id: made.json.id, version: made.json.updatedAt });
}
for (let i = 0; i < 3; i += 1) {
  let version = noteIds[i].version;
  for (let r = 1; r <= 5; r += 1) {
    const saved = await call('PUT', '/api/note?id=' + noteIds[i].id, { body: `Note ${i}\nedit ${r}\n`, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-base-updated': version } });
    version = saved.json.updatedAt;
  }
  noteIds[i].version = version;
}
// Everything seeded is old enough to be listed and settled.
const age = (ms) => { for (const f of counter.sdk.files.values()) for (const v of f.versions) v.at -= ms; };
age(5 * 60 * 1000);
counter.reset();

/* ---------- measuring ---------- */

async function measure(name, work, { note = '' } = {}) {
  const before = counter.snapshot();
  const mark = counter.log.length;
  await work();
  await sleep(1800);   // answers that are still on their way
  const d = counter.since(before);
  results.push({ name, advanced: d.advanced, simple: d.simple, put: d.put, list: d.list, get: d.get, head: d.head, del: d.del, note });
  if (process.env.TRACE) for (const l of counter.log.slice(mark)) console.log('      ' + l.replace(/[0-9a-f]{32}/g, '<id>'));
  console.log(`${name.padEnd(64)} advanced ${String(d.advanced).padStart(4)}  simple ${String(d.simple).padStart(4)}  (put ${d.put} list ${d.list} get ${d.get} head ${d.head} del ${d.del})`);
}

async function newPage(startPath, { hiddenControl = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.clock.install({ time: NOW });
  if (hiddenControl) await context.addInitScript(() => { Object.defineProperty(document, 'visibilityState', { get: () => (window.__hidden ? 'hidden' : 'visible'), configurable: true }); });
  await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=')[1], url: BASE }]);
  const page = await context.newPage();
  page.errors = [];
  if (process.env.TRACE) page.on('request', (r) => { if (/\/api\/(note|notes|labels)/.test(r.url())) console.log('      REQ ' + r.method() + ' ' + r.url().replace(BASE, '').replace(/[0-9a-f]{32}/, '<id>') + ' rev=' + (r.headers()['x-base-rev'] || '-')); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  return { context, page };
}
const openJournal = async (page) => { await page.goto(BASE + '/journal'); await page.waitForSelector('#app:not([hidden])'); await page.waitForSelector('.date-row'); };
const openNotes = async (page, hash = '') => { await page.goto(BASE + '/notes' + hash); await page.waitForSelector('#list:not([hidden]), #edit:not([hidden])'); };

/* ----- one hour idle ----- */
for (const [state, hidden, focusFirst] of [['focused', false, true], ['visible, not focused', false, false], ['hidden', true, false]]) {
  const { context, page } = await newPage('/journal', { hiddenControl: true });
  await openJournal(page);
  await sleep(1500);
  if (hidden) await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  if (focusFirst) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await sleep(2500); }
  await measure(`journal open and idle for one hour, ${state}`, async () => { await context.clock.runFor(60 * 60 * 1000); });
  await context.close();
}
for (const view of ['list', 'a note being edited']) {
  const { context, page } = await newPage('/notes');
  await openNotes(page, view === 'list' ? '' : '#n/' + noteIds[5].id);
  if (view !== 'list') await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  await sleep(1500);
  await measure(`notes open and idle for one hour, on the ${view}`, async () => { await context.clock.runFor(60 * 60 * 1000); });
  await context.close();
}

/* ----- journal actions ----- */
{
  const { context, page } = await newPage('/journal');
  await measure('journal: open (page load, signed in)', async () => { await openJournal(page); });
  await measure('journal: open again (a second device, or a reload)', async () => { await page.reload(); await page.waitForSelector('.date-row'); });
  await measure('journal: add an entry in Today', async () => {
    await page.locator('#addbar-today .editor-line').click();
    await page.keyboard.type('A new task for measuring');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('#list-today .entry-text')].some((e) => e.innerText.includes('A new task for measuring')));
  });
  await measure('journal: move that entry to Tomorrow (keyboard buttons)', async () => {
    const row = page.locator('#list-today li.entry', { hasText: 'A new task for measuring' });
    await page.keyboard.press('Tab');
    await row.locator('.entry-text').focus();
    await row.locator('.entry-actions button', { hasText: 'Tomorrow' }).press('Enter');
    await page.waitForSelector('#flash:not([hidden])');
  });
  await measure('journal: edit an entry and tick another', async () => {
    const first = page.locator('#list-today li.entry').first();
    await first.locator('.entry-text').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    await page.keyboard.press('Enter');
    await sleep(600);
    await page.locator('#list-today li.entry').nth(1).locator('button.bullet').click();
  });
  await measure('journal: type a calendar line in Month', async () => {
    const row = page.locator('.date-row[data-date="2026-10-24"] .line-text');
    await row.click();
    await page.keyboard.type('Dentist at ten');
    await page.keyboard.press('Enter');
  });
  await measure('journal: make a span from that line (Until, three days)', async () => {
    await page.locator('.date-row[data-date="2026-10-24"] .line-text').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.locator('#until-menu button').nth(3).press('Enter');
  });
  await measure('journal: switch back to the window after six minutes (focus)', async () => {
    await context.clock.runFor(6 * 60 * 1000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  });
  await measure('journal: switch back to the window again after one minute (focus)', async () => {
    await context.clock.runFor(60 * 1000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  });
  await measure('journal: type in Quick notes for one minute', async () => {
    await page.locator('#quick-editor').click();
    await context.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
    for (let burst = 0; burst < 12; burst += 1) {
      for (let k = 0; k < 10; k += 1) { await page.keyboard.type('ab'); await context.clock.runFor(300); }
      await context.clock.runFor(2000);
    }
    await context.clock.resume();
  });
  await context.close();
}

/* ----- notes actions ----- */
{
  const { context, page } = await newPage('/notes');
  await measure('notes: open the list (page load, signed in)', async () => { await openNotes(page); });
  await measure('notes: open a note', async () => {
    await page.locator('#notes .note-link').nth(7).click();
    await page.waitForSelector('#edit:not([hidden])');
    await page.waitForFunction(() => document.getElementById('text').value.length > 0);
  });
  await measure('notes: type for one minute (bursts with short pauses)', async () => {
    await page.locator('#text').click();
    await page.keyboard.press('Control+End');
    await context.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
    for (let burst = 0; burst < 12; burst += 1) {
      for (let k = 0; k < 10; k += 1) { await page.keyboard.type('ab'); await context.clock.runFor(300); }
      await context.clock.runFor(2000);
      await sleep(250);
    }
    await context.clock.resume();
  });
  await measure('notes: give the open note a label', async () => {
    await page.click('#labels-button');
    await page.waitForSelector('#labels-panel:not([hidden])');
    await page.locator('#panel-list .check-row', { hasText: 'Home' }).locator('input').check();
    await sleep(600);
  });
  await measure('notes: archive the open note', async () => {
    await page.click('#archive');
    await page.waitForSelector('#list:not([hidden])');
  });
  await measure('notes: go back to the list after editing (the list is asked for again)', async () => { await page.goto(BASE + '/notes'); await page.waitForSelector('#notes .note-link'); });
  await measure('notes: search for a word', async () => {
    await page.fill('#search', 'zephyrine');
    await page.waitForFunction(() => document.querySelectorAll('#notes .note-link').length > 5);
  });
  await context.close();
}

/* ----- revision cleanup ----- */
{
  // A note with many settled revisions, listed: the list tidies what has become safe to delete.
  const victim = noteIds[10];
  let version = victim.version;
  for (let r = 1; r <= 8; r += 1) {
    const saved = await call('PUT', '/api/note?id=' + victim.id, { body: `Tidy me ${r}\n`, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-base-updated': version } });
    version = saved.json.updatedAt;
  }
  age(5 * 60 * 1000);
  counter.reset();
  await measure('notes: list after one note collected 8 settled revisions (cleanup)', async () => { await call('GET', '/api/notes?view=all'); }, { note: '8 old revisions and their text files become deletable' });
  await measure('notes: the same list again straight after', async () => { await call('GET', '/api/notes?view=all'); });
  await measure('notes: one save with no cleanup due', async () => { const r = await call('PUT', '/api/note?id=' + noteIds[20].id, { body: 'one more save\n', headers: { 'content-type': 'text/plain; charset=utf-8', 'x-base-updated': noteIds[20].version } }); void r; });
}

await browser.close();
await server.close();

/* ---------- a typical day ---------- */
const by = (name) => results.find((r) => r.name === name);
const cost = (name) => { const r = by(name); return r ? { advanced: r.advanced, simple: r.simple, del: r.del } : { advanced: 0, simple: 0, del: 0 }; };
// One user, two devices (a PC and an iPad). The mix is stated here so it can be argued with.
const DAY = [
  ['journal: open (page load, signed in)', 5, 'five opens across the PC and the iPad'],
  ['journal: switch back to the window after six minutes (focus)', 4, 'four returns to a window left open for more than five minutes'],
  ['journal: add an entry in Today', 8, 'eight entries added'],
  ['journal: move that entry to Tomorrow (keyboard buttons)', 2, 'two moves'],
  ['journal: edit an entry and tick another', 3, 'three edits or ticks'],
  ['journal: type a calendar line in Month', 1, 'one calendar line'],
  ['journal: type in Quick notes for one minute', 1, 'one minute of Quick notes'],
  ['notes: open the list (page load, signed in)', 2, 'two visits to the notes list'],
  ['notes: open a note', 3, 'three notes opened'],
  ['notes: type for one minute (bursts with short pauses)', 2, 'two minutes of typing in notes'],
  ['notes: give the open note a label', 1, 'one label'],
  ['notes: archive the open note', 1, 'one archive'],
  ['notes: search for a word', 1, 'one search'],
];
let advanced = 0; let simple = 0;
const rows = DAY.map(([name, times, why]) => { const c = cost(name); advanced += c.advanced * times; simple += c.simple * times; return { name, times, why, each: c.advanced, simpleEach: c.simple, advanced: c.advanced * times, simple: c.simple * times }; });
const idleHour = results.filter((r) => r.name.includes('idle for one hour'));
const day = { rows, advanced, simple, note: 'Idle open windows are not in this day. Add the idle hour figure for each hour a window is left open.' };
console.log(`\nTypical day, ${MODE} instances: advanced ${advanced}, simple ${simple}`);
writeFileSync(`${OUT}/usage-${LABEL}-${MODE}.json`, JSON.stringify({ label: LABEL, mode: MODE, results, day, idleHour }, null, 2));

// --check holds the figures to notes-tests/blob-budget.json and exits 1 when any is over,
// or when a budgeted action was not measured at all (a check that saw nothing has not run).
if (process.argv.includes('--check')) {
  const { readFileSync } = await import('node:fs');
  const budget = JSON.parse(readFileSync(ROOT + 'notes-tests/blob-budget.json', 'utf8'));
  let bad = 0;
  for (const [name, limit] of Object.entries(budget.browser)) {
    const got = results.find((r) => r.name === name);
    if (!got) { console.log(`NOT MEASURED  ${name}`); bad += 1; continue; }
    if (got.advanced > limit.advanced || got.simple > limit.simple) { console.log(`OVER BUDGET   ${name}: advanced ${got.advanced}/${limit.advanced}, simple ${got.simple}/${limit.simple}`); bad += 1; }
  }
  if (!WARM && (advanced > budget.typicalDay.advanced || simple > budget.typicalDay.simple)) { console.log(`OVER BUDGET   typical day: advanced ${advanced}/${budget.typicalDay.advanced}, simple ${simple}/${budget.typicalDay.simple}`); bad += 1; }
  console.log(bad === 0 ? `Within budget (${Object.keys(budget.browser).length} actions checked)` : `${bad} over budget`);
  if (bad) process.exitCode = 1;
}
const md = [`# Blob operations, ${LABEL}, ${MODE} instances`, '', '| Action | Advanced | Simple | del |', '|---|---:|---:|---:|', ...results.map((r) => `| ${r.name} | ${r.advanced} | ${r.simple} | ${r.del} |`), '', `Typical day: advanced ${advanced}, simple ${simple}`, ''].join('\n');
writeFileSync(`${OUT}/usage-${LABEL}-${MODE}.md`, md);
