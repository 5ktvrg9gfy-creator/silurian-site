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
    ["POST change", "POST", "/api/journal", JSON.stringify({ op: "add", list: LIST, entry: { id, type: "task", text: "x" } })],
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
  assert.equal(t.store.files.size, 0);
  assert.equal(t.store.state.quick, null, "a refused request writes nothing");
});

test("a good cookie opens every route, so the 401 checks are not vacuous", async () => {
  const t = buildJournal();
  assert.equal((await home(t)).status, 200);
  assert.equal((await months(t, "2026-10")).status, 200);
  assert.equal((await post(t, { op: "add", list: LIST, entry: { id: newId(), type: "task", text: "x" } })).status, 200);
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
  await note("post 409", await post(t, { op: "state", list: LIST, id, rev: 1, state: "open" }));
  await note("post 400", await post(t, { op: "nope" }));
  await note("post 401", await post(t, { op: "nope" }, undefined));
  await note("put 200", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "q", headers: { "x-base-updated": "none" } }));
  await note("put 409", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "q", headers: { "x-base-updated": "none" } }));
  await note("put 413", await send(t.api.PUT, { method: "PUT", path: "/api/journal?part=quick", cookie: t.cookie, body: "x".repeat(core.MAX_QUICK_BYTES + 1), headers: { "x-base-updated": "none" } }));
  const broken = buildJournal({ store: { ...journalMemoryStore(), readMonth: async () => { throw new Error("down"); } } });
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
    t.store.files.set(m, { json: JSON.stringify(core.emptyMonth()), tag: "t-" + m });
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
  const before = t.store.writes.length;
  for (let i = 0; i < 3; i += 1) {
    await home(t);
    await home(t, "2026-11-02");
    await months(t, "2026-10");
  }
  assert.equal(t.store.writes.length, before, "nothing is moved, migrated or dropped by being opened");
});

test("a month nobody has written is an empty month, not an error", async () => {
  const t = buildJournal();
  const answer = await (await months(t, "2030-05")).json();
  assert.deepEqual(answer.months["2030-05"], core.emptyMonth());
});

// ---------- changes and the version check ----------

test("a change is applied by the shared rules and answered with the months it touched", async () => {
  const t = buildJournal();
  const id = newId();
  const response = await post(t, { op: "add", list: LIST, entry: { id, type: "task", text: "Order labels" } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.months["2026-10"].days[TODAY].entries[0].text, "Order labels");
  assert.equal(body.months["2026-10"].rev, 1);
  assert.deepEqual(body.created, [id]);
});

test("a stale revision is refused with 409, writes nothing and returns the current month", async () => {
  const t = buildJournal();
  const id = await addEntry(t, LIST, "Contested");
  assert.equal((await post(t, { op: "state", list: LIST, id, rev: 1, state: "done" })).status, 200);
  const writes = t.store.writes.length;
  const stale = await post(t, { op: "edit", list: LIST, id, rev: 1, text: "From an old copy" });
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.code, "stale");
  assert.equal(body.error, core.MESSAGES.stale);
  assert.equal(body.months["2026-10"].days[TODAY].entries[0].state, "done", "the answer is what is stored now");
  assert.equal(t.store.writes.length, writes, "no write");
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

test("a write that loses a race on the file is tried again against the newer file, and neither change is lost", async () => {
  const t = buildJournal();
  const mine = newId();
  const theirs = newId();
  // Another device writes between this request's read and its write.
  t.store.state.hook = async () => {
    const other = await t.store.readMonth("2026-10");
    core.applyOp({ "2026-10": other.file }, { op: "add", list: LIST, entry: { id: theirs, type: "task", text: "From the iPad" } });
    assert.equal(await t.store.writeMonth("2026-10", other.file, other.tag), true);
  };
  const response = await post(t, { op: "add", list: LIST, entry: { id: mine, type: "task", text: "From the PC" } });
  assert.equal(response.status, 200);
  const texts = (await (await months(t, "2026-10")).json()).months["2026-10"].days[TODAY].entries.map((e) => e.text);
  assert.deepEqual(texts, ["From the iPad", "From the PC"], "both are there");
});

test("a change that keeps losing the race says so and writes nothing of its own", async () => {
  const t = buildJournal();
  const real = t.store.writeMonth.bind(t.store);
  t.store.writeMonth = async () => false;
  const response = await post(t, { op: "add", list: LIST, entry: { id: newId(), type: "task", text: "Never lands" } });
  assert.equal(response.status, 503);
  t.store.writeMonth = real;
  assert.equal(t.store.files.size, 0);
});

test("a move across months that is refused after its first try takes its copies back", async () => {
  const t = buildJournal();
  const from = core.migrateList("2026-10");
  const to = core.migrateList("2026-11");
  const id = await addEntry(t, from, "Carry me");
  const copyId = newId();
  // The first try writes November (the copy) and loses the race writing October,
  // because another device ticked the task in between.
  t.store.state.hook = null;
  const real = t.store.writeMonth.bind(t.store);
  let calls = 0;
  t.store.writeMonth = async (month, file, tag) => {
    calls += 1;
    if (calls === 2) {
      assert.equal(month, "2026-10", "the copy went first");
      const other = await t.store.readMonth("2026-10");
      core.applyOp({ "2026-10": other.file }, { op: "state", list: from, id, rev: 1, state: "done" });
      await real("2026-10", other.file, other.tag);
    }
    return real(month, file, tag);
  };
  const response = await post(t, { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId }] });
  assert.equal(response.status, 409);
  t.store.writeMonth = real;
  assert.equal((await entryOf(t, from, id)).state, "done", "the other device's change stands");
  assert.equal(await entryOf(t, to, copyId), null, "no stray copy is left in November");
});

test("a move across months writes the copy first and then the original, and a repeat does not copy twice", async () => {
  const t = buildJournal();
  const from = core.migrateList("2026-10");
  const to = core.migrateList("2026-11");
  const id = await addEntry(t, from, "Carry me");
  const copyId = newId();
  const op = { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId }] };
  const before = t.store.writes.length;
  assert.equal((await post(t, op)).status, 200);
  assert.deepEqual(t.store.writes.slice(before), ["2026-11", "2026-10"]);
  assert.equal((await entryOf(t, from, id)).state, "migrated");
  assert.equal((await entryOf(t, to, copyId)).text, "Carry me");
  assert.equal((await post(t, op)).status, 409, "the same move again is stale, not a second copy");
  assert.equal((await (await months(t, "2026-11")).json()).months["2026-11"].migrate.length, 1);
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
  assert.equal(t.store.files.size, 0);
});

test("a damaged month file is never read as empty and never written over", async () => {
  const t = buildJournal();
  t.store.files.set("2026-10", { json: JSON.stringify({ v: 1, rev: 1, days: "broken", migrate: [] }), tag: "x" });
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal((await home(t)).status, 500);
    assert.equal((await post(t, { op: "add", list: LIST, entry: { id: newId(), type: "task", text: "x" } })).status, 500);
  } finally { console.error = quiet; }
  assert.equal(t.store.files.get("2026-10").json.includes('"broken"'), true, "the damaged file is as it was");
  assert.equal(t.store.writes.length, 0);
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
      // The one default clock, which the signed-in check reads, is the only mention allowed.
      .replace("now = () => Date.now()", "");
    read += 1;
    assert.ok(!/setTimeout|setInterval|setImmediate|queueMicrotask|Date\.now|new Date\(\)|process\.on\(/.test(source), `${file} has a timer or reads the time`);
  }
  assert.equal(read, 4);
});

test("the journal API's only reading of the clock is the signed-in check and the quick notes stamp", () => {
  const source = readFileSync(new URL("../api/_lib/journal-api.js", import.meta.url), "utf8");
  const uses = source.match(/\bnow\(\)/g) ?? [];
  assert.equal(uses.length, 3, "the default clock, signedIn() and the quick notes stamp, and nothing that could decide a move");
  assert.ok(source.includes("now = () => Date.now()"));
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
    async list({ prefix, limit, cursor }) {
      calls.push({ op: "list", prefix, limit, cursor });
      const all = [...files.keys()].filter((p) => p.startsWith(prefix)).sort();
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
  await journal.POST(req("/api/journal", "POST", cookie, JSON.stringify({ op: "add", list: LIST, entry: { id: newId(), type: "task", text: secret } })));
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

test("the Blob adapter writes private, against the version it read, and creates without overwriting", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  const file = core.emptyMonth();
  assert.equal(await store.writeMonth("2026-10", file, null), true, "created");
  assert.equal(await store.writeMonth("2026-10", file, null), false, "created twice: the second is refused, not overwritten");
  const read = await store.readMonth("2026-10");
  assert.equal(await store.writeMonth("2026-10", { ...file, rev: 1 }, read.tag), true);
  assert.equal(await store.writeMonth("2026-10", { ...file, rev: 2 }, read.tag), false, "an old version is refused, not overwritten");
  assert.equal((await store.readMonth("2026-10")).file.rev, 1);

  const puts = sdk.calls.filter((c) => c.op === "put");
  assert.deepEqual([...new Set(puts.map((c) => c.pathname))], ["journal/month/2026-10.json"]);
  for (const put of puts) {
    assert.equal(put.options.access, "private");
    assert.equal(put.options.addRandomSuffix, false);
    assert.equal(put.options.contentType, "application/json");
  }
  assert.equal(puts[0].options.allowOverwrite, false, "a first write cannot replace a file");
  assert.equal(puts[2].options.ifMatch, read.tag, "a later write is against the etag that was read");
  assert.equal(puts[2].options.allowOverwrite, true, "and the package needs overwrite on to honour it");
  for (const get of sdk.calls.filter((c) => c.op === "get")) {
    assert.equal(get.options.access, "private");
    assert.equal(get.options.useCache, false, "a read bypasses the CDN so another device sees the latest");
  }
  assert.ok(puts.every((c) => !("token" in c.options)), "no credentials of its own");
});

test("the journal store lists only months, newest first, and reads quick notes with their version", async () => {
  const sdk = fakeSdk();
  const store = createJournalStore(sdk);
  for (const m of ["2026-08", "2026-10", "2026-09"]) await store.writeMonth(m, core.emptyMonth(), null);
  await store.writeQuick("scratch", "2026-10-22T09:00:00.000Z", null);
  assert.deepEqual(await store.months(), ["2026-10", "2026-09", "2026-08"], "the quick notes file is not a month");
  const quick = await store.readQuick();
  assert.equal(quick.text, "scratch");
  assert.equal(quick.updatedAt, "2026-10-22T09:00:00.000Z");
  assert.equal(await store.writeQuick("again", "2026-10-22T09:01:00.000Z", null), false, "no version, no overwrite");
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
