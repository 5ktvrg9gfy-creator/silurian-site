// Local browser run for the Done list, the calendar search and the Quick notes
// bullets (28 October 2026). Run from the repository root:
//   node docs/evidence/journal/browser-check-journal-done-search.mjs
// The real page and the real API handlers over the in-memory journal store and a
// password made for the run, in Chromium through Playwright. Prints one PASS or
// FAIL line per check and the count of checks that ran. Run by hand; not part of
// either suite.
import { mkdirSync } from 'node:fs';
import { startServer, chromium, ROOT } from './harness.mjs';

const SHOTS = process.env.SHOTS_DIR || ROOT + 'docs/evidence/journal/shots';
mkdirSync(SHOTS, { recursive: true });
const server = await startServer({ port: 8775 });
const BASE = server.base;
const browser = await chromium.launch();

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual) === JSON.stringify(expected) ? '' : `got ${JSON.stringify(actual)} wanted ${JSON.stringify(expected)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NOW = new Date('2026-10-22T09:30:00+01:00');
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- seeding through the real API, with the store's clock under control ---------- */

let cookie = '';
let atMs = 0;
server.journalStore.ageNow.now = () => atMs;
const when = (iso) => { atMs = Date.parse(iso); };
async function http(method, path, body) {
  const response = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: response.status, json };
}
async function signInForSeeding() {
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: server.password }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
}
let seedAt = 1_790_000_000_000;
const item = (list, id) => ({ list, id, rev: 1 });
async function add(list, text, type = 'task') {
  const id = newId();
  const made = await http('POST', '/api/journal', { op: 'add', list, at: (seedAt += 1000), entry: { id, type, text } });
  if (made.status !== 200) throw new Error('seed ' + made.status);
  return item(list, id);
}
async function change(it, op, extra) {
  const made = await http('POST', '/api/journal', { op, list: it.list, id: it.id, rev: it.rev, ...extra });
  if (made.status !== 200) throw new Error('change ' + made.status + ' ' + JSON.stringify(made.json));
  it.rev += 1;
}
const reset = () => { const s = server.journalStore; s.entries.clear(); s.lines.clear(); s.spanFiles.clear(); s.creates.length = 0; s.state.quick = null; server.requests.length = 0; };

async function open(viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  await context.clock.install({ time: NOW });
  await context.clock.resume();
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/401/.test(m.text())) page.errors.push(m.text()); });
  return { context, page };
}
async function signIn(page, hash = '') {
  await page.goto(BASE + '/journal' + hash);
  await page.waitForSelector('#login:not([hidden])');
  await page.fill('#password', server.password);
  await page.click('#login-submit');
  await page.waitForSelector('#app:not([hidden]), #done:not([hidden])');
}
const asks = (needle) => server.requests.filter((r) => r.path.includes(needle)).length;

await signInForSeeding();

/* =====================================================================
   1. The Done list
   ===================================================================== */
{
  reset();
  when('2026-10-20T10:00:00Z');
  const t1 = await add('day:2026-10-20', 'Send the quote');
  const t2 = await add('day:2026-10-20', 'Ring the carrier');
  const t3 = await add('day:2026-10-20', 'Still open');
  const m1 = await add('migrate:2026-10', 'Renew the licence');
  const ev = await add('day:2026-10-20', 'An event', 'event');
  const old = await add('day:2026-09-29', 'Tick in September log');
  when('2026-10-21T09:00:00Z'); await change(t1, 'state', { state: 'done' });
  when('2026-10-22T06:00:00Z'); await change(m1, 'state', { state: 'done' });
  when('2026-10-22T07:30:00Z'); await change(t2, 'state', { state: 'done' });
  when('2026-10-22T08:00:00Z'); await change(old, 'state', { state: 'done' });
  when('2026-10-22T11:00:00Z'); await change(t2, 'edit', { text: 'Ring the carrier back' });
  void t3; void ev;

  const { context, page } = await open();
  await signIn(page);
  check('the header has a Done button with a tick icon', await page.evaluate(() => !!document.querySelector('#done-open svg use[href="#j-tick"]') && document.getElementById('done-open').textContent.trim() === 'Done'));
  const before = asks('view=done');
  await page.click('#done-open');
  await page.waitForSelector('#done:not([hidden]) .done-row');
  eq('the Done view is the whole window: the panels and the tab bar are hidden', await page.evaluate(() => [document.getElementById('app').hidden, document.getElementById('tabbar').hidden, document.getElementById('done').hidden]), [true, true, false]);
  eq('it has its own address', await page.evaluate(() => location.hash), '#done/2026-10');
  eq('the month is the current one first', await page.textContent('#done-month'), 'October 2026');
  eq('days newest first, each by the day the tick was written', await page.locator('.done-day').allInnerTexts(), ['Thursday 22 October', 'Wednesday 21 October']);
  eq('within a day, newest tick first, with the newest text of an edited task',
    await page.locator('.done-row .done-text').allInnerTexts(), ['Tick in September log', 'Ring the carrier back', 'Renew the licence', 'Send the quote']);
  eq('each row says which log it sits in',
    await page.locator('.done-row .done-log').allInnerTexts(), ['Log: Tue 29 Sept', 'Log: Tue 20 Oct', 'Log: Migrate, October 2026', 'Log: Tue 20 Oct']);
  eq('open tasks, events and nothing else are left out', (await page.locator('.done-row').count()), 4);
  check('read only: no button, field or checkbox inside the list', await page.evaluate(() => !document.querySelector('#done-groups button, #done-groups input, #done-groups [contenteditable], #done-groups a')));
  eq('opening it asked the server for the Done list once', asks('view=done') - before, 1);
  await page.screenshot({ path: SHOTS + '/done-list.png' });

  // changing the month
  await page.click('#done-prev');
  await page.waitForSelector('#done-empty:not([hidden])');
  eq('an empty month says so', await page.textContent('#done-empty'), 'Nothing completed in September 2026.');
  eq('the address follows the month', await page.evaluate(() => location.hash), '#done/2026-09');
  eq('the next arrow is off on the current month only', await page.evaluate(() => document.getElementById('done-next').disabled), false);
  await page.click('#done-next');
  await page.waitForSelector('.done-row');
  check('the current month has no next arrow', await page.evaluate(() => document.getElementById('done-next').disabled));
  const again = asks('view=done');
  await page.click('#done-prev'); await page.click('#done-next');
  await sleep(300);
  eq('going back to a month already seen asks nothing', asks('view=done') - again, 0);

  // refresh keeps it
  await page.reload();
  await page.waitForSelector('#done:not([hidden]) .done-row');
  eq('a refresh keeps the Done view and its month', [await page.evaluate(() => location.hash), await page.textContent('#done-month')], ['#done/2026-10', 'October 2026']);
  await page.click('#done-prev');
  await page.waitForSelector('#done-empty:not([hidden])');
  await page.reload();
  await page.waitForSelector('#done:not([hidden])');
  eq('a refresh keeps an earlier month too', await page.textContent('#done-month'), 'September 2026');
  await context.close();
}
{
  reset();
  when('2026-10-21T09:00:00Z');
  const t = await add('day:2026-10-21', 'Back button task');
  await change(t, 'state', { state: 'done' });
  const { context, page } = await open();
  await signIn(page);
  await page.click('#done-open');
  await page.waitForSelector('.done-row');
  await page.click('#done-back');
  await page.waitForSelector('#app:not([hidden])');
  eq('Back puts the panels back and the address as it was', await page.evaluate(() => [location.hash, document.getElementById('done').hidden]), ['', true]);
  await page.click('#done-open');
  await page.waitForSelector('.done-row');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#app:not([hidden])');
  eq('Escape closes it', await page.evaluate(() => [location.hash, document.getElementById('done').hidden]), ['', true]);
  await page.click('#done-open');
  await page.waitForSelector('.done-row');
  await page.goBack();
  await page.waitForSelector('#app:not([hidden])');
  check('the browser Back button closes it', await page.evaluate(() => document.getElementById('done').hidden && location.hash === ''));
  await page.goForward();
  await page.waitForSelector('#done:not([hidden]) .done-row');
  check('and Forward opens it again', await page.evaluate(() => location.hash === '#done/2026-10'));
  // sign out empties it
  await page.click('#done-back');
  await page.click('#sign-out');
  await page.waitForSelector('#login:not([hidden])');
  eq('signed out: no Done list is left on the page', await page.evaluate(() => [document.getElementById('done-groups').textContent, document.getElementById('done').hidden, document.getElementById('bar-actions').hidden]), ['', true, true]);
  check('no page error', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
}
{
  // a phone
  reset();
  when('2026-10-21T09:00:00Z');
  const t = await add('day:2026-10-21', 'A phone sized task with a long line of words that wraps onto a second line when the window is narrow');
  await change(t, 'state', { state: 'done' });
  const { context, page } = await open({ width: 390, height: 800 });
  await signIn(page);
  check('390px: the header fits without a sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.click('#done-open');
  await page.waitForSelector('.done-row');
  check('390px: the Done view fits without a sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: SHOTS + '/done-list-390.png' });
  await context.close();
}

/* =====================================================================
   2. Searching the calendar
   ===================================================================== */
{
  reset();
  when('2026-03-02T09:00:00Z');
  await add('day:2026-03-04', 'Dentist forms in March');
  await http('POST', '/api/journal', { op: 'line', date: '2026-03-04', rev: 0, text: 'DENTIST in the morning' });
  when('2026-10-05T09:00:00Z');
  await add('day:2026-10-23', 'Pick up dentist letter');
  await add('migrate:2026-10', 'Migrate dentist thing', 'task');
  await add('day:2026-10-25', 'Unrelated');
  await http('POST', '/api/journal', { op: 'spanAdd', span: { id: newId(), start: '2026-11-02', end: '2026-11-04', text: 'Dentist away' } });
  const { context, page } = await open();
  await signIn(page);
  check('the search field is at the top of the Month panel', await page.evaluate(() => { const f = document.getElementById('month-search'); const p = document.getElementById('panel-month'); return f.placeholder === 'Search calendar' && p.firstElementChild.contains(f); }));
  const everything = () => asks('view=all');
  await page.fill('#month-search', 'DENTIST');
  await page.waitForSelector('#search-results:not([hidden]) .search-result');
  eq('the first search read everything once', everything(), 1);
  eq('results replace the month list', await page.evaluate(() => [document.getElementById('date-rows').hidden, document.getElementById('search-results').hidden]), [true, false]);
  eq('case is ignored, and every month, span, line and entry is found, newest first',
    await page.locator('.search-result').evaluateAll((els) => els.map((e) => [e.querySelector('.result-meta').children[0].textContent, e.querySelector('.result-text').textContent, e.querySelector('.result-meta').children[1].textContent])),
    [
      ['Mon 2 Nov 2026', 'Dentist away', 'Span to 4 Nov'],
      ['Fri 23 Oct 2026', 'Pick up dentist letter', 'Tomorrow'],
      ['October 2026', 'Migrate dentist thing', 'Migrate'],
      ['Wed 4 Mar 2026', 'DENTIST in the morning', 'Calendar'],
      ['Wed 4 Mar 2026', 'Dentist forms in March', 'Month'],
    ]);
  await page.screenshot({ path: SHOTS + '/search-results.png' });
  await page.fill('#month-search', 'dentist forms');
  await sleep(500);
  eq('a narrower search shows fewer results', await page.locator('.search-result').count(), 1);
  eq('a second search asks the server nothing', everything(), 1);
  await page.fill('#month-search', 'zzz');
  await page.waitForSelector('#search-empty:not([hidden])');
  eq('no results says what was searched for', await page.textContent('#search-empty'), 'Nothing in the calendar contains zzz.');
  await page.fill('#month-search', 'dentist');
  await page.waitForSelector('.search-result');
  // click a March result: Month jumps to that date and opens its log
  await page.locator('.search-result', { hasText: 'Dentist forms in March' }).click();
  await page.waitForSelector('#day-view:not([hidden])');
  eq('a result opens the log of its date', await page.textContent('#day-date'), 'Wednesday 4 March');
  eq('and the log shows the entry', await page.locator('#list-day .entry-text').allInnerTexts(), ['Dentist forms in March']);
  await page.click('#day-back');
  await page.waitForSelector('#search-results:not([hidden])');
  check('Back from the log shows the results again', (await page.locator('.search-result').count()) === 5);
  eq('Month sits on the month of the result', await page.textContent('#month-title'), 'March 2026');
  // clearing restores the month
  await page.fill('#month-search', '');
  await page.waitForSelector('#date-rows:not([hidden])');
  eq('clearing the field restores the month', await page.evaluate(() => [document.getElementById('search-results').hidden, document.getElementById('date-rows').children.length]), [true, 31]);
  // Escape clears
  await page.fill('#month-search', 'dentist');
  await page.waitForSelector('.search-result');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#date-rows:not([hidden])');
  check('Escape in the field clears it', await page.evaluate(() => document.getElementById('month-search').value === ''));
  // a result for today's log goes to the Today panel; a Migrate result goes to the Migrate panel
  await page.fill('#month-search', 'dentist');
  await page.waitForSelector('.search-result');
  await page.locator('.search-result', { hasText: 'Migrate dentist thing' }).click();
  check('a Migrate result shows the Migrate panel', await page.evaluate(() => document.getElementById('panel-migrate').getAttribute('data-active') === 'true'));
  // an edit made in the window is found without asking again
  await page.fill('#month-search', '');
  await page.locator('#addbar-today .editor-line').click();
  await page.keyboard.type('Dentist booked today');
  await page.keyboard.press('Enter');
  await page.fill('#month-search', 'booked today');
  await page.waitForSelector('.search-result');
  eq('an entry just added is found, from the page itself', [await page.locator('.search-result').count(), await page.locator('.result-meta').first().evaluate((e) => e.children[1].textContent)], [1, 'Today']);
  eq('still only one read of everything', everything(), 1);
  check('no page error', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
}

/* =====================================================================
   3. Quick notes bullets
   ===================================================================== */
{
  reset();
  const { context, page } = await open();
  await signIn(page);
  const quick = page.locator('#quick-editor');
  const stored = () => page.evaluate(() => {
    // The stored text is what the page would send.
    return [...document.getElementById('quick-editor').childNodes].map((n) => n.nodeType === 3 ? n.nodeValue : n.nodeName === 'DIV' ? n.textContent : '').join('\n');
  });
  void stored;
  const saved = async () => { await page.click('#panel-month .month-search input'); await sleep(400); return (server.journalStore.state.quick || {}).text; };
  check('there is a bullet button next to bold and strike-through', await page.evaluate(() => { const b = [...document.querySelectorAll('#panel-quick .quick-tools .fmt-button')].map((x) => x.getAttribute('aria-label')); return JSON.stringify(b) === JSON.stringify(['Bold', 'Strike-through', 'Bullet list']); }));
  await quick.click();
  await page.keyboard.type('- first');
  eq('"- " at the start of a line becomes a bullet', await quick.evaluate((e) => e.textContent.replace(/ /g, ' ')), '• first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  eq('Enter on a bullet line starts a new bullet', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ')), '• first\n• second');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  eq('Enter on an empty bullet ends the list', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').replace(/\n+$/, '')), '• first\n• second');
  await page.keyboard.type('plain line');
  eq('and what is typed next is plain', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), 'plain line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('* star');
  eq('"* " makes a bullet as well', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), '• star');
  await page.screenshot({ path: SHOTS + '/quick-bullets.png' });
  const text = await saved();
  eq('stored as plain text with the bullet and a space', text, '• first\n• second\nplain line\n• star');

  // the button
  await quick.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('abc');
  await page.click('#panel-quick .fmt-bullet');
  eq('the button turns the line into a bullet', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), '• abc');
  eq('and the button shows it is on', await page.getAttribute('#panel-quick .fmt-bullet', 'aria-pressed'), 'true');
  await page.keyboard.type('d');
  eq('the caret stays where it was', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), '• abcd');
  await page.click('#panel-quick .fmt-bullet');
  eq('and back again', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), 'abcd');
  eq('the button shows it is off', await page.getAttribute('#panel-quick .fmt-bullet', 'aria-pressed'), 'false');
  // a bullet in the middle of a line is not a bullet line
  await page.keyboard.type(' and - dash');
  eq('a dash inside a line is left alone', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ').split('\n').pop()), 'abcd and - dash');
  // empty editor and the button
  await quick.evaluate((e) => { e.textContent = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await quick.click();
  await page.click('#panel-quick .fmt-bullet');
  await page.keyboard.type('only');
  eq('the button works in an empty box', await quick.evaluate((e) => e.innerText.replace(/ /g, ' ')), '• only');
  check('no page error', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed${failed.length ? ', FAILED: ' + failed.map((f) => f.name).join('; ') : ''}`);
process.exit(failed.length ? 1 : 0);
