// The journal against the worst the real Blob store may do. Found on the Preview,
// 22 October 2026, in two rounds: entries vanished a few seconds after being added,
// one move showed twice, and then, with the first fix in, entries still vanished on
// a refresh and a change was refused with "Could not save that change".
//
// The cause: one file per month meant every change was read, changed and written
// back, against a store that can return an older copy of a file after it was
// overwritten. Vercel's documentation says that overwriting or deleting a blob "may
// take up to 60 seconds to propagate through our cache". A change made from the old
// copy loses what came after it, however the timing is handled.
//
// Each entry is now its own file and no entry file is ever overwritten. These tests
// run the API against a stand-in that serves an older copy of an overwritten file
// for 60 seconds, and one whose listings leave out a file made in the last 60
// seconds, and prove that adding, editing, moving and Bring forward lose nothing,
// double nothing and never wait for the store.

import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../journal/core.js";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { buildJournal, day, home, months, newId, post, send } from "./journal-helpers.js";

const TODAY = "2026-10-22";
const LIST = day(TODAY);
const OCT = "2026-10";
const LAG = 60_000;
const SECOND = 1000;

// A store that serves an overwritten file as it was 60 seconds ago and does not list
// a file made in the last 60 seconds.
const lagging = () => buildJournal({ lagMs: LAG, listLagMs: LAG });
const at = (t) => t.clock.now;
const add = (t, text, list = LIST, id = newId(), extra = {}) => post(t, { op: "add", list, at: (t.clock.now += SECOND), entry: { id, type: "task", text }, ...extra });

// What is really stored, whatever a lagging read or listing would show.
function truth(t, month = OCT) {
  const records = [];
  for (const [key, held] of t.store.entries) {
    const found = core.normaliseEntryFile(JSON.parse(held.json));
    if (core.parseList(found.list).month === month) records.push(found);
  }
  const lines = [...t.store.lines.values()].map((held) => core.normaliseLineFile(JSON.parse(held.json))).filter((l) => l.date.startsWith(month));
  return core.viewFrom([month], records, lines)[month];
}
const texts = (entries) => core.liveEntries(entries).filter((e) => e.state === "open" || e.state === "done").map((e) => e.text);
const live = (file, date) => core.liveEntries((file.days[date] || { entries: [] }).entries);
const another = (t) => createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });

test("the stand-in really does what the documentation says, so the tests below are not vacuous", async () => {
  const t = lagging();
  const put = (body, base) => send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body, headers: { "x-base-updated": base } });
  const first = await put("one", "none");
  assert.equal(first.status, 200);
  assert.equal((await t.store.readQuick()).text, "", "an overwritten file is read as it was, for 60 seconds");
  t.clock.now += LAG - 1;
  assert.equal((await t.store.readQuick()).text, "");
  t.clock.now += 2;
  assert.equal((await t.store.readQuick()).text, "one", "and is the file after that");

  const id = (await add(t, "Listed late").then((r) => r.json())).created[0];
  assert.deepEqual((await t.store.entriesOfMonth(OCT)), [], "a file made in the last 60 seconds is not in a listing");
  t.clock.now += LAG + 1;
  assert.deepEqual((await t.store.entriesOfMonth(OCT)).map((e) => e.entry.id), [id]);
});

test("a run of adds, each a second after the last, loses none and makes none twice", async () => {
  const t = lagging();
  for (const text of ["A", "B", "C", "D", "E"]) {
    const response = await add(t, text);
    assert.equal(response.status, 200, text);
  }
  assert.deepEqual(texts(truth(t).days[TODAY].entries), ["A", "B", "C", "D", "E"]);
  assert.equal(t.store.creates.length, 5, "one new file for each add and nothing else");
  assert.deepEqual(t.sleeps, [], "no waiting");
  assert.equal(t.store.state.reads, 0, "and nothing read");
});

test("an edit and a tick straight after the add are not refused as a clash", async () => {
  const t = lagging();
  const id = newId();
  await add(t, "Typo", LIST, id);
  const edited = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "Fixed" });
  assert.equal(edited.status, 200, "the entry exists at revision 1, whatever a lagging read or listing shows");
  const ticked = await post(t, { op: "state", list: LIST, id, rev: 2, state: "done" });
  assert.equal(ticked.status, 200);
  assert.deepEqual(live(truth(t), TODAY).map((e) => [e.text, e.state, e.rev]), [["Fixed", "done", 3]]);
  assert.deepEqual(t.sleeps, []);
});

test("a move straight after the add makes exactly one copy", async () => {
  const t = lagging();
  const id = newId();
  await add(t, "Book the van", LIST, id);
  const moved = await post(t, { op: "move", from: LIST, to: day("2026-10-23"), how: "migrated", at: at(t), items: [{ id, rev: 1 }] });
  assert.equal(moved.status, 200);
  const file = truth(t);
  assert.equal(live(file, "2026-10-23").length, 1, "one copy");
  assert.equal(live(file, TODAY).filter((e) => e.state === "migrated").length, 1, "one original, marked once");
  assert.deepEqual(t.sleeps, []);
});

test("the same move sent again, and again, after the answer was lost, makes one copy", async () => {
  const t = lagging();
  const id = newId();
  await add(t, "Chase the invoice", LIST, id);
  const op = { op: "move", from: LIST, to: core.migrateList(OCT), how: "migrated", at: at(t), items: [{ id, rev: 1 }] };
  await post(t, op);                       // the answer never reaches the page
  t.clock.now += 3 * SECOND;
  for (const instance of [t.api, another(t), another(t)]) {
    const again = await send(instance.POST, { method: "POST", cookie: t.cookie, body: op });
    assert.equal(again.status, 200, "a repeat of a change that already happened is not a clash");
    t.clock.now += 3 * SECOND;
  }
  const file = truth(t);
  assert.equal(file.migrate.length, 1, "exactly one copy");
  assert.equal(live(file, TODAY)[0].rev, 2, "and the original was marked once");
  assert.equal(t.store.creates.length, 3, "the add, the copy and the mark, and nothing from the repeats");
});

test("Bring forward of several, sent twice, makes one copy of each", async () => {
  const t = lagging();
  const yesterday = day("2026-10-21");
  const ids = [newId(), newId(), newId()];
  for (const [i, id] of ids.entries()) await add(t, "Task " + i, yesterday, id);
  const op = { op: "move", from: yesterday, to: LIST, how: "migrated", at: at(t), items: ids.map((id) => ({ id, rev: 1 })) };
  assert.equal((await post(t, op)).status, 200);
  t.clock.now += SECOND;
  assert.equal((await send(another(t).POST, { method: "POST", cookie: t.cookie, body: op })).status, 200);
  const file = truth(t);
  assert.deepEqual(texts(live(file, TODAY)), ["Task 0", "Task 1", "Task 2"], "three copies, not six");
  assert.equal(live(file, "2026-10-21").filter((e) => e.state === "migrated").length, 3);
});

test("a move that crosses into another month, sent twice, makes one copy", async () => {
  const t = lagging();
  const from = core.migrateList("2026-09");
  const to = core.migrateList(OCT);
  const id = newId();
  await add(t, "Renew the licence", from, id);
  const op = { op: "move", from, to, how: "migrated", at: at(t), items: [{ id, rev: 1 }] };
  assert.equal((await post(t, op)).status, 200);
  assert.equal((await post(t, op)).status, 200);
  assert.equal(truth(t).migrate.length, 1);
  assert.equal(truth(t, "2026-09").migrate.filter((e) => e.state === "migrated").length, 1);
});

test("a move, an undo and the same move again make one visible copy and meet nothing left behind", async () => {
  const t = lagging();
  const id = newId();
  const to = day("2026-10-28");
  await add(t, "Maybe later", LIST, id);
  assert.equal((await post(t, { op: "move", from: LIST, to, how: "scheduled", at: at(t), items: [{ id, rev: 1 }] })).status, 200);
  assert.equal((await post(t, { op: "undo", list: LIST, id, rev: 2, toList: to })).status, 200);
  assert.equal(live(truth(t), "2026-10-28").length, 0, "the copy was taken back");
  assert.equal((await post(t, { op: "move", from: LIST, to, how: "scheduled", at: at(t), items: [{ id, rev: 3 }] })).status, 200);
  assert.deepEqual(texts(live(truth(t), "2026-10-28")), ["Maybe later"], "one copy, and it is a new one");
  // The undo sent again after its answer was lost has already happened: it is done,
  // and it does not take back the new copy.
  assert.equal((await post(t, { op: "undo", list: LIST, id, rev: 2, toList: to })).status, 200);
  assert.deepEqual(texts(live(truth(t), "2026-10-28")), ["Maybe later"], "nothing moved");
  assert.equal(live(truth(t), TODAY)[0].state, "scheduled");
});

test("a calendar line saved twice in a row, and cleared, is not refused as a clash", async () => {
  const t = lagging();
  assert.equal((await post(t, { op: "line", date: "2026-10-24", rev: 0, text: "Dentist" })).status, 200);
  assert.equal((await post(t, { op: "line", date: "2026-10-24", rev: 1, text: "Dentist at 9" })).status, 200);
  assert.equal((await post(t, { op: "line", date: "2026-10-24", rev: 2, text: "" })).status, 200);
  assert.equal((await post(t, { op: "line", date: "2026-10-24", rev: 3, text: "Moved to 10" })).status, 200);
  assert.equal(truth(t).days["2026-10-24"].line, "Moved to 10");
  assert.equal(truth(t).days["2026-10-24"].lineRev, 4);
  assert.deepEqual(t.sleeps, []);
});

test("a view read during the lag is shorter than the truth and is never wrong, and after the lag it is the truth", async () => {
  const t = lagging();
  await add(t, "First");
  await add(t, "Second");
  const during = await (await months(t, OCT)).json();
  assert.ok(live(during.months[OCT], TODAY).length <= 2, "a listing may leave a new file out");
  assert.deepEqual(texts(live(truth(t), TODAY)), ["First", "Second"], "and what is stored is whole");
  t.clock.now += LAG + 1;
  const later = await (await home(t)).json();
  assert.deepEqual(texts(live(later.months[OCT], TODAY)), ["First", "Second"], "after the lag the read is the truth");
});

test("every change goes to an instance that remembers nothing, and none is lost or refused", async () => {
  const t = lagging();
  const instance = () => another(t);
  const send1 = (op) => send(instance().POST, { method: "POST", cookie: t.cookie, body: op });
  const a = newId();
  const b = newId();
  assert.equal((await send1({ op: "add", list: LIST, at: 1, entry: { id: a, type: "task", text: "A" } })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await send1({ op: "add", list: LIST, at: 2, entry: { id: b, type: "task", text: "B" } })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await send1({ op: "edit", list: LIST, id: a, rev: 1, text: "A edited" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await send1({ op: "state", list: LIST, id: b, rev: 1, state: "done" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await send1({ op: "move", from: LIST, to: core.migrateList(OCT), how: "migrated", at: 3, items: [{ id: a, rev: 2 }, { id: b, rev: 2 }] })).status, 409, "a ticked task is not moved, and nothing of the move is written");
  assert.equal((await send1({ op: "move", from: LIST, to: core.migrateList(OCT), how: "migrated", at: 4, items: [{ id: a, rev: 2 }] })).status, 200);
  const file = truth(t);
  assert.deepEqual(file.migrate.map((e) => e.text), ["A edited"]);
  assert.deepEqual(live(file, TODAY).map((e) => [e.text, e.state]), [["A edited", "migrated"], ["B", "done"]]);
  assert.deepEqual(t.sleeps, [], "nothing waited, on any instance");
});

test("two hundred changes, some sent twice and each to a different instance, end as a single device would have left them", async () => {
  const t = lagging();
  const model = { [OCT]: core.emptyMonth(), "2026-11": core.emptyMonth() };
  let seed = 20261022;
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const lists = [LIST, day("2026-10-23"), core.migrateList(OCT), core.migrateList("2026-11"), day("2026-11-02")];
  const everyEntry = () => lists.flatMap((list) => core.entriesOf(model, list).map((e) => ({ list, e })));
  const asFlat = (view) => [...Object.values(view)].flatMap((file) => [
    ...file.migrate.map((e) => ({ list: "m", ...e })),
    ...Object.entries(file.days).flatMap(([date, d]) => d.entries.map((e) => ({ list: date, ...e }))),
  ]).sort((x, y) => (x.id < y.id ? -1 : 1));
  const storedNow = () => ({ [OCT]: truth(t, OCT), "2026-11": truth(t, "2026-11") });
  let sent = 0;
  let refusedByModel = 0;
  for (let i = 0; i < 200; i += 1) {
    t.clock.now += random(4) * SECOND;
    const open = everyEntry().filter(({ e }) => e.state === "open" || e.state === "done");
    const pick = () => open[random(open.length)];
    let op;
    const kind = open.length < 3 ? 0 : random(10);
    if (kind <= 2) {
      const list = lists[random(lists.length)];
      op = { op: "add", list, at: at(t), entry: { id: newId(), type: ["task", "task", "event", "note"][random(4)], text: "Entry " + i } };
    } else if (kind === 3) {
      const { list, e } = pick(); op = { op: "edit", list, id: e.id, rev: e.rev, text: "Edited " + i };
    } else if (kind === 4) {
      const { list, e } = pick(); op = { op: "state", list, id: e.id, rev: e.rev, state: e.state === "done" ? "open" : "done" };
    } else if (kind === 5) {
      const { list, e } = pick(); op = { op: "remove", list, id: e.id, rev: e.rev };
    } else if (kind === 6) {
      const { list, e } = pick(); op = { op: "drop", list, items: [{ id: e.id, rev: e.rev }] };
    } else if (kind === 7 || kind === 8) {
      const picked = [pick(), pick()].filter(({ list }, n, all) => all.findIndex((x) => x.list === list) === n && all[0].list === list);
      const from = picked[0].list;
      const to = lists.filter((l) => l !== from)[random(lists.length - 1)];
      const how = core.parseList(to).kind === "day" && random(2) ? "scheduled" : "migrated";
      op = { op: "move", from, to, how, at: at(t), items: [...new Map(picked.map(({ e }) => [e.id, { id: e.id, rev: e.rev }])).values()] };
    } else {
      const moved = everyEntry().filter(({ e }) => e.state === "migrated" || e.state === "scheduled");
      if (moved.length === 0) continue;
      const { list, e } = moved[random(moved.length)];
      op = { op: "undo", list, id: e.id, rev: e.rev, toList: e.to };
    }
    const before = JSON.stringify(model);
    const result = core.applyOp(model, op);
    if (result.error) {
      assert.equal(JSON.stringify(model), before, "a refused change leaves the model alone");
      refusedByModel += 1;
    }
    // The server is sent what the page would send: every change, and some of them again.
    const attempts = 1 + (random(4) === 0 ? 1 + random(2) : 0);
    for (let n = 0; n < attempts; n += 1) {
      const response = await send(another(t).POST, { method: "POST", cookie: t.cookie, body: op });
      sent += 1;
      const expected = result.error ? (result.error.code === "undo" ? 409 : 409) : 200;
      assert.equal(response.status, result.error && result.error.code === "invalid" ? 400 : expected, `change ${i} (${op.op}) sent ${n + 1} of ${attempts}: ${JSON.stringify(op).slice(0, 160)}`);
    }
    t.clock.now += SECOND;
    assert.deepEqual(asFlat(storedNow()), asFlat(model), `after change ${i} (${op.op}), what is stored is what one device would hold`);
  }
  assert.ok(sent > 200 && refusedByModel < 100, `a real mix: ${sent} sent, ${refusedByModel} refused`);
  const stored = storedNow();
  const normalise = (list) => JSON.parse(JSON.stringify(list));
  // A day that only holds its own line leaves no trace in either, and a day opened to look is dropped.
  assert.deepEqual(normalise(asFlat(stored)), normalise(asFlat(model)), "every entry, at every revision, exactly as one device would have left them");
  assert.deepEqual(t.sleeps, [], "and not one change waited for the store");
});

// ---------- quick notes: the one file that is overwritten ----------
//
// Quick notes are one block of text with the rule a note has. They are the one
// thing the journal overwrites, so they are the one thing still exposed to an old
// read, and the one place that waits. They wait up to about six seconds, which
// covers a store a few seconds behind. A store 60 seconds behind is past it: the
// save is then refused as busy, with nothing lost and the text still on the page.

const quickPut = (api, t, body, base) => send(api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body, headers: { "x-base-updated": base } });

test("quick notes saved twice in a row by one instance are not refused, at 60 seconds of lag", async () => {
  const t = lagging();
  const first = await quickPut(t.api, t, "one", "none");
  assert.equal(first.status, 200);
  const second = await quickPut(t.api, t, "one two", (await first.json()).updatedAt);
  assert.equal(second.status, 200, "the instance remembers what it wrote");
  assert.equal(t.store.inner.state.quick.text, "one two");
});

test("quick notes saved through another instance while the store is a few seconds behind are not refused", async () => {
  const t = buildJournal({ lagMs: 5000 });
  const first = await quickPut(t.api, t, "one", "none");
  const second = await quickPut(another(t), t, "one two", (await first.json()).updatedAt);
  assert.equal(second.status, 200, "it waited for the store to catch up");
  assert.ok(t.sleeps.length > 0);
  assert.equal(t.store.inner.state.quick.text, "one two");
});

test("quick notes through another instance 60 seconds behind are refused as busy, losing nothing", async () => {
  const t = lagging();
  const first = await quickPut(t.api, t, "one", "none");
  const second = await quickPut(another(t), t, "one two", (await first.json()).updatedAt);
  assert.equal(second.status, 503, "busy, not a clash and not a silent overwrite");
  assert.equal(t.store.inner.state.quick.text, "one", "what was saved is still saved");
  assert.ok(t.sleeps.reduce((a, b) => a + b, 0) <= 8000, "and it gave up inside the time a function may run");
});
