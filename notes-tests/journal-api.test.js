// The journal API: the notes gate on every route, a version check on every
// write, storage kept apart from notes, nothing that moves by itself, and the
// Blob adapter's use of the package.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { createJournalStore } from "../api/_lib/journal-store.js";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { createBlobStore } from "../api/_lib/store.js";
import { ENVIRONMENT_VARIABLE, SESSION_SECONDS } from "../api/_lib/gate.js";
import * as core from "../journal/core.js";
import {
  NOW, addEntry, buildJournal, day, entryOf, freshSecret, home, journalMemoryStore, months, newId, post, send, signedInCookie,
} from "./journal-helpers.js";

const TODAY = "2026-10-22";
const LIST = day(TODAY);

// ---------- the gate ----------

function shapes() {
  const id = "a".repeat(32);
  return [
    ["GET home", "GET", `/api/journal?view=home&today=${TODAY}`, undefined],
    ["GET months", "GET", "/api/journal?view=months&months=2026-10", undefined],
    ["POST change", "POST", "/api/journal", JSON.stringify({ op: "add", list: LIST, at: 1, entry: { id, type: "task", text: "x" } })],
    ["PUT quick notes", "PUT", "/api/journal?part=quick", "text"],
  ];
}

test("every journal route answers 401 for every kind of bad or missing cookie, and writes nothing", async () => {
  const t = buildJournal();
  const good = signedInCookie(t.password);
  const [name, value] = good.split("=");
  const [expiry, sig] = value.split(".");
  const cases = {
    "no cookie": undefined,
    "another cookie name": `other=${value}`,
    "an expired cookie": signedInCookie(t.password, NOW - SESSION_SECONDS * 1000 - 1000),
    "a cookie under another password": signedInCookie(freshSecret("old")),
    "a changed signature": `${name}=${expiry}.${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`,
    "a longer expiry": `${name}=${Number(expiry) + 86400}.${sig}`,
    "garbage": `${name}=not-a-cookie`,
    "empty": `${name}=`,
  };
  let checked = 0;
  for (const [what, cookie] of Object.entries(cases)) {
    for (const [label, method, path, body] of shapes()) {
      const response = await send(t.api[method], { method, path, cookie, body, headers: method === "PUT" ? { "x-base-updated": "none" } : {} });
      assert.equal(response.status, 401, `${label} with ${what}`);
      assert.deepEqual(await response.json(), { error: "Sign in to see your journal." });
      checked += 1;
    }
  }
  assert.equal(checked, 32);
  assert.equal(t.store.entries.size, 0);
  assert.equal(t.store.state.quick, null, "a refused request writes nothing");
});

test("a good cookie opens every route, so the 401 checks are not vacuous", async () => {
  const t = buildJournal();
  assert.equal((await home(t)).status, 200);
  assert.equal((await months(t, "2026-10")).status, 200);
  assert.equal((await post(t, { op: "add", list: LIST, at: 1, entry: { id: newId(), type: "task", text: "x" } })).status, 200);
  assert.equal((await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "x", headers: { "x-base-updated": "none" } })).status, 200);
});

test("it is the notes gate: a notes cookie opens the journal and a changed password closes it", async () => {
  const password = freshSecret("shared");
  const journal = buildJournal({ password });
  const notesApi = createNotesApi({ store: { list: async () => [] }, env: { [ENVIRONMENT_VARIABLE]: password }, now: () => NOW, sleep: async () => {} });
  const login = await notesApi.login(new Request("https://journal.test/api/login", { method: "POST", body: JSON.stringify({ password }) }));
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await home(journal, TODAY, cookie)).status, 200, "one password, one cookie");
  const changed = buildJournal({ password: freshSecret("new") });
  assert.equal((await home(changed, TODAY, cookie)).status, 401, "changing the password signs everyone out of the journal too");
});

test("with no password configured the journal refuses everything", async () => {
  for (const env of [{}, { [ENVIRONMENT_VARIABLE]: "" }, { [ENVIRONMENT_VARIABLE]: "  \n" }]) {
    const t = buildJournal({ env });
    for (const secret of ["", "undefined", freshSecret("guess")]) {
      assert.equal((await home(t, TODAY, signedInCookie(secret))).status, 401);
    }
  }
});

test("a store that is never reached stays unreached on a 401", async () => {
  let reached = 0;
  const spy = new Proxy(journalMemoryStore(), { get: (target, key) => (...args) => { reached += 1; return target[key](...args); } });
  const t = buildJournal({ store: spy });
  for (const [, method, path, body] of shapes()) await send(t.api[method], { method, path, body });
  assert.equal(reached, 0);
});

test("every answer, success or failure, says no-store and noindex", async () => {
  const t = buildJournal();
  const seen = new Map();
  const note = async (label, response) => { seen.set(label, response); return response; };
  const id = await addEntry(t, LIST, "Seen");
  await note("home 200", await home(t));
  await note("home 400", await home(t, "2026-02-31"));
  await note("months 200", await months(t, "2026-10"));
  await note("months 400", await months(t, "nope"));
  await note("get 400", await send(t.api.GET, { path: "/api/journal", cookie: t.cookie }));
  await note("get 401", await send(t.api.GET, { path: "/api/journal?view=home&today=" + TODAY }));
  await note("post 200", await post(t, { op: "state", list: LIST, id, rev: 1, state: "done" }));
  await note("post 409", await post(t, { op: "edit", list: LIST, id, rev: 1, text: "From an old copy" }));
  await note("post 400", await post(t, { op: "nope" }));
  await note("post 401", await post(t, { op: "nope" }, undefined));
  await note("put 200", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "q", headers: { "x-base-updated": "none" } }));
  await note("put 409", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "q", headers: { "x-base-updated": "none" } }));
  await note("put 413", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "x".repeat(core.MAX_QUICK_BYTES + 1), headers: { "x-base-updated": "none" } }));
  const broken = buildJournal({ store: { ...journalMemoryStore(), entriesOfMonth: async () => { throw new Error("down"); } } });
  const quiet = console.error;
  console.error = () => {};
  try { await note("get 500", await home(broken)); } finally { console.error = quiet; }
  const statuses = new Set([...seen.values()].map((r) => r.status));
  for (const status of [200, 400, 401, 409, 413, 500]) assert.ok(statuses.has(status), `saw a ${status}`);
  for (const [label, response] of seen) {
    assert.equal(response.headers.get("cache-control"), "no-store", label);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", label);
  }
});

test("the only console call in the journal API is the fixed storage line, and nothing else is logged", () => {
  for (const file of ["api/_lib/journal-api.js", "api/_lib/journal-store.js", "api/_lib/journal-live.js", "api/journal.js", "journal/core.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const found = source.match(/console\.\w+\([^)]*\)/g) ?? [];
    for (const call of found) assert.match(call, /"journal: storage error"/, `${file}: ${call}`);
  }
});

// ---------- reading ----------

test("home sends this month, tomorrow's month, up to three earlier months that have files, and the quick notes", async () => {
  const t = buildJournal();
  for (const m of ["2026-04", "2026-07", "2026-08", "2026-09", "2026-10"]) {
    await t.store.createEntry(core.migrateList(m), { id: newId(), type: "task", state: "open", text: "t", rev: 1, order: 1 });
  }
  const answer = await (await home(t)).json();
  assert.deepEqual(Object.keys(answer.months).sort(), ["2026-08", "2026-09", "2026-10", "2026-07"].sort(), "this month and the three before it that have a file");
  assert.deepEqual(answer.quick, { text: "", updatedAt: "none" });
  assert.equal(answer.today, TODAY);
  const edge = await (await home(t, "2026-10-31")).json();
  assert.ok(edge.months["2026-11"], "on the last day of a month, tomorrow's month comes too");
});

test("reading never writes, even with groups waiting in the strip", async () => {
  const t = buildJournal();
  await addEntry(t, day("2026-10-21"), "Yesterday's open task");
  const before = t.store.creates.length;
  for (let i = 0; i < 3; i += 1) {
    await home(t);
    await home(t, "2026-11-02");
    await months(t, "2026-10");
  }
  assert.equal(t.store.creates.length, before, "nothing is moved, migrated or dropped by being opened");
});

test("a month nobody has written is an empty month, not an error", async () => {
  const t = buildJournal();
  const answer = await (await months(t, "2030-05")).json();
  assert.deepEqual(answer.months["2030-05"], core.emptyMonth());
});

// ---------- changes and the version check ----------

test("a change is applied by the shared rules and answered with the entries it touched", async () => {
  const t = buildJournal();
  const id = newId();
  const response = await post(t, { op: "add", list: LIST, at: 1_800_000_000_000, entry: { id, type: "task", text: "Order labels" } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.months["2026-10"].days[TODAY].entries[0].text, "Order labels");
  assert.equal(body.months["2026-10"].days[TODAY].entries[0].rev, 1);
  assert.equal(body.months["2026-10"].rev, undefined, "a month has no version of its own any more");
  assert.deepEqual(body.created, [id]);
});

test("a stale revision is refused with 409, writes nothing and returns the current month", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Contested");
  assert.equal((await post(t, { op: "state", list: LIST, id, rev: 1, state: "done" })).status, 200);
  const writes = t.store.creates.length;
  const stale = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "From an old copy" });
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.code, "stale");
  assert.equal(body.error, core.MESSAGES.stale);
  assert.equal(body.months["2026-10"].days[TODAY].entries[0].state, "done", "the answer is what is stored now");
  assert.equal(t.store.creates.length, writes, "no write");
  assert.equal((await entryOf(t, LIST, id)).text, "Contested");
});

test("two devices changing different entries both keep their changes", async () => {
  const t = buildJournal();
  const a = await addEntry(t, LIST, "First");
  const b = await addEntry(t, LIST, "Second");
  // Both devices loaded the list when both entries were at revision 1.
  assert.equal((await post(t, { op: "state", list: LIST, id: a, rev: 1, state: "done" })).status, 200);
  assert.equal((await post(t, { op: "edit", list: LIST, id: b, rev: 1, text: "Second, edited" })).status, 200);
  assert.equal((await entryOf(t, LIST, a)).state, "done");
  assert.equal((await entryOf(t, LIST, b)).text, "Second, edited");
});

test("two devices changing the same entry: the second is refused and the first stands", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Same entry");
  const first = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "Device one" });
  const second = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "Device two" });
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  assert.equal((await entryOf(t, LIST, id)).text, "Device one", "never silently overwritten");
});

test("an entry deleted on another device cannot be changed from a stale copy", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Doomed");
  assert.equal((await post(t, { op: "remove", list: LIST, id, rev: 1 })).status, 200);
  assert.equal((await post(t, { op: "state", list: LIST, id, rev: 1, state: "done" })).status, 409);
  assert.equal(await entryOf(t, LIST, id), null, "not brought back");
});

test("another device making the same revision between this request's read and its create: the create is refused, nothing is replaced, and the answer is 409", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Contested");
  // Another device's edit lands between this request's read and its create.
  t.store.state.hook = async () => {
    assert.equal((await post(t, { op: "edit", list: LIST, id, rev: 1, text: "From the iPad" })).status, 200);
  };
  const response = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "From the PC" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).months["2026-10"].days[TODAY].entries[0].text, "From the iPad", "the answer is what is there now");
  assert.equal((await entryOf(t, LIST, id)).text, "From the iPad", "never overwritten");
  assert.equal(t.store.entries.size, 2, "the entry has its first revision and the iPad's second, and nothing else");
});

test("two devices adding at the same moment both keep their entries, because no file is shared", async () => {
  const t = buildJournal();
  t.store.state.hook = async () => {
    assert.equal((await post(t, { op: "add", list: LIST, at: 2, entry: { id: "b".repeat(32), type: "task", text: "From the iPad" } })).status, 200);
  };
  const response = await post(t, { op: "add", list: LIST, at: 1, entry: { id: "a".repeat(32), type: "task", text: "From the PC" } });
  assert.equal(response.status, 200);
  const texts = (await (await months(t, "2026-10")).json()).months["2026-10"].days[TODAY].entries.map((e) => e.text);
  assert.deepEqual(texts, ["From the PC", "From the iPad"], "both are there, in the order they were made");
});

test("a store that cannot create says so and nothing of the change is left", async () => {
  const t = buildJournal();
  t.store.createEntry = async () => { throw new Error("down"); };
  const quiet = console.error;
  console.error = () => {};
  let response;
  try { response = await post(t, { op: "add", list: LIST, at: 1, entry: { id: newId(), type: "task", text: "Never lands" } }); } finally { console.error = quiet; }
  assert.equal(response.status, 500);
  assert.equal(t.store.entries.size, 0);
});

test("a create refused for a file that cannot then be read is an error, not a guess", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "One");
  const real = t.store.createEntry.bind(t.store);
  t.store.createEntry = async () => false;
  const readEntry = t.store.readEntry.bind(t.store);
  t.store.readEntry = async (list, entryId, rev) => (rev === 2 ? null : readEntry(list, entryId, rev));
  const quiet = console.error;
  console.error = () => {};
  let response;
  try { response = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "Two" }); } finally { console.error = quiet; }
  assert.equal(response.status, 500);
  t.store.createEntry = real;
  assert.equal((await entryOf(t, LIST, id)).text, "One");
});

test("a move across months that is refused after its first try takes its copy back", async () => {
  const t = buildJournal();
  const from = core.migrateList("2026-10");
  const to = core.migrateList("2026-11");
  const id = await addEntry(t, from, "Carry me");
  const copyId = core.copyIdFor(id, 1, to);
  // The copy is made first. Then another device ticks the task, so the original's
  // second revision is already taken when the move comes to make it.
  const real = t.store.createEntry.bind(t.store);
  let calls = 0;
  t.store.createEntry = async (list, entry) => {
    calls += 1;
    const made = await real(list, entry);
    if (calls === 1) {
      assert.equal(list, to, "the copy went first");
      assert.equal((await post(t, { op: "state", list: from, id, rev: 1, state: "done" })).status, 200);
    }
    return made;
  };
  const response = await post(t, { op: "move", from, to, how: "migrated", at: 5, items: [{ id, rev: 1 }] });
  assert.equal(response.status, 409);
  t.store.createEntry = real;
  assert.equal((await entryOf(t, from, id)).state, "done", "the other device's change stands");
  assert.equal(await entryOf(t, to, copyId), null, "no stray copy is left in November");
});

test("a move across months makes the copy first and then marks the original, and a repeat does not copy twice", async () => {
  const t = buildJournal();
  const from = core.migrateList("2026-10");
  const to = core.migrateList("2026-11");
  const id = await addEntry(t, from, "Carry me");
  const copyId = core.copyIdFor(id, 1, to);
  const op = { op: "move", from, to, how: "migrated", at: 7, items: [{ id, rev: 1 }] };
  const before = t.store.creates.length;
  assert.equal((await post(t, op)).status, 200);
  assert.deepEqual(t.store.creates.slice(before), [`${to}|${copyId}|1`, `${from}|${id}|2`], "two creates and no others");
  assert.equal((await entryOf(t, from, id)).state, "migrated");
  assert.equal((await entryOf(t, to, copyId)).text, "Carry me");
  assert.equal((await post(t, op)).status, 200, "the same move again has already happened: done, not a clash");
  assert.equal(t.store.creates.length, before + 2, "and it wrote nothing");
  assert.equal((await post(t, { ...op, to: core.migrateList("2026-12") })).status, 409, "a different move of the same entry from the same revision is a clash, not a second copy");
  assert.equal(await entryOf(t, core.migrateList("2026-12"), core.copyIdFor(id, 1, core.migrateList("2026-12"))), null, "and the copy it made is taken back");
  assert.equal((await (await months(t, "2026-11")).json()).months["2026-11"].migrate.length, 1);
});

test("an add reads nothing first, and an edit reads only the entry it changes and creates exactly one file", async () => {
  const t = buildJournal();
  const id = newId();
  const reads = () => t.store.state.reads;
  assert.equal((await post(t, { op: "add", list: LIST, at: 1, entry: { id, type: "task", text: "A" } })).status, 200);
  assert.equal(reads(), 0, "an add reads nothing, not the list, not the month, not itself");
  assert.deepEqual(t.store.creates, [`${LIST}|${id}|1`], "one new file");
  const other = await addEntry(t, LIST, "Another entry in the same day");
  const base = reads();
  const listed = [];
  const real = t.store.entriesOfMonth.bind(t.store);
  t.store.entriesOfMonth = async (m) => { listed.push(m); return real(m); };
  assert.equal((await post(t, { op: "edit", list: LIST, id, rev: 1, text: "B" })).status, 200);
  assert.equal(reads() - base, 1, "one read, of the one entry");
  assert.deepEqual(listed, [], "no listing of the month");
  assert.deepEqual(t.store.creates.slice(-1), [`${LIST}|${id}|2`], "and one new file, the entry's next revision");
  assert.equal((await entryOf(t, LIST, other)).rev, 1, "its neighbour was not touched");
});

test("Bring forward of several tasks makes one copy of each, once, however many times it is sent", async () => {
  const t = buildJournal();
  const from = day("2026-10-21");
  const ids = [await addEntry(t, from, "One"), await addEntry(t, from, "Two"), await addEntry(t, from, "Three")];
  const op = { op: "move", from, to: LIST, how: "migrated", at: 50, items: ids.map((id) => ({ id, rev: 1 })) };
  const before = t.store.creates.length;
  for (let i = 0; i < 3; i += 1) assert.equal((await post(t, op)).status, 200);
  assert.equal(t.store.creates.length - before, 6, "three copies and three marks, once");
  const today = (await (await months(t, "2026-10")).json()).months["2026-10"].days[TODAY].entries;
  assert.deepEqual(today.map((e) => e.text), ["One", "Two", "Three"], "each once, in order");
});

test("calendar lines are versioned too", async () => {
  const t = buildJournal();
  assert.equal((await post(t, { op: "line", date: "2026-10-23", rev: 0, text: "Dentist" })).status, 200);
  assert.equal((await post(t, { op: "line", date: "2026-10-23", rev: 0, text: "Overwrite" })).status, 409);
  const file = (await (await months(t, "2026-10")).json()).months["2026-10"];
  assert.equal(file.days["2026-10-23"].line, "Dentist");
});

test("a bad change body is refused with 400 and nothing is written", async () => {
  const t = buildJournal();
  for (const body of ["not json", "[]", "null", JSON.stringify({ op: "add" }), JSON.stringify({ op: "state", list: LIST, id: "short", rev: 1, state: "done" }), "x".repeat(70 * 1024)]) {
    const response = await send(t.api.POST, { method: "POST", cookie: t.cookie, body });
    assert.equal(response.status, 400);
  }
  assert.equal(t.store.entries.size, 0);
});

test("a damaged entry file is never skipped as if it were not there, and never written over", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Fine");
  const damaged = newId();
  t.store.entries.set(`${LIST}|${damaged}|1`, { json: JSON.stringify({ v: 1, list: LIST, id: damaged, rev: 0 }), at: 0 });
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal((await home(t)).status, 500, "a view with a file it cannot read is an error, not a view without it");
    assert.equal((await post(t, { op: "edit", list: LIST, id: damaged, rev: 1, text: "x" })).status, 500);
  } finally { console.error = quiet; }
  assert.ok(t.store.entries.get(`${LIST}|${damaged}|1`).json.includes('"rev":0'), "the damaged file is as it was");
  assert.equal(t.store.entries.size, 2);
  assert.equal((await entryOf(t, LIST, id).catch(() => "unreadable")), "unreadable");
});

// ---------- the nothing-automatic rules ----------

test("the journal has no scheduled work: no cron in vercel.json and no timer in the API", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.crons, undefined);
  let read = 0;
  for (const file of ["api/_lib/journal-api.js", "api/_lib/journal-store.js", "api/_lib/journal-live.js", "api/journal.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      // The one default clock, which the signed-in check reads, and the one default
      // pause, which a change uses to wait for a lagging store, are the only mentions.
      .replace("now = () => Date.now()", "")
      .replace("sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))", "");
    // The one pause left is quick notes', and nothing that changes an entry waits.
    read += 1;
    assert.ok(!/setTimeout|setInterval|setImmediate|queueMicrotask|Date\.now|new Date\(\)|process\.on\(/.test(source), `${file} has a timer or reads the time`);
  }
  assert.equal(read, 4);
});

test("no change to an entry or a line ever waits: the only pause in the API is the quick notes one", () => {
  const source = readFileSync(new URL("../api/_lib/journal-api.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const pauses = source.split("\n").filter((line) => /\bsleep\(/.test(line));
  assert.deepEqual(pauses.map((line) => line.trim()), ["await sleep(QUICK_WAITS_MS[attempt]);"]);
  assert.ok(!/WAITS_MS\b/.test(source.replace(/QUICK_WAITS_MS/g, "")), "the six second wait for entries is gone");
  assert.ok(!/\bknown\b|\brecent\b|knownRevisions/.test(source), "and so are the remembered revisions and the remembered files");
});

test("the journal API's only reading of the clock is the signed-in check, the quick notes stamp and the age of what it last wrote", () => {
  const source = readFileSync(new URL("../api/_lib/journal-api.js", import.meta.url), "utf8");
  const lines = source.split("\n").filter((line) => /\bnow\(\)/.test(line) && !line.trim().startsWith("//"));
  assert.ok(lines.length >= 5, `${lines.length} uses found`);
  const allowed = [/now = \(\) => Date\.now\(\)/, /requestIsSignedIn\(request, env, now\(\)\)/, /Math\.max\(now\(\)/, /RECENT_MS/, /at: now\(\)/];
  for (const line of lines) assert.ok(allowed.some((pattern) => pattern.test(line)), `a reading of the clock that decides something: ${line.trim()}`);
  assert.ok(!/\btoday\b[^;]*now\(\)/.test(source));
});

// ---------- storage kept apart from notes ----------

class FakeNotFound extends Error {}
class FakePrecondition extends Error {}

function fakeSdk() {
  const files = new Map();
  const calls = [];
  let version = 0;
  return {
    files,
    calls,
    BlobNotFoundError: FakeNotFound,
    BlobPreconditionFailedError: FakePrecondition,
    async put(pathname, body, options) {
      calls.push({ op: "put", pathname, options });
      const held = files.get(pathname);
      if (options.ifMatch !== undefined && options.allowOverwrite === false) throw new Error("contradictory");
      if (options.ifMatch !== undefined && (!held || held.etag !== options.ifMatch)) throw new FakePrecondition();
      if (held && !options.allowOverwrite) throw new Error("This blob already exists, use `allowOverwrite: true` to overwrite it");
      files.set(pathname, { bytes: Buffer.from(body), uploadedAt: new Date(NOW + version), etag: `etag-${(version += 1)}` });
      return { pathname };
    },
    async get(pathname, options) {
      calls.push({ op: "get", pathname, options });
      const file = files.get(pathname);
      if (!file) return null;
      return { statusCode: 200, stream: new Response(file.bytes).body, blob: { etag: file.etag, uploadedAt: file.uploadedAt } };
    },
    async head(pathname) {
      calls.push({ op: "head", pathname });
      const file = files.get(pathname);
      if (!file) throw new FakeNotFound();
      return { size: file.bytes.length, uploadedAt: file.uploadedAt, pathname };
    },
    async list({ prefix, limit, cursor, mode }) {
      calls.push({ op: "list", prefix, limit, cursor, mode });
      const all = [...files.keys()].filter((p) => p.startsWith(prefix)).sort();
      if (mode === "folded") {
        const folders = [...new Set(all.map((p) => p.slice(0, prefix.length) + p.slice(prefix.length).split("/")[0] + "/").filter((f, i) => all[i].slice(prefix.length).includes("/")))];
        return { blobs: [], folders, hasMore: false };
      }
      return {
        blobs: all.map((pathname) => ({ pathname, uploadedAt: files.get(pathname).uploadedAt, size: 1, url: "u", downloadUrl: "d", etag: files.get(pathname).etag })),
        hasMore: false,
      };
    },
    async del(target) {
      calls.push({ op: "del", pathname: target });
      for (const path of [target].flat()) files.delete(path);
    },
  };
}

function bothApis() {
  const sdk = fakeSdk();
  const password = freshSecret("pw");
  const env = { [ENVIRONMENT_VARIABLE]: password };
  const journal = createJournalApi({ store: createJournalStore(sdk), env, now: () => NOW });
  const notes = createNotesApi({ store: createBlobStore(sdk), env, now: () => NOW, sleep: async () => {} });
  return { sdk, journal, notes, cookie: signedInCookie(password) };
}

const req = (path, method, cookie, body, headers = {}) => new Request(`https://journal.test${path}`, { method, headers: { cookie, ...headers }, body });

test("journal entries never appear in the notes list, the notes index or notes search", async () => {
  const { sdk, journal, notes, cookie } = bothApis();
  const secret = "Zebra-crossing-secret";
  await journal.POST(req("/api/journal", "POST", cookie, JSON.stringify({ op: "add", list: LIST, at: 1, entry: { id: newId(), type: "task", text: secret } })));
  await journal.POST(req("/api/journal", "POST", cookie, JSON.stringify({ op: "line", date: TODAY, rev: 0, text: secret + " line" })));
  await journal.PUT(req("/api/journal?part=quick", "PUT", cookie, secret + " quick", { "x-base-updated": "none" }));
  assert.ok([...sdk.files.keys()].length >= 2);
  assert.ok([...sdk.files.keys()].every((p) => p.startsWith("journal/")), "everything the journal wrote is under journal/");

  const made = await (await notes.collection.POST(req("/api/notes", "POST", cookie, "A real note"))).json();
  for (const view of ["notes", "archive", "all"]) {
    const list = await (await notes.collection.GET(req(`/api/notes?view=${view}`, "GET", cookie))).json();
    assert.deepEqual(list.notes.map((n) => n.id), view === "archive" ? [] : [made.id], `the ${view} list holds the note and nothing from the journal`);
  }
  const search = await (await notes.collection.GET(req("/api/notes", "GET", cookie, undefined, { "x-note-search": "zebra" }))).json();
  assert.deepEqual(search.notes, [], "search does not read the journal");
  const index = [...sdk.files].find(([p]) => p === "notes-index.json");
  assert.ok(index, "the notes index exists");
  assert.ok(!index[1].bytes.toString().includes(secret), "and does not name a journal entry");
});

test("the notes API never lists, reads or deletes under journal/", () => {
  const source = readFileSync(new URL("../api/_lib/store.js", import.meta.url), "utf8");
  assert.ok(!source.includes("journal"), "store.js does not mention the journal");
  assert.match(source, /const PREFIX = "notes\/";/);
  const mine = readFileSync(new URL("../api/_lib/journal-store.js", import.meta.url), "utf8").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/["'`]notes\//.test(mine), "and the journal store never names the notes prefix");
});

test("the Blob adapter creates each entry revision private and without overwriting, and reads without the CDN", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  const list = core.dayList(TODAY);
  const id = newId();
  const entry = { id, type: "task", state: "open", text: "t", rev: 1, order: 5 };
  assert.equal(await store.createEntry(list, entry), true, "created");
  assert.equal(await store.createEntry(list, entry), false, "created twice: the second is refused, not overwritten");
  assert.equal(await store.createEntry(list, { ...entry, text: "other text" }), false, "even with other text");
  assert.equal((await store.readEntry(list, id, 1)).entry.text, "t", "what is there is what was made first");
  assert.equal(await store.readEntry(list, id, 2), null);
  assert.equal(await store.createEntry(list, { ...entry, rev: 2, text: "t2" }), true);
  assert.equal(await store.createLine(TODAY, 1, "Dentist"), true);
  assert.equal(await store.createLine(TODAY, 1, "Other"), false);

  const puts = sdk.calls.filter((c) => c.op === "put");
  assert.deepEqual([...new Set(puts.map((c) => c.pathname))].sort(), [`journal/e/2026-10/${id}.1.json`, `journal/e/2026-10/${id}.2.json`, "journal/l/2026-10/2026-10-22.1.json"].sort());
  for (const put of puts) {
    assert.equal(put.options.access, "private");
    assert.equal(put.options.addRandomSuffix, false);
    assert.equal(put.options.contentType, "application/json");
    assert.equal(put.options.allowOverwrite, false, "no file of an entry or a line is ever overwritten");
    assert.ok(!("ifMatch" in put.options), "so there is no etag to match");
    assert.ok(!("token" in put.options), "no credentials of its own");
  }
  for (const get of sdk.calls.filter((c) => c.op === "get")) {
    assert.equal(get.options.access, "private");
    assert.equal(get.options.useCache, false, "a read bypasses the CDN so another device sees the latest");
  }
});

test("a file that cannot change is read once: the second read of the same revision does not go to the store", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  const list = core.dayList(TODAY);
  const id = newId();
  await store.createEntry(list, { id, type: "task", state: "open", text: "t", rev: 1, order: 5 });
  const other = createJournalStore(sdk);
  await other.readEntry(list, id, 1);
  const gets = () => sdk.calls.filter((c) => c.op === "get").length;
  const first = gets();
  await other.readEntry(list, id, 1);
  await other.readEntry(list, id, 1);
  assert.equal(gets(), first, "kept by path");
  await store.readEntry(list, id, 1);
  assert.equal(gets(), first, "and a file this instance made is kept at once");
});

test("a month is listed, the highest revision of each entry is the only one read, and a month with nothing is empty", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  const list = core.dayList(TODAY);
  const a = "a".repeat(32), b = "b".repeat(32);
  const make = (id, rev, text) => ({ id, type: "task", state: "open", text, rev, order: rev });
  await store.createEntry(list, make(a, 1, "a1"));
  await store.createEntry(list, make(a, 2, "a2"));
  await store.createEntry(list, make(a, 3, "a3"));
  await store.createEntry(list, make(b, 1, "b1"));
  await store.createEntry(core.dayList("2026-11-02"), make("c".repeat(32), 1, "other month"));
  const fresh = createJournalStore(sdk);
  const before = sdk.calls.filter((c) => c.op === "get").length;
  const found = await fresh.entriesOfMonth("2026-10");
  assert.deepEqual(found.map((f) => f.entry.text).sort(), ["a3", "b1"]);
  assert.equal(sdk.calls.filter((c) => c.op === "get").length - before, 2, "two reads for two entries, not four for four files");
  assert.deepEqual(await fresh.entriesOfMonth("2030-01"), []);
});

test("the Blob adapter refuses a damaged file instead of reading it as one that is not there", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  const list = core.dayList(TODAY);
  const id = newId();
  const path = `journal/e/2026-10/${id}.1.json`;
  for (const body of [JSON.stringify({ v: 1, list, id, rev: 0 }), "{ not json", JSON.stringify({ v: 1, list: "notes:2026-10", id, type: "task", state: "open", text: "t", rev: 1, order: 1 })]) {
    sdk.files.set(path, { bytes: Buffer.from(body), uploadedAt: new Date(NOW), etag: "e" });
    await assert.rejects(createJournalStore(sdk).readEntry(list, id, 1), undefined, "a read of a damaged file is an error");
    await assert.rejects(createJournalStore(sdk).entriesOfMonth("2026-10"), undefined, "and so is a view that would have to leave it out");
  }
  assert.equal(await createJournalStore(sdk).readEntry(list, newId(), 1), null, "a file that is not there is null");
  assert.equal(sdk.files.get(path).bytes.toString(), JSON.stringify({ v: 1, list: "notes:2026-10", id, type: "task", state: "open", text: "t", rev: 1, order: 1 }), "and nothing was written over it");
  assert.ok(sdk.calls.filter((c) => c.op === "put").length === 0);
});

test("the journal store lists only months, newest first, and reads quick notes with their version", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  for (const m of ["2026-08", "2026-10", "2026-09"]) await store.createEntry(core.migrateList(m), { id: newId(), type: "task", state: "open", text: "t", rev: 1, order: 1 });
  await store.createLine("2026-07-01", 1, "a line alone does not make a month with entries");
  await store.writeQuick("scratch", "2026-10-22T09:00:00.000Z", null);
  assert.deepEqual(await store.months(), ["2026-10", "2026-09", "2026-08"], "the quick notes file and the lines are not months");
  const quick = await store.readQuick();
  assert.equal(quick.text, "scratch");
  assert.equal(quick.updatedAt, "2026-10-22T09:00:00.000Z");
  assert.equal(await store.writeQuick("again", "2026-10-22T09:01:00.000Z", null), false, "no version, no overwrite");
  assert.notEqual(await store.writeQuick("again", "2026-10-22T09:01:00.000Z", quick.tag), false, "against the version it read, it is written");
  const puts = sdk.calls.filter((c) => c.op === "put" && c.pathname === "journal/quick.json");
  assert.equal(puts[0].options.allowOverwrite, false);
  assert.equal(puts[2].options.ifMatch, quick.tag);
  assert.equal(puts[2].options.allowOverwrite, true);
});

// ---------- quick notes ----------

const putQuick = (t, body, base) => send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body, headers: base === undefined ? {} : { "x-base-updated": base } });

test("quick notes save against the version they started from, and a clash keeps the typed text on the page", async () => {
  const t = buildJournal();
  const first = await (await putQuick(t, "first", "none")).json();
  assert.match(first.updatedAt, /^2026-10-01T12:00:00\.0\d\dZ$|^2026-10-01T12:00:00\.000Z$/);
  const stale = await putQuick(t, "second from the other device", "none");
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.updatedAt, first.updatedAt, "the answer names the stored version and holds no text");
  assert.ok(!JSON.stringify(body).includes("first"));
  assert.equal((await t.store.readQuick()).text, "first", "never overwritten");
  const next = await putQuick(t, "second", first.updatedAt);
  assert.equal(next.status, 200);
  assert.ok((await next.json()).updatedAt > first.updatedAt, "versions only ever go up");
});

test("quick notes refuse a missing version, text over 256 KB, bytes that are not text and any other part", async () => {
  const t = buildJournal();
  assert.equal((await putQuick(t, "x")).status, 400, "no version");
  assert.equal((await putQuick(t, "x".repeat(core.MAX_QUICK_BYTES + 1), "none")).status, 413);
  assert.equal((await putQuick(t, new Uint8Array([0xff, 0xfe, 0xfd]), "none")).status, 400);
  const other = await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=other", cookie: t.cookie, body: "x", headers: { "x-base-updated": "none" } });
  assert.equal(other.status, 400);
  assert.equal(t.store.state.quick, null);
});

test("quick notes come back with the first load, with their version", async () => {
  const t = buildJournal();
  const saved = await (await putQuick(t, "line one\nline two", "none")).json();
  const answer = await (await home(t)).json();
  assert.deepEqual(answer.quick, { text: "line one\nline two", updatedAt: saved.updatedAt });
});
