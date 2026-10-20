// The Blob adapter, against an in-memory stand-in for the package. This proves
// how the adapter uses the package (private, overwrite in place, text before
// metadata, paging). It cannot prove the package or the store behave as the
// stand-in does; that needs a real Preview with a store attached.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { createBlobStore } from "../api/_lib/store.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";

class FakeNotFound extends Error {}

function fakeSdk({ pageSize = 2 } = {}) {
  const files = new Map();
  const calls = [];
  let tick = 0;
  let version = 0;
  return {
    files,
    calls,
    BlobNotFoundError: FakeNotFound,
    async put(pathname, body, options) {
      calls.push({ op: "put", pathname, options });
      if (files.has(pathname) && !options.allowOverwrite) throw new Error("exists");
      // Like the real store, every write gives the blob a new etag.
      files.set(pathname, { bytes: Buffer.from(typeof body === "string" ? body : body), uploadedAt: new Date(NOW + tick++), etag: `etag-${version++}` });
      return { pathname };
    },
    async get(pathname, options) {
      calls.push({ op: "get", pathname, options });
      const file = files.get(pathname);
      if (!file) return null;
      return {
        statusCode: 200,
        stream: new Response(file.bytes).body,
        blob: { size: file.bytes.length, uploadedAt: file.uploadedAt, contentType: "text/plain" },
      };
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
      const start = cursor ? Number(cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const next = start + pageSize;
      return {
        blobs: slice.map((pathname) => ({ pathname, uploadedAt: files.get(pathname).uploadedAt, size: 1, url: "u", downloadUrl: "d", etag: files.get(pathname).etag })),
        hasMore: next < all.length,
        cursor: next < all.length ? String(next) : undefined,
      };
    },
    async del(target) {
      calls.push({ op: "del", pathname: target });
      for (const path of [target].flat()) {
        if (!files.delete(path)) throw new FakeNotFound();
      }
    },
  };
}

function wire() {
  const sdk = fakeSdk();
  const password = freshSecret("pw");
  const api = createNotesApi({ store: createBlobStore(sdk), env: { [ENVIRONMENT_VARIABLE]: password }, now: () => NOW, sleep: async () => {} });
  return { sdk, api, cookie: signedInCookie(password) };
}

const request = (path, method, cookie, body) =>
  new Request(`https://notes.test${path}`, { method, headers: { cookie }, body });

test("notes are written private, in place, text first and metadata second", async () => {
  const { sdk, api, cookie } = wire();
  const { id } = await (await api.collection.POST(request("/api/notes", "POST", cookie, "Title\nbody"))).json();
  const puts = sdk.calls.filter((c) => c.op === "put");
  assert.deepEqual(puts.map((c) => c.pathname), [`notes/${id}.txt`, `notes/${id}.json`]);
  for (const put of puts) {
    assert.equal(put.options.access, "private");
    assert.equal(put.options.addRandomSuffix, false);
    assert.equal(put.options.allowOverwrite, true);
  }
  assert.match(puts[0].options.contentType, /^text\/plain/);
});

test("every read is private and bypasses the CDN cache so another device sees the latest save", async () => {
  const { sdk, api, cookie } = wire();
  const { id } = await (await api.collection.POST(request("/api/notes", "POST", cookie, "x"))).json();
  await api.item.GET(request(`/api/note?id=${id}`, "GET", cookie));
  await api.collection.GET(request("/api/notes", "GET", cookie));
  const gets = sdk.calls.filter((c) => c.op === "get");
  assert.ok(gets.length >= 3, `${gets.length} reads observed`);
  for (const get of gets) {
    assert.equal(get.options.access, "private");
    assert.equal(get.options.useCache, false);
  }
});

test("the list pages through every note and drops nothing at a page boundary", async () => {
  const { sdk, api, cookie } = wire();
  const ids = [];
  for (let i = 0; i < 5; i += 1) {
    ids.push((await (await api.collection.POST(request("/api/notes", "POST", cookie, `Note ${i}`))).json()).id);
  }
  const { notes } = await (await api.collection.GET(request("/api/notes", "GET", cookie))).json();
  assert.deepEqual(notes.map((n) => n.id).sort(), [...ids].sort());
  const listCalls = sdk.calls.filter((c) => c.op === "list");
  assert.ok(listCalls.length >= 3, "five notes is ten files, which is several pages at this page size");
  assert.ok(listCalls.every((c) => c.prefix === "notes/"));
});

test("delete removes both files from storage and the note from the list", async () => {
  const { sdk, api, cookie } = wire();
  const { id } = await (await api.collection.POST(request("/api/notes", "POST", cookie, "to go"))).json();
  assert.equal(sdk.files.size, 2);
  const response = await api.item.DELETE(request(`/api/note?id=${id}`, "DELETE", cookie));
  assert.equal(response.status, 200);
  assert.equal(sdk.files.size, 0, "nothing left in storage");
  const { notes } = await (await api.collection.GET(request("/api/notes", "GET", cookie))).json();
  assert.deepEqual(notes, []);
  // Deleting again is not an error.
  assert.equal((await api.item.DELETE(request(`/api/note?id=${id}`, "DELETE", cookie))).status, 200);
});

test("a note whose metadata is missing or damaged still lists, as Untitled", async () => {
  const { sdk, api, cookie } = wire();
  const a = (await (await api.collection.POST(request("/api/notes", "POST", cookie, "A"))).json()).id;
  const b = (await (await api.collection.POST(request("/api/notes", "POST", cookie, "B"))).json()).id;
  sdk.files.delete(`notes/${a}.json`);
  sdk.files.get(`notes/${b}.json`).bytes = Buffer.from("{ not json");
  const { notes } = await (await api.collection.GET(request("/api/notes", "GET", cookie))).json();
  assert.deepEqual(notes.map((n) => n.title).sort(), ["Untitled", "Untitled"]);
  // Reading the text still works and a save repairs the title.
  assert.equal((await api.item.GET(request(`/api/note?id=${a}`, "GET", cookie))).status, 200);
  const base = (await (await api.item.GET(request(`/api/note?id=${a}`, "GET", cookie))).headers.get("x-note-updated"));
  const repaired = await api.item.PUT(new Request(`https://notes.test/api/note?id=${a}`, { method: "PUT", headers: { cookie, "x-base-updated": base }, body: "Repaired title" }));
  assert.equal(repaired.status, 200, "a note with no metadata can still be saved from the time it was opened");
  const after = (await (await api.collection.GET(request("/api/notes", "GET", cookie))).json()).notes;
  assert.ok(after.some((n) => n.id === a && n.title === "Repaired title"));
});

test("a storage failure answers 500 with a plain message and leaks nothing", async () => {
  const sdk = fakeSdk();
  const secret = freshSecret("token");
  sdk.put = async () => { throw new Error(`upstream said no for ${secret}`); };
  const password = freshSecret("pw");
  const api = createNotesApi({ store: createBlobStore(sdk), env: { [ENVIRONMENT_VARIABLE]: password }, now: () => NOW, sleep: async () => {} });
  const quiet = console.error;
  console.error = () => {};
  try {
    const response = await api.collection.POST(request("/api/notes", "POST", signedInCookie(password), "x"));
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes(secret));
  } finally {
    console.error = quiet;
  }
});

test("the version check reads two small files and never the note text", async () => {
  const { sdk, api, cookie } = wire();
  const { id, updatedAt } = await (await api.collection.POST(request("/api/notes", "POST", cookie, "A".repeat(100_000)))).json();
  sdk.calls.length = 0;
  const response = await api.item.PUT(new Request(`https://notes.test/api/note?id=${id}`, { method: "PUT", headers: { cookie, "x-base-updated": updatedAt }, body: "B" }));
  assert.equal(response.status, 200);
  const before = sdk.calls.slice(0, sdk.calls.findIndex((c) => c.op === "put"));
  assert.deepEqual(before.map((c) => c.pathname), [`notes/${id}.txt`, `notes/${id}.json`], "a head of the text, then the metadata");
  assert.ok(!before.some((c) => c.op === "get" && c.pathname.endsWith(".txt")), "the text was not downloaded to check the version");
});

test("a note with no text file is reported as gone even if its metadata lingers", async () => {
  const { sdk, api, cookie } = wire();
  const { id, updatedAt } = await (await api.collection.POST(request("/api/notes", "POST", cookie, "A"))).json();
  sdk.files.delete(`notes/${id}.txt`);
  const response = await api.item.PUT(new Request(`https://notes.test/api/note?id=${id}`, { method: "PUT", headers: { cookie, "x-base-updated": updatedAt }, body: "B" }));
  assert.equal(response.status, 409);
  assert.ok(!sdk.files.has(`notes/${id}.txt`), "the deleted note was not brought back");
});
