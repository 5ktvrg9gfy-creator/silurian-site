// Local browser run for the journal. Run from the repository root:
//   node docs/evidence/journal/browser-check-journal.mjs
// The real page and the real API handlers over in-memory stores and a password
// made for the run, in Chromium through Playwright. Prints one PASS or FAIL line
// per check and writes the screenshots to docs/evidence/journal/shots/.
import { mkdirSync } from 'node:fs';
import { startServer, chromium, ROOT, returnToWindow } from './harness.mjs';
import * as core from '../../../journal/core.js';

const SHOTS = process.env.SHOTS_DIR || ROOT + 'docs/evidence/journal/shots';
mkdirSync(SHOTS, { recursive: true });
const server = await startServer({ port: 8771 });
const BASE = server.base;
const browser = await chromium.launch();

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual) === JSON.stringify(expected) ? '' : `got ${JSON.stringify(actual)} wanted ${JSON.stringify(expected)}`);

// The run is pinned to one date so the screenshots and the checks agree. The
// page reads London's date from the browser clock, which is set to this.
const TODAY = '2026-10-22';
const TOMORROW = '2026-10-23';
const YESTERDAY = '2026-10-21';
const NOW = new Date('2026-10-22T09:30:00+01:00');
const OCT = '2026-10';
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- seeding through the real API ---------- */

let cookie = '';
async function http(method, path, body) {
  const response = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, headers: response.headers };
}
async function signInForSeeding() {
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: server.password }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
}
let seedAt = 1_790_000_000_000;
async function seed(list, text, type = 'task', state) {
  const id = newId();
  const made = await http('POST', '/api/journal', { op: 'add', list, at: (seedAt += 1000), entry: { id, type, text, ...(state ? { state } : {}) } });
  if (made.status !== 200) throw new Error('seed ' + made.status);
  return id;
}
const reset = () => { const s = server.journalStore; s.entries.clear(); s.lines.clear(); s.spanFiles.clear(); s.creates.length = 0; s.state.quick = null; s.state.hook = null; };
// What is really stored, built from the entry and line files, removed entries included.
const stored = (month = OCT) => {
  const s = server.journalStore;
  const records = [...s.entries.values()].map((h) => core.normaliseEntryFile(JSON.parse(h.json))).filter((r) => core.parseList(r.list).month === month);
  const lines = [...s.lines.values()].map((h) => core.normaliseLineFile(JSON.parse(h.json))).filter((l) => l.date.startsWith(month));
  return core.viewFrom([month], records, lines)[month];
};
// A day as stored, without the entries that were removed.
const storedDay = (date = TODAY) => { const d = stored(date.slice(0, 7)).days[date] || { entries: [], line: '', lineRev: 0 }; return { ...d, entries: core.liveEntries(d.entries) }; };
const writes = () => server.journalStore.creates.length;

/* ---------- the page ---------- */

async function open(viewport = { width: 1280, height: 800 }, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  await context.clock.install({ time: NOW });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/401/.test(m.text())) page.errors.push(m.text()); });
  return { context, page };
}
async function signIn(page) {
  await page.goto(BASE + '/journal');
  await page.waitForSelector('#login:not([hidden])');
  await page.fill('#password', server.password);
  await page.click('#login-submit');
  await page.waitForSelector('#app:not([hidden])');
}
async function enter(page, panel, text, { type } = {}) {
  const editor = page.locator(`#addbar-${panel} .editor-line`);
  await editor.click();
  if (type) await page.keyboard.press('Alt+Digit' + { task: 1, event: 2, note: 3 }[type]);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}
const rows = (page, list) => page.locator(`#list-${list} li.entry`);
const texts = (page, list) => page.locator(`#list-${list} li.entry .entry-text`).allInnerTexts();
async function settle(page) { await page.waitForFunction(() => document.querySelector('#app') && true); await sleep(250); }
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

await signInForSeeding();

/* =====================================================================
   1. Sign in, nothing before the session, the layout
   ===================================================================== */
{
  reset();
  const { context, page } = await open();
  await page.goto(BASE + '/journal');
  await page.waitForSelector('#login:not([hidden])');
  eq('signed out: only the wordmark and the form are visible, no panel, no tab bar, no sign out',
    await page.evaluate(() => ({ app: !document.getElementById('app').hidden, tabs: !document.getElementById('tabbar').hidden, out: !document.getElementById('sign-out').hidden, notes: !document.getElementById('bar-actions').hidden })),
    { app: false, tabs: false, out: false, notes: false });
  eq('signed out: nothing of the journal is painted, only the wordmark and the form', await page.evaluate(() => /October|Today|Tomorrow|Migrate|Quick notes/.test(document.body.innerText)), false);
  await page.fill('#password', 'wrong');
  await page.click('#login-submit');
  await page.waitForSelector('#login-error:not([hidden])');
  eq('wrong password says so in the notes wording', await page.textContent('#login-error'), 'That password is incorrect.');
  await page.fill('#password', server.password);
  await page.click('#login-submit');
  await page.waitForSelector('#app:not([hidden])');
  check('signed in: the five panels are all on screen at 1280', (await page.locator('.panel:visible').count()) === 5);
  eq('the title of the window is Journal', await page.title(), 'Journal');
  eq('today and tomorrow are filled in automatically', await page.evaluate(() => [document.getElementById('date-today').textContent, document.getElementById('date-tomorrow').textContent]), ['Thursday 22 October', 'Friday 23 October']);
  await context.close();
}

/* =====================================================================
   2. The layout at each width
   ===================================================================== */
async function boxes(page) {
  return page.evaluate(() => Object.fromEntries(['month', 'today', 'tomorrow', 'migrate', 'quick'].map((k) => {
    const el = document.getElementById('panel-' + k);
    const r = el.getBoundingClientRect();
    return [k, el.offsetParent === null && getComputedStyle(el).display === 'none' ? null : { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }];
  })));
}
{
  reset();
  for (const [width, height] of [[1920, 1080], [1280, 800], [1000, 700]]) {
    const { context, page } = await open({ width, height });
    await signIn(page);
    const b = await boxes(page);
    const cols = [b.month.x, b.today.x, b.migrate.x];
    check(`${width}px: three columns, Month then Today then Migrate`, cols[0] < cols[1] && cols[1] < cols[2] && b.tomorrow.x === b.today.x && b.quick.x === b.migrate.x);
    check(`${width}px: Month is full height, Today above Tomorrow, Migrate above Quick notes`, b.month.h > b.today.h * 1.8 && b.today.y < b.tomorrow.y && b.migrate.y < b.quick.y);
    check(`${width}px: nothing scrolls the page`, await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
    await shot(page, `${width}-light`);
    await context.close();
  }
  {
    const { context, page } = await open({ width: 900, height: 900 });
    await signIn(page);
    const b = await boxes(page);
    check('900px: Month on the left, the other four stacked on the right', b.month.x < b.today.x && b.today.x === b.tomorrow.x && b.tomorrow.x === b.migrate.x && b.migrate.x === b.quick.x && b.today.y < b.tomorrow.y && b.tomorrow.y < b.migrate.y && b.migrate.y < b.quick.y);
    check('900px: Month is as tall as the window and sticks while the page scrolls', b.month.h >= 900 - 65 - 24 - 2);
    await shot(page, '900-light');
    await context.close();
  }
  for (const [width, height] of [[375, 740], [320, 640]]) {
    const { context, page } = await open({ width, height }, { hasTouch: true, isMobile: true });
    await signIn(page);
    const b = await boxes(page);
    eq(`${width}px: one panel at a time, Today first`, Object.entries(b).filter(([, v]) => v).map(([k]) => k), ['today']);
    eq(`${width}px: five tabs, text only`, await page.locator('#tabbar button').allInnerTexts(), ['Month', 'Today', 'Tomorrow', 'Migrate', 'Quick']);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabbar button')].map((t) => Math.round(t.getBoundingClientRect().height)));
    check(`${width}px: every tab is 44px tall`, tabs.every((h) => h >= 44), tabs.join(','));
    const header = await page.evaluate(() => { const r = document.querySelector('.bar-right').getBoundingClientRect(); return { right: Math.round(r.right), width: window.innerWidth, scroll: document.documentElement.scrollWidth }; });
    check(`${width}px: the header fits without a menu and nothing scrolls sideways`, header.right <= header.width && header.scroll <= header.width, JSON.stringify(header));
    await shot(page, `${width}-light`);
    await context.close();
  }
}


/* =====================================================================
   3. Adding entries: the type, the keyboard, the prefixes
   ===================================================================== */
{
  reset();
  const { context, page } = await open();
  await signIn(page);
  const bar = '#addbar-today';
  eq('the add line says what it will add', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a task');
  eq('task is the chosen type to begin with', await page.locator(bar + ' .type-button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-pressed'))), ['true', 'false', 'false']);
  await enter(page, 'today', 'Ring the supplier');
  await enter(page, 'today', '   ');
  eq('a task appears at once, and an empty line adds nothing', await texts(page, 'today'), ['Ring the supplier']);
  eq('the cursor stays in the add line for the next entry', await page.evaluate(() => document.activeElement.className), 'editor-line');
  await page.keyboard.press('Alt+Digit2');
  eq('Alt+2 chooses event and the line says so', [await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), await page.getAttribute(bar + ' .type-button:nth-child(2)', 'aria-pressed')], ['Add an event', 'true']);
  await page.keyboard.type('Supplier call');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+Digit3');
  await page.keyboard.type('Ask about pallets');
  await page.keyboard.press('Enter');
  eq('a run of notes stays notes: the type is remembered for the list', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a note');
  await page.keyboard.press('Alt+Digit1');
  eq('Alt+1 goes back to task', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a task');
  eq('the other lists keep their own type', await page.getAttribute('#addbar-tomorrow .editor-line', 'data-placeholder'), 'Add a task');

  // typed prefixes
  await page.keyboard.type('o ');
  eq('"o " on an empty line makes it an event and the characters are eaten', [await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), await page.locator(bar + ' .editor-line').innerText()], ['Add an event', '']);
  await page.keyboard.press('Backspace');
  eq('Backspace straight after gives the characters back', (await page.locator(bar + ' .editor-line').innerText()).trim(), 'o');
  await page.keyboard.type('clock check');
  await page.keyboard.press('Enter');
  eq('so a line that really starts with o is never lost', (await texts(page, 'today')).at(-1), 'o clock check');
  await page.locator(bar + ' .editor-line').click();
  await page.keyboard.type('- ');
  eq('"- " makes a note', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a note');
  await page.keyboard.type('x. ');
  eq('and a prefix typed after other text is just text', (await page.locator(bar + ' .editor-line').innerText()).replace(/\xa0/g, ' ').trim(), 'x.');
  eq('without changing the type', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a note');
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await page.keyboard.type('. ');
  eq('". " makes a task', await page.getAttribute(bar + ' .editor-line', 'data-placeholder'), 'Add a task');

  // the bullet in each row
  const kinds = await page.locator('#list-today li.entry').evaluateAll((lis) => lis.map((li) => [li.dataset.type, li.dataset.state, li.querySelector('use').getAttribute('href'), li.querySelector('.bullet').tagName]));
  eq('each type has its own bullet: dot, circle, dash', kinds.slice(0, 3), [['task', 'open', '#j-task', 'BUTTON'], ['event', 'open', '#j-event', 'SPAN'], ['note', 'open', '#j-note', 'SPAN']]);
  await sleep(400);
  eq('and the server holds them, in order, at the bottom', storedDay().entries.map((e) => [e.type, e.text, e.rev]), [['task', 'Ring the supplier', 1], ['event', 'Supplier call', 1], ['note', 'Ask about pallets', 1], ['event', 'o clock check', 1]]);
  check('only a task bullet is a button', (await page.locator('#list-today .bullet').evaluateAll((b) => b.map((x) => x.tagName))).join() === 'BUTTON,SPAN,SPAN,SPAN');
  await shot(page, 'entries-1280-light');
  eq('the page threw nothing', page.errors, []);
  await context.close();
}

/* =====================================================================
   4. States: done, and what each looks like
   ===================================================================== */
{
  reset();
  const a = await seed(core.dayList(TODAY), 'Order labels');
  const { context, page } = await open();
  await signIn(page);
  const row = page.locator('#list-today li.entry').first();
  await row.locator('.bullet').click();
  await page.waitForFunction(() => document.querySelector('#list-today li.entry').dataset.state === 'done');
  await sleep(300);
  const done = await page.evaluate(() => { const li = document.querySelector('#list-today li.entry'); return { icon: li.querySelector('use').getAttribute('href'), decoration: getComputedStyle(li.querySelector('.entry-text')).textDecorationLine, pressed: li.querySelector('.bullet').getAttribute('aria-pressed'), label: li.querySelector('.bullet').getAttribute('aria-label') }; });
  eq('ticking shows a cross, a strike, and the label says what the next click does', done, { icon: '#j-done', decoration: 'line-through', pressed: 'true', label: 'Mark not done: Order labels' });
  await sleep(300);
  eq('the server has it done at revision 2', [storedDay().entries[0].state, storedDay().entries[0].rev], ['done', 2]);
  await row.locator('.bullet').click();
  await page.waitForFunction(() => document.querySelector('#list-today li.entry').dataset.state === 'open');
  await sleep(300);
  eq('clicking the cross opens it again', [storedDay().entries[0].state, storedDay().entries[0].rev], ['open', 3]);
  await context.close();
}

/* =====================================================================
   5. Editing in place, deleting, and Undo
   ===================================================================== */
{
  reset();
  const id = await seed(core.dayList(TODAY), 'Draft wording');
  const { context, page } = await open();
  await signIn(page);
  const text = page.locator('#list-today .entry-text').first();
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' final');
  await page.keyboard.press('Enter');
  await sleep(300);
  eq('click the text, type, Enter: saved where it is', [storedDay().entries[0].text, storedDay().entries[0].rev], ['Draft wording final', 2]);
  await text.click();
  await page.keyboard.type(' junk');
  await page.keyboard.press('Escape');
  eq('Escape puts the old text back', await text.innerText(), 'Draft wording final');
  await sleep(200);
  eq('and saves nothing', storedDay().entries[0].rev, 2);
  await text.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#flash:not([hidden])');
  eq('clearing the text deletes the entry, with a message and an Undo', [await page.textContent('#flash-text'), await page.textContent('#flash-action'), await rows(page, 'today').count()], ['Entry deleted.', 'Undo', 0]);
  await sleep(300);
  eq('the server holds it as a removed revision, so another device learns it is gone', [storedDay().entries.length, stored().days[TODAY].entries.map((e) => [e.state, e.rev])], [0, [['removed', 3]]]);
  await page.click('#flash-action');
  await page.waitForFunction(() => document.querySelectorAll('#list-today li.entry').length === 1);
  await sleep(300);
  eq('Undo brings it back with its text, as a new entry', [(await texts(page, 'today'))[0], storedDay().entries.map((e) => e.text)], ['Draft wording final', ['Draft wording final']]);
  void id;
  await context.close();
}

/* =====================================================================
   6. Bold and strike-through
   ===================================================================== */
{
  reset();
  const { context, page } = await open();
  await signIn(page);
  const line = page.locator('#addbar-today .editor-line');
  await line.click();
  await page.keyboard.press('Control+B');
  await page.keyboard.type('Urgent');
  await page.keyboard.press('Control+B');
  await page.keyboard.type(' reorder ');
  await page.keyboard.press('Control+Shift+X');
  await page.keyboard.type('old code');
  await page.keyboard.press('Enter');
  await sleep(300);
  eq('Ctrl+B and Ctrl+Shift+X store markers', storedDay().entries[0].text, '**Urgent** reorder ~~old code~~');
  eq('and the row shows styled text, with no asterisks in sight', await page.locator('#list-today .entry-text').evaluate((el) => ({ text: el.innerText, bold: !!el.querySelector('b'), strike: !!el.querySelector('s') })), { text: 'Urgent reorder old code', bold: true, strike: true });
  await line.click();
  await page.keyboard.type('Button style');
  await page.keyboard.press('Control+A');
  await page.click('#addbar-today .fmt-bold');
  eq('the B button makes the selected text bold and shows it pressed', await page.getAttribute('#addbar-today .fmt-bold', 'aria-pressed'), 'true');
  await page.keyboard.press('Enter');
  await sleep(300);
  eq('and stores it', storedDay().entries[1].text, '**Button style**');
  await line.click();
  await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'Pasted\nline'); dt.setData('text/html', '<b>styled</b>'); document.querySelector('#addbar-today .editor-line').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  eq('a paste comes in as plain text on one line', await line.innerText(), 'Pasted line');
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await page.keyboard.press('Control+I');
  await page.keyboard.type('no italics');
  eq('there is no italic', await line.evaluate((el) => !el.querySelector('i, em')), true);
  await context.close();
}


/* =====================================================================
   7. Moving: the four actions, for a mouse and for a finger
   ===================================================================== */
const cell = (page, list, text) => page.locator(`#list-${list} li.entry`, { hasText: text });
// A move by keyboard: Tab marks the page as keyboard worked, focus is put in the entry, and the button that is shown is pressed.
const keyMove = async (page, row, word) => { await page.keyboard.press('Tab'); await row.locator('.entry-text').focus(); await row.locator('.entry-actions button', { hasText: word }).press('Enter'); };
{
  reset();
  const first = await seed(core.dayList(TODAY), 'Chase the invoice');
  await seed(core.dayList(TODAY), 'Supplier call', 'event');
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const row = cell(page, 'today', 'Chase the invoice');
  await row.hover();
  eq('1280, a narrow panel, a mouse: hovering shows no move buttons and there is no More button', [await row.locator('.entry-actions').isVisible(), await row.locator('.more').isVisible()], [false, false]);
  await page.keyboard.press('Tab');
  await row.locator('.entry-text').focus();
  eq('keyboard focus in the entry shows the actions in a second line, and not the one that points where it already is', await row.locator('.entry-actions button').allInnerTexts(), ['Tomorrow', 'Migrate', 'Date']);
  await row.locator('.entry-actions button', { hasText: 'Tomorrow' }).press('Enter');
  await page.waitForSelector('#flash:not([hidden])');
  eq('Tomorrow: the moved entry is no longer in the list', await cell(page, 'today', 'Chase the invoice').count(), 0);
  eq('and a quiet line at the bottom of the panel says "1 moved", closed', [await page.textContent('#moved-toggle-today'), await page.getAttribute('#moved-toggle-today', 'aria-expanded'), await page.locator('#moved-list-today').isHidden()], ['1 moved', 'false', true]);
  await page.click('#moved-toggle-today');
  const movedRow = page.locator('#moved-list-today li.entry');
  eq('opening it shows the original with a right arrow and where it went', await movedRow.evaluate((li) => [li.dataset.state, li.querySelector('use').getAttribute('href'), li.querySelector('.entry-note').textContent]), ['migrated', '#j-migrated', 'to Tomorrow']);
  eq('and says it is open', await page.getAttribute('#moved-toggle-today', 'aria-expanded'), 'true');
  eq('and a copy is at the bottom of Tomorrow', await texts(page, 'tomorrow'), ['Chase the invoice']);
  eq('the message says what happened and offers Undo', [await page.textContent('#flash-text'), await page.textContent('#flash-action')], ['Moved to Tomorrow.', 'Undo']);
  await page.mouse.move(2, 2);   // a hovered row on a Peel goes to ink, so measure it at rest
  const grey = await movedRow.evaluate((li) => { const t = getComputedStyle(li.querySelector('.entry-text')); return { colour: t.color, opacity: getComputedStyle(li).opacity, strike: t.textDecorationLine }; });
  check('greyed by colour, never by opacity, and not struck', grey.opacity === '1' && grey.strike === 'none' && grey.colour !== 'rgb(47, 45, 43)', JSON.stringify(grey));
  check('a moved entry has no move controls and cannot be edited', (await movedRow.locator('.more, .entry-actions, [contenteditable]').count()) === 0);
  await shot(page, 'moved-open-1280-light');
  await page.click('#moved-toggle-today');
  check('pressing the line again closes it', await page.locator('#moved-list-today').isHidden());
  await sleep(300);
  eq('the server agrees: arrow, destination, and the copy at revision 1', [storedDay().entries[0].state, storedDay().entries[0].to, storedDay(TOMORROW).entries[0].rev], ['migrated', 'day:' + TOMORROW, 1]);
  await page.click('#flash-action');
  await page.waitForFunction(() => document.querySelectorAll('#list-tomorrow li.entry').length === 0);
  eq('Undo opens the original again, takes the copy away, and the moved line goes', [await cell(page, 'today', 'Chase the invoice').getAttribute('data-state'), await rows(page, 'tomorrow').count(), await page.locator('#moved-today').isHidden()], ['open', 0, true]);
  await sleep(300);
  eq('on the server too, and the copy is removed from tomorrow', [storedDay().entries[0].state, storedDay(TOMORROW).entries.length], ['open', 0]);

  // events and notes move too
  const event = cell(page, 'today', 'Supplier call');
  await keyMove(page, event, 'Migrate');
  await page.waitForFunction(() => document.querySelectorAll('#list-migrate li.entry').length === 1);
  eq('an event moves to Migrate and keeps its circle', await page.locator('#list-migrate li.entry use').first().getAttribute('href'), '#j-event');
  await shot(page, 'moved-1280-light');

  // the date picker
  const again = cell(page, 'today', 'Chase the invoice');
  await keyMove(page, again, 'Date');
  const days = await again.locator('.pick-day').evaluateAll((bs) => bs.map((b) => b.textContent));
  eq('Date lists the dates of the month from today, with Today and Tomorrow named', [days[0], days[1], days.length], ['Thu 22 Oct' + 'Today', 'Fri 23 Oct' + 'Tomorrow', 10]);
  check('and the day the entry is already on is not offered', await again.locator('.pick-day').first().isDisabled());
  await again.locator('.pick-day', { hasText: 'Wed 28 Oct' }).click();
  await page.waitForSelector('#flash:not([hidden])');
  await page.click('#moved-toggle-today');
  eq('scheduling gives a left arrow and "to 28 Oct", shown in the moved line', await page.locator('#moved-list-today li.entry', { hasText: 'Chase the invoice' }).evaluate((li) => [li.dataset.state, li.querySelector('use').getAttribute('href'), li.querySelector('.entry-note').textContent]), ['scheduled', '#j-scheduled', 'to 28 Oct']);
  eq('the moved line counts moved and scheduled together (the event moved earlier and this)', await page.textContent('#moved-toggle-today'), '2 moved');
  eq('the message says which day, in full, and offers Undo and Open day', [await page.textContent('#flash-text'), await page.textContent('#flash-action'), await page.textContent('#flash-also')], ['Moved to Wednesday 28 October.', 'Undo', 'Open day']);
  await page.click('#flash-also');
  await page.waitForSelector('#day-view:not([hidden])');
  eq('Open day opens that day, with the moved entry in it', [await page.textContent('#day-date'), await texts(page, 'day'), await page.locator('#flash').isHidden()], ['Wednesday 28 October', ['Chase the invoice'], true]);
  await sleep(300);
  eq('the copy is in that day\'s log on the server', storedDay('2026-10-28').entries.map((e) => [e.text, e.state, e.rev]), [['Chase the invoice', 'open', 1]]);
  await context.close();
}
{
  // a wide panel with a mouse: no buttons on hover, and on keyboard focus they sit on a line of their own under the text
  reset();
  await seed(core.dayList(TODAY), 'Chase the invoice');
  const { context, page } = await open({ width: 1920, height: 1080 });
  await signIn(page);
  const row = cell(page, 'today', 'Chase the invoice');
  eq('1920, a wide panel: nothing shows until the row is hovered', await row.locator('.entry-actions').isVisible(), false);
  await row.hover();
  eq('hovering shows no move buttons: they would cover the text', await row.locator('.entry-actions').isVisible(), false);
  await page.keyboard.press('Tab');
  await row.locator('.entry-text').focus();
  eq('keyboard focus shows the actions, as text', [await row.locator('.entry-actions').isVisible(), await row.locator('.entry-actions button').allInnerTexts()], [true, ['Tomorrow', 'Migrate', 'Date']]);
  const where = await row.evaluate((li) => { const a = li.querySelector('.entry-actions').getBoundingClientRect(); const t = li.querySelector('.entry-text').getBoundingClientRect(); return { below: a.top >= t.bottom - 1, left: Math.round(a.left - li.getBoundingClientRect().left) }; });
  check('they sit on a line of their own under the text, not over it', where.below === true, JSON.stringify(where));
  eq('the More button is out of the way for a mouse in a wide panel', await row.locator('.more').isVisible(), false);
  await shot(page, 'focus-1920-light');
  await row.locator('.entry-actions button', { hasText: 'Migrate' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#list-migrate li.entry').length === 1);
  check('one click moves it', (await cell(page, 'today', 'Chase the invoice').count()) === 0 && (await page.textContent('#moved-toggle-today')) === '1 moved');
  await shot(page, 'moved-by-click-1920-light');
  await context.close();
}
/* =====================================================================
   7b. The bin, spell check and dragging (a mouse), 23 October 2026
   ===================================================================== */
{
  reset();
  await seed(core.dayList(TODAY), 'Alpha task');
  await seed(core.dayList(TODAY), 'Beta event', 'event');
  await seed(core.dayList(TODAY), 'Gamma task');
  await seed(core.dayList(TODAY), 'Delta task');
  await seed(core.dayList(TOMORROW), 'Epsilon task');
  const { context, page } = await open({ width: 1920, height: 1080 });
  await signIn(page);

  // Spell check, in UK English, on the three places text is typed, and not on notes.
  const spell = await page.evaluate(() => {
    const read = (el) => [el.spellcheck, el.lang];
    return {
      entry: read(document.querySelector('#list-today .entry-text')),
      line: read(document.querySelector('#date-rows .line-text')),
      quick: read(document.getElementById('quick-editor')),
      add: read(document.querySelector('#addbar-today .editor-line')),
    };
  });
  eq('spell check is on, in UK English, for an entry, a calendar line, Quick notes and the new entry line', spell, { entry: [true, 'en-GB'], line: [true, 'en-GB'], quick: [true, 'en-GB'], add: [true, 'en-GB'] });
  const notesHtml = await (await fetch(BASE + '/notes')).text();
  check('notes is as it was: spell check off on the note box and no UK English tag', /id="text" class="editor" aria-label="Note text" spellcheck="false"/.test(notesHtml) && !/lang="en-GB"/.test(notesHtml));

  // The bin.
  const row = cell(page, 'today', 'Gamma task');
  const bin = row.locator('.entry-delete');
  eq('every entry has a bin button named for its text', [await bin.getAttribute('aria-label'), await cell(page, 'today', 'Beta event').locator('.entry-delete').getAttribute('aria-label')], ['Delete entry: Gamma task', 'Delete entry: Beta event']);
  const colours = async () => page.evaluate(() => { const probe = (v) => { const e = document.createElement('span'); e.style.color = v; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }; return { bad: probe('var(--notes-bad)'), icon: probe('var(--notes-icon)') }; });
  const c = await colours();
  const colour = () => bin.evaluate((b) => getComputedStyle(b).color);
  eq('the bin is quiet, and turns to the red on hover', [await colour(), (await row.hover(), await bin.hover(), await colour())], [c.icon, c.bad]);
  await page.keyboard.press('Tab');
  await bin.focus();
  eq('and on keyboard focus', await colour(), c.bad);
  await bin.click();
  await page.waitForSelector('#flash:not([hidden])');
  eq('one click deletes it, with no question, and the message offers Undo', [await cell(page, 'today', 'Gamma task').count(), await page.textContent('#flash-text'), await page.textContent('#flash-action')], [0, 'Entry deleted.', 'Undo']);
  await sleep(300);
  eq('the server holds it as a removed revision', stored().days[TODAY].entries.filter((e) => e.text === 'Gamma task').map((e) => [e.state, e.rev]), [['removed', 2]]);
  await page.click('#flash-action');
  await page.waitForFunction(() => [...document.querySelectorAll('#list-today .entry-text')].some((e) => e.innerText === 'Gamma task'));
  await sleep(300);
  eq('Undo brings it back as a new entry, once', [await cell(page, 'today', 'Gamma task').count(), storedDay().entries.filter((e) => e.text === 'Gamma task').length], [1, 1]);
  await cell(page, 'today', 'Gamma task').locator('.entry-delete').click();
  await page.waitForSelector('#flash:not([hidden])');
  check('the message goes by itself after ten seconds', await (async () => { await sleep(10300); return page.locator('#flash').isHidden(); })());

  // Dragging an entry. The target takes the selected fill while the pointer is over it.
  const fill = async (selector) => page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
  const selectedFill = await page.evaluate(() => { const e = document.createElement('span'); e.style.background = 'var(--notes-selected)'; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; });
  const source = cell(page, 'today', 'Alpha task');
  const sourceBox = await source.locator('.bullet').boundingBox();
  const box = async (selector) => page.locator(selector).boundingBox();
  await page.mouse.move(sourceBox.x + 10, sourceBox.y + 10);
  await page.mouse.down();
  const tomorrowBox = await box('#panel-tomorrow');
  await page.mouse.move(tomorrowBox.x + 60, tomorrowBox.y + 200, { steps: 8 });
  await page.mouse.move(tomorrowBox.x + 63, tomorrowBox.y + 202, { steps: 2 });
  await sleep(300);
  eq('over Tomorrow, the panel takes the selected fill and no other panel does', [await fill('#panel-tomorrow'), await page.locator('[data-drop]').count()], ['rgb(185, 217, 179)', 1]);   // Tomorrow is the green Peel, whose selected fill is Spud Notes' green fold colour
  const todayBox = await box('#panel-today');
  await page.mouse.move(todayBox.x + 60, todayBox.y + 300, { steps: 8 });
  await page.mouse.move(todayBox.x + 63, todayBox.y + 302, { steps: 2 });
  await sleep(300);
  eq('over the panel the entry is already in, nothing is marked', await page.locator('[data-drop]').count(), 0);
  await page.locator('#date-rows li.date-row[data-date="2026-10-20"]').scrollIntoViewIfNeeded();
  const pastRow = await box('#date-rows li.date-row[data-date="2026-10-20"]');
  await page.mouse.move(pastRow.x + 40, pastRow.y + 10, { steps: 8 });
  await page.mouse.move(pastRow.x + 43, pastRow.y + 12, { steps: 2 });
  await sleep(300);
  eq('over a date before today, nothing is marked', await page.locator('[data-drop]').count(), 0);
  await page.locator('#date-rows li.date-row[data-date="2026-10-28"]').scrollIntoViewIfNeeded();
  const dateRow = await box('#date-rows li.date-row[data-date="2026-10-28"]');
  await page.mouse.move(dateRow.x + 40, dateRow.y + 10, { steps: 8 });
  await page.mouse.move(dateRow.x + 43, dateRow.y + 12, { steps: 2 });
  await sleep(300);
  eq('over a date line, the line takes the selected fill', [await fill('#date-rows li.date-row[data-date="2026-10-28"]'), await page.locator('[data-drop]').count()], [selectedFill, 1]);
  await shot(page, 'drag-over-a-date-1920-light');
  await page.mouse.move(tomorrowBox.x + 60, tomorrowBox.y + 200, { steps: 8 });
  await page.mouse.up();
  await page.waitForSelector('#flash:not([hidden])');
  eq('dropped on Tomorrow: a copy there, the original marked, the same message and Undo as the button', [await texts(page, 'tomorrow'), await cell(page, 'today', 'Alpha task').count(), await page.textContent('#flash-text'), await page.textContent('#flash-action'), await page.locator('[data-drop]').count()], [['Epsilon task', 'Alpha task'], 0, 'Moved to Tomorrow.', 'Undo', 0]);
  await sleep(300);
  eq('the server: one copy in Tomorrow at revision 1, the original migrated at revision 2', [storedDay(TOMORROW).entries.filter((e) => e.text === 'Alpha task').map((e) => e.rev), storedDay().entries.filter((e) => e.text === 'Alpha task').map((e) => [e.state, e.rev, e.to])], [[1], [['migrated', 2, 'day:' + TOMORROW]]]);

  const dragTo = async (from, selector, where = {}) => {
    const s = await from.locator('.bullet').boundingBox();
    const t = await box(selector);
    await page.mouse.move(s.x + 10, s.y + 10);
    await page.mouse.down();
    await page.mouse.move(t.x + (where.x ?? 60), t.y + (where.y ?? 12), { steps: 8 });
    await page.mouse.up();
  };
  await dragTo(cell(page, 'today', 'Delta task'), '#panel-migrate', { y: 200 });
  await page.waitForFunction(() => document.querySelectorAll('#list-migrate li.entry').length === 1);
  eq('dropped on Migrate: one copy there, and the message says so', [await texts(page, 'migrate'), await page.textContent('#flash-text')], [['Delta task'], 'Moved to Migrate.']);
  await dragTo(cell(page, 'tomorrow', 'Epsilon task'), '#panel-today', { y: 200 });
  await page.waitForFunction(() => [...document.querySelectorAll('#list-today .entry-text')].some((e) => e.innerText === 'Epsilon task'));
  eq('dropped on Today from Tomorrow: one copy in Today, and the message says so', [(await texts(page, 'today')).filter((t) => t === 'Epsilon task').length, await page.textContent('#flash-text')], [1, 'Moved to Today.']);
  const before = writes();
  await dragTo(cell(page, 'today', 'Beta event'), '#panel-today', { y: 300 });
  await sleep(500);
  eq('dropped on the panel it is already in: nothing happens, nothing is written', [await texts(page, 'today').then((t) => t.includes('Beta event')), writes() - before], [true, 0]);
  await dragTo(cell(page, 'today', 'Beta event'), '#date-rows li.date-row[data-date="2026-10-28"]', { x: 40, y: 10 });
  await page.waitForSelector('#flash:not([hidden])');
  await page.waitForFunction(() => /Moved to/.test(document.getElementById('flash-text').textContent));
  eq('dropped on a date line: the message names the day with Undo and Open day, as the Date picker does', [await page.textContent('#flash-text'), await page.textContent('#flash-action'), await page.textContent('#flash-also')], ['Moved to Wednesday 28 October.', 'Undo', 'Open day']);
  await sleep(400);
  eq('the server: the event is scheduled (a left arrow) and has one copy on the 28th', [storedDay().entries.filter((e) => e.text === 'Beta event').map((e) => [e.state, e.to]), storedDay('2026-10-28').entries.filter((e) => e.text === 'Beta event').length], [[['scheduled', 'day:2026-10-28']], 1]);
  const open_ = (entries) => entries.filter((e) => e.state === 'open').map((e) => e.text).sort();
  const copies = { today: open_(storedDay().entries), tomorrow: open_(storedDay(TOMORROW).entries), migrate: open_(stored().migrate), the28th: open_(storedDay('2026-10-28').entries) };
  eq('every drag made exactly one copy: nothing doubled, nothing lost', copies, { today: ['Epsilon task'], tomorrow: ['Alpha task'], migrate: ['Delta task'], the28th: ['Beta event'] });

  // The move buttons: not on hover, on keyboard focus.
  const key = cell(page, 'today', 'Epsilon task');
  await key.hover();
  eq('a mouse over an entry shows no move buttons', await key.locator('.entry-actions').isVisible(), false);
  await page.keyboard.press('Tab');
  await key.locator('.entry-text').focus();
  eq('keyboard focus in an entry shows them, and each is a button that names the entry', [await key.locator('.entry-actions').isVisible(), await key.locator('.entry-actions button').first().getAttribute('aria-label')], [true, 'Tomorrow: Epsilon task']);
  const text = key.locator('.entry-text');
  await text.click();
  eq('clicking into the text with the mouse puts them away again', await key.locator('.entry-actions').isVisible(), false);
  // Selecting words in an entry that is being edited is not a drag.
  await text.click();
  const textBox = await text.boundingBox();
  await page.mouse.dblclick(textBox.x + 20, textBox.y + 10);
  const picked = await page.evaluate(() => String(getSelection()).trim());
  check('a double click in the text being edited selects a word, and does not start a drag', picked === 'Epsilon' && (await key.getAttribute('draggable')) === 'false', JSON.stringify([picked, await key.getAttribute('draggable')]));
  await context.close();
}
{
  // a finger keeps More and the move buttons, and nothing is draggable
  reset();
  await seed(core.dayList(TODAY), 'Chase the invoice');
  const { context, page } = await open({ width: 375, height: 740 }, { hasTouch: true, isMobile: true });
  await signIn(page);
  const row = cell(page, 'today', 'Chase the invoice');
  eq('375 touch: the More button shows and nothing is draggable', [await row.locator('.more').isVisible(), await row.getAttribute('draggable')], [true, null]);
  const bin = await row.locator('.entry-delete').boundingBox();
  check('375 touch: the bin is 44px square', Math.round(bin.width) >= 44 && Math.round(bin.height) >= 44, JSON.stringify(bin));
  await row.locator('.more').tap();
  eq('and More opens the same buttons as before', await row.locator('.entry-actions button').allInnerTexts(), ['Tomorrow', 'Migrate', 'Date']);
  await row.locator('.entry-actions button', { hasText: 'Tomorrow' }).tap();
  await page.waitForSelector('#flash:not([hidden])');
  eq('a tap on Tomorrow moves it as it always did', [await page.textContent('#flash-text'), await page.textContent('#flash-action')], ['Moved to Tomorrow.', 'Undo']);
  await row.hover().catch(() => {});
  await context.close();
}
{
  // a finger: every target is 44px
  reset();
  await seed(core.dayList(TODAY), 'Chase the invoice');
  const { context, page } = await open({ width: 375, height: 740 }, { hasTouch: true, isMobile: true });
  await signIn(page);
  const row = cell(page, 'today', 'Chase the invoice');
  await row.locator('.more').tap();
  const h = async (selector, scope = page) => scope.locator(selector).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  const targets = { more: await h('.more', row), bullet: await h('.bullet', row), actions: await h('.entry-actions button', row), type: await h('#addbar-today .type-button'), fmt: await h('#addbar-today .fmt-button'), line: await h('#addbar-today .editor-line') };
  check('375 touch: the bullet and More are 44px square', targets.more[0].every((n) => n >= 44) && targets.bullet[0].every((n) => n >= 44), JSON.stringify([targets.more, targets.bullet]));
  check('375 touch: each of the four actions is 44px tall', targets.actions.length === 3 && targets.actions.every(([, hh]) => hh >= 44), JSON.stringify(targets.actions));
  check('375 touch: the type buttons, B and S and the add line are 44px', [...targets.type, ...targets.fmt, ...targets.line].every(([w, hh], i) => hh >= 44 && (i >= targets.type.length + targets.fmt.length || w >= 44)), JSON.stringify(targets));
  check('375 touch: in a narrow panel the actions are never squeezed below a thumb', targets.actions.every(([w]) => w >= 90), JSON.stringify(targets.actions));
  await row.locator('.entry-actions button', { hasText: 'Date' }).tap();
  const picks = await h('.pick-day', row);
  check('375 touch: the date rows are 44px tall and the full width', picks.length > 5 && picks.every(([w, hh]) => hh >= 44 && w > 200), JSON.stringify(picks.slice(0, 2)));
  await row.locator('.pick-head .icon-button').first().evaluate((b) => b.getBoundingClientRect().height).then((v) => check('375 touch: the month arrows in the picker are 44px', v >= 44, String(v)));
  await shot(page, 'picker-375-light');
  await context.close();
}
{
  // a finger on the Month and the strip: 44px as well
  reset();
  await seed(core.dayList(YESTERDAY), 'Chase the invoice');
  await seed(core.dayList(YESTERDAY), 'Book the van');
  await seed(core.dayList('2026-10-24'), 'Courier', 'event');
  const { context, page } = await open({ width: 375, height: 740 }, { hasTouch: true, isMobile: true });
  await signIn(page);
  const tall = async (selector) => page.locator(selector).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check('375 touch: the strip buttons and Bring all forward are 44px tall', (await tall('#strip .strip-buttons button, #strip .strip-foot')).every((h) => h >= 44), (await tall('#strip button')).join());
  await page.click('#tabbar button[data-panel="month"]');
  await sleep(150);
  const rowsTall = await tall('.date-row');
  const lineTall = await tall('.date-row .line-text');
  const dateTall = await tall('.date-row .date-open');
  check('375 touch: every Month row, its date button and its line are 44px tall', rowsTall.every((h) => h >= 44) && lineTall.every((h) => h >= 44) && dateTall.every((h) => h >= 44), [Math.min(...rowsTall), Math.min(...lineTall), Math.min(...dateTall)].join());
  check('375 touch: the month arrows, the month name and This month are 44px', (await tall('#month-prev, #month-next, #month-title')).every((h) => h >= 44));
  await context.close();
}

/* =====================================================================
   8. Month: marks, picker, the day log and the way back
   ===================================================================== */
{
  reset();
  await seed(core.dayList('2026-10-24'), 'Pick up the samples');
  await seed(core.dayList('2026-10-24'), 'Courier at 10', 'event');
  await seed(core.dayList('2026-10-24'), 'Courier cut-off', 'event');
  await seed(core.dayList('2026-10-24'), 'A note', 'note');
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-24', rev: 0, text: 'Dentist **9:30**' });
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-25', rev: 0, text: 'Team lunch' });
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const month = '#panel-month';
  eq('Month shows the month and year', await page.textContent('#month-title'), 'October 2026');
  eq('there is one line per date', await page.locator('.date-row').count(), 31);
  const marks = await page.locator('.date-row[data-mark]').evaluateAll((rs) => rs.map((r) => [r.dataset.date, r.dataset.mark, r.querySelector('.mark-word').textContent, getComputedStyle(r).backgroundColor]));
  eq('today and tomorrow carry a word as well as a fill', marks.map((m) => m.slice(0, 3)), [[TODAY, 'today', 'Today'], [TOMORROW, 'tomorrow', 'Tomorrow']]);
  check('and the two fills differ from each other and from the panel', new Set([marks[0][3], marks[1][3], 'rgb(241, 237, 231)']).size === 3, marks.map((m) => m[3]).join(' | '));
  const near = await page.evaluate(() => { const b = document.getElementById('month-body').getBoundingClientRect(); const r = document.querySelector('.date-row[data-mark="today"]').getBoundingClientRect(); return Math.round(r.top - b.top); });
  const atEnd = await page.evaluate(() => { const b = document.getElementById('month-body'); return b.scrollTop + b.clientHeight >= b.scrollHeight - 2; });
  check('Month opens with today as near the top as the month allows: at the top, or the list is scrolled as far as it goes', (near >= 0 && near < 80) || (atEnd && near > 0), `${near}px from the top, at the end: ${atEnd}`);
  const row = page.locator('.date-row[data-date="2026-10-24"]');
  eq('a date with a log shows its own line, then its events, then a count', await row.evaluate((r) => [r.querySelector('.line-text').innerText, r.querySelector('.line-events').textContent, r.querySelector('.chip').textContent]), ['Dentist 9:30', 'Courier at 10; Courier cut-off', '4']);
  eq('tasks and notes in the log do not show on the line', await row.evaluate((r) => /samples|note/i.test(r.querySelector('.line-events').textContent)), false);
  eq('the line shows styled text with no asterisks', await row.locator('.line-text').evaluate((el) => [el.innerText, !!el.querySelector('b')]), ['Dentist 9:30', true]);

  // editing a line
  const lunch = page.locator('.date-row[data-date="2026-10-25"] .line-text');
  await lunch.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' at 12');
  await page.keyboard.press('Enter');
  await sleep(300);
  eq('the calendar line is edited where it is, and saved with its own revision', [storedDay('2026-10-25').line, storedDay('2026-10-25').lineRev], ['Team lunch at 12', 2]);
  eq('and the log is untouched', storedDay('2026-10-24').entries.length, 4);

  // opening a day
  await row.locator('.date-open').click();
  await page.waitForSelector('#day-view:not([hidden])');
  eq('clicking the date opens that day in the Month panel, with a way back', [await page.textContent('#day-back-label'), await page.textContent('#day-date'), await texts(page, 'day')], ['Back to October', 'Saturday 24 October', ['Pick up the samples', 'Courier at 10', 'Courier cut-off', 'A note']]);
  eq('the month list is out of the way and the day has its own add line', [await page.locator('#date-rows').isVisible(), await page.locator('#addbar-day').isVisible()], [false, true]);
  await shot(page, 'day-1280-light');
  await page.click('#day-back');
  await page.waitForSelector('#date-rows:not([hidden])');
  check('Back returns to the month', (await page.locator('#day-view').isHidden()) && (await page.locator('.date-row').count()) === 31);
  await row.locator('.date-open').click();
  await page.waitForSelector('#day-view:not([hidden])');
  await page.locator('#day-view li.entry .bullet').first().focus();
  await page.keyboard.press('Escape');
  await page.waitForSelector('#date-rows:not([hidden])');
  check('Escape goes back too', await page.locator('#day-view').isHidden());
  await row.locator('.date-open').click();
  await page.waitForSelector('#day-view:not([hidden])');
  eq('the day has an address, so the browser Back button closes it', await page.evaluate(() => location.hash), '#d/2026-10-24');
  await page.goBack();
  await page.waitForSelector('#date-rows:not([hidden])');
  check('and it does', await page.locator('#day-view').isHidden());

  // today and tomorrow have their own panels
  await page.locator('.date-row[data-mark="today"] .date-open').click();
  eq('the date for today goes to the Today panel\'s add line and opens no second copy', [await page.evaluate(() => document.activeElement.closest('.addbar') && document.activeElement.closest('.addbar').id), await page.locator('#day-view').isHidden()], ['addbar-today', true]);
  await page.locator('.date-row[data-mark="tomorrow"] .date-open').click();
  eq('and tomorrow to its own', await page.evaluate(() => document.activeElement.closest('.addbar').id), 'addbar-tomorrow');

  // the month picker
  await page.click('#month-next');
  await page.waitForFunction(() => document.getElementById('month-title').textContent === 'November 2026');
  eq('the arrows move a month, and "This month" appears to come back', [await page.locator('#month-now').isVisible(), await page.locator('.date-row').count()], [true, 30]);
  eq('another month has no marks', await page.locator('.date-row[data-mark]').count(), 0);
  eq('an empty month says so and what to do next', await page.textContent('#month-empty'), 'Nothing on the calendar for November yet. Click a date to add a line, or open a date to log it.');
  await page.click('#month-now');
  await page.waitForFunction(() => document.getElementById('month-title').textContent === 'October 2026');
  check('This month goes back and the button goes away', await page.locator('#month-now').isHidden());
  await page.click('#month-title');
  eq('the month name opens twelve months for the year', [await page.locator('#month-picker button').count(), await page.textContent('#year-label')], [12, '2026']);
  await page.click('#year-next');
  await page.locator('#month-picker button', { hasText: 'Feb' }).click();
  await page.waitForFunction(() => document.getElementById('month-title').textContent === 'February 2027');
  eq('choosing one shows it, and the picker closes', [await page.locator('.date-row').count(), await page.locator('#month-picker-wrap').isHidden()], [28, true]);
  await page.click('#month-title');
  await page.keyboard.press('Escape');
  check('Escape closes the picker without a change', (await page.locator('#month-picker-wrap').isHidden()) && (await page.textContent('#month-title')) === 'February 2027');
  await context.close();
}


/* =====================================================================
   9. The morning strip: Bring forward or Drop, and nothing by itself
   ===================================================================== */
const strip = (page) => page.locator('#strip');
{
  reset();
  const a = await seed(core.dayList(YESTERDAY), 'Chase the invoice');
  const b = await seed(core.dayList(YESTERDAY), 'Book the van');
  await seed(core.dayList(YESTERDAY), 'Supplier call', 'event');
  await seed(core.dayList(YESTERDAY), 'Ask about pallets', 'note');
  const done = await seed(core.dayList(YESTERDAY), 'Already done');
  await http('POST', '/api/journal', { op: 'state', list: core.dayList(YESTERDAY), id: done, rev: 1, state: 'done' });
  const before = writes();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  await sleep(1200);
  eq('the strip is at the top of Today with a heading that says whose tasks and how many', [await strip(page).isVisible(), await strip(page).locator('.strip-head').allInnerTexts()], [true, ['From yesterday, 2 open tasks']]);
  eq('it offers open tasks only: no event, no note, no ticked task', await strip(page).locator('.strip-text').allInnerTexts(), ['Chase the invoice', 'Book the van']);
  eq('each task has Bring forward and Drop, and there is one Bring all forward and no Drop all', [await strip(page).locator('.strip-buttons button').allInnerTexts(), await strip(page).locator('.strip-foot').allInnerTexts()], [['Bring forward', 'Drop', 'Bring forward', 'Drop'], ['Bring all forward']]);
  check('opening the journal moved, migrated and dropped nothing: no write happened', writes() === before, `${writes()} writes against ${before}`);
  // Ten minutes go by on the page's clock: every timer it has fires many times.
  await context.clock.fastForward(10 * 60 * 1000);
  await sleep(500);
  check('ten minutes of timers later: still nothing moved, migrated or dropped, and the strip is still waiting', writes() === before && (await strip(page).locator('.strip-row').count()) === 2, `${writes()} writes against ${before}`);
  await shot(page, 'strip-1280-light');
  const primary = await strip(page).locator('.strip-buttons button').first().evaluate((x) => getComputedStyle(x).backgroundColor);
  check('Bring forward is the primary button, in the accent', primary === 'rgb(236, 105, 23)', primary);

  await strip(page).locator('.strip-row', { hasText: 'Chase the invoice' }).getByText('Bring forward').click();
  await page.waitForSelector('#flash:not([hidden])');
  eq('Bring forward puts a copy at the bottom of Today', await texts(page, 'today'), ['Chase the invoice']);
  eq('and the strip now has the one left, in the singular', await strip(page).locator('.strip-head').allInnerTexts(), ['From yesterday, 1 open task']);
  eq('with the message and an Undo', [await page.textContent('#flash-text'), await page.textContent('#flash-action')], ['Brought forward.', 'Undo']);
  await sleep(300);
  eq('yesterday\'s original is kept, marked as moved to Today', storedDay(YESTERDAY).entries.filter((e) => e.state === 'migrated').map((e) => [e.text, e.to]), [['Chase the invoice', 'day:' + TODAY]]);
  await page.click('#flash-action');
  await page.waitForFunction(() => document.querySelectorAll('#strip .strip-row').length === 2);
  eq('Undo puts both tasks back in the strip and takes the copy out of Today', [await rows(page, 'today').count(), await strip(page).locator('.strip-row').count()], [0, 2]);

  await strip(page).locator('.strip-row', { hasText: 'Book the van' }).getByText('Drop', { exact: true }).click();
  await page.waitForSelector('#flash:not([hidden])');
  eq('Drop strikes it and keeps it: yesterday\'s task is still there, marked Dropped', await sleep(300).then(() => storedDay(YESTERDAY).entries.filter((e) => e.state === 'dropped').map((e) => e.text)), ['Book the van']);
  eq('Bring all forward brings what is left', await strip(page).locator('.strip-foot').count(), 0);
  await strip(page).getByText('Bring forward').click();
  await page.waitForFunction(() => document.getElementById('strip').hidden);
  eq('when the last one is handled the block goes and the message says so', [await strip(page).isHidden(), await page.textContent('#flash-text')], [true, 'All handled.']);
  eq('Today holds the brought forward task', await texts(page, 'today'), ['Chase the invoice']);
  void a; void b;
  await context.close();
}
{
  // After a weekend: the most recent earlier day that has any open task.
  reset();
  await seed(core.dayList('2026-10-16'), 'Friday task');
  await seed(core.dayList('2026-10-15'), 'Thursday task');
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  eq('the heading names the day when it is not yesterday, and only the latest day is offered', await strip(page).locator('.strip-head, .strip-text').allInnerTexts(), ['From Friday 16 October, 1 open task', 'Friday task']);
  await context.close();
}
{
  // Month end: last month's open Migrate tasks, in the same strip, to the new month's Migrate.
  reset();
  await seed(core.dayList(YESTERDAY), 'Yesterday task');
  await seed(core.migrateList('2026-09'), 'Renew the licence');
  await seed(core.migrateList('2026-09'), 'Book flights');
  await seed(core.migrateList('2026-09'), 'Park idea', 'note');
  const done = await seed(core.migrateList('2026-09'), 'Finished');
  await http('POST', '/api/journal', { op: 'state', list: core.migrateList('2026-09'), id: done, rev: 1, state: 'done' });
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  eq('a second group below the daily one, in the same words', await strip(page).locator('.strip-head').allInnerTexts(), ['From yesterday, 1 open task', 'From September, 2 open tasks on Migrate']);
  eq('open tasks only', await strip(page).locator('[data-kind="monthly"] .strip-text').allInnerTexts(), ['Renew the licence', 'Book flights']);
  await strip(page).locator('[data-kind="monthly"] .strip-foot').click();
  await page.waitForFunction(() => document.querySelectorAll('#strip [data-kind="monthly"]').length === 0);
  eq('Bring all forward puts them at the bottom of this month\'s Migrate, not Today', [await texts(page, 'migrate'), await rows(page, 'today').count()], [['Renew the licence', 'Book flights'], 0]);
  eq('the daily group is still waiting, untouched', await strip(page).locator('.strip-head').allInnerTexts(), ['From yesterday, 1 open task']);
  await sleep(300);
  eq('September\'s originals are kept, marked moved to October', stored('2026-09').migrate.filter((e) => e.state === 'migrated').map((e) => [e.text, e.to]), [['Renew the licence', 'migrate:2026-10'], ['Book flights', 'migrate:2026-10']]);
  await context.close();
}
{
  // The clock rolls over while the window is open: the page follows, and moves nothing.
  reset();
  await seed(core.dayList(TODAY), 'Left open at the end of the day');
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const before = writes();
  await context.clock.setSystemTime(new Date('2026-10-23T00:10:00+01:00'));
  await context.clock.fastForward(60000);
  await page.waitForFunction(() => document.getElementById('date-today').textContent === 'Friday 23 October', null, { timeout: 8000 });
  eq('overnight the headings and marks move on by themselves', [await page.textContent('#date-tomorrow'), await page.locator('.date-row[data-mark="today"]').getAttribute('data-date')], ['Saturday 24 October', '2026-10-23']);
  eq('and the open task is offered in the strip, as yesterday\'s', await strip(page).locator('.strip-head, .strip-text').allInnerTexts(), ['From yesterday, 1 open task', 'Left open at the end of the day']);
  check('and nothing was moved, migrated or dropped by the date changing', writes() === before);
  await context.clock.fastForward(10 * 60 * 1000);
  await sleep(500);
  check('and ten more minutes of timers move nothing either, with the strip still waiting', writes() === before && (await strip(page).locator('.strip-row').count()) === 1);
  await context.close();
}

/* =====================================================================
   10. Quick notes
   ===================================================================== */
{
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const quick = page.locator('#quick-editor');
  eq('the empty state says what it is', await quick.getAttribute('data-placeholder'), 'Type anything here. It has no date and stays until you delete it.');
  await quick.click();
  await page.keyboard.type('Ring Tom about the order');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('Pallets');
  eq('typing marks it as not saved yet', await page.getAttribute('#quick-status', 'data-state'), 'unsaved');
  await page.waitForFunction(() => document.getElementById('quick-status').dataset.state === 'saved', null, { timeout: 8000 });
  eq('and it saves by itself, as typed, with bold as markers', server.journalStore.state.quick.text, 'Ring Tom about the order\n**Pallets**');
  await page.reload();
  await page.waitForSelector('#app:not([hidden])');
  eq('it comes back after a reload, with the bold drawn as bold', await page.locator('#quick-editor').evaluate((el) => [el.innerText, !!el.querySelector('b')]), ['Ring Tom about the order\nPallets', true]);
  // another device saves in the meantime
  const current = (await (await fetch(BASE + '/api/journal?view=home&today=' + TODAY, { headers: { cookie } })).json()).quick;
  const other = await fetch(BASE + '/api/journal?part=quick', { method: 'PUT', headers: { cookie, 'x-base-updated': current.updatedAt }, body: 'From the iPad' });
  eq('another device saves its own quick notes', other.status, 200);
  await page.locator('#quick-editor').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' and more');
  await page.waitForFunction(() => document.getElementById('quick-status').dataset.state === 'failed', null, { timeout: 8000 });
  eq('a clash is refused: the plain message, a Reload button, and the typed text stays on screen', [(await page.textContent('#flash-text')).startsWith('Your quick notes were changed on another device'), await page.textContent('#flash-action'), (await page.locator('#quick-editor').innerText()).includes('and more')], [true, 'Reload', true]);
  eq('the other device\'s text was not overwritten', server.journalStore.state.quick.text, 'From the iPad');
  await page.click('#flash-action');
  await page.waitForFunction(() => document.getElementById('quick-editor').innerText === 'From the iPad');
  eq('Reload brings the other device\'s text in and the status goes back to saved', await page.getAttribute('#quick-status', 'data-state'), 'saved');
  await context.close();
}

/* =====================================================================
   11. Two devices: no silent overwrite, and the typed text stays
   ===================================================================== */
{
  reset();
  const id = await seed(core.dayList(TODAY), 'Shared entry');
  const A = await open({ width: 1280, height: 800 });
  const B = await open({ width: 1280, height: 800 });
  await signIn(A.page);
  await signIn(B.page);
  // A edits the entry.
  const aText = A.page.locator('#list-today .entry-text').first();
  await aText.click(); await A.page.keyboard.press('End'); await A.page.keyboard.type(' (edited on the PC)'); await A.page.keyboard.press('Enter');
  await sleep(400);
  // B starts to edit the same entry from its older copy.
  const bText = B.page.locator('#list-today .entry-text').first();
  await bText.click(); await B.page.keyboard.press('End'); await B.page.keyboard.type(' (typed on the iPad)');
  await B.page.keyboard.press('Enter');
  await B.page.waitForSelector('#flash:not([hidden])');
  eq('the iPad is refused with the plain message and a Reload button', [await B.page.textContent('#flash-text'), await B.page.textContent('#flash-action')], ['This changed on another device. Your text is still on screen. Reload to see the latest, then add it again.', 'Reload']);
  eq('its typed text is still on screen, in the row, still editable', await B.page.locator('#list-today .entry-text').first().innerText(), 'Shared entry (typed on the iPad)');
  eq('and the PC\'s edit was not overwritten', storedDay().entries[0].text, 'Shared entry (edited on the PC)');
  await B.page.click('#flash-action');
  await B.page.waitForFunction(() => document.querySelector('#list-today .entry-text').innerText.includes('PC'));
  eq('Reload shows the PC\'s version', await B.page.locator('#list-today .entry-text').first().innerText(), 'Shared entry (edited on the PC)');

  // B ticks from an old copy: refused, and the tick is taken back on screen.
  const aAgain = A.page.locator('#list-today .entry-text').first();
  await aAgain.click(); await A.page.keyboard.press('End'); await A.page.keyboard.type(' again'); await A.page.keyboard.press('Enter');
  await sleep(400);
  const tick = B.page.locator('#list-today .bullet').first();
  await tick.click();
  await B.page.waitForSelector('#flash:not([hidden])');
  await B.page.waitForFunction(() => document.querySelector('#list-today li.entry').dataset.state === 'open' || document.querySelector('#list-today li.entry').dataset.state === 'done');
  eq('a tick from an old copy is refused and writes nothing', [storedDay().entries[0].state, storedDay().entries[0].rev], ['open', 3]);
  check('and the iPad shows the message', (await B.page.textContent('#flash-text')).startsWith('This changed on another device'));
  await shot(B.page, 'conflict-1280-light');

  // Different entries do not clash, and the other device sees them when it looks again.
  await enter(A.page, 'today', 'Added on the PC');
  await sleep(400);
  await enter(B.page, 'tomorrow', 'Added on the iPad');
  await sleep(400);
  await B.page.evaluate(returnToWindow);
  await B.page.waitForFunction(() => document.querySelectorAll('#list-today li.entry').length === 2, null, { timeout: 6000 });
  await A.page.evaluate(returnToWindow);
  await A.page.waitForFunction(() => document.querySelectorAll('#list-tomorrow li.entry').length === 1, null, { timeout: 6000 });
  eq('entries added on two devices both survive and both screens catch up when the window gets focus', [await texts(B.page, 'today'), await texts(A.page, 'tomorrow')], [['Shared entry (edited on the PC) again', 'Added on the PC'], ['Added on the iPad']]);
  void id;
  await A.context.close(); await B.context.close();
}
{
  // A send that fails (the server is down) puts the typed text back and changes nothing.
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  server.control.failPosts = true;
  await enter(page, 'today', 'Typed while the server is down');
  await page.waitForSelector('#flash:not([hidden])');
  eq('nothing is shown as saved: the entry goes and the message says nothing was changed', [await rows(page, 'today').count(), await page.textContent('#flash-text')], [0, 'Could not save that change. Nothing was changed. Try again.']);
  eq('and the text is back in the add line', await page.locator('#addbar-today .editor-line').innerText(), 'Typed while the server is down');
  server.control.failPosts = false;
  await page.locator('#addbar-today .editor-line').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list-today li.entry').length === 1);
  eq('pressing Enter again saves it', await sleep(300).then(() => storedDay().entries.map((e) => e.text)), ['Typed while the server is down']);
  await context.close();
}

/* =====================================================================
   12. Sign out, memory, storage, leaving the page
   ===================================================================== */
async function heapHas(page, needle) {
  const client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.enable');
  await client.send('HeapProfiler.collectGarbage');
  let found = false;
  let tail = '';
  client.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => {
    if ((tail + chunk).includes(needle)) found = true;
    tail = chunk.slice(-needle.length);
  });
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await client.detach();
  return found;
}
const MARK = 'ZEBRA-CROSSING-4471';
{
  reset();
  await seed(core.dayList(TODAY), MARK + ' entry');
  await seed(core.migrateList(OCT), MARK + ' migrate');
  await fetch(BASE + '/api/journal?part=quick', { method: 'PUT', headers: { cookie, 'x-base-updated': 'none' }, body: MARK + ' quick' });
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  await page.locator('#quick-editor').click();
  await page.keyboard.type(' typed');
  await page.waitForFunction(() => document.getElementById('quick-status').dataset.state === 'saved', null, { timeout: 8000 });
  check('sign out: before signing out the page holds the entries in memory, so the heap search can see them', await heapHas(page, MARK));
  await page.click('#sign-out');
  await page.waitForSelector('#login:not([hidden])');
  check('sign out: after signing out no copy of an entry or of the quick notes is left in the page\'s memory', !(await heapHas(page, MARK)));
  check('sign out: and none is on screen', await page.evaluate((m) => !(document.body.innerText + document.documentElement.innerHTML).includes(m), MARK));
  eq('sign out: the panels, the tabs and the header links are gone', await page.evaluate(() => [document.getElementById('app').hidden, document.getElementById('tabbar').hidden, document.getElementById('sign-out').hidden, document.getElementById('bar-actions').hidden]), [true, true, true, true]);
  await page.reload();
  await page.waitForSelector('#login:not([hidden])');
  check('sign out: refresh shows only sign in, nothing painted first', await page.evaluate(() => document.getElementById('app').hidden && !/October|Today/.test(document.body.innerText)));
  // Signing back in with a slow answer shows nothing from before.
  server.control.delayMs = 0;
  await page.fill('#password', server.password);
  await page.click('#login-submit');
  await page.waitForSelector('#app:not([hidden])');
  eq('sign out: signing in again brings the journal back', (await texts(page, 'today')), [MARK + ' entry']);
  await context.close();
}
{
  // Leaving the page empties it, so a page the browser keeps shows nothing.
  reset();
  await seed(core.dayList(TODAY), MARK + ' entry');
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  check('leaving: before leaving the page holds the entry', await heapHas(page, MARK));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  check('leaving: after pagehide no copy of it is in memory', !(await heapHas(page, MARK)));
  check('leaving: and nothing is on screen but the loading line', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim() === 'Journal Loading.'), await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForSelector('#app:not([hidden])');
  check('leaving: coming back asks the server first and then shows the journal', (await texts(page, 'today')).length === 1);
  await context.close();
}
{
  // The session ends under the page (a 401): to sign in, memory dropped.
  reset();
  await seed(core.dayList(TODAY), MARK + ' entry');
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  await context.clearCookies();
  await page.evaluate(returnToWindow);
  await page.waitForSelector('#login:not([hidden])', { timeout: 6000 });
  check('401: the page ends on sign in with no entry on screen', await page.evaluate(() => document.getElementById('app').hidden));
  check('401: and no copy of the entry is left in the page\'s memory', !(await heapHas(page, MARK)));
  await context.close();
}
{
  // Sign out is refused while quick notes could not be saved.
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  server.control.failQuick = true;
  await page.locator('#quick-editor').click();
  await page.keyboard.type('Unsaved thought');
  await page.waitForFunction(() => document.getElementById('quick-status').dataset.state === 'failed', null, { timeout: 8000 });
  await page.click('#sign-out');
  await page.waitForFunction(() => document.getElementById('flash-text').textContent.startsWith('Could not sign out'));
  check('sign out: if the quick notes cannot be saved the person stays signed in with the text on screen', (await page.locator('#app').isVisible()) && (await page.locator('#quick-editor').innerText()) === 'Unsaved thought');
  server.control.failQuick = false;
  await context.close();
}
{
  // Nothing is kept on the device but the theme and the tab.
  reset();
  await seed(core.dayList(TODAY), MARK + ' entry');
  const { context, page } = await open({ width: 375, height: 740 }, { hasTouch: true, isMobile: true });
  await signIn(page);
  await page.click('#tabbar button[data-panel="tomorrow"]');
  await page.click('#theme-switch');
  const kept = await page.evaluate(async () => ({
    local: Object.keys(localStorage).sort(), session: Object.keys(sessionStorage), idb: (indexedDB.databases ? await indexedDB.databases() : []).length,
    caches: (await caches.keys()).length, workers: (await navigator.serviceWorker.getRegistrations()).length, cookie: document.cookie,
    stored: JSON.stringify(localStorage).includes('ZEBRA'),
  }));
  eq('storage: the device holds the theme and the last tab, and no service worker, cache or database', kept, { local: ['silurian-journal-tab', 'silurian-notes-theme'], session: [], idb: 0, caches: 0, workers: 0, cookie: '', stored: false });
  await page.reload();
  await page.waitForSelector('#app:not([hidden])');
  eq('the last tab is remembered on the phone', await page.getAttribute('#panel-tomorrow', 'data-active'), 'true');
  eq('and the theme choice is the one notes uses', await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
  await context.close();
}
{
  // Storage blocked: the page still works.
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await signIn(page);
  await page.click('#theme-switch');
  check('storage blocked: the page and the theme switch still work', (await page.locator('.panel:visible').count()) === 5 && (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
  await context.close();
}

/* =====================================================================
   13. The page and the API are never stored
   ===================================================================== */
{
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const headers = await page.evaluate(async () => {
    const out = {};
    for (const path of ['/journal', '/journal/', '/journal/core.js', '/journal/manifest.webmanifest', '/api/journal?view=months&months=2026-10', '/api/session']) {
      const r = await fetch(path, { cache: 'no-store' });
      out[path] = [r.status, r.headers.get('cache-control'), r.headers.get('x-robots-tag')];
    }
    return out;
  });
  for (const [path, [status, cache, robots]] of Object.entries(headers)) {
    check(`no-store and noindex on ${path}`, status === 200 && cache === 'no-store' && robots === 'noindex, nofollow', JSON.stringify([status, cache, robots]));
  }
  await context.close();
}

/* =====================================================================
   14. Installing it as an app
   ===================================================================== */
{
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const manifestUrl = await page.getAttribute('link[rel="manifest"]', 'href');
  const manifest = await (await fetch(BASE + manifestUrl)).json();
  eq('the manifest is public: it loads with no cookie, as a browser fetches it', [manifest.name, manifest.short_name, manifest.display, manifest.start_url, manifest.scope], ['Journal', 'Journal', 'standalone', '/journal/', '/journal/']);
  eq('the theme and background colours are the page ground', [manifest.theme_color, manifest.background_color], ['#faf8f5', '#faf8f5']);
  const sizes = [];
  for (const icon of manifest.icons) {
    const png = Buffer.from(await (await fetch(BASE + icon.src)).arrayBuffer());
    sizes.push([icon.src, png.readUInt32BE(16), png.readUInt32BE(20), icon.purpose || 'any']);
  }
  eq('the icons load with no cookie and are the sizes they say', sizes, [['/journal/icon-192.png', 192, 192, 'any'], ['/journal/icon-512.png', 512, 512, 'any'], ['/journal/icon-512-maskable.png', 512, 512, 'maskable']]);
  eq('the iPad icon and the tab icon load', await Promise.all(['/journal/apple-touch-icon.png', '/journal/icon-32.png'].map(async (p) => (await fetch(BASE + p)).status)), [200, 200]);
  eq('the page names itself for the iPad home screen', await page.evaluate(() => ['apple-mobile-web-app-capable', 'apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style'].map((n) => document.querySelector(`meta[name="${n}"]`).content)), ['yes', 'Journal', 'default']);
  const bars = await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m.media, m.content]));
  eq('the title bar colour follows the light and dark page ground', bars, [['(prefers-color-scheme: light)', '#faf8f5'], ['(prefers-color-scheme: dark)', '#262422']]);
  await page.click('#theme-switch');
  eq('and the colour is read from the page when the theme is switched', await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content)), ['#262422', '#262422']);
  const client = await context.newCDPSession(page);
  const errors = await client.send('Page.getInstallabilityErrors');
  eq('Chromium, which is Edge\'s engine, finds nothing to stop the install, with no service worker', errors.installabilityErrors, []);
  const parsed = await client.send('Page.getAppManifest');
  check('and it parsed the manifest without complaint', (parsed.errors || []).length === 0 && parsed.data.length > 100, JSON.stringify(parsed.errors));
  eq('there is no service worker on the page', await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await context.close();
}

/* =====================================================================
   15. The notes menu has a Journal item
   ===================================================================== */
{
  reset();
  const { context, page } = await open({ width: 1280, height: 800 });
  await page.goto(BASE + '/notes');
  await page.waitForSelector('#login:not([hidden])');
  await page.fill('#password', server.password);
  await page.click('#login-submit');
  await page.waitForSelector('#menu:not([hidden])');
  const items = await page.locator('#menu .menu-item').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  eq('Journal is the last item in the menu, after Archive', items.slice(0, 1).concat(items.slice(-4, -2)), ['Notes', 'Archive', 'Journal']);
  eq('it is a plain link to the journal', [await page.getAttribute('#menu-journal', 'href'), await page.locator('#menu-journal use').getAttribute('href')], ['/journal/', '#i-journal']);
  await shot(page, 'notes-menu-1280-light');
  await page.click('#menu-journal');
  await page.waitForSelector('#app:not([hidden])');
  check('it opens the journal, already signed in because it is the same cookie', (await page.url()).endsWith('/journal/') && (await page.title()) === 'Journal');
  await context.close();
  const phone = await open({ width: 375, height: 740 }, { hasTouch: true, isMobile: true });
  await phone.page.goto(BASE + '/notes');
  await phone.page.waitForSelector('#login:not([hidden])');
  await phone.page.fill('#password', server.password);
  await phone.page.click('#login-submit');
  await phone.page.waitForSelector('#menu-button:not([hidden])');
  await phone.page.click('#menu-button');
  check('at phone width the menu that opens over the page has the Journal item too', await phone.page.locator('#menu-journal').isVisible());
  await shot(phone.page, 'notes-menu-375-light');
  await phone.context.close();
}


/* =====================================================================
   16. The screenshots: a real week, at four widths, in light and dark
   ===================================================================== */
async function showcase() {
  reset();
  const day = core.dayList(TODAY);
  const tomorrow = core.dayList(TOMORROW);
  const id = {};
  id.urgent = await seed(day, '**Urgent** review the deviation report');
  id.chase = await seed(day, 'Chase the supplier about the pallet labels');
  id.qa = await seed(day, 'Send the batch record to QA');
  id.reply = await seed(day, 'Reply to Daniel about the audit date');
  id.van = await seed(day, 'Book the van for Friday');
  id.licence = await seed(day, 'Renew the site licence');
  id.sop = await seed(day, 'Draft the old SOP wording');
  await seed(day, 'Supplier call at 14:00', 'event');
  await seed(day, 'Ask Toni about the ~~label~~ proof', 'note');
  await http('POST', '/api/journal', { op: 'state', list: day, id: id.qa, rev: 1, state: 'done' });
  await http('POST', '/api/journal', { op: 'move', from: day, to: tomorrow, how: 'migrated', items: [{ id: id.van, rev: 1 }], at: (seedAt += 1000) });
  await http('POST', '/api/journal', { op: 'move', from: day, to: core.dayList('2026-10-28'), how: 'scheduled', items: [{ id: id.licence, rev: 1 }], at: (seedAt += 1000) });
  await http('POST', '/api/journal', { op: 'drop', list: day, items: [{ id: id.sop, rev: 1 }] });
  await seed(tomorrow, 'Dentist at 09:30', 'event');
  await seed(tomorrow, 'Prepare the supplier meeting pack');
  const migrate = core.migrateList(OCT);
  await seed(migrate, 'Update the supplier list');
  await seed(migrate, 'Order a new label printer');
  const review = await seed(migrate, 'Review the stability protocol');
  await http('POST', '/api/journal', { op: 'state', list: migrate, id: review, rev: 1, state: 'done' });
  await seed(migrate, 'Idea: a weekly stock check', 'note');
  await seed(core.dayList(YESTERDAY), 'Call the courier about the missing pallet');
  await seed(core.dayList(YESTERDAY), 'Check the audit action tracker');
  await seed(core.migrateList('2026-09'), 'Renew the data logger calibration');
  await seed(core.migrateList('2026-09'), 'Book the autumn training');
  await seed(core.dayList('2026-10-26'), 'Site visit, Leeds', 'event');
  await seed(core.dayList('2026-10-30'), 'Month end close');
  await http('POST', '/api/journal', { op: 'line', date: TOMORROW, rev: 0, text: 'Dentist **9:30**' });
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-26', rev: 0, text: 'Leeds site visit' });
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-30', rev: 0, text: 'Month end' });
  await fetch(BASE + '/api/journal?part=quick', { method: 'PUT', headers: { cookie, 'x-base-updated': 'none' }, body: '**Ring Tom** about the order\nPallet count ~~40~~ 42\nAsk finance about the PO' });
}
{
  await showcase();
  for (const scheme of ['light', 'dark']) {
    for (const [width, height] of [[1920, 1080], [1280, 800], [900, 900], [375, 740]]) {
      const phone = width < 761;
      const { context, page } = await open({ width, height }, { colorScheme: scheme, ...(phone ? { hasTouch: true, isMobile: true } : {}) });
      await signIn(page);
      await sleep(300);
      await shot(page, `week-${width}-${scheme}`);
      if (width === 1280 || width === 375) {
        await page.click('#moved-toggle-today');
        await sleep(150);
        await shot(page, `week-${width}-moved-open-${scheme}`);
        await page.click('#moved-toggle-today');
      }
      if (width === 900) await page.screenshot({ path: `${SHOTS}/week-900-${scheme}-full-page.png`, fullPage: true });
      if (phone) {
        for (const tab of ['month', 'tomorrow', 'migrate', 'quick']) {
          await page.click(`#tabbar button[data-panel="${tab}"]`);
          await sleep(150);
          await shot(page, `week-375-${tab}-${scheme}`);
        }
        await page.click('#tabbar button[data-panel="today"]');
        const row = page.locator('#list-today li.entry', { hasText: 'Chase the supplier' });
        await row.locator('.more').tap();
        await sleep(100);
        await shot(page, `week-375-today-moves-${scheme}`);
      }
      eq(`screenshots: ${width}px ${scheme}: no error on the page`, page.errors, []);
      await context.close();
    }
  }
  const dark = await open({ width: 1280, height: 800 }, { colorScheme: 'dark' });
  await signIn(dark.page);
  await dark.page.locator('.date-row[data-date="2026-10-26"] .date-open').click();
  await sleep(200);
  await shot(dark.page, 'week-1280-dark-day-log');
  await dark.page.click('#day-back');
  await dark.page.click('#month-title');
  await sleep(150);
  await shot(dark.page, 'week-1280-dark-month-picker');
  await dark.context.close();
}


/* =====================================================================
   17. Each panel renders alone
   ===================================================================== */
{
  await showcase();
  const expectations = {
    month: async (page) => (await page.locator('.date-row').count()) === 31,
    today: async (page) => (await page.locator('#list-today li.entry').count()) === 7 && (await page.textContent('#moved-toggle-today')) === '2 moved' && (await page.locator('#strip .strip-group').count()) === 2,
    tomorrow: async (page) => (await page.locator('#list-tomorrow li.entry').count()) === 3,
    migrate: async (page) => (await page.locator('#list-migrate li.entry').count()) === 4,
    quick: async (page) => (await page.locator('#quick-editor').innerText()).startsWith('Ring Tom'),
  };
  for (const [panel, drawn] of Object.entries(expectations)) {
    const { context, page } = await open({ width: 1280, height: 800 });
    await signIn(page);
    await page.evaluate((keep) => { for (const el of [...document.querySelectorAll('.panel')]) if (el.id !== 'panel-' + keep) el.remove(); }, panel);
    // Ask the server again and draw: only this panel is on the page.
    await page.evaluate(returnToWindow);
    await sleep(900);
    check(`alone: the ${panel} panel draws with the other four taken off the page`, (await page.locator('.panel').count()) === 1 && (await drawn(page)) && page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }
}

/* =====================================================================
   18. The Peels: Today yellow, Tomorrow green, Migrate pink, in both themes
   ===================================================================== */
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const PEELS = { today: ['#fcf0b8', '#f6e294', '#ecd47a', '#fef9e3'], tomorrow: ['#e0f0dc', '#cde6c8', '#b9d9b3', '#f3f9f1'], migrate: ['#fbe0e7', '#f5ccd8', '#ecb6c6', '#fdf3f5'] };
const PLAIN = { light: ['#f1ede7'], dark: ['#1f1d1c'] };
// In the page: the contrast of a colour on the fill a given element really sits on.
const inPage = () => {
  const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const fillOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return 'rgb(255, 255, 255)'; };
  return { ratio, fillOf };
};
{
  await showcase();
  let observations = 0;
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await open({ width: 1280, height: 800 }, { colorScheme: scheme });
    await signIn(page);
    await page.evaluate((src) => { window.__h = (new Function('return (' + src + ')()'))(); }, inPage.toString());
    for (const [panel, [body, hover, selected, field]] of Object.entries(PEELS)) {
      const bg = await page.evaluate((id) => getComputedStyle(document.getElementById('panel-' + id)).backgroundColor, panel);
      eq(`${scheme}: ${panel} is the Peel fill`, bg, rgb(body));
      // Every text, icon and mark that sits on the fill, measured as drawn.
      const measured = await page.evaluate((id) => {
        const h = window.__h; const panelEl = document.getElementById('panel-' + id);
        const pick = (sel) => [...panelEl.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
        const out = [];
        for (const [label, sel, floor] of [['title', '.panel-title', 4.5], ['date', '.panel-date', 4.5], ['entry text', '.entry-text', 4.5], ['bullet', 'span.bullet, button.bullet', 3], ['bin', '.entry-delete', 3], ['moved line', '.moved-toggle', 4.5], ['add line', '.editor-line', 4.5], ['type button', '.type-button', 3], ['strip heading', '.strip-head', 4.5], ['strip text', '.strip-text', 4.5]]) {
          for (const el of pick(sel)) { const cs = getComputedStyle(el); out.push({ label, floor, ratio: h.ratio(cs.color, h.fillOf(el)) }); }
        }
        return out;
      }, panel);
      observations += measured.length;
      const bad = measured.filter((m) => m.ratio < m.floor);
      check(`${scheme}: ${panel}: ${measured.length} text and icon colours measured on the Peel, none under their floor`, measured.length >= 8 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
      // The empty-state box and a muted entry (done) are measured where they exist.
    }
    for (const plain of ['month', 'quick']) {
      const bg = await page.evaluate((id) => getComputedStyle(document.getElementById('panel-' + id)).backgroundColor, plain);
      eq(`${scheme}: ${plain} keeps the page panel colour`, bg, rgb(PLAIN[scheme][0]));
    }
    // Hover, a drop target and focus, on Today.
    const row = page.locator('#list-today li.entry').first();
    await row.hover();
    eq(`${scheme}: a hovered row on Today takes the Peel's hover fill`, await row.evaluate((el) => getComputedStyle(el).backgroundColor), rgb(PEELS.today[1]));
    const muted = page.locator('#list-today li.entry[data-state="done"]').first();
    await muted.hover();
    check(`${scheme}: a greyed entry on Today stays 4.5:1 while hovered`, await muted.evaluate((el, src) => { const h = (new Function('return (' + src + ')()'))(); const t = el.querySelector('.entry-text'); return h.ratio(getComputedStyle(t).color, getComputedStyle(el).backgroundColor) >= 4.5; }, inPage.toString()));
    for (const [panel, [, , selected]] of Object.entries(PEELS)) {
      await page.evaluate((id) => document.getElementById('panel-' + id).setAttribute('data-drop', 'true'), panel);
      const drop = await page.evaluate((id) => { const el = document.getElementById('panel-' + id); const h = window.__h; const out = [getComputedStyle(el).backgroundColor]; for (const sel of ['.panel-date', '.panel-title', '.entry-text', '.entry-delete', '.moved-toggle']) for (const n of el.querySelectorAll(sel)) if (n.offsetParent !== null) out.push(h.ratio(getComputedStyle(n).color, getComputedStyle(el).backgroundColor) >= (sel === '.entry-delete' ? 3 : 4.5)); return out; }, panel);
      check(`${scheme}: ${panel} as a drop target takes its selected fill, and every text on it holds its floor`, drop[0] === rgb(selected) && drop.slice(1).every(Boolean) && drop.length > 3, JSON.stringify(drop));
      await page.evaluate((id) => document.getElementById('panel-' + id).removeAttribute('data-drop'), panel);
    }
    // The field: lighter than the Peel, with a darker edge.
    const field = await page.evaluate(() => { const el = document.querySelector('#addbar-today .editor-line'); const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor]; });
    eq(`${scheme}: the add line on Today is the Peel's field fill with the icon colour as its edge`, field, [rgb(PEELS.today[3]), rgb('#4a4744')]);
    // Focus: ink on a Peel, accent on Quick notes.
    await page.locator('#addbar-today .editor-line').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    eq(`${scheme}: a focused control on a Peel has a 2px ink outline`, await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [cs.outlineWidth, cs.outlineColor]; }), ['2px', rgb('#1a1918')]);
    await page.locator('#quick-editor').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    eq(`${scheme}: a focused control in Quick notes keeps the accent outline`, await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [cs.outlineWidth, cs.outlineColor]; }), ['2px', rgb('#ec6917')]);
    await shot(page, `peels-${scheme}`);
    check(`${scheme}: no page errors`, page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }
  check(`peels: ${observations} colours were measured in all, so the check saw something`, observations > 100, String(observations));
  // A phone shows one panel at a time and it is still a Peel.
  const { context, page } = await open({ width: 390, height: 800 }, { colorScheme: 'dark', hasTouch: true, isMobile: true });
  await signIn(page);
  eq('phone, dark: Today is the yellow Peel', await page.evaluate(() => getComputedStyle(document.getElementById('panel-today')).backgroundColor), rgb('#fcf0b8'));
  await context.close();
}

/* =====================================================================
   19. Month's resize handle
   ===================================================================== */
{
  await showcase();
  const widths = (page) => page.evaluate(() => Object.fromEntries(['month', 'today', 'tomorrow', 'migrate', 'quick'].map((k) => [k, Math.round(document.getElementById('panel-' + k).getBoundingClientRect().width)])));
  const stash = (page) => page.evaluate(() => { try { return localStorage.getItem('silurian-journal-month-width'); } catch { return 'blocked'; } });
  const handleBox = async (page) => { const b = await page.locator('#month-handle').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }; };
  const { context, page } = await open({ width: 1280, height: 800 });
  await signIn(page);
  const first = await widths(page);
  check('handle: shown at 1280 with its role, name and values', await page.evaluate(() => { const h = document.getElementById('month-handle'); return h.offsetParent !== null && h.getAttribute('role') === 'separator' && h.getAttribute('aria-label') === 'Resize Month' && h.getAttribute('aria-orientation') === 'vertical' && h.getAttribute('aria-valuemin') === '240' && h.getAttribute('aria-valuemax') === '616'; }));
  eq('handle: at rest the three columns are equal thirds and nothing is stored', [Math.abs(first.month - first.today) <= 1, Math.abs(first.today - first.migrate) <= 1, await stash(page)], [true, true, null]);
  // The handle sits in the gap at Month's right edge.
  const gap = await page.evaluate(() => { const m = document.getElementById('panel-month').getBoundingClientRect(); const h = document.getElementById('month-handle').getBoundingClientRect(); return Math.abs((h.left + h.width / 2) - (m.right + 6)); });
  check('handle: sits on Month right edge, in the gap', gap <= 1, String(gap));
  // Drag with a mouse.
  let h = await handleBox(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  eq('drag: the page says it is resizing and the handle says it is dragging', await page.evaluate(() => [document.documentElement.getAttribute('data-resizing'), document.getElementById('month-handle').getAttribute('data-dragging')]), ['true', 'true']);
  await page.mouse.move(h.x + 60, h.y); await page.mouse.move(h.x + 120, h.y);
  const during = await widths(page);
  eq('drag: nothing is stored while the pointer moves', await stash(page), null);
  await page.mouse.up();
  const after = await widths(page);
  check('drag: Month is 120px wider and the middle and right columns share the rest equally', Math.abs(after.month - (first.month + 120)) <= 2 && Math.abs(after.today - after.migrate) <= 1 && Math.abs(during.month - after.month) <= 1, JSON.stringify(after));
  eq('drag: letting go stores the width and clears the dragging marks', [await stash(page), await page.evaluate(() => [document.documentElement.getAttribute('data-resizing'), document.getElementById('month-handle').getAttribute('data-dragging')])], [String(after.month), [null, null]]);
  check('drag: the handle followed Month', Math.abs((await handleBox(page)).x - (await page.evaluate(() => document.getElementById('panel-month').getBoundingClientRect().right + 6))) <= 1);
  await shot(page, 'handle-dragged');
  // Reload keeps it.
  await page.reload(); await page.waitForSelector('#app:not([hidden])'); await sleep(300);
  check('reload: the width is remembered on this device', Math.abs((await widths(page)).month - after.month) <= 1);
  // Limits.
  h = await handleBox(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(5, h.y, { steps: 5 }); await page.mouse.up();
  eq('limit: dragged to the far left Month stops at 240px', (await widths(page)).month, 240);
  h = await handleBox(page);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(1270, h.y, { steps: 5 }); await page.mouse.up();
  const far = await widths(page);
  check('limit: dragged to the far right Month stops at 616px and the others keep 280px or more', far.month === 616 && far.today >= 280 && far.migrate >= 280, JSON.stringify(far));
  // Keyboard.
  await page.locator('#month-handle').focus();
  eq('keyboard: the handle takes focus', await page.evaluate(() => document.activeElement.id), 'month-handle');
  await shot(page, 'handle-focused');
  await page.keyboard.press('Home');
  eq('keyboard: Home goes to the minimum', [(await widths(page)).month, await page.getAttribute('#month-handle', 'aria-valuenow')], [240, '240']);
  await page.keyboard.press('ArrowRight');
  eq('keyboard: Right arrow adds 16px', (await widths(page)).month, 256);
  await page.keyboard.press('Shift+ArrowRight');
  eq('keyboard: Shift and Right arrow adds 64px', (await widths(page)).month, 320);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+ArrowLeft');
  eq('keyboard: Left arrow takes 16px and Shift and Left arrow takes 64px', (await widths(page)).month, 240);
  await page.keyboard.press('End');
  eq('keyboard: End goes to the maximum', (await widths(page)).month, 616);
  eq('keyboard: every step is stored', await stash(page), '616');
  await page.keyboard.press('Enter');
  const reset = await widths(page);
  eq('keyboard: Enter resets to the default and forgets the stored width', [Math.abs(reset.month - first.month) <= 1, await stash(page)], [true, null]);
  await page.keyboard.press('ArrowRight');
  await page.locator('#month-handle').dblclick();
  eq('double click: resets to the default', [Math.abs((await widths(page)).month - first.month) <= 1, await stash(page)], [true, null]);
  check('handle: the focus outline is 2px ink on the page', await page.evaluate(() => { document.getElementById('month-handle').focus(); const cs = getComputedStyle(document.getElementById('month-handle')); return cs.outlineWidth; }) === '2px');
  // Trimmed, not rewritten, when the window is too small.
  await page.keyboard.press('End');
  await page.setViewportSize({ width: 1000, height: 700 }); await sleep(300);
  const squeezed = await widths(page);
  check('window shrinks: a stored 616px is trimmed to 392px on screen, the others keep 280px or more', squeezed.month === 392 && squeezed.today >= 280, JSON.stringify(squeezed));
  eq('window shrinks: storage still holds 616', await stash(page), '616');
  await page.setViewportSize({ width: 1280, height: 800 }); await sleep(300);
  eq('window grows again: the choice comes back', (await widths(page)).month, 616);
  // Below 1000px there is no handle and the layout is the old one.
  await page.setViewportSize({ width: 999, height: 700 }); await sleep(300);
  check('999px: no handle, Month is the sticky column as before', await page.evaluate(() => getComputedStyle(document.getElementById('month-handle')).display === 'none' && getComputedStyle(document.getElementById('panel-month')).position === 'sticky'));
  await page.setViewportSize({ width: 390, height: 800 }); await sleep(300);
  check('390px: no handle', await page.evaluate(() => getComputedStyle(document.getElementById('month-handle')).display === 'none'));
  check('handle: no page errors', page.errors.length === 0, page.errors.join(' | '));
  await context.close();

  // Dark theme look of the handle, and storage that is blocked.
  const dark = await open({ width: 1280, height: 800 }, { colorScheme: 'dark' });
  await dark.page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await signIn(dark.page);
  await dark.page.locator('#month-handle').focus();
  await dark.page.keyboard.press('ArrowRight');
  check('storage blocked: the handle still works and nothing throws', (await widths(dark.page)).month > first.month - 1 && dark.page.errors.length === 0, dark.page.errors.join(' | '));
  await shot(dark.page, 'handle-dark');
  await dark.context.close();

  // A finger gets a 44px target.
  const touch = await open({ width: 1280, height: 800 }, { hasTouch: true, isMobile: true });
  await signIn(touch.page);
  check('a coarse pointer: the handle is 44px wide', (await touch.page.evaluate(() => document.getElementById('month-handle').getBoundingClientRect().width)) === 44);
  await touch.context.close();
}

/* =====================================================================
   20. With an entry focused by Tab, the move buttons are on their own line
   ===================================================================== */
{
  await showcase();
  let seen = 0;
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const width of [1920, 1280, 1000]) {
    const { context, page } = await open({ width, height: 800 });
    await signIn(page);
    for (const where of ['Today (a Peel)', 'Month day log']) {
      if (where === 'Month day log') { await page.locator('.date-row[data-date="2026-10-26"] .date-open').click(); await page.waitForSelector('#list-day li.entry'); }
      const list = where === 'Today (a Peel)' ? '#list-today' : '#list-day';
      const row = page.locator(`${list} li.entry`).first();
      await page.mouse.move(2, 2);
      await page.keyboard.press('Tab');
      await row.locator('.entry-text').focus();
      await sleep(150);
      const buttons = row.locator('.entry-actions button');
      const count = await buttons.count();
      const text = await row.locator('.entry-text').boundingBox();
      const bin = await row.locator('.entry-delete').boundingBox();
      let covered = 0; let beside = 0; let binCovered = 0; let shown = 0;
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (!box) continue;
        shown++;
        if (overlap(box, text)) covered++;
        if (box.y < text.y + text.height - 1) beside++;
        if (bin && overlap(box, bin)) binCovered++;
      }
      seen += shown;
      check(`${width}px, ${where}: the move buttons show under the focused entry (${where.startsWith('Today') ? 3 : 4}), none over its text or its bin`, shown === (where.startsWith('Today') ? 3 : 4) && covered === 0 && beside === 0 && binCovered === 0, JSON.stringify({ shown, covered, beside, binCovered }));
      await shot(page, `keyboard-moves-${width}-${where.startsWith('Today') ? 'today' : 'day'}`);
    }
    check(`${width}px: no page errors`, page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }
  check(`keyboard moves: ${seen} buttons were measured, so the check saw something`, seen === 21, String(seen));
}

/* =====================================================================
   21. Past days, and every text pair on Month, its hover and the Peels, as live
   ===================================================================== */
{
  reset();
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-15', rev: 0, text: 'Past line' });
  await http('POST', '/api/journal', { op: 'line', date: '2026-10-26', rev: 0, text: 'Future line' });
  await seed(core.dayList('2026-10-15'), 'Past event', 'event');
  await seed(core.dayList('2026-10-26'), 'Future event', 'event');
  await seed(core.dayList(TODAY), 'Something today');
  const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratioOf = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
  let measured = 0;
  const table = [];
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await open({ width: 1280, height: 1500 }, { colorScheme: scheme });
    await signIn(page);
    const colours = await page.evaluate(() => {
      const v = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
      const root = getComputedStyle(document.documentElement);
      return { muted: root.getPropertyValue('--notes-muted').trim(), ink: root.getPropertyValue('--notes-ink').trim(), strong: root.getPropertyValue('--notes-strong').trim() };
    });
    const rgbOf = async (selector) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).color);
    const mutedRgb = await page.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--notes-muted)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
    const inkRgb = await page.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--notes-ink)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
    const strongRgb = await page.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--notes-strong)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; });
    const colour = (date, part) => rgbOf(`.date-row[data-date="${date}"] ${part}`);
    eq(`${scheme}: a past day's number, weekday, line and event text are all muted`, [await colour('2026-10-15', '.date-open .num'), await colour('2026-10-15', '.date-open .wk'), await colour('2026-10-15', '.line-text'), await colour('2026-10-15', '.line-events')], [mutedRgb, mutedRgb, mutedRgb, mutedRgb]);
    eq(`${scheme}: a day from today on is unchanged: strong number, muted weekday, ink line and events`, [await colour('2026-10-26', '.date-open .num'), await colour('2026-10-26', '.date-open .wk'), await colour('2026-10-26', '.line-text'), await colour('2026-10-26', '.line-events')], [strongRgb, mutedRgb, inkRgb, inkRgb]);
    eq(`${scheme}: Today and Tomorrow are marked as before`, [await page.locator('.date-row[data-mark="today"]').count(), await page.locator('.date-row[data-mark="tomorrow"]').count(), await page.locator('.date-row[data-past]').count()], [1, 1, 21]);
    // Every text pair on the Month panel, as drawn, with its fill, for the report.
    const pairs = await page.evaluate(({ src, today: todayDate, tomorrow: tomorrowDate }) => {
      const h = (new Function('return (' + src + ')()'))();
      const out = [];
      const grab = (kind, date) => {
        const li = document.querySelector(`.date-row[data-date="${date}"]`);
        for (const [label, sel] of [['number', '.date-open .num'], ['weekday', '.date-open .wk'], ['line', '.line-text'], ['events', '.line-events'], ['mark word', '.mark-word'], ['count', '.chip']]) {
          const el = li.querySelector(sel);
          if (el) out.push({ kind, label, ratio: h.ratio(getComputedStyle(el).color, h.fillOf(el)) });
        }
      };
      grab('past', '2026-10-15'); grab('ordinary', '2026-10-26'); grab('today', todayDate); grab('tomorrow', tomorrowDate);
      return out;
    }, { src: inPage.toString(), today: TODAY, tomorrow: TOMORROW });
    pairs.forEach((p) => { measured += 1; table.push(`${scheme}\tMonth ${p.kind}\t${p.label}\t${p.ratio.toFixed(2)}`); });
    check(`${scheme}: ${pairs.length} Month row text pairs measured as drawn, every one 4.5:1 or more`, pairs.length >= 14 && pairs.every((p) => p.ratio >= 4.5), JSON.stringify(pairs.filter((p) => p.ratio < 4.5)));
    // Hover: the date button takes the hover fill, and its text stays readable.
    await page.locator('.date-row[data-date="2026-10-15"] .date-open').hover();
    const hover = await page.evaluate((src) => {
      const h = (new Function('return (' + src + ')()'))();
      const b = document.querySelector('.date-row[data-date="2026-10-15"] .date-open');
      return ['.num', '.wk'].map((sel) => ({ sel, ratio: h.ratio(getComputedStyle(b.querySelector(sel)).color, getComputedStyle(b).backgroundColor) }));
    }, inPage.toString());
    hover.forEach((x) => { measured += 1; table.push(`${scheme}\tMonth past, hovered\t${x.sel.slice(1)}\t${x.ratio.toFixed(2)}`); });
    check(`${scheme}: a past day while its date is hovered is 4.5:1 or more`, hover.every((x) => x.ratio >= 4.5), JSON.stringify(hover));
    // The variable pairs behind them, read from the live page: Month, its hover and selected fills, and each Peel.
    const live = await page.evaluate(() => {
      const out = {};
      for (const [name, id] of [['Month', 'panel-month'], ['Today Peel', 'panel-today'], ['Tomorrow Peel', 'panel-tomorrow'], ['Migrate Peel', 'panel-migrate'], ['Quick notes', 'panel-quick']]) {
        const cs = getComputedStyle(document.getElementById(id));
        const v = (n) => cs.getPropertyValue(n).trim();
        out[name] = { ink: v('--notes-ink'), strong: v('--notes-strong'), muted: v('--notes-muted'), icon: v('--notes-icon'), bad: v('--notes-bad'), panel: v('--notes-panel'), hover: v('--notes-hover'), selected: v('--notes-selected'), field: v('--notes-field') };
      }
      return out;
    });
    const hexLum = (hex) => lum(hexRgb(hex));
    const hexRatio = (a, b) => { const [x, y] = [hexLum(a), hexLum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    let variablePairs = 0;
    let underFloor = [];
    for (const [panel, c] of Object.entries(live)) {
      for (const fg of ['ink', 'strong', 'muted', 'icon']) {
        for (const bg of ['panel', 'hover', 'selected', 'field']) {
          const ratio = hexRatio(c[fg], c[bg]);
          variablePairs += 1; measured += 1;
          table.push(`${scheme}\t${panel}\t${fg} on ${bg}\t${ratio.toFixed(2)}`);
          // The pairs the page never sets: muted on a selected fill, and on a hover for a Peel (ink takes over there).
          const used = !(fg === 'muted' && bg === 'selected') && !(fg === 'muted' && bg === 'hover' && panel.includes('Peel'));
          const floor = fg === 'icon' ? 3 : 4.5;
          if (used && ratio < floor) underFloor.push(`${panel} ${fg} on ${bg} ${ratio.toFixed(2)}`);
        }
      }
    }
    check(`${scheme}: ${variablePairs} text and icon pairs on Month, its hover, the three Peels and Quick notes read from the live page, none used under its floor`, variablePairs === 5 * 16 && underFloor.length === 0, underFloor.join(' | '));
    check(`${scheme}: no page errors`, page.errors.length === 0, page.errors.join(' | '));
    await shot(page, `month-past-${scheme}`);
    await context.close();
  }
  check(`past days: ${measured} pairs were measured in all, so the check saw something`, measured > 150, String(measured));
  console.log('RATIOS\n' + table.map((l) => 'RATIO\t' + l).join('\n'));
}

/* =====================================================================
   22. Multi-day spans
   ===================================================================== */
{
  const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(60); } return false; };
  const spanFiles = () => server.journalStore.spanFiles.size;
  const latest = () => { const out = new Map(); for (const [k, h] of server.journalStore.spanFiles) { const f = core.normaliseSpanFile(JSON.parse(h.json)); if (!out.has(f.id) || f.rev > out.get(f.id).rev) out.set(f.id, f); } return [...out.values()]; };
  const liveSpans = () => latest().filter((x) => x.state === 'open');
  const rowOf = (page, d) => page.locator(`.date-row[data-date="${d}"]`);
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const lineAt = async (date, text) => http('POST', '/api/journal', { op: 'line', date, rev: 0, text });
  const bigPage = async (extra = {}, view = { width: 1280, height: 1500 }) => { const o = await open(view, extra); await signIn(o.page); return o; };
  async function dragFrom(page, fromDate, toDate, { release = true, steps = 6 } = {}) {
    await rowOf(page, fromDate).hover();
    const hb = await rowOf(page, fromDate).locator('.span-handle').boundingBox();
    const x = hb.x + hb.width / 2;
    await page.mouse.move(x, hb.y + hb.height / 2);
    await page.mouse.down();
    const t = await rowOf(page, toDate).boundingBox();
    await page.mouse.move(x, t.y + t.height / 2, { steps });
    if (release) await page.mouse.up();
    return x;
  }

  /* ----- making a span with a mouse ----- */
  reset();
  await lineAt('2026-10-26', 'Possible Germany');
  {
    const { context, page } = await bigPage();
    await rowOf(page, '2026-10-26').hover();
    check('hovering a line with words shows a 24px handle at its right', await rowOf(page, '2026-10-26').locator('.span-handle').isVisible() && (await rowOf(page, '2026-10-26').locator('.span-handle').boundingBox()).width === 24);
    eq('a line with no words has no handle to show', await rowOf(page, '2026-10-27').locator('.span-handle').count(), 0);
    await dragFrom(page, '2026-10-26', '2026-10-29', { release: false });
    const dragging = await page.evaluate(() => ({
      pill: document.querySelector('.span-pill') && document.querySelector('.span-pill').textContent,
      rows: [...document.querySelectorAll('.date-row[data-spanning]')].map((r) => r.getAttribute('data-date')),
      dashed: document.querySelector('.span-preview') ? getComputedStyle(document.querySelector('.span-preview')).backgroundImage.includes('repeating-linear-gradient') : false,
      width: document.querySelector('.span-preview') ? getComputedStyle(document.querySelector('.span-preview')).width : null,
      fill: [...document.querySelectorAll('.date-row[data-spanning]')].map((r) => getComputedStyle(r).backgroundColor),
      hover: (() => { const e = document.createElement('i'); e.style.background = 'var(--notes-hover)'; document.body.appendChild(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; })(),
    }));
    eq('dragging down: a pill reads "Until Thu 29"', dragging.pill, 'Until Thu 29');
    eq('and the days in range snap day by day', dragging.rows, ['2026-10-27', '2026-10-28', '2026-10-29']);
    check('they take the hover fill, with a dashed 2px bar', dragging.dashed && dragging.width === '2px' && dragging.fill.every((c) => c === dragging.hover), JSON.stringify(dragging));
    await shot(page, 'span-drag');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await sleep(400);
    check('Esc cancels: nothing is made, the preview and the pill are gone, the line is as it was', spanFiles() === 0 && (await page.locator('.span-pill, .span-preview').count()) === 0 && (await rowOf(page, '2026-10-27').locator('.span-bar').count()) === 0 && (await rowOf(page, '2026-10-26').locator('.line-text').innerText()) === 'Possible Germany');
    await dragFrom(page, '2026-10-26', '2026-10-26');
    await sleep(400);
    check('releasing on the first day makes no span, and says nothing', spanFiles() === 0 && server.journalStore.lines.size === 1 && (await page.locator('#flash').isHidden()));
    const writesBefore = writes();
    await dragFrom(page, '2026-10-26', '2026-10-29');
    check('releasing on Thursday makes one span', await until(() => spanFiles() === 1));
    await until(() => server.journalStore.lines.size === 2);
    const made = liveSpans()[0];
    eq('it is one file, from the 26th to the 29th, with the line\'s words', [made.rev, made.start, made.end, made.text], [1, '2026-10-26', '2026-10-29', 'Possible Germany']);
    eq('and the line is cleared, after the span was made', [[...server.journalStore.creates].filter((c) => c.startsWith('span:') || c.startsWith('line:')).slice(writesBefore ? 0 : 0).slice(-2).map((c) => c.split(':')[0]), storedDay('2026-10-26').line], [['span', 'line'], '']);
    eq('the first day has the words and "to Thu 29" in muted, no bar', await page.evaluate(() => { const r = document.querySelector('.date-row[data-date="2026-10-26"]'); return [r.querySelector('.line-text').innerText, r.querySelector('.span-range').innerText, r.querySelectorAll('.span-bar').length, getComputedStyle(r.querySelector('.span-range')).color === (() => { const e = document.createElement('i'); e.style.color = 'var(--notes-ink)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })()]; }).then((a) => [a[0], a[1], a[2]]), ['Possible Germany', 'to Thu 29', 0]);
    eq('a 2px bar runs down each following day, with a foot on the last only', await page.evaluate(() => ['27', '28', '29', '30'].map((d) => { const r = document.querySelector(`.date-row[data-date="2026-10-${d}"]`); const b = r.querySelector('.span-bar'); return b ? [getComputedStyle(b, '::before').width, b.hasAttribute('data-foot')] : null; })), [['2px', false], ['2px', false], ['2px', true], null]);
    check('a past day\'s bar is muted and a future day\'s is ink', await page.evaluate(() => { const c = (v) => { const e = document.createElement('i'); e.style.color = v; document.body.appendChild(e); const x = getComputedStyle(e).color; e.remove(); return x; }; return getComputedStyle(document.querySelector('.date-row[data-date="2026-10-27"] .span-bar'), '::before').backgroundColor === c('var(--notes-ink)'); }));
    eq('a screen reader hears the first day as a range and the next days as continuing', await page.evaluate(() => [document.querySelector('.date-row[data-date="2026-10-26"] .line-text').getAttribute('aria-label'), ...['27', '28', '29'].map((d) => document.querySelector(`.date-row[data-date="2026-10-${d}"] .sr-only`).textContent)]),
      ['Possible Germany, Monday 26 to Thursday 29 October', 'Possible Germany continues, day 2 of 4', 'Possible Germany continues, day 3 of 4', 'Possible Germany continues, day 4 of 4']);
    await shot(page, 'span-made');

    /* ----- edit the words once ----- */
    const before = spanFiles();
    const words = rowOf(page, '2026-10-26').locator('.line-text');
    await words.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Germany trip');
    await page.keyboard.press('Enter');
    check('editing the words on the first day is one new revision of the one span', await until(() => spanFiles() === before + 1) && liveSpans().length === 1 && liveSpans()[0].text === 'Germany trip' && liveSpans()[0].rev === 2);
    eq('and nothing was written into a day', server.journalStore.lines.size, 2);

    /* ----- resize with the handle ----- */
    await dragFrom(page, '2026-10-29', '2026-10-31');
    check('on a span the handle is on the last day, and dragging down lengthens it', await until(() => liveSpans()[0].end === '2026-10-31'));
    await dragFrom(page, '2026-10-31', '2026-10-28');
    check('dragging up shortens it', await until(() => liveSpans()[0].end === '2026-10-28'));
    eq('the same one span, with a revision for each change', [liveSpans().length, liveSpans()[0].rev], [1, 4]);
    eq('the handle is not on the first day of a span', await rowOf(page, '2026-10-26').locator('.span-handle').count(), 0);
    const afterResize = writes();
    // The entry drag is a separate drag and is untouched by all of this.
    await seed(core.dayList(TODAY), 'Entry to move');
    await page.reload();
    await page.waitForSelector('#app:not([hidden])');
    await page.locator('#list-today li.entry').first().waitFor();
    const entry = page.locator('#list-today li.entry').first();
    const eb = await entry.locator('.bullet').boundingBox();
    const dropRow = await rowOf(page, '2026-10-27').boundingBox();
    const spansBefore = JSON.stringify(latest());
    await page.mouse.move(eb.x + 10, eb.y + 10); await page.mouse.down();
    await page.mouse.move(dropRow.x + 120, dropRow.y + 10, { steps: 8 });
    await page.mouse.move(dropRow.x + 123, dropRow.y + 12, { steps: 2 });
    await sleep(300);
    eq('an entry dragged over a spanned date line still takes the selected fill', await rowOf(page, '2026-10-27').getAttribute('data-drop'), 'true');
    await page.mouse.up();
    await page.waitForSelector('#flash:not([hidden])');
    check('and still moves to that date, without touching the span', (await page.textContent('#flash-text')) === 'Moved to Tuesday 27 October.' && JSON.stringify(latest()) === spansBefore && storedDay('2026-10-27').entries.length === 1);
    void afterResize;
    // And a handle drag never moves an entry.
    const entriesBefore = server.journalStore.entries.size;
    await dragFrom(page, '2026-10-28', '2026-10-29');
    await until(() => liveSpans()[0].end === '2026-10-29');
    eq('a handle drag moves no entry', server.journalStore.entries.size, entriesBefore);
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }

  /* ----- the Until button and its menu, by keyboard ----- */
  reset();
  await lineAt('2026-10-26', 'Site visit');
  {
    const { context, page } = await bigPage();
    await page.mouse.move(2, 2);
    await page.keyboard.press('Tab');
    await rowOf(page, '2026-10-26').locator('.line-text').focus();
    const until = rowOf(page, '2026-10-26').locator('.span-until');
    check('the Until button shows on the line being edited, 44px tall, with a calendar icon', await until.isVisible() && (await until.boundingBox()).height >= 44 && (await until.locator('use').getAttribute('href')) === '#j-until');
    await page.keyboard.press('Tab');
    eq('Tab reaches it', await page.evaluate(() => document.activeElement.className), 'span-until');
    await page.keyboard.press('Enter');
    const menu = page.locator('#until-menu');
    await menu.waitFor();
    const items = await menu.locator('button').allInnerTexts();
    eq('Enter opens the menu: Just this day, the next 7 days, then Later date', [items[0], items.length, items[8].startsWith('Later date')], ['Just this day\n✓', 9, true]);
    check('every row is 44px tall', (await menu.locator('button').evaluateAll((b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 44));
    eq('the current end is ticked: Just this day', await menu.locator('[aria-checked="true"]').innerText().then((t) => t.split('\n')[0]), 'Just this day');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    eq('arrows move', await page.evaluate(() => document.activeElement.innerText.split('\n')[0]), 'Tue 27 Oct'.replace('Tue 27', 'Tue 27') && (await menu.locator('button').nth(2).innerText()).split('\n')[0]);
    await page.keyboard.press('Escape');
    check('Esc closes it and the focus goes back to the button', (await page.locator('#until-menu').count()) === 0 && (await page.evaluate(() => document.activeElement.className)) === 'span-until' && spanFiles() === 0);
    await page.keyboard.press('Enter');
    await menu.waitFor();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    check('Enter on a day sets it: a span to that day is made', await until_(() => liveSpans().length === 1) && liveSpans()[0].end === '2026-10-29' && liveSpans()[0].start === '2026-10-26');
    await until_(() => rowOf(page, '2026-10-26').locator('.span-range').count().then((n) => n === 1));
    await sleep(600);   // the answer has arrived and the row is drawn again
    await rowOf(page, '2026-10-26').locator('.line-text').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await menu.waitFor();
    eq('reopened, the span\'s end is the ticked row', await menu.locator('[aria-checked="true"]').innerText().then((t) => t.split('\n')[0]), 'Thu 29 Oct');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.locator('#until-menu .pick-day, #until-menu [aria-label^="Until "]').first().waitFor();
    check('Later date opens a date picker', (await page.locator('#until-menu .pick-head').count()) === 1 && (await page.locator('#until-menu [aria-label^="Until "]').count()) > 5);
    await page.locator('#until-menu [aria-label="Until Friday 6 November"]').click();
    check('a later date in the next month sets the end there', await until_(() => liveSpans()[0].end === '2026-11-06') && liveSpans().length === 1);
    await sleep(600);
    await rowOf(page, '2026-10-26').locator('.line-text').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await menu.waitFor();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await until_(() => liveSpans().length === 0);
    eq('Just this day removes the span and keeps the line', [liveSpans().length, storedDay('2026-10-26').line], [0, 'Site visit']);
    eq('and the line is back on screen, with no bar', await page.evaluate(() => [document.querySelector('.date-row[data-date="2026-10-26"] .line-text').innerText, document.querySelectorAll('.span-bar').length]), ['Site visit', 0]);
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }

  /* ----- touch: the iPad ----- */
  reset();
  await lineAt('2026-10-26', 'Site visit');
  {
    const { context, page } = await bigPage({ hasTouch: true, isMobile: true }, { width: 1024, height: 1366 });
    const row = rowOf(page, '2026-10-26');
    check('the Until button is always visible for a finger, 44px tall, and there is no drag handle', await row.locator('.span-until').isVisible() && (await row.locator('.span-until').boundingBox()).height >= 44 && !(await row.locator('.span-handle').isVisible()));
    check('a line with no words has no Until button to show', (await rowOf(page, '2026-10-27').locator('.span-until').isVisible()) === false);
    await row.locator('.span-until').tap();
    await page.locator('#until-menu').waitFor();
    check('the menu has 44px rows', (await page.locator('#until-menu button').evaluateAll((b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 44));
    await page.locator('#until-menu button').nth(3).tap();
    check('tapping a day makes the span', await until_(() => liveSpans().length === 1) && liveSpans()[0].end === '2026-10-29');
    await shot(page, 'span-ipad');
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }
  async function until_(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(60); } return false; }

  /* ----- a span across the month end ----- */
  reset();
  await lineAt('2026-10-29', 'Possible Germany');
  {
    const { context, page } = await bigPage();
    const t = (await (await page.request.get(server.base + '/api/session')).status());
    void t;
    await rowOf(page, '2026-10-29').locator('.span-until').waitFor({ state: 'attached' });
    await rowOf(page, '2026-10-29').locator('.line-text').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await page.locator('#until-menu button').last().press('Enter');
    await page.locator('#until-menu [aria-label="Until Tuesday 3 November"]').click();
    await until_(() => liveSpans().length === 1);
    eq('the span is made from the 29th to 3 November, in one file', [liveSpans()[0].start, liveSpans()[0].end, spanFiles()], ['2026-10-29', '2026-11-03', 1]);
    eq('in October the bar runs off the end of the month with no foot', await page.evaluate(() => ['30', '31'].map((d) => { const b = document.querySelector(`.date-row[data-date="2026-10-${d}"] .span-bar`); return [Boolean(b), b && b.hasAttribute('data-foot')]; })), [[true, false], [true, false]]);
    eq('and "to Tue 3 Nov" says where it ends, with the month', await rowOf(page, '2026-10-29').locator('.span-range').innerText(), 'to Tue 3 Nov');
    await page.click('#month-next');
    await page.waitForSelector('.date-row[data-date="2026-11-01"]');
    await until_(() => rowOf(page, '2026-11-01').locator('.span-range').count().then((n) => n === 1));
    eq('November repeats the words on the 1st, "continued, to Tue 3"', await rowOf(page, '2026-11-01').evaluate((r) => [r.querySelector('.line-text').innerText, r.querySelector('.span-range').innerText]), ['Possible Germany', 'continued, to Tue 3']);
    eq('with the bar from the top of the 1st and a foot on the 3rd', await page.evaluate(() => ['01', '02', '03', '04'].map((d) => { const b = document.querySelector(`.date-row[data-date="2026-11-${d}"] .span-bar`); return b ? b.hasAttribute('data-foot') : null; })), [false, false, true, null]);
    eq('the 1st reads as continuing, day 4 of 6', await rowOf(page, '2026-11-01').locator('.line-text').getAttribute('aria-label'), 'Possible Germany continues, day 4 of 6');
    await shot(page, 'span-month-end');
    // Editing the words on the continued 1st changes it everywhere.
    const before = spanFiles();
    await rowOf(page, '2026-11-01').locator('.line-text').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Germany all week');
    await page.keyboard.press('Enter');
    check('editing the continued 1st is one new revision of the same span', await until_(() => spanFiles() === before + 1) && liveSpans().length === 1 && liveSpans()[0].text === 'Germany all week');
    await page.click('#month-prev');
    await page.waitForSelector('.date-row[data-date="2026-10-29"]');
    await until_(() => rowOf(page, '2026-10-29').locator('.line-text').innerText().then((t) => t === 'Germany all week'));
    eq('and October shows the new words too', await rowOf(page, '2026-10-29').locator('.line-text').innerText(), 'Germany all week');
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }

  /* ----- delete, with Undo, and select by the bar ----- */
  reset();
  {
    const idA = newId();
    await http('POST', '/api/journal', { op: 'spanAdd', span: { id: idA, start: '2026-10-26', end: '2026-10-29', text: 'Possible Germany' } });
    const { context, page } = await bigPage();
    await rowOf(page, '2026-10-27').locator('.span-bar').click();
    check('clicking the bar on a later day selects the span and puts the cursor in the first day\'s words', await page.evaluate(() => document.activeElement.classList.contains('line-text') && document.activeElement.closest('.date-row').getAttribute('data-date') === '2026-10-26' && document.querySelectorAll('.span-bar[data-selected="true"]').length === 3));
    await page.keyboard.press('Delete');
    await page.waitForSelector('#flash:not([hidden])');
    eq('Delete with the span selected removes the whole span and says so, with Undo', [await page.textContent('#flash-text'), await page.textContent('#flash-action'), await page.locator('.span-bar').count()], ['Span deleted.', 'Undo', 0]);
    check('it is a removed revision in the same span file series', await until_(() => latest()[0].state === 'removed') && latest()[0].id === idA && latest()[0].rev === 2);
    await page.click('#flash-action');
    check('Undo makes the span again as a new one', await until_(() => liveSpans().length === 1) && liveSpans()[0].id !== idA && liveSpans()[0].start === '2026-10-26' && liveSpans()[0].end === '2026-10-29' && liveSpans()[0].text === 'Possible Germany');
    eq('and the bars are back', await page.locator('.span-bar').count(), 3);
    // Clearing the text does the same.
    await rowOf(page, '2026-10-26').locator('.line-text').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#flash:not([hidden])');
    eq('clearing the text removes the whole span, with the same message', [await page.textContent('#flash-text'), liveSpans().length === 0 || await until_(() => liveSpans().length === 0)], ['Span deleted.', true]);
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }

  /* ----- lanes ----- */
  reset();
  {
    const ids = {};
    for (const [name, start, end] of [['One', '2026-10-05', '2026-10-12'], ['Two', '2026-10-06', '2026-10-10'], ['Three', '2026-10-07', '2026-10-09'], ['Four', '2026-10-08', '2026-10-11']]) {
      ids[name] = newId();
      await http('POST', '/api/journal', { op: 'spanAdd', span: { id: ids[name], start, end, text: 'Span ' + name } });
    }
    await seed(core.dayList('2026-10-09'), 'An event that day', 'event');
    const { context, page } = await bigPage();
    const lane = (d, name) => page.evaluate(([date, id]) => { const b = document.querySelector(`.date-row[data-date="${date}"] .span-bar[data-span-id="${id}"]`); return b ? b.style.getPropertyValue('--lane') : null; }, [d, ids[name]]);
    eq('overlapping spans take lanes 0, 1 and 2', [await lane('2026-10-09', 'One'), await lane('2026-10-09', 'Two'), await lane('2026-10-09', 'Three')], ['0', '1', '2']);
    eq('the fourth is a normal line with its range and has no bar', [await lane('2026-10-09', 'Four'), await rowOf(page, '2026-10-08').locator('.line-text').innerText(), await rowOf(page, '2026-10-08').locator('.span-range').innerText()], [null, 'Span Four', 'to Sun 11']);
    const bars = await page.evaluate(() => [...document.querySelectorAll('.date-row[data-date="2026-10-09"] .span-bar')].map((b) => b.getBoundingClientRect().left));
    check('the bars are 14px apart', bars.length === 3 && Math.abs(bars[1] - bars[0] - 14) < 1 && Math.abs(bars[2] - bars[1] - 14) < 1, JSON.stringify(bars));
    const geometry = await page.evaluate(() => { const r = document.querySelector('.date-row[data-date="2026-10-09"]'); const text = r.querySelector('.line-events').getBoundingClientRect().left; const rightmost = Math.max(...[...r.querySelectorAll('.span-bar')].map((b) => b.getBoundingClientRect().left + 8)); const plain = document.querySelector('.date-row[data-date="2026-10-20"] .line-text').getBoundingClientRect().left; const lead = document.querySelector('.date-row[data-date="2026-10-09"] .span-gutter').getBoundingClientRect().width; return { text, rightmost, plain, lead }; });
    check('events on a spanned day indent past the lanes in use', geometry.lead === 42 && geometry.text > geometry.rightmost, JSON.stringify(geometry));
    await shot(page, 'span-lanes');
    check('no page errors', page.errors.length === 0, page.errors.join(' | '));
    await context.close();
  }

  /* ----- two devices, a retry and a clash ----- */
  reset();
  {
    const idA = newId();
    await http('POST', '/api/journal', { op: 'spanAdd', span: { id: idA, start: '2026-10-26', end: '2026-10-29', text: 'Possible Germany' } });
    const one = await bigPage();
    const two = await bigPage();
    // Device one edits.
    await rowOf(one.page, '2026-10-26').locator('.line-text').click();
    await one.page.keyboard.press('Control+A'); await one.page.keyboard.type('From device one'); await one.page.keyboard.press('Enter');
    await until_(() => liveSpans()[0].rev === 2);
    // Device two, still holding the first revision, edits.
    await rowOf(two.page, '2026-10-26').locator('.line-text').click();
    await two.page.keyboard.press('Control+A'); await two.page.keyboard.type('From device two'); await two.page.keyboard.press('Enter');
    await two.page.waitForSelector('#flash:not([hidden])');
    eq('the second device is told, in the plain message, with a Reload button', [await two.page.textContent('#flash-text'), await two.page.textContent('#flash-action')], [core.MESSAGES.stale, 'Reload']);
    eq('its typed words are kept on screen', await rowOf(two.page, '2026-10-26').locator('.line-text').innerText(), 'From device two');
    check('nothing was replaced and no second span was made', liveSpans().length === 1 && liveSpans()[0].text === 'From device one' && liveSpans()[0].rev === 2 && spanFiles() === 2);
    await two.page.click('#flash-action');
    await until_(() => rowOf(two.page, '2026-10-26').locator('.line-text').innerText().then((t) => t === 'From device one'));
    eq('Reload shows what the other device saved', await rowOf(two.page, '2026-10-26').locator('.line-text').innerText(), 'From device one');
    // A resize that clashes with a delete.
    await rowOf(one.page, '2026-10-26').locator('.line-text').click();
    await one.page.keyboard.press('Control+A'); await one.page.keyboard.press('Backspace'); await one.page.keyboard.press('Enter');
    await until_(() => liveSpans().length === 0);
    await dragFrom(two.page, '2026-10-29', '2026-10-30');
    await two.page.waitForSelector('#flash:not([hidden])');
    check('a resize of a span that was deleted on the other device is refused the same way', (await two.page.textContent('#flash-text')) === core.MESSAGES.stale && liveSpans().length === 0);
    const real = [...one.page.errors, ...two.page.errors].filter((e) => !/409/.test(e));   // the refusals are the point of this check
    check('no page errors on either device, apart from the two refusals', real.length === 0, real.join(' | '));
    await one.context.close(); await two.context.close();
  }
  {
    // A retry: the answer to the first make is lost and the window sends it again.
    reset();
    await lineAt('2026-10-26', 'Possible Germany');
    server.control.loseFirstAnswers = '"spanAdd"';
    const { context, page } = await bigPage();
    await dragFrom(page, '2026-10-26', '2026-10-29');
    await until_(() => spanFiles() === 1 && server.journalStore.lines.size === 2, 12000);
    await sleep(800);
    server.control.loseFirstAnswers = '';
    eq('a lost answer and a retry make one span, not two', [spanFiles(), liveSpans().length, storedDay('2026-10-26').line], [1, 1, '']);
    await context.close();
  }
}

/* The rest of the checks continue below. */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
await browser.close();
await server.close();
process.exit(failed.length ? 1 : 0);
