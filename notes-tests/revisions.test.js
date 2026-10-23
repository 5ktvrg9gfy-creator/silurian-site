// Notes save safety. Found while building the journal, 22 October 2026: a note save
// checked the version and then overwrote the note's file in place. Vercel's Blob
// documentation says an overwritten blob "may take up to 60 seconds to propagate
// through our cache", so a read of the note's small file could show the version a
// save started from after another device had saved a newer one, the check passed,
// and the newer save was overwritten.
//
// Every save now writes a new revision file and never overwrites; the create of the
// next revision is the version check. These tests run the real notes API over the
// real Blob adapter against notes-tests/stale-sdk.js, which serves an overwritten
// file as it was for 60 seconds and, in some tests, leaves a file made in the last
// 60 seconds out of a listing. Each request goes to an instance that remembers
// nothing, as a function that has just started does.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { SUPERSEDED_MS, ORPHAN_MS, createBlobStore } from "../api/_lib/store.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";
import { staleSdk } from "./stale-sdk.js";

const SECOND = 1000;
const LAG = 60 * SECOND;

function world(options = {}) {
  const clock = { now: NOW };
  const sdk = staleSdk({ clock, ...options });
  const password = freshSecret("pw");
  const env = { [ENVIRONMENT_VARIABLE]: password };
  const cookie = signedInCookie(password);
  // A function that has just started: it remembers nothing it made or read.
  const instance = () => createNotesApi({ store: createBlobStore(sdk, { now: () => clock.now }), env, now: () => clock.now, sleep: async () => {} });
  const call = (handler, path, method = "GET", body, headers = {}) =>
    handler(new Request(`https://notes.test${path}`, { method, headers: { cookie, ...headers }, body }));
  const w = {
    clock, sdk, instance,
    create: async (text, labels = [], api = instance()) => {
      const r = await call(api.collection.POST, "/api/notes", "POST", text, labels.length ? { "x-note-labels": labels.join(",") } : {});
      return r.json();
    },
    open: async (id, api = instance()) => {
      const r = await call(api.item.GET, `/api/note?id=${id}`);
      if (r.status !== 200) return { status: r.status };
      return { status: 200, text: await r.text(), version: r.headers.get("x-note-updated"), labels: r.headers.get("x-note-labels"), archived: r.headers.get("x-note-archived") };
    },
    save: (id, text, base, api = instance()) => call(api.item.PUT, `/api/note?id=${id}`, "PUT", text, base === undefined ? {} : { "x-base-updated": base }),
    patch: (id, change, base, api = instance()) => call(api.item.PATCH, `/api/note?id=${id}`, "PATCH", JSON.stringify(change), { "x-base-updated": base }),
    remove: (id, api = instance()) => call(api.item.DELETE, `/api/note?id=${id}`, "DELETE"),
    list: async (view = "all", api = instance()) => (await call(api.collection.GET, `/api/notes?view=${view}`)).json(),
    labels: async (api = instance()) => (await call(api.labels.GET, "/api/labels")).json(),
    labelCall: (method, path, body, base, api = instance()) => call(api.labels[method], path, method, body === undefined ? undefined : JSON.stringify(body), { "x-base-labels": base }),
    files: (pattern) => [...sdk.files.keys()].filter((p) => pattern.test(p)),
  };
  return w;
}

const metaFiles = (w, id) => w.files(new RegExp(`^notes/${id}\\.\\d+\\.json$`));
const textFiles = (w, id) => w.files(new RegExp(`^notes/${id}\\.[0-9a-f]{12}\\.txt$`));

test("the stand-in does what the documentation says, so the tests below are not vacuous", async () => {
  const clock = { now: NOW };
  const sdk = staleSdk({ clock, listLagMs: LAG });
  await sdk.put("x.json", "one", { allowOverwrite: false });
  await assert.rejects(sdk.put("x.json", "two", { allowOverwrite: false }), /already exists/);
  clock.now += SECOND;
  await sdk.put("x.json", "two", { allowOverwrite: true });
  const text = async () => new Response((await sdk.get("x.json")).stream).text();
  assert.equal(await text(), "one", "an overwritten file is read as it was");
  clock.now += LAG - 2 * SECOND;
  assert.equal(await text(), "one");
  clock.now += 3 * SECOND;
  assert.equal(await text(), "two", "and is the file after 60 seconds");
  assert.deepEqual((await sdk.list({ prefix: "" })).blobs.map((b) => b.pathname), ["x.json"], "a file old enough is listed");
  await sdk.put("y.json", "new", {});
  assert.deepEqual((await sdk.list({ prefix: "" })).blobs.map((b) => b.pathname), ["x.json"], "a file made a moment ago is not");
  assert.equal(await new Response((await sdk.get("y.json")).stream).text(), "new", "though it can be read");
});

test("a stale read cannot overwrite a newer save from another instance", async () => {
  const w = world();
  const note = await w.create("v1");
  w.clock.now += 2 * SECOND;
  // Device A saves a newer version. Device B opened the note before that, so it still holds the first version.
  const a = await w.save(note.id, "v2 from A", note.updatedAt);
  assert.equal(a.status, 200);
  const second = (await a.json()).updatedAt;
  w.clock.now += 2 * SECOND;
  const b = await w.save(note.id, "v2 from B", note.updatedAt);
  assert.equal(b.status, 409, "B started from a version that is no longer the newest");
  assert.equal((await b.json()).updatedAt, second, "and is told what is");
  const read = await w.open(note.id);
  assert.equal(read.text, "v2 from A", "A's save stands");
  assert.equal(read.version, second);
});

test("the same holds when the listing is 60 seconds behind, so the newer save is not in it", async () => {
  const w = world({ listLagMs: LAG });
  const note = await w.create("v1");
  w.clock.now += 2 * SECOND;
  const a = await w.save(note.id, "v2 from A", note.updatedAt);
  assert.equal(a.status, 200, "a note made a moment ago is found though no listing shows it");
  w.clock.now += 2 * SECOND;
  const c = await w.save(note.id, "v3 from A again", (await a.json()).updatedAt);
  assert.equal(c.status, 200, "and so is a save from the version just saved, on an instance that read nothing");
  w.clock.now += 2 * SECOND;
  const b = await w.save(note.id, "from B, which still holds the first", note.updatedAt);
  assert.equal(b.status, 409);
  w.clock.now += LAG;
  assert.equal((await w.open(note.id)).text, "v3 from A again");
});

test("labels and archive changes are checked the same way, against the newest revision", async () => {
  const w = world();
  const note = await w.create("Shopping");
  w.clock.now += 2 * SECOND;
  const archived = await w.patch(note.id, { archived: true }, note.updatedAt);
  assert.equal(archived.status, 200);
  w.clock.now += SECOND;
  const stale = await w.patch(note.id, { labels: [] }, note.updatedAt);
  assert.equal(stale.status, 409, "from the version before the archive");
  const staleText = await w.save(note.id, "Shopping, edited", note.updatedAt);
  assert.equal(staleText.status, 409, "and so is a text save from it");
  const read = await w.open(note.id);
  assert.equal(read.archived, "true");
  assert.equal(read.text, "Shopping");
  // A text save keeps the flag and the labels.
  const saved = await w.save(note.id, "Shopping, edited", (await archived.json()).updatedAt);
  assert.equal(saved.status, 200);
  assert.equal((await w.open(note.id)).archived, "true");
});

test("a note deleted on another device is not brought back by a save from a copy of it", async () => {
  const w = world();
  const note = await w.create("Doomed");
  w.clock.now += SECOND;
  assert.equal((await w.remove(note.id)).status, 200);
  w.clock.now += SECOND;
  const save = await w.save(note.id, "back from the dead", note.updatedAt);
  assert.equal(save.status, 409);
  assert.equal((await w.open(note.id)).status, 404);
  const listed = await w.list();
  assert.deepEqual(listed.notes, []);
  assert.deepEqual(listed.gone, [note.id], "and a page that still shows it is told it is gone");
});

test("the same save sent again produces no second revision, through any instance", async () => {
  const w = world();
  const note = await w.create("Once");
  w.clock.now += 2 * SECOND;
  const first = await w.save(note.id, "Edited once", note.updatedAt);
  const stamp = (await first.json()).updatedAt;
  const files = w.sdk.files.size;
  for (let i = 0; i < 3; i += 1) {
    w.clock.now += 5 * SECOND;
    const again = await w.save(note.id, "Edited once", note.updatedAt);
    assert.equal(again.status, 200, "a repeat of a save that already happened is not a clash");
    assert.equal((await again.json()).updatedAt, stamp, "it is answered with the version the first one made");
  }
  assert.equal(w.sdk.files.size, files, "and nothing was written");
  assert.equal(metaFiles(w, note.id).length, 2);
  // A different text from the same base is a clash.
  assert.equal((await w.save(note.id, "Something else", note.updatedAt)).status, 409);

  const archived = await w.patch(note.id, { archived: true }, stamp);
  const archivedStamp = (await archived.json()).updatedAt;
  const again = await w.patch(note.id, { archived: true }, stamp);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).updatedAt, archivedStamp);
  assert.equal(metaFiles(w, note.id).length, 3, "one revision for the archive, however many times it was sent");
  // And a repeat of the text save after the archive on top of it is still recognised.
  const late = await w.save(note.id, "Edited once", note.updatedAt);
  assert.equal(late.status, 200);
  assert.equal(metaFiles(w, note.id).length, 3);
});

test("a repeated label change makes no second revision of the label list and gives back the same label", async () => {
  const w = world();
  const first = await w.labelCall("POST", "/api/labels", { name: "Work" }, "none");
  assert.equal(first.status, 201);
  const made = await first.json();
  w.clock.now += 5 * SECOND;
  const again = await w.labelCall("POST", "/api/labels", { name: "Work" }, "none");
  assert.equal(again.status, 201, "sent again after the answer was lost");
  const twice = await again.json();
  assert.equal(twice.id, made.id, "the same label, not a second one called Work");
  assert.equal(twice.updatedAt, made.updatedAt);
  assert.equal(w.files(/^labels\//).length, 1);
  const other = await w.labelCall("POST", "/api/labels", { name: "Home" }, "none");
  assert.equal(other.status, 409, "from the version before it, a different change is refused");
  const renamed = await w.labelCall("PUT", `/api/labels?id=${made.id}`, { name: "Office" }, made.updatedAt);
  assert.equal(renamed.status, 200);
  const labels = await w.labels();
  assert.deepEqual(labels.labels, [{ id: made.id, name: "Office" }]);
  assert.equal(w.files(/^labels\//).length, 2);
});

test("a stale label list cannot be overwritten by a change made from an older version", async () => {
  const w = world();
  const a = await (await w.labelCall("POST", "/api/labels", { name: "A" }, "none")).json();
  w.clock.now += 2 * SECOND;
  const b = await (await w.labelCall("POST", "/api/labels", { name: "B" }, a.updatedAt)).json();
  w.clock.now += 2 * SECOND;
  const stale = await w.labelCall("POST", "/api/labels", { name: "C" }, a.updatedAt);
  assert.equal(stale.status, 409);
  assert.deepEqual((await stale.json()).labels.map((l) => l.name), ["A", "B"]);
  assert.deepEqual((await w.labels()).labels.map((l) => l.name), ["A", "B"]);
  assert.equal(b.updatedAt > a.updatedAt, true);
});

test("a note made before revisions reads as its first revision, and the first save after it makes revision 1", async () => {
  const w = world();
  const id = "f".repeat(32);
  await w.sdk.put(`notes/${id}.txt`, "Old note\nbody", { allowOverwrite: false });
  await w.sdk.put(`notes/${id}.json`, JSON.stringify({ title: "Old note", updatedAt: "2026-09-01T10:00:00.000Z", labels: [], archived: false }), { allowOverwrite: false });
  const read = await w.open(id);
  assert.equal(read.text, "Old note\nbody");
  assert.equal(read.version, "2026-09-01T10:00:00.000Z");
  const listed = await w.list();
  assert.deepEqual(listed.notes.map((n) => [n.id, n.title]), [[id, "Old note"]]);
  w.clock.now += SECOND;
  const saved = await w.save(id, "Old note\nbody, edited", read.version);
  assert.equal(saved.status, 200);
  assert.ok(w.sdk.files.has(`notes/${id}.1.json`), "revision 1");
  assert.ok(w.sdk.files.has(`notes/${id}.json`) && w.sdk.files.has(`notes/${id}.txt`), "the old pair is not rewritten and not migrated");
  assert.equal((await w.open(id)).text, "Old note\nbody, edited");
  assert.equal((await w.save(id, "from a stale copy of the old note", read.version)).status, 409);
});

test("old revisions are deleted only once a newer one has been listed for over 60 seconds, and never the newest", async () => {
  const w = world();
  const note = await w.create("one");
  let version = note.updatedAt;
  for (const text of ["two", "three", "four"]) {
    w.clock.now += 2 * SECOND;
    version = (await (await w.save(note.id, text, version)).json()).updatedAt;
  }
  assert.equal(metaFiles(w, note.id).length, 4);
  assert.equal(textFiles(w, note.id).length, 4);
  w.clock.now += SUPERSEDED_MS - 8 * SECOND;
  await w.list();
  assert.equal(metaFiles(w, note.id).length, 4, "nothing goes before the minute is up");
  assert.equal(w.sdk.calls.filter((c) => c.op === "del").length, 0);

  w.clock.now += 10 * SECOND;
  const listed = await w.list();
  assert.equal(listed.notes[0].title, "four", "the list is unchanged by the tidying");
  assert.deepEqual(metaFiles(w, note.id), [`notes/${note.id}.4.json`], "only the newest small file is left");
  assert.equal(textFiles(w, note.id).length, 1, "and the one text file it uses");
  assert.equal((await w.open(note.id)).text, "four");

  // A very old note keeps its newest revision, whatever its age.
  w.clock.now += 20 * 24 * 60 * 60 * SECOND;   // inside the 30 days a sign-in lasts
  await w.list();
  assert.deepEqual(metaFiles(w, note.id), [`notes/${note.id}.4.json`]);
  assert.equal((await w.open(note.id)).text, "four");
});

test("a save tidies its own note, a text file nobody uses goes after two minutes, and a removed note keeps its last revision", async () => {
  const w = world();
  const note = await w.create("one");
  let version = note.updatedAt;
  w.clock.now += 2 * SECOND;
  version = (await (await w.save(note.id, "two", version)).json()).updatedAt;
  w.clock.now += SUPERSEDED_MS + SECOND;
  version = (await (await w.save(note.id, "three", version)).json()).updatedAt;
  assert.deepEqual(metaFiles(w, note.id), [`notes/${note.id}.2.json`, `notes/${note.id}.3.json`], "the save removed what the minute-old revision had superseded");

  // A save that lost its race leaves a text file no small file names, made after the newest revision.
  w.clock.now += SECOND;
  await w.sdk.put(`notes/${note.id}.abcdefabcdef.txt`, "from a save that lost", { allowOverwrite: false });
  w.clock.now += ORPHAN_MS - SECOND;
  await w.list();
  assert.ok(w.sdk.files.has(`notes/${note.id}.abcdefabcdef.txt`), "kept while it could still belong to a save on its way");
  w.clock.now += 2 * SECOND;
  await w.list();
  assert.ok(!w.sdk.files.has(`notes/${note.id}.abcdefabcdef.txt`), "gone after two minutes");
  assert.equal((await w.open(note.id)).text, "three");

  await w.remove(note.id);
  w.clock.now += SUPERSEDED_MS + SECOND;
  await w.list();
  assert.deepEqual(metaFiles(w, note.id), [`notes/${note.id}.4.json`], "the removal is kept, so a device that still shows the note learns it is gone");
  assert.equal(textFiles(w, note.id).length, 0, "and the text is gone");
  assert.deepEqual((await w.list()).gone, [note.id]);
});

test("another device makes the next revision between this request's check and its create: the create is refused and nothing is overwritten", async () => {
  const w = world();
  const note = await w.create("v1");
  w.clock.now += 2 * SECOND;
  // Our save passes its check on the version it started from, and then, as it makes revision 2, another device's
  // revision 2 is already there.
  const real = w.sdk.put.bind(w.sdk);
  let armed = true;
  w.sdk.put = async (pathname, body, options) => {
    if (armed && pathname === `notes/${note.id}.2.json`) {
      armed = false;
      await real(pathname, JSON.stringify({ v: 2, title: "from the other device", updatedAt: "2026-10-01T12:00:01.000Z", labels: [], archived: false, text: "legacy", from: note.updatedAt, fp: "t:other" }), { allowOverwrite: false });
    }
    return real(pathname, body, options);
  };
  const response = await w.save(note.id, "from this device", note.updatedAt);
  assert.equal(response.status, 409, "refused, not written over");
  assert.equal((await response.json()).updatedAt, "2026-10-01T12:00:01.000Z", "and told what is there");
  assert.equal(JSON.parse(w.sdk.files.get(`notes/${note.id}.2.json`).versions.at(-1).bytes.toString()).title, "from the other device");
  assert.equal(w.sdk.files.get(`notes/${note.id}.2.json`).versions.length, 1, "the file was never overwritten");

  // The same for a change of labels or archive.
  armed = true;
  const patch = await w.patch(note.id, { archived: true }, note.updatedAt);
  assert.equal(patch.status, 409);
});

test("another device changes the label list between this request's check and its create: refused, not written over", async () => {
  const w = world();
  const a = await (await w.labelCall("POST", "/api/labels", { name: "A" }, "none")).json();
  w.clock.now += 2 * SECOND;
  const real = w.sdk.list.bind(w.sdk);
  let lists = 0;
  w.sdk.list = async (options) => {
    if (options.prefix === "labels/") {
      lists += 1;
      // The second look at the label list, the one the write makes, finds another device's change in it.
      if (lists === 2) await w.sdk.put("labels/2.json", JSON.stringify({ labels: [{ id: "b".repeat(32), name: "B" }], updatedAt: "2026-10-01T12:00:05.000Z", from: a.updatedAt, fp: "c:B" }), { allowOverwrite: false });
    }
    return real(options);
  };
  const response = await w.labelCall("POST", "/api/labels", { name: "C" }, a.updatedAt);
  assert.equal(response.status, 409, "not made, and not said to be made");
  assert.deepEqual((await response.json()).labels.map((l) => l.name), ["B"]);
  assert.equal(w.files(/^labels\//).length, 2, "no third revision");
});

test("the list never shows an older version of a note than one the server has made, and a stale index cannot", async () => {
  const w = world();
  const note = await w.create("v1");
  const before = await w.list();
  w.clock.now += 2 * SECOND;
  const saved = await (await w.save(note.id, "v2", note.updatedAt)).json();
  const after = await w.list();
  assert.equal(after.notes[0].updatedAt, saved.updatedAt);
  assert.equal(after.notes[0].title, "v2");
  assert.equal(before.notes[0].title, "v1");
  // The index is overwritten in place and is only a copy: an old one is never trusted past its revision tags.
  const index = JSON.parse(w.sdk.files.get("notes-index.json").versions.at(-1).bytes.toString());
  assert.equal(index.entries[note.id].tag, "r2");
});

test("two hundred saves, changes and deletes, some sent twice, each to an instance that remembers nothing, end as one device would have left them", async () => {
  const w = world();
  let seed = 20261022;
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  // One device's view of what should happen. A request from the newest version is made. A request that
  // repeats what one of the last three revisions already did, from the same version, is done and makes
  // nothing. Anything else from an older version, or for a note that was deleted, is refused.
  const model = new Map();   // id -> { text, version, archived, deleted, history: [{ from, fp }] }
  const devices = [new Map(), new Map(), new Map()];   // what each device last saw: id -> version
  const ids = [];
  const sent = [];
  let clashes = 0;
  let repeats = 0;
  const expected = (truth, known, fp) => {
    if (truth.deleted) return 409;
    if (known === truth.version) return 200;
    return truth.history.slice(-3).some((h) => h.from === known && h.fp === fp) ? 200 : 409;
  };
  for (let step = 0; step < 200; step += 1) {
    w.clock.now += random(4) * SECOND;
    const device = devices[random(devices.length)];
    if (ids.length < 3 || random(12) === 0) {
      const made = await w.create(`Note ${ids.length} v0`);
      model.set(made.id, { text: `Note ${ids.length} v0`, version: made.updatedAt, archived: false, deleted: false, history: [{ from: null, fp: "new" }] });
      ids.push(made.id);
      device.set(made.id, made.updatedAt);
      continue;
    }
    const id = ids[random(ids.length)];
    const truth = model.get(id);
    const known = device.get(id) ?? truth.version;
    const kind = random(10);
    if (kind === 0) {
      const read = await w.open(id);
      if (truth.deleted) assert.equal(read.status, 404, `step ${step}`);
      else { assert.equal(read.version, truth.version, `step ${step}: open shows the newest`); device.set(id, read.version); }
      continue;
    }
    if (kind === 1) {
      assert.equal((await w.remove(id)).status, 200);
      truth.deleted = true;
      continue;
    }
    const text = `${truth.text.split(" v")[0]} v${step}`;
    const change = { archived: !truth.archived };
    const isSave = kind <= 6;
    const fp = isSave ? `t:${text}` : `m:${change.archived}`;
    const request = () => (isSave ? w.save(id, text, known) : w.patch(id, change, known));
    const want = expected(truth, known, fp);
    const filesBefore = metaFiles(w, id).length;
    const response = await request();
    assert.equal(response.status, want, `step ${step}: ${isSave ? "a save" : "a change"} from ${known === truth.version ? "the newest" : "an old"} version of ${truth.deleted ? "a deleted note" : "a note"}`);
    if (want === 200 && known === truth.version) {
      const body = await response.json();
      truth.version = body.updatedAt;
      if (isSave) truth.text = text; else truth.archived = change.archived;
      truth.history.push({ from: known, fp });
      device.set(id, body.updatedAt);
      sent.push({ id, request, version: body.updatedAt });
    } else if (want === 200) {
      repeats += 1;
      assert.equal(metaFiles(w, id).length, filesBefore, `step ${step}: a repeat made no second revision`);
    } else {
      clashes += 1;
      const read = await w.open(id);
      if (read.status === 200) device.set(id, read.version);
    }
    // Some requests arrive twice, through another instance.
    if (sent.length > 0 && random(5) === 0) {
      const again = sent[sent.length - 1];
      const t = model.get(again.id);
      if (!t.deleted && t.history.slice(-3).length > 0) {
        const before = metaFiles(w, again.id).length;
        const r = await again.request();
        const doneAlready = t.history.slice(-3).some((h) => h.fp !== "new");
        assert.equal(r.status, doneAlready && t.version === again.version ? 200 : r.status);
        if (r.status === 200 && t.version === again.version) {
          assert.equal(metaFiles(w, again.id).length, before, "a request sent twice made no second revision");
          repeats += 1;
        }
      }
    }
  }
  assert.ok(clashes > 10 && repeats > 5, `a real mix: ${clashes} refused, ${repeats} repeated`);
  for (const id of ids) {
    const truth = model.get(id);
    const read = await w.open(id);
    if (truth.deleted) { assert.equal(read.status, 404); continue; }
    assert.equal(read.text, truth.text, `${id} text`);
    assert.equal(read.version, truth.version);
    assert.equal(read.archived, String(truth.archived));
  }
  const listed = await w.list();
  assert.deepEqual(listed.notes.map((n) => n.id).sort(), ids.filter((id) => !model.get(id).deleted).sort());
  assert.deepEqual([...listed.gone].sort(), ids.filter((id) => model.get(id).deleted).sort());

  // And after the minute, the tidying takes nothing the newest needs.
  w.clock.now += SUPERSEDED_MS + 3 * ORPHAN_MS;
  await w.list();
  for (const id of ids) {
    const truth = model.get(id);
    assert.equal(metaFiles(w, id).length, 1, `${id} keeps only its newest small file`);
    if (!truth.deleted) assert.equal((await w.open(id)).text, truth.text, `${id} still reads after the tidying`);
  }
});

test("revisions are never overwritten: no put in all of that asked to", async () => {
  const w = world();
  const note = await w.create("one");
  let version = note.updatedAt;
  for (const text of ["two", "three"]) {
    w.clock.now += 2 * SECOND;
    version = (await (await w.save(note.id, text, version)).json()).updatedAt;
  }
  await w.patch(note.id, { archived: true }, version);
  await w.labelCall("POST", "/api/labels", { name: "Work" }, "none");
  await w.list();
  const overwrites = w.sdk.calls.filter((c) => c.op === "put" && c.options.allowOverwrite === true).map((c) => c.pathname);
  assert.deepEqual([...new Set(overwrites)], ["notes-index.json"], "the one file still overwritten is the index, which is only a copy");
});
