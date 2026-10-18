// The version check: a save from a stale copy is refused, nothing is written,
// and the caller is told in plain words so it can keep its own text on screen.

import assert from "node:assert/strict";
import { test } from "node:test";
import { build, call, put, signedInCookie } from "./helpers.js";
import { MESSAGES } from "../api/_lib/notes-api.js";

const STEP = 60_000;

async function setup(text = "original text\n") {
  const t = build();
  const cookie = signedInCookie(t.password);
  const created = await (await call(t.api.collection.POST, { method: "POST", cookie, body: text })).json();
  return { t, cookie, id: created.id, opened: created.updatedAt };
}

const stored = (t, id) => Buffer.from(t.store.notes.get(id).bytes).toString("utf8");

test("a save from a stale copy is refused and the newer text is untouched", async () => {
  const { t, cookie, id, opened } = await setup();
  // Device B opens the same version, then saves first.
  t.clock.now += STEP;
  const saveB = await put(t, cookie, id, "device B wrote this\n", opened);
  assert.equal(saveB.status, 200);
  const { updatedAt: afterB } = await saveB.json();

  // Device A still holds the original version.
  t.clock.now += STEP;
  const saveA = await put(t, cookie, id, "device A wrote this\n", opened);
  assert.equal(saveA.status, 409);
  const body = await saveA.json();
  assert.equal(body.error, MESSAGES.changedElsewhere);
  assert.equal(body.updatedAt, afterB, "the reply names the current version, so a client can tell");

  assert.equal(stored(t, id), "device B wrote this\n", "B's text is what is stored");
  assert.equal(t.store.notes.get(id).meta.updatedAt, afterB, "the time did not move");
  assert.equal((await t.store.list())[0].title, "device B wrote this", "nor did the title");
});

test("the message is plain, says what happened and what to do, and has no dash", () => {
  for (const message of [MESSAGES.changedElsewhere, MESSAGES.deletedElsewhere]) {
    assert.match(message, /another device/);
    assert.match(message, /your edits were not saved/);
    assert.match(message, /Your text is still on screen/);
    assert.match(message, /Copy it/);
    assert.ok(!/[\u2013\u2014]/.test(message));
  }
});

test("after a refusal the caller can save from the latest version", async () => {
  const { t, cookie, id, opened } = await setup();
  t.clock.now += STEP;
  await put(t, cookie, id, "B\n", opened);
  t.clock.now += STEP;
  const refused = await put(t, cookie, id, "A\n", opened);
  const { updatedAt: latest } = await refused.json();
  t.clock.now += STEP;
  const retry = await put(t, cookie, id, "A, after reading B\n", latest);
  assert.equal(retry.status, 200);
  assert.equal(stored(t, id), "A, after reading B\n");
});

test("a run of saves from one device never conflicts with itself", async () => {
  const { t, cookie, id, opened } = await setup();
  let base = opened;
  for (let i = 0; i < 5; i += 1) {
    t.clock.now += 1000;
    const response = await put(t, cookie, id, `edit ${i}\n`, base);
    assert.equal(response.status, 200, `save ${i}`);
    base = (await response.json()).updatedAt;
  }
  assert.equal(stored(t, id), "edit 4\n");
});

test("two saves in the same millisecond still get different versions, so a stale copy is caught", async () => {
  const { t, cookie, id, opened } = await setup();
  // The clock does not move at all between these calls.
  const first = await put(t, cookie, id, "first\n", opened);
  const { updatedAt: v2 } = await first.json();
  assert.notEqual(v2, opened);
  const stale = await put(t, cookie, id, "second from the stale copy\n", opened);
  assert.equal(stale.status, 409);
  assert.equal(stored(t, id), "first\n");
});

test("a note deleted on another device is not brought back by a save", async () => {
  const { t, cookie, id, opened } = await setup();
  await call(t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${id}`, cookie });
  const response = await put(t, cookie, id, "typed after it was deleted\n", opened);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, MESSAGES.deletedElsewhere);
  assert.equal(t.store.notes.size, 0, "nothing was written");
});

test("a save that does not say which version it started from is refused and writes nothing", async () => {
  const { t, cookie, id } = await setup();
  const response = await put(t, cookie, id, "no version\n");
  assert.equal(response.status, 400);
  assert.equal(stored(t, id), "original text\n");
});

test("creating a note and reading one never need a version", async () => {
  const { t, cookie, id } = await setup();
  const read = await call(t.api.item.GET, { path: `/api/note?id=${id}`, cookie });
  assert.equal(read.status, 200);
  assert.match(read.headers.get("x-note-updated"), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await call(t.api.collection.POST, { method: "POST", cookie, body: "second note" })).status, 201);
});

test("a refused save leaves a store with nothing written", async () => {
  const { t, cookie, id, opened } = await setup();
  t.clock.now += STEP;
  await put(t, cookie, id, "B\n", opened);
  const writes = [];
  const realWrite = t.store.write;
  t.store.write = async (...args) => { writes.push(args); return realWrite(...args); };
  t.clock.now += STEP;
  assert.equal((await put(t, cookie, id, "A\n", opened)).status, 409);
  assert.equal(writes.length, 0);
});
