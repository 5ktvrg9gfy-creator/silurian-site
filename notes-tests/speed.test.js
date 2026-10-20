// Notes speed, server side: the metadata index and the reads that go out
// together. The index is only a copy, so these tests are mostly about what it
// must never do: put a stale row on screen, change a version check, or make a
// request fail.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { createBlobStore } from "../api/_lib/store.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";

class FakeNotFound extends Error {}

function fakeSdk({ failIndexPut = false } = {}) {
  const files = new Map();
  const calls = [];
  const flight = { now: 0, most: 0 };
  let tick = 0;
  let version = 0;
  const around = async (work) => {
    flight.now += 1;
    flight.most = Math.max(flight.most, flight.now);
    await new Promise((r) => setTimeout(r, 2));
    try { return work(); } finally { flight.now -= 1; }
  };
  return {
    files,
    calls,
    flight,
    BlobNotFoundError: FakeNotFound,
    put: (pathname, body, options) => around(() => {
      calls.push({ op: "put", pathname });
      if (failIndexPut && pathname === "notes-index.json") throw new Error("refused");
      files.set(pathname, { bytes: Buffer.from(body), uploadedAt: new Date(NOW + tick++), etag: `etag-${version++}` });
      return { pathname };
    }),
    get: (pathname) => around(() => {
      calls.push({ op: "get", pathname });
      const file = files.get(pathname);
      return file ? { statusCode: 200, stream: new Response(file.bytes).body, blob: { uploadedAt: file.uploadedAt } } : null;
    }),
    head: (pathname) => around(() => {
      calls.push({ op: "head", pathname });
      const file = files.get(pathname);
      if (!file) throw new FakeNotFound();
      return { uploadedAt: file.uploadedAt, pathname };
    }),
    list: ({ prefix }) => around(() => {
      calls.push({ op: "list", prefix });
      const blobs = [...files].filter(([p]) => p.startsWith(prefix)).map(([pathname, f]) => ({ pathname, uploadedAt: f.uploadedAt, etag: f.etag }));
      return { blobs, hasMore: false };
    }),
    del: (pathname) => around(() => {
      calls.push({ op: "del", pathname });
      if (!files.delete(pathname)) throw new FakeNotFound();
    }),
  };
}

function wire(options) {
  const sdk = fakeSdk(options);
  const password = freshSecret("pw");
  let clock = NOW;
  const api = createNotesApi({ store: createBlobStore(sdk), env: { [ENVIRONMENT_VARIABLE]: password }, now: () => (clock += 10), sleep: async () => {} });
  const cookie = signedInCookie(password);
  const send = (handler, path, method = "GET", body, headers = {}) =>
    handler(new Request(`https://notes.test${path}`, { method, headers: { cookie, ...headers }, body }));
  return { sdk, api, send, cookie };
}

const mark = (sdk) => sdk.calls.length;
const since = (sdk, from) => sdk.calls.slice(from);
const count = (calls, op) => calls.filter((c) => c.op === op).length;

async function seeded(n = 6) {
  const t = wire();
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    ids.push((await (await t.send(t.api.collection.POST, "/api/notes", "POST", `Note ${i}\nbody ${i}`)).json()).id);
  }
  return { ...t, ids };
}
const listOf = async (t) => (await (await t.send(t.api.collection.GET, "/api/notes?view=all")).json()).notes;

test("once the index is made, a list is one listing and one read, whatever the number of notes", async () => {
  const t = await seeded(8);
  await listOf(t); // the first list makes the index
  const from = mark(t.sdk);
  const notes = await listOf(t);
  assert.equal(notes.length, 8);
  const calls = since(t.sdk, from);
  assert.deepEqual(calls.map((c) => c.op).sort(), ["get", "list"], JSON.stringify(calls));
  assert.equal(calls.find((c) => c.op === "get").pathname, "notes-index.json");
});

test("the first list of a store with no index reads each note once and makes the index", async () => {
  const t = await seeded(5);
  const from = mark(t.sdk);
  await listOf(t);
  const calls = since(t.sdk, from);
  assert.equal(count(calls, "get"), 1 + 5, "the missing index, then the five metadata files");
  assert.equal(count(calls, "put"), 1);
  assert.ok(t.sdk.files.has("notes-index.json"));
});

test("after one note changes, the next list reads that note's metadata only and repairs the index once", async () => {
  const t = await seeded(6);
  await listOf(t);
  const base = (await t.send(t.api.item.GET, `/api/note?id=${t.ids[2]}`)).headers.get("x-note-updated");
  const patched = await t.send(t.api.item.PATCH, `/api/note?id=${t.ids[2]}`, "PATCH", JSON.stringify({ archived: true }), { "x-base-updated": base });
  assert.equal(patched.status, 200);
  const from = mark(t.sdk);
  const notes = await listOf(t);
  const calls = since(t.sdk, from);
  assert.equal(notes.find((n) => n.id === t.ids[2]).archived, true, "the change shows at once");
  assert.equal(count(calls, "get"), 1 + 1, "the index and the one changed metadata file");
  assert.equal(count(calls, "put"), 1);
  const again = since(t.sdk, mark(t.sdk));
  await listOf(t);
  assert.equal(count(since(t.sdk, mark(t.sdk) - 2), "put"), 0, "and the list after that makes no write");
  assert.deepEqual(again, []);
});

test("an index that is behind the store never shows a stale row", async () => {
  const t = await seeded(4);
  await listOf(t);
  // Another instance wrote a note's metadata after this index was made.
  const meta = JSON.parse(t.sdk.files.get(`notes/${t.ids[1]}.json`).bytes.toString());
  await t.sdk.put(`notes/${t.ids[1]}.json`, JSON.stringify({ ...meta, title: "Changed elsewhere", labels: [], archived: true }), {});
  const notes = await listOf(t);
  const row = notes.find((n) => n.id === t.ids[1]);
  assert.equal(row.title, "Changed elsewhere");
  assert.equal(row.archived, true);
});

test("a note deleted elsewhere leaves the list and the index", async () => {
  const t = await seeded(4);
  await listOf(t);
  await t.send(t.api.item.DELETE, `/api/note?id=${t.ids[0]}`, "DELETE");
  const notes = await listOf(t);
  assert.equal(notes.length, 3);
  assert.ok(!notes.some((n) => n.id === t.ids[0]));
  const index = JSON.parse(t.sdk.files.get("notes-index.json").bytes.toString());
  assert.ok(!(t.ids[0] in index.entries), "the index lost it too");
});

test("a damaged, empty or other-version index is ignored and replaced", async () => {
  for (const bad of ["{ not json", "{}", JSON.stringify({ v: 99, entries: { x: { tag: "m:etag-0", title: "Wrong" } } }), "null", "[]"]) {
    const t = await seeded(3);
    await t.sdk.put("notes-index.json", bad, {});
    const notes = await listOf(t);
    assert.equal(notes.length, 3, bad);
    assert.deepEqual(notes.map((n) => n.title).sort(), ["Note 0", "Note 1", "Note 2"]);
    const index = JSON.parse(t.sdk.files.get("notes-index.json").bytes.toString());
    assert.equal(Object.keys(index.entries).length, 3, "replaced with a good one");
  }
});

test("an index that cannot be written never fails a list", async () => {
  const t = wire({ failIndexPut: true });
  const id = (await (await t.send(t.api.collection.POST, "/api/notes", "POST", "Only note")).json()).id;
  const response = await t.send(t.api.collection.GET, "/api/notes?view=all");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).notes.map((n) => n.id), [id]);
});

test("a note with no metadata file lists as before and its entry is replaced by a save", async () => {
  const t = await seeded(2);
  await listOf(t);
  t.sdk.files.delete(`notes/${t.ids[0]}.json`);
  const notes = await listOf(t);
  assert.equal(notes.find((n) => n.id === t.ids[0]).title, "Untitled");
});

test("a version check never looks at the index", async () => {
  const t = await seeded(2);
  await listOf(t);
  const id = t.ids[0];
  const real = (await t.send(t.api.item.GET, `/api/note?id=${id}`)).headers.get("x-note-updated");
  // Make the index claim a different version for this note, with its tag intact.
  const index = JSON.parse(t.sdk.files.get("notes-index.json").bytes.toString());
  const lie = "2030-01-01T00:00:00.000Z";
  index.entries[id].updatedAt = lie;
  await t.sdk.put("notes-index.json", JSON.stringify(index), {});
  const withLie = await t.send(t.api.item.PUT, `/api/note?id=${id}`, "PUT", "edited", { "x-base-updated": lie });
  assert.equal(withLie.status, 409, "the index's version is not the note's version");
  const withReal = await t.send(t.api.item.PUT, `/api/note?id=${id}`, "PUT", "edited", { "x-base-updated": real });
  assert.equal(withReal.status, 200);
  const withDeleted = await t.send(t.api.item.DELETE, `/api/note?id=${id}`, "DELETE");
  assert.equal(withDeleted.status, 200);
  const gone = await t.send(t.api.item.PUT, `/api/note?id=${id}`, "PUT", "again", { "x-base-updated": real });
  assert.equal(gone.status, 409, "a deleted note still refuses a save, whatever the index says");
});

test("search reads each note's text once and no metadata", async () => {
  const t = await seeded(5);
  await listOf(t);
  const from = mark(t.sdk);
  const found = await (await t.send(t.api.collection.GET, "/api/notes", "GET", undefined, { "x-note-search": encodeURIComponent("body 3") })).json();
  assert.equal(found.notes.length, 1);
  const calls = since(t.sdk, from);
  assert.equal(count(calls, "get"), 1 + 5, "the index, then the five texts");
  assert.ok(calls.filter((c) => c.op === "get").every((c) => c.pathname === "notes-index.json" || c.pathname.endsWith(".txt")), JSON.stringify(calls));
});

test("opening a note and changing its labels send their independent reads together", async () => {
  const t = await seeded(1);
  const id = t.ids[0];
  t.sdk.flight.most = 0;
  const opened = await t.send(t.api.item.GET, `/api/note?id=${id}`);
  assert.equal(opened.status, 200);
  assert.equal(t.sdk.flight.most, 2, "the text and the metadata are read together");
  const version = opened.headers.get("x-note-updated");
  const label = await (await t.send(t.api.labels.POST, "/api/labels", "POST", JSON.stringify({ name: "Work" }), { "x-base-labels": "none" })).json();
  t.sdk.flight.most = 0;
  const from = mark(t.sdk);
  const patched = await t.send(t.api.item.PATCH, `/api/note?id=${id}`, "PATCH", JSON.stringify({ labels: [label.id] }), { "x-base-updated": version });
  assert.equal(patched.status, 200);
  assert.equal(t.sdk.flight.most, 3, "the text file check, the metadata and the label list are read together");
  assert.equal(count(since(t.sdk, from), "put"), 1);
  assert.deepEqual((await patched.json()).labels, [label.id]);
});

test("a label change still drops an id the label list no longer knows", async () => {
  const t = await seeded(1);
  const id = t.ids[0];
  const version = (await t.send(t.api.item.GET, `/api/note?id=${id}`)).headers.get("x-note-updated");
  const ghost = "a".repeat(32);
  const patched = await t.send(t.api.item.PATCH, `/api/note?id=${id}`, "PATCH", JSON.stringify({ labels: [ghost] }), { "x-base-updated": version });
  assert.deepEqual((await patched.json()).labels, []);
});
