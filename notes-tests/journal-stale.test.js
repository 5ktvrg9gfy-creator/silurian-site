// A store whose reads lag behind its writes, which the real Blob store may do
// and the in-memory stand-in does not. Found on the Preview, 22 October 2026:
// entries vanished a few seconds after being added, and one move showed twice.
// Each test here is a case of that: a change made while the store still shows
// the file as it was a few seconds ago. None may lose a change, refuse one as a
// clash when it is not, or make a second copy.

import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../journal/core.js";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { buildJournal, day, home, months, newId, post, send } from "./journal-helpers.js";

const TODAY = "2026-10-22";
const LIST = day(TODAY);
const LAG = 5000;
const OCT = "2026-10";

const truth = (t, month = OCT) => JSON.parse(t.store.inner.files.get(month).json);
const lagging = () => buildJournal({ lagMs: LAG });
const add = (t, text, known, list = LIST, id = newId()) =>
  post(t, { op: "add", list, entry: { id, type: "task", text }, ...(known ? { known } : {}) });

test("an add straight after an add keeps both, though the store still shows the file as it was", async () => {
  const t = lagging();
  const first = await add(t, "First");
  assert.equal(first.status, 200);
  const rev = (await first.json()).months[OCT].rev;
  const second = await add(t, "Second", { [OCT]: rev });
  assert.equal(second.status, 200, "the second add must not be refused because the store is behind");
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => e.text), ["First", "Second"]);
});

test("a run of adds, each straight after the last, loses none", async () => {
  const t = lagging();
  let rev = 0;
  for (const text of ["A", "B", "C", "D", "E"]) {
    const response = await add(t, text, rev ? { [OCT]: rev } : undefined);
    assert.equal(response.status, 200, text);
    rev = (await response.json()).months[OCT].rev;
  }
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => e.text), ["A", "B", "C", "D", "E"]);
});

test("a change to an entry straight after it was added is not refused as a clash", async () => {
  const t = lagging();
  const id = newId();
  const made = await add(t, "Typo", undefined, LIST, id);
  const rev = (await made.json()).months[OCT].rev;
  const edited = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "Fixed", known: { [OCT]: rev } });
  assert.equal(edited.status, 200, "the entry exists at revision 1, whatever a lagging read shows");
  const ticked = await post(t, { op: "state", list: LIST, id, rev: 2, state: "done", known: { [OCT]: rev + 1 } });
  assert.equal(ticked.status, 200);
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => [e.text, e.state, e.rev]), [["Fixed", "done", 3]]);
});

test("a move straight after the add makes exactly one copy", async () => {
  const t = lagging();
  const id = newId();
  const made = await add(t, "Book the van", undefined, LIST, id);
  const rev = (await made.json()).months[OCT].rev;
  const copyId = newId();
  const moved = await post(t, { op: "move", from: LIST, to: day("2026-10-23"), how: "migrated", items: [{ id, rev: 1, copyId }], known: { [OCT]: rev } });
  assert.equal(moved.status, 200);
  const file = truth(t);
  assert.equal(file.days["2026-10-23"].entries.length, 1, "one copy");
  assert.equal(file.days[TODAY].entries.filter((e) => e.state === "migrated").length, 1, "one original, marked once");
});

test("the same move sent again after the answer was lost is done once", async () => {
  const t = lagging();
  const id = newId();
  const made = await add(t, "Chase the invoice", undefined, LIST, id);
  const rev = (await made.json()).months[OCT].rev;
  const op = { op: "move", from: LIST, to: core.migrateList(OCT), how: "migrated", items: [{ id, rev: 1, copyId: newId() }], known: { [OCT]: rev } };
  await post(t, op);                       // the answer never reaches the page
  const again = await post(t, op);         // the page sends the same change again
  assert.equal(again.status, 200, "a repeat of a change that already happened is not a clash");
  const file = truth(t);
  assert.equal(file.migrate.length, 1, "exactly one copy");
  assert.equal(file.days[TODAY].entries[0].rev, 2, "and the original was marked once");
  const third = await post(t, op);
  assert.equal(third.status, 200);
  assert.equal(truth(t).migrate.length, 1);
});

test("Bring forward of several, sent twice, makes one copy of each", async () => {
  const t = lagging();
  const yesterday = day("2026-10-21");
  const ids = [newId(), newId(), newId()];
  let rev = 0;
  for (const [i, id] of ids.entries()) {
    const made = await add(t, "Task " + i, rev ? { [OCT]: rev } : undefined, yesterday, id);
    rev = (await made.json()).months[OCT].rev;
  }
  const op = { op: "move", from: yesterday, to: LIST, how: "migrated", items: ids.map((id) => ({ id, rev: 1, copyId: newId() })), known: { [OCT]: rev } };
  assert.equal((await post(t, op)).status, 200);
  assert.equal((await post(t, op)).status, 200);
  const file = truth(t);
  assert.deepEqual(file.days[TODAY].entries.map((e) => e.text), ["Task 0", "Task 1", "Task 2"], "three copies, not six");
  assert.equal(file.days["2026-10-21"].entries.filter((e) => e.state === "migrated").length, 3);
});

test("a move that crosses into another month, sent twice, makes one copy", async () => {
  const t = lagging();
  const from = core.migrateList("2026-09");
  const to = core.migrateList(OCT);
  const id = newId();
  const made = await add(t, "Renew the licence", undefined, from, id);
  const rev = (await made.json()).months["2026-09"].rev;
  const op = { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId: newId() }], known: { "2026-09": rev } };
  assert.equal((await post(t, op)).status, 200);
  assert.equal((await post(t, op)).status, 200);
  assert.equal(truth(t).migrate.length, 1);
  assert.equal(truth(t, "2026-09").migrate.filter((e) => e.state === "migrated").length, 1);
});

test("a calendar line saved twice in a row is not refused as a clash", async () => {
  const t = lagging();
  const first = await post(t, { op: "line", date: "2026-10-24", rev: 0, text: "Dentist" });
  const rev = (await first.json()).months[OCT].rev;
  const second = await post(t, { op: "line", date: "2026-10-24", rev: 1, text: "Dentist at 9", known: { [OCT]: rev } });
  assert.equal(second.status, 200);
  assert.equal(truth(t).days["2026-10-24"].line, "Dentist at 9");
});

test("quick notes saved twice in a row are not refused as a clash", async () => {
  const t = lagging();
  const put = (body, base) => send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body, headers: { "x-base-updated": base } });
  const first = await put("one", "none");
  assert.equal(first.status, 200);
  const stamp = (await first.json()).updatedAt;
  const second = await put("one two", stamp);
  assert.equal(second.status, 200, "the stored version is the first save, whatever a lagging read shows");
  assert.equal(t.store.inner.state.quick.text, "one two");
});

test("a read during the lag is old, and says so by its revision, so a page can tell", async () => {
  const t = lagging();
  const first = await add(t, "First");
  const rev1 = (await first.json()).months[OCT].rev;
  await add(t, "Second", { [OCT]: rev1 });
  // Straight after the second write the store still shows the file with one entry or none.
  const seen = await (await months(t, OCT)).json();
  assert.ok(seen.months[OCT].rev <= 2, "a read is never newer than the truth");
  assert.equal(truth(t).rev, 2);
  t.clock.now += LAG + 1;
  const later = await (await home(t)).json();
  assert.equal(later.months[OCT].rev, 2, "after the lag the read is the truth");
});

test("a change refused for good says so and writes nothing", async () => {
  const t = lagging();
  const real = t.store.writeMonth.bind(t.store);
  t.store.writeMonth = async () => false;
  const response = await add(t, "Never lands");
  assert.equal(response.status, 503);
  t.store.writeMonth = real;
  assert.equal(t.store.inner.files.size, 0);
  assert.ok(t.sleeps.length >= 3, "it waited and tried again before giving up");
  assert.ok(t.sleeps.reduce((a, b) => a + b, 0) <= 8000, "and gave up inside the time a function may run");
});

test("another instance with nothing remembered waits for the store to catch up, and loses nothing", async () => {
  const t = lagging();
  const other = createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });
  const first = await add(t, "Written by one instance");
  const rev = (await first.json()).months[OCT].rev;
  // The second change goes to an instance that did not write the first, and the
  // store still shows the file as it was.
  const second = await send(other.POST, { method: "POST", cookie: t.cookie, body: { op: "add", list: LIST, entry: { id: newId(), type: "task", text: "Written by another" }, known: { [OCT]: rev } } });
  assert.equal(second.status, 200);
  assert.ok(t.sleeps.length > 0, "it waited for the store");
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => e.text), ["Written by one instance", "Written by another"]);
});

test("an instance that remembers what it wrote does not wait for a lagging store", async () => {
  const t = lagging();
  let rev = 0;
  for (const text of ["A", "B", "C"]) {
    const response = await add(t, text, rev ? { [OCT]: rev } : undefined);
    rev = (await response.json()).months[OCT].rev;
  }
  assert.deepEqual(t.sleeps, [], "three changes in a row, no waiting");
  assert.equal(truth(t).days[TODAY].entries.length, 3);
});

test("what an instance remembers is only a shortcut: another instance's write is not overwritten", async () => {
  const t = lagging();
  const other = createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });
  const a = await add(t, "From the first");
  const rev = (await a.json()).months[OCT].rev;
  t.clock.now += LAG + 1;                         // the store has caught up
  await send(other.POST, { method: "POST", cookie: t.cookie, body: { op: "add", list: LIST, entry: { id: newId(), type: "task", text: "From the second" }, known: { [OCT]: rev } } });
  // The first instance still remembers its own write, which is now older than the store.
  const third = await add(t, "From the first again", { [OCT]: rev + 1 });
  assert.equal(third.status, 200);
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => e.text), ["From the first", "From the second", "From the first again"], "nothing lost");
});

test("another instance asked to change an entry the first just added is not told it is a clash", async () => {
  const t = lagging();
  const other = createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });
  const id = newId();
  const made = await add(t, "Typo", undefined, LIST, id);
  const rev = (await made.json()).months[OCT].rev;
  const edited = await send(other.POST, { method: "POST", cookie: t.cookie, body: { op: "edit", list: LIST, id, rev: 1, text: "Fixed", known: { [OCT]: rev } } });
  assert.equal(edited.status, 200, "the page holds revision 1 of the month, so a file older than that is a lagging read, not a clash");
  assert.deepEqual(truth(t).days[TODAY].entries.map((e) => e.text), ["Fixed"]);
});

test("quick notes saved through another instance, while the store lags, are not refused as a clash", async () => {
  const t = lagging();
  const other = createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });
  const put = (api, body, base) => send(api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body, headers: { "x-base-updated": base } });
  const first = await put(t.api, "one", "none");
  const stamp = (await first.json()).updatedAt;
  const second = await put(other, "one two", stamp);
  assert.equal(second.status, 200, "the page's base is the first save, so a read older than it is a lagging read");
  assert.ok(t.sleeps.length > 0, "it waited for the store");
  assert.equal(t.store.inner.state.quick.text, "one two");
});
