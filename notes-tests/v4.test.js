// Notes version 4: labels, archive and the phone menu (CLAUDE.md section 9d).
// The API tests run the real handlers over the in-memory store. The phone menu
// test lifts the menu script out of notes/index.html and runs it against a
// small stand-in for the page, as theme.test.js does for the theme switch.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { MESSAGES, labelClash } from "../api/_lib/notes-api.js";
import { createBlobStore } from "../api/_lib/store.js";
import { NOW, build, call, put, signedInCookie } from "./helpers.js";

const STEP = 60_000;
const text = (t, id) => Buffer.from(t.store.notes.get(id).bytes).toString("utf8");

function setup() {
  const t = build();
  const cookie = signedInCookie(t.password);
  const tick = () => { t.clock.now += STEP; };
  return { t, cookie, tick };
}

async function makeNote(c, body, headers = {}) {
  c.tick();
  const response = await call(c.t.api.collection.POST, { method: "POST", cookie: c.cookie, body, headers });
  assert.equal(response.status, 201);
  return response.json();
}

async function labelsNow(c) {
  return (await call(c.t.api.labels.GET, { path: "/api/labels", cookie: c.cookie })).json();
}

// A change to the label list from the version the caller last saw.
async function labelChange(c, method, { id, name, base, noBase = false } = {}) {
  c.tick();
  const handler = c.t.api.labels[method];
  const current = base ?? (await labelsNow(c)).updatedAt;
  return call(handler, {
    method,
    path: `/api/labels${id ? `?id=${id}` : ""}`,
    cookie: c.cookie,
    body: name === undefined ? undefined : JSON.stringify({ name }),
    headers: noBase ? {} : { "x-base-labels": current },
  });
}

const createLabel = async (c, name) => {
  const response = await labelChange(c, "POST", { name });
  assert.equal(response.status, 201, `create ${name}`);
  return (await response.json()).id;
};

function patch(c, id, base, change) {
  c.tick();
  return call(c.t.api.item.PATCH, {
    method: "PATCH",
    path: `/api/note?id=${id}`,
    cookie: c.cookie,
    body: JSON.stringify(change),
    headers: base === undefined ? {} : { "x-base-updated": base },
  });
}

const list = async (c, query = "") => (await (await call(c.t.api.collection.GET, { path: `/api/notes${query}`, cookie: c.cookie })).json()).notes;
const search = async (c, words) =>
  (await (await call(c.t.api.collection.GET, { path: "/api/notes?view=archive", cookie: c.cookie, headers: { "x-note-search": encodeURIComponent(words) } })).json()).notes;

/* ---------- labels ---------- */

test("a label can be created, renamed and deleted, and the list is always alphabetical data", async () => {
  const c = setup();
  assert.deepEqual(await labelsNow(c), { labels: [], updatedAt: "none" }, "no file yet reads as no labels");
  const work = await createLabel(c, "  Work  ");
  const home = await createLabel(c, "home");
  let now = await labelsNow(c);
  assert.deepEqual(now.labels.map((l) => l.name), ["Work", "home"], "the name is trimmed");
  assert.match(work, /^[0-9a-f]{32}$/, "a stable 32 character id");

  const renamed = await labelChange(c, "PUT", { id: work, name: "Office" });
  assert.equal(renamed.status, 200);
  now = await labelsNow(c);
  assert.deepEqual(now.labels.map((l) => [l.id, l.name]), [[work, "Office"], [home, "home"]], "the id stays, the name changes");

  const removed = await labelChange(c, "DELETE", { id: home });
  assert.equal(removed.status, 200);
  assert.deepEqual((await labelsNow(c)).labels.map((l) => l.id), [work]);
  assert.equal((await labelChange(c, "DELETE", { id: home })).status, 404, "an unknown label is not found");
});

test("a duplicate name is refused ignoring case, and a rename may change only its own case", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const clash = await labelChange(c, "POST", { name: "wORK" });
  assert.equal(clash.status, 422);
  assert.deepEqual(await clash.json(), { error: "There is already a label called wORK.", code: "duplicate" });
  assert.equal(labelClash("x"), "There is already a label called x.");

  const other = await createLabel(c, "Play");
  const into = await labelChange(c, "PUT", { id: other, name: " WORK " });
  assert.equal(into.status, 422, "renaming onto another label's name ignoring case is a clash");
  const own = await labelChange(c, "PUT", { id: work, name: "WORK" });
  assert.equal(own.status, 200, "a label may be renamed to its own name in another case");
  assert.deepEqual((await labelsNow(c)).labels.map((l) => l.name).sort(), ["Play", "WORK"]);
});

test("a name is 1 to 50 characters after trimming", async () => {
  const c = setup();
  for (const bad of ["", "   ", "x".repeat(51), "\u{1F600}".repeat(51), 7, null]) {
    const response = await labelChange(c, "POST", { name: bad });
    assert.equal(response.status, 400, JSON.stringify(bad));
    assert.deepEqual(await response.json(), { error: MESSAGES.labelNameLength });
  }
  await createLabel(c, "x".repeat(50));
  await createLabel(c, "\u{1F600}".repeat(50));
  assert.equal((await labelsNow(c)).labels.length, 2, "50 characters, counted as characters and not bytes");
});

test("label create, rename and delete go through a version check: a stale device changes nothing", async () => {
  const c = setup();
  const a = await createLabel(c, "Shared");
  // Two devices both hold this version of the label list.
  const held = (await labelsNow(c)).updatedAt;

  // Device B renames first.
  assert.equal((await labelChange(c, "PUT", { id: a, name: "Renamed by B", base: held })).status, 200);
  const afterB = await labelsNow(c);

  // Device A, still on the old version, tries each kind of change.
  for (const [method, options] of [["POST", { name: "From A" }], ["PUT", { id: a, name: "Renamed by A" }], ["DELETE", { id: a }]]) {
    const response = await labelChange(c, method, { ...options, base: held });
    assert.equal(response.status, 409, `${method} from a stale version`);
    const body = await response.json();
    assert.equal(body.error, MESSAGES.labelsChanged);
    assert.deepEqual(body.labels, afterB.labels, "the reply carries the current list, so the page can refresh");
    assert.equal(body.updatedAt, afterB.updatedAt);
  }
  assert.deepEqual(await labelsNow(c), afterB, "nothing A tried was written");
});

test("a label change that says no version, or the version of a file that does not exist yet, is handled", async () => {
  const c = setup();
  const missing = await labelChange(c, "POST", { name: "x", noBase: true });
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: MESSAGES.labelsMissingVersion });
  const stale = await labelChange(c, "POST", { name: "x", base: "2000-01-01T00:00:00.000Z" });
  assert.equal(stale.status, 409, "a version for a file that is not there is stale");
  assert.equal((await labelsNow(c)).labels.length, 0);
  // Two creates from the empty state: the second is refused, not merged away.
  const first = await labelChange(c, "POST", { name: "One", base: "none" });
  const second = await labelChange(c, "POST", { name: "Two", base: "none" });
  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.deepEqual((await labelsNow(c)).labels.map((l) => l.name), ["One"]);
});

test("the version moves on every label change, even in one millisecond", async () => {
  const c = setup();
  const versions = [];
  for (const name of ["a", "b", "c"]) {
    const response = await call(c.t.api.labels.POST, {
      method: "POST", path: "/api/labels", cookie: c.cookie, body: JSON.stringify({ name }),
      headers: { "x-base-labels": versions.at(-1) ?? "none" },
    });
    assert.equal(response.status, 201);
    versions.push((await response.json()).updatedAt);
  }
  assert.equal(new Set(versions).size, 3);
});

/* ---------- labels and notes ---------- */

test("deleting a label leaves every note and its text untouched, and the id is dropped on the next save", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const keep = await createLabel(c, "Keep");
  const one = await makeNote(c, "First note\nbody one\n");
  const two = await makeNote(c, "Second note\n");
  assert.equal((await patch(c, one.id, one.updatedAt, { labels: [work, keep] })).status, 200);
  const before = JSON.stringify([...c.t.store.notes]);

  assert.equal((await labelChange(c, "DELETE", { id: work })).status, 200);
  assert.equal(JSON.stringify([...c.t.store.notes]), before, "no note was rewritten by deleting the label");
  assert.deepEqual(c.t.store.notes.get(one.id).meta.labels, [work, keep], "the note still holds the id, and ignores it");
  assert.equal(text(c.t, one.id), "First note\nbody one\n");
  assert.equal(text(c.t, two.id), "Second note\n");

  // The next save of that note drops the dead id and keeps the live one.
  const current = c.t.store.notes.get(one.id).meta.updatedAt;
  c.tick();
  const saved = await put(c.t, c.cookie, one.id, "First note edited\n", current);
  assert.equal(saved.status, 200);
  assert.deepEqual(c.t.store.notes.get(one.id).meta.labels, [keep]);
});

test("a text save keeps the labels and the archived flag it was not asked to change", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const note = await makeNote(c, "Title\n");
  const labelled = await (await patch(c, note.id, note.updatedAt, { labels: [work], archived: true })).json();
  c.tick();
  const saved = await (await put(c.t, c.cookie, note.id, "Title\nmore\n", labelled.updatedAt)).json();
  const meta = c.t.store.notes.get(note.id).meta;
  assert.deepEqual([meta.labels, meta.archived, meta.title], [[work], true, "Title"]);
  assert.equal(meta.updatedAt, saved.updatedAt);
});

test("a note can be created with a starting label, and unknown ids are ignored", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const note = await makeNote(c, "From a label view\n", { "x-note-labels": `${work},${"a".repeat(32)}` });
  assert.deepEqual(c.t.store.notes.get(note.id).meta.labels, [work], "the unknown id is dropped");
  c.tick();
  const bad = await call(c.t.api.collection.POST, { method: "POST", cookie: c.cookie, body: "x", headers: { "x-note-labels": "not-an-id" } });
  assert.equal(bad.status, 400);
});

test("the list and a search return each note's label ids and archived flag", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const note = await makeNote(c, "Plan\nzephyrine line\n");
  await patch(c, note.id, note.updatedAt, { labels: [work] });
  const [row] = await list(c);
  assert.deepEqual([row.labels, row.archived], [[work], false]);
  const found = await (await call(c.t.api.collection.GET, { path: "/api/notes", cookie: c.cookie, headers: { "x-note-search": "zephyrine" } })).json();
  assert.deepEqual(Object.keys(found.notes[0]).sort(), ["archived", "id", "labels", "line", "title", "updatedAt"]);
  assert.deepEqual([found.notes[0].labels, found.notes[0].archived], [[work], false]);
});

test("the label view lists only the notes with that label that are not archived", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const play = await createLabel(c, "Play");
  const a = await makeNote(c, "A work note\n");
  const b = await makeNote(c, "B archived work note\n");
  const d = await makeNote(c, "C play note\n");
  const e = await makeNote(c, "D no label\n");
  await patch(c, a.id, a.updatedAt, { labels: [work] });
  await patch(c, b.id, b.updatedAt, { labels: [work], archived: true });
  await patch(c, d.id, d.updatedAt, { labels: [play] });
  assert.deepEqual((await list(c, `?view=label&label=${work}`)).map((n) => n.id), [a.id]);
  assert.deepEqual((await list(c, `?view=label&label=${play}`)).map((n) => n.id), [d.id]);
  assert.deepEqual((await list(c, `?view=label&label=${"c".repeat(32)}`)), [], "an unknown label holds nothing");
  assert.equal((await call(c.t.api.collection.GET, { path: "/api/notes?view=label", cookie: c.cookie })).status, 400);
  assert.equal((await call(c.t.api.collection.GET, { path: "/api/notes?view=elsewhere", cookie: c.cookie })).status, 400);
  assert.equal(e.id.length, 32);
});

/* ---------- archive ---------- */

test("archive and unarchive round trip: Notes leaves archived notes out, Archive holds only them", async () => {
  const c = setup();
  const one = await makeNote(c, "One\n");
  const two = await makeNote(c, "Two\n");
  assert.deepEqual((await list(c)).map((n) => n.id), [two.id, one.id], "the default list is Notes, newest first");

  const archived = await (await patch(c, one.id, one.updatedAt, { archived: true })).json();
  assert.equal(archived.archived, true);
  assert.deepEqual((await list(c, "?view=notes")).map((n) => n.id), [two.id]);
  assert.deepEqual((await list(c, "?view=archive")).map((n) => n.id), [one.id]);
  assert.deepEqual((await list(c, "?view=all")).map((n) => n.id).sort(), [one.id, two.id].sort());
  assert.equal(text(c.t, one.id), "One\n", "archiving does not touch the text");

  const back = await (await patch(c, one.id, archived.updatedAt, { archived: false })).json();
  assert.equal(back.archived, false);
  assert.deepEqual((await list(c, "?view=archive")), []);
  assert.deepEqual((await list(c)).map((n) => n.id).sort(), [one.id, two.id].sort());
});

test("the Archive list is newest edit first, and an archived note can still be opened and edited", async () => {
  const c = setup();
  const one = await makeNote(c, "One\n");
  const two = await makeNote(c, "Two\n");
  const a = await (await patch(c, one.id, one.updatedAt, { archived: true })).json();
  const b = await (await patch(c, two.id, two.updatedAt, { archived: true })).json();
  assert.deepEqual((await list(c, "?view=archive")).map((n) => n.id), [two.id, one.id]);
  const opened = await call(c.t.api.item.GET, { path: `/api/note?id=${one.id}`, cookie: c.cookie });
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get("x-note-archived"), "true");
  c.tick();
  assert.equal((await put(c.t, c.cookie, one.id, "One edited\n", a.updatedAt)).status, 200);
  assert.equal(c.t.store.notes.get(one.id).meta.archived, true, "saving does not unarchive");
  assert.equal(b.archived, true);
});

test("search finds archived notes from any view and returns the flag", async () => {
  const c = setup();
  const live = await makeNote(c, "Live\nthe zephyrine plan\n");
  const old = await makeNote(c, "Old\nan old zephyrine plan\n");
  await patch(c, old.id, old.updatedAt, { archived: true });
  const results = await search(c, "zephyrine");
  assert.equal(results.length, 2, "one list, archived or not, whatever the view asked for");
  assert.deepEqual(results.map((n) => n.id).sort(), [live.id, old.id].sort());
  assert.equal(results.find((n) => n.id === old.id).archived, true);
});

/* ---------- the version check on a note ---------- */

test("a label or archive change from a stale version is refused, as a text save is, and writes nothing", async () => {
  const c = setup();
  const work = await createLabel(c, "Work");
  const note = await makeNote(c, "Original\n");
  // Device B saves new text first.
  c.tick();
  const b = await (await put(c.t, c.cookie, note.id, "Device B text\n", note.updatedAt)).json();
  const before = JSON.stringify(c.t.store.notes.get(note.id));

  // Device A still holds the first version.
  for (const change of [{ labels: [work] }, { archived: true }]) {
    const response = await patch(c, note.id, note.updatedAt, change);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error, MESSAGES.metaChangedElsewhere);
    assert.equal(body.updatedAt, b.updatedAt);
  }
  assert.equal(JSON.stringify(c.t.store.notes.get(note.id)), before, "nothing changed");

  // And the other way round: a label change makes a stale text save a conflict.
  const labelled = await (await patch(c, note.id, b.updatedAt, { labels: [work] })).json();
  c.tick();
  const stale = await put(c.t, c.cookie, note.id, "Device A text\n", b.updatedAt);
  assert.equal(stale.status, 409);
  assert.equal(text(c.t, note.id), "Device B text\n");
  assert.ok(labelled.updatedAt > b.updatedAt);
});

test("a change to a note that was deleted elsewhere, with no version, or that cannot be read, is refused", async () => {
  const c = setup();
  const note = await makeNote(c, "Here\n");
  const gone = await patch(c, "d".repeat(32), "2000-01-01T00:00:00.000Z", { archived: true });
  assert.equal(gone.status, 409);
  assert.deepEqual(await gone.json(), { error: MESSAGES.metaDeletedElsewhere });
  assert.equal((await patch(c, note.id, undefined, { archived: true })).status, 400);
  for (const change of [{}, { archived: "yes" }, { labels: "x" }, { labels: ["nope"] }, { labels: Array(501).fill("a".repeat(32)) }]) {
    assert.equal((await patch(c, note.id, note.updatedAt, change)).status, 400, JSON.stringify(change).slice(0, 40));
  }
  c.tick();
  const notJson = await call(c.t.api.item.PATCH, { method: "PATCH", path: `/api/note?id=${note.id}`, cookie: c.cookie, body: "{{", headers: { "x-base-updated": note.updatedAt } });
  assert.equal(notJson.status, 400);
  assert.equal((await patch(c, "short", note.updatedAt, { archived: true })).status, 404);
});

test("old metadata without labels or archived reads as no labels and not archived, with no migration", async () => {
  const c = setup();
  const note = await makeNote(c, "Old note\n");
  // The metadata as version 3 wrote it.
  c.t.store.notes.get(note.id).meta = { title: "Old note", updatedAt: note.updatedAt };
  const [row] = await list(c);
  assert.deepEqual([row.labels, row.archived], [[], false]);
  const opened = await call(c.t.api.item.GET, { path: `/api/note?id=${note.id}`, cookie: c.cookie });
  assert.equal(opened.headers.get("x-note-labels"), "");
  assert.equal(opened.headers.get("x-note-archived"), "false");
  assert.equal((await list(c, "?view=archive")).length, 0);
  c.tick();
  assert.equal((await put(c.t, c.cookie, note.id, "Old note edited\n", note.updatedAt)).status, 200);
  assert.deepEqual([c.t.store.notes.get(note.id).meta.labels, c.t.store.notes.get(note.id).meta.archived], [[], false]);
});

/* ---------- the gate ---------- */

test("every new route and method refuses without the cookie, and reads nothing", async () => {
  const t = build();
  let reads = 0;
  for (const name of Object.keys(t.store)) {
    if (typeof t.store[name] === "function") {
      const original = t.store[name];
      t.store[name] = (...args) => { reads += 1; return original(...args); };
    }
  }
  const id = "a".repeat(32);
  const attempts = [
    [t.api.labels.GET, "GET", "/api/labels"],
    [t.api.labels.POST, "POST", "/api/labels"],
    [t.api.labels.PUT, "PUT", `/api/labels?id=${id}`],
    [t.api.labels.DELETE, "DELETE", `/api/labels?id=${id}`],
    [t.api.item.PATCH, "PATCH", `/api/note?id=${id}`],
    [t.api.collection.GET, "GET", "/api/notes?view=archive"],
  ];
  for (const [handler, method, path] of attempts) {
    const response = await call(handler, { method, path, body: ["GET", "DELETE"].includes(method) ? undefined : "{}", headers: { "x-base-labels": "none", "x-base-updated": "x" } });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.deepEqual(await response.json(), { error: MESSAGES.signedOut });
  }
  assert.equal(reads, 0, "the store was never touched");
  const cookieOnly = signedInCookie(t.password);
  assert.equal((await call(t.api.labels.GET, { path: "/api/labels", cookie: cookieOnly })).status, 200);
});

test("the label routes answer no-store like every other route", async () => {
  const c = setup();
  const response = await call(c.t.api.labels.GET, { path: "/api/labels", cookie: c.cookie });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const refused = await labelChange(c, "POST", { name: "x", noBase: true });
  assert.equal(refused.headers.get("cache-control"), "no-store");
});

/* ---------- the Blob store ---------- */

class FakeNotFound extends Error {}

function fakeSdk() {
  const files = new Map();
  return {
    files,
    BlobNotFoundError: FakeNotFound,
    async put(pathname, body) { files.set(pathname, { bytes: Buffer.from(body), uploadedAt: new Date(NOW) }); },
    async get(pathname) {
      const file = files.get(pathname);
      return file ? { statusCode: 200, stream: new Response(file.bytes).body, blob: { uploadedAt: file.uploadedAt } } : null;
    },
    async head(pathname) {
      const file = files.get(pathname);
      if (!file) throw new FakeNotFound();
      return { uploadedAt: file.uploadedAt };
    },
    async list({ prefix }) {
      return { blobs: [...files.keys()].filter((p) => p.startsWith(prefix)).map((pathname) => ({ pathname, uploadedAt: files.get(pathname).uploadedAt })), hasMore: false };
    },
    async del(path) { if (!files.delete(path)) throw new FakeNotFound(); },
  };
}

test("the label list sits outside the notes prefix, so the notes listing never sees it", async () => {
  const sdk = fakeSdk();
  const store = createBlobStore(sdk);
  assert.deepEqual(await store.writeLabels({ labels: [{ id: "a".repeat(32), name: "Work" }], updatedAt: "2026-10-20T10:00:00.000Z" }, "none", "c:Work", "a".repeat(32)), { ok: true });
  assert.deepEqual(await store.write("b".repeat(32), Buffer.from("A note"), { title: "A note", updatedAt: "2026-10-20T10:01:00.000Z", labels: [], archived: false }, null, "t:x"), { ok: true, updatedAt: "2026-10-20T10:01:00.000Z", rev: 1 });
  assert.ok(sdk.files.has("labels/1.json"), "a revision of the label list, never overwritten");
  assert.ok(![...sdk.files.keys()].some((p) => p.startsWith("notes/labels")));
  assert.deepEqual((await store.list()).map((n) => n.id), ["b".repeat(32)]);
  assert.deepEqual(await store.readLabels(), { labels: [{ id: "a".repeat(32), name: "Work" }], updatedAt: "2026-10-20T10:00:00.000Z" });
  // A label list made before revisions is read as revision 0, and the first change after it is revision 1.
  const old = fakeSdk();
  old.files.set("labels.json", { bytes: Buffer.from(JSON.stringify({ labels: [{ id: "d".repeat(32), name: "Old" }], updatedAt: "2026-10-19T10:00:00.000Z" })), uploadedAt: new Date(NOW) });
  const oldStore = createBlobStore(old);
  assert.deepEqual((await oldStore.readLabels()).labels, [{ id: "d".repeat(32), name: "Old" }]);
  assert.deepEqual(await oldStore.writeLabels({ labels: [], updatedAt: "2026-10-20T10:00:00.000Z" }, "2026-10-19T10:00:00.000Z", "d:x"), { ok: true });
  assert.ok(old.files.has("labels.json") && old.files.has("labels/1.json"), "the old file is not rewritten");
  assert.deepEqual(await oldStore.writeLabels({ labels: [], updatedAt: "2026-10-20T10:01:00.000Z" }, "2026-10-19T10:00:00.000Z", "d:y"), { ok: false }, "a change from the old version is refused");
});

test("labels and archived make a new small file that names the same text, and a damaged label list is never read as empty", async () => {
  const sdk = fakeSdk();
  const store = createBlobStore(sdk);
  const id = "c".repeat(32);
  await store.write(id, Buffer.from("Text"), { title: "Text", updatedAt: "2026-10-20T10:00:00.000Z", labels: [], archived: false }, null, "t:x");
  const first = JSON.parse(sdk.files.get(`notes/${id}.1.json`).bytes.toString());
  const textBefore = Buffer.from(sdk.files.get(`notes/${id}.${first.text}.txt`).bytes).toString();
  const filesBefore = sdk.files.size;
  const done = await store.writeMeta(id, { title: "Text", updatedAt: "2026-10-20T10:05:00.000Z", labels: ["a".repeat(32)], archived: true }, "2026-10-20T10:00:00.000Z", "m:y");
  assert.equal(done.ok, true);
  assert.equal(sdk.files.size, filesBefore + 1, "one new small file and no new text file");
  assert.equal(JSON.parse(sdk.files.get(`notes/${id}.2.json`).bytes.toString()).text, first.text, "it names the text the note already had");
  assert.equal(Buffer.from(sdk.files.get(`notes/${id}.${first.text}.txt`).bytes).toString(), textBefore);
  assert.deepEqual(await store.meta(id), { title: "Text", updatedAt: "2026-10-20T10:05:00.000Z", labels: ["a".repeat(32)], archived: true });
  assert.equal(await store.meta("d".repeat(32)), null);

  for (const path of ["labels.json", "labels/1.json"]) {
    const broken = fakeSdk();
    broken.files.set(path, { bytes: Buffer.from("{ not json"), uploadedAt: new Date(NOW) });
    await assert.rejects(() => createBlobStore(broken).readLabels(), undefined, path);
  }
  assert.equal(await createBlobStore(fakeSdk()).readLabels(), null, "no file at all is no labels");
});

/* ---------- the phone menu ---------- */

const html = readFileSync(new URL("../notes/index.html", import.meta.url), "utf8");
const menuScript = html.match(/<script id="menu-script">([\s\S]*?)<\/script>/)[1];

function phoneMenu({ narrow = true, script = menuScript } = {}) {
  const focused = [];
  const listeners = {};
  const element = (name) => ({
    name,
    hidden: false,
    attributes: new Map(),
    listeners: {},
    inert: false,
    setAttribute(key, value) { this.attributes.set(key, value); },
    getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    focus() { focused.push(name); },
    click(target = this) { this.listeners.click({ target }); },
  });
  const button = element("menu-button");
  button.attributes.set("aria-expanded", "false");
  button.attributes.set("aria-label", "Open menu");
  const scrim = element("scrim");
  scrim.hidden = true;
  const main = element("main");
  const active = element("active-item");
  const first = element("first-item");
  const menu = element("menu");
  menu.querySelector = (selector) => (selector === '[aria-current="page"]' ? menu.activeItem : first);
  menu.activeItem = active;
  const items = {
    "menu-button": button, menu, scrim, main,
  };
  let mediaChange = null;
  const document = {
    getElementById: (id) => items[id] ?? null,
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  const window = {
    matchMedia: () => ({ matches: narrow, addEventListener: (type, handler) => { mediaChange = handler; } }),
  };
  runInNewContext(script, { document, window });
  const link = { closest: (selector) => (selector === "a, button" ? link : null) };
  return {
    button, scrim, main, menu, focused, window,
    key: (key) => listeners.keydown({ key }),
    resize: (matches) => mediaChange({ matches }),
    choose: () => menu.click(link),
    expanded: () => button.getAttribute("aria-expanded"),
    label: () => button.getAttribute("aria-label"),
    isOpen: () => menu.getAttribute("data-open") === "true",
  };
}

test("phone menu: the menu button opens it, sets aria-expanded and the label, covers the page and moves focus to the active item", () => {
  const m = phoneMenu();
  assert.equal(m.isOpen(), false);
  m.button.click();
  assert.equal(m.isOpen(), true);
  assert.equal(m.expanded(), "true");
  assert.equal(m.label(), "Close menu");
  assert.equal(m.scrim.hidden, false, "the scrim shows behind the open menu");
  assert.equal(m.main.inert, true, "the content is inert while it is open");
  assert.deepEqual(m.focused, ["active-item"]);
});

test("phone menu: pressing the button again closes it and returns focus to the button", () => {
  const m = phoneMenu();
  m.button.click();
  m.button.click();
  assert.equal(m.isOpen(), false);
  assert.equal(m.expanded(), "false");
  assert.equal(m.label(), "Open menu");
  assert.equal(m.scrim.hidden, true);
  assert.equal(m.main.inert, false);
  assert.equal(m.focused.at(-1), "menu-button");
});

test("phone menu: Escape closes it, and does nothing when it is closed", () => {
  const m = phoneMenu();
  m.key("Escape");
  assert.deepEqual(m.focused, [], "closed: Escape moves nothing");
  m.button.click();
  m.key("a");
  assert.equal(m.isOpen(), true, "another key does not close it");
  m.key("Escape");
  assert.equal(m.isOpen(), false);
  assert.equal(m.expanded(), "false");
  assert.equal(m.focused.at(-1), "menu-button");
});

test("phone menu: choosing an item and tapping the scrim both close it", () => {
  const m = phoneMenu();
  m.button.click();
  m.choose();
  assert.equal(m.isOpen(), false);
  assert.equal(m.focused.at(-1), "menu-button");
  m.button.click();
  m.scrim.click();
  assert.equal(m.isOpen(), false);
  assert.equal(m.expanded(), "false");
  assert.equal(m.main.inert, false);
  assert.equal(m.focused.at(-1), "menu-button");
});

test("phone menu: with no active item focus goes to the first one", () => {
  const m = phoneMenu();
  m.menu.activeItem = null;
  m.button.click();
  assert.deepEqual(m.focused, ["first-item"]);
});

test("phone menu: opening a note closes it without taking focus from the note, and widening the window closes it", () => {
  const m = phoneMenu();
  m.button.click();
  m.window.NotesMenu.close(false);
  assert.equal(m.isOpen(), false);
  assert.equal(m.focused.includes("menu-button"), false, "the editor takes focus, not the button");
  m.button.click();
  m.resize(true);
  assert.equal(m.isOpen(), true, "staying narrow changes nothing");
  m.resize(false);
  assert.equal(m.isOpen(), false);
  assert.equal(m.scrim.hidden, true);
  assert.equal(m.main.inert, false);
});

test("phone menu: the checks can fail, a menu whose Escape or scrim handling is removed is caught", () => {
  const noEscape = phoneMenu({ script: menuScript.replace('if (open && event.key === "Escape") { setOpen(false); }', "") });
  noEscape.button.click();
  noEscape.key("Escape");
  assert.equal(noEscape.isOpen(), true, "without the Escape branch the menu stays open, so the Escape test would fail");

  const noScrim = phoneMenu({ script: menuScript.replace('scrim.addEventListener("click", function () { setOpen(false); });', "") });
  noScrim.button.click();
  assert.equal(noScrim.scrim.listeners.click, undefined, "without the scrim handler a tap on it does nothing");

  const noFocus = phoneMenu({ script: menuScript.replace("button.focus();", "") });
  noFocus.button.click();
  noFocus.button.click();
  assert.equal(noFocus.focused.includes("menu-button"), false, "without the focus return the button is never focused");
});
