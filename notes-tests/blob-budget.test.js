// A budget for Blob operations, so the cost cannot creep back. The Vercel Hobby team
// was paused on 24 October 2026 for Blob Advanced Operations (3.3K used against 2K a
// month). Advanced is upload, copy and list; simple is a read that misses the cache
// (see notes-tests/counting-sdk.js for what Vercel's pricing page says).
//
// Each action below runs the real route code over the real Blob adapters and the
// counting stand-in, every request answered by an instance that remembers nothing
// (the most an action can cost), and must stay inside the figures in
// blob-budget.json. An idle window costs nothing because nothing in either page asks
// the server on a timer: the page tests (test_journal_page.py, test_notes_page.py)
// hold that, and docs/evidence/blob-usage/measure.mjs shows it in a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { createJournalStore } from "../api/_lib/journal-store.js";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { createBlobStore } from "../api/_lib/store.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";
import { newId } from "./journal-helpers.js";
import { countingSdk } from "./counting-sdk.js";

const BUDGET = JSON.parse(readFileSync(new URL("./blob-budget.json", import.meta.url), "utf8"));

function world() {
  const clock = { now: NOW };
  const counter = countingSdk({ clock });
  const password = freshSecret("pw");
  const env = { [ENVIRONMENT_VARIABLE]: password };
  const cookie = signedInCookie(password);
  const now = () => clock.now;
  const journal = () => createJournalApi({ store: createJournalStore(counter.sdk), env, now, sleep: async () => { clock.now += 1; } });
  const notes = () => createNotesApi({ store: createBlobStore(counter.sdk, { now }), env, now, sleep: async () => {} });
  const ask = (handler, path, method = "GET", body, headers = {}) => handler(new Request(`https://x.test${path}`, { method, headers: { cookie, ...headers }, body }));
  const op = async (body) => { const r = await ask(journal().POST, "/api/journal", "POST", JSON.stringify(body), { "content-type": "application/json" }); assert.equal(r.status, 200, JSON.stringify(body)); return r.json(); };
  return { clock, counter, journal, notes, ask, op };
}

// What one action costs, as { advanced, simple }.
async function costOf(w, work) {
  const before = w.counter.snapshot();
  await work();
  const d = w.counter.since(before);
  return { advanced: d.advanced, simple: d.simple };
}
const within = (name, got) => {
  if (process.env.BUDGET_REPORT) console.log(`BUDGET ${name} => ${JSON.stringify(got)}`);
  const limit = BUDGET.api[name];
  assert.ok(limit, `no budget for "${name}"`);
  assert.ok(got.advanced <= limit.advanced, `${name}: ${got.advanced} advanced operations, budget ${limit.advanced}`);
  assert.ok(got.simple <= limit.simple, `${name}: ${got.simple} simple operations, budget ${limit.simple}`);
  return got;
};

test("the journal: every common action stays inside its Blob budget", async () => {
  const w = world();
  const today = "2026-10-22";
  const entries = [];
  for (let d = 1; d <= 22; d += 1) {
    const date = `2026-10-${String(d).padStart(2, "0")}`;
    for (let i = 0; i < 3; i += 1) {
      const id = newId();
      entries.push({ id, list: `day:${date}` });
      await w.op({ op: "add", list: `day:${date}`, at: NOW + d * 100 + i, entry: { id, type: "task", text: `Task ${d}.${i}` } });
    }
  }
  for (let d = 1; d <= 10; d += 1) await w.op({ op: "add", list: "day:2026-09-" + String(d).padStart(2, "0"), at: NOW + d, entry: { id: newId(), type: "task", text: "September" } });
  await w.op({ op: "spanAdd", span: { id: newId(), start: "2026-10-26", end: "2026-10-29", text: "Site visit" } });
  w.clock.now += 5 * 60 * 1000;

  within("journal: open (home)", await costOf(w, () => w.ask(w.journal().GET, `/api/journal?view=home&today=${today}`).then((r) => r.json())));
  const light = within("journal: return to an open window (light home)", await costOf(w, () => w.ask(w.journal().GET, `/api/journal?view=home&light=1&today=${today}`).then((r) => r.json())));
  const full = await costOf(w, () => w.ask(w.journal().GET, `/api/journal?view=home&today=${today}`).then((r) => r.json()));
  assert.ok(light.advanced < full.advanced, "a return to an open window lists less than an open");

  const id = newId();
  within("journal: add an entry", await costOf(w, () => w.op({ op: "add", list: `day:${today}`, at: NOW + 99999, entry: { id, type: "task", text: "Measured" } })));
  within("journal: edit an entry", await costOf(w, () => w.op({ op: "edit", list: `day:${today}`, id, rev: 1, text: "Measured again" })));
  within("journal: move an entry", await costOf(w, () => w.op({ op: "move", from: `day:${today}`, to: "day:2026-10-23", at: NOW + 100000, how: "migrated", items: [{ id, rev: 2 }] })));
  within("journal: set a calendar line", await costOf(w, () => w.op({ op: "line", date: "2026-10-24", rev: 0, text: "Dentist" })));
  within("journal: make a span", await costOf(w, () => w.op({ op: "spanAdd", span: { id: newId(), start: "2026-11-02", end: "2026-11-04", text: "Away" } })));
  // The Done list: five of the October tasks are ticked, one of them edited after, and
  // the list is asked for with nothing remembered by the instance that answers.
  const ticked = entries.filter((e) => e.list === "day:2026-10-03").slice(0, 3).concat(entries.filter((e) => e.list === "day:2026-10-04").slice(0, 2));
  for (const e of ticked) await w.op({ op: "state", list: e.list, id: e.id, rev: 1, state: "done" });
  await w.op({ op: "edit", list: ticked[0].list, id: ticked[0].id, rev: 2, text: "Edited after the tick" });
  w.clock.now += 5 * 60 * 1000;
  const doneOpen = within("journal: open the Done list", await costOf(w, () => w.ask(w.journal().GET, "/api/journal?view=done&month=2026-10").then((r) => r.json())));
  const doneBody = await (await w.ask(w.journal().GET, "/api/journal?view=done&month=2026-10")).json();
  assert.equal(doneBody.items.length, 5, "the five ticked tasks, and only those");
  assert.ok(doneOpen.advanced >= 2, "a listing for each of the two log months");
  within("journal: change the Done month", await costOf(w, () => w.ask(w.journal().GET, "/api/journal?view=done&month=2026-09").then((r) => r.json())));
  // The first search in a window: everything the page does not hold. The page holds this month.
  const search = within("journal: search the calendar (the first search in a window)", await costOf(w, () => w.ask(w.journal().GET, "/api/journal?view=all&skip=2026-10").then((r) => r.json())));
  assert.ok(search.advanced >= 3, "one listing of the entries, one of the lines and one of the spans");
  // The next search in the window is worked out by the page from what it holds: it asks nothing,
  // which forecast-app/tests/test_journal_page.py holds and the browser check shows.
  within("journal: save quick notes", await costOf(w, () => w.ask(w.journal().PUT, "/api/journal?part=quick", "PUT", "Quick text", { "x-base-updated": "none", "content-type": "text/plain; charset=utf-8" }).then((r) => assert.equal(r.status, 200))));
});

test("notes: every common action stays inside its Blob budget", async () => {
  const w = world();
  const ids = [];
  for (let i = 0; i < 30; i += 1) {
    const made = await (await w.ask(w.notes().collection.POST, "/api/notes", "POST", `Note ${i}\nsome words about zephyrine ${i}\n`, { "content-type": "text/plain" })).json();
    ids.push(made);
  }
  const labels = await (await w.ask(w.notes().labels.GET, "/api/labels")).json();
  const made = await w.ask(w.notes().labels.POST, "/api/labels", "POST", JSON.stringify({ name: "Home" }), { "x-base-labels": labels.updatedAt, "content-type": "application/json" });
  const labelId = (await made.json()).labels[0].id;
  // The first list of a store makes the index; every list after reads it.
  await (await w.ask(w.notes().collection.GET, "/api/notes?view=all")).json();
  w.clock.now += 5 * 60 * 1000;

  within("notes: open the list", await costOf(w, async () => {
    await (await w.ask(w.notes().collection.GET, "/api/notes?view=all")).json();
    await (await w.ask(w.notes().labels.GET, "/api/labels")).json();
  }));
  const one = ids[3];
  let opened;
  within("notes: open a note", await costOf(w, async () => { opened = await w.ask(w.notes().item.GET, `/api/note?id=${one.id}`); await opened.text(); }));
  // The page keeps the revision the server gave and sends it back (X-Base-Rev).
  let version = opened.headers.get("x-note-updated");
  let rev = opened.headers.get("x-note-rev");
  let saved;
  within("notes: save a note, from the revision the page holds", await costOf(w, async () => {
    saved = await w.ask(w.notes().item.PUT, `/api/note?id=${one.id}`, "PUT", "Note 3\nedited\n", { "x-base-updated": version, "x-base-rev": rev, "content-type": "text/plain" });
    assert.equal(saved.status, 200);
  }));
  version = (await saved.json()).updatedAt; rev = saved.headers.get("x-note-rev");
  let labelled;
  within("notes: label a note, from the revision the page holds", await costOf(w, async () => {
    labelled = await w.ask(w.notes().item.PATCH, `/api/note?id=${one.id}`, "PATCH", JSON.stringify({ labels: [labelId] }), { "x-base-updated": version, "x-base-rev": rev, "content-type": "application/json" });
    assert.equal(labelled.status, 200);
  }));
  version = (await labelled.json()).updatedAt; rev = labelled.headers.get("x-note-rev");
  within("notes: archive a note, from the revision the page holds", await costOf(w, async () => {
    const r = await w.ask(w.notes().item.PATCH, `/api/note?id=${one.id}`, "PATCH", JSON.stringify({ archived: true }), { "x-base-updated": version, "x-base-rev": rev, "content-type": "application/json" });
    assert.equal(r.status, 200);
  }));
  w.clock.now += 5 * 60 * 1000;
  within("notes: search", await costOf(w, async () => { await (await w.ask(w.notes().collection.GET, "/api/notes", "GET", undefined, { "x-note-search": encodeURIComponent("zephyrine") })).json(); }));
});

test("a revision hint is only a starting point: a wrong or old one never lets a save overwrite a newer revision", async () => {
  const w = world();
  const made = await (await w.ask(w.notes().collection.POST, "/api/notes", "POST", "first\n", { "content-type": "text/plain" })).json();
  const first = made.updatedAt;
  const second = await (await w.ask(w.notes().item.PUT, `/api/note?id=${made.id}`, "PUT", "second\n", { "x-base-updated": first, "x-base-rev": "1", "content-type": "text/plain" })).json();
  // A device that still holds revision 1 saves from it, with its own hint.
  const stale = await w.ask(w.notes().item.PUT, `/api/note?id=${made.id}`, "PUT", "from the old copy\n", { "x-base-updated": first, "x-base-rev": "1", "content-type": "text/plain" });
  assert.equal(stale.status, 409, "refused, and nothing written");
  // A hint that names a revision that is not there is ignored.
  const lost = await w.ask(w.notes().item.PUT, `/api/note?id=${made.id}`, "PUT", "bad hint\n", { "x-base-updated": second.updatedAt, "x-base-rev": "40", "content-type": "text/plain" });
  assert.equal(lost.status, 200, "a bad hint falls back to the listing");
  // A hint that is too high for the version it claims cannot skip a revision.
  const read = await (await w.ask(w.notes().item.GET, `/api/note?id=${made.id}`)).text();
  assert.equal(read, "bad hint\n");
  const newest = (await w.ask(w.notes().item.GET, `/api/note?id=${made.id}`)).headers.get("x-note-rev");
  assert.equal(newest, "3", "three revisions, none skipped");
});
