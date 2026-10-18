// Acceptance criteria 1, 2 and 6: what goes in comes out, the size limit holds,
// and delete means delete.

import assert from "node:assert/strict";
import { test } from "node:test";
import { build, call, put, signedInCookie } from "./helpers.js";
import { MAX_NOTE_BYTES, MESSAGES, titleOf } from "../api/_lib/notes-api.js";

// A fixture that is awkward on purpose: tabs, trailing spaces, blank lines,
// Windows and Unix line endings in one note, a lone carriage return, backticks,
// a code fence, and text in scripts that need more than one byte a character.
function awkwardNote() {
  const unit = [
    "# Heading with `backticks` and ``double``",
    "\ttabbed line with trailing spaces   ",
    "",
    "",
    "windows line ending\r",
    "another windows line\r\n",
    "lone carriage return\rafter it",
    "```bash",
    "echo \"$HOME\" && cat <<'EOF'\n\tindented heredoc\nEOF",
    "```",
    "日本語のテキストです。",
    "Привет, мир",
    "مرحبا بالعالم",
    "naïve café ñandú Ångström",
    "emoji 🙂 and a joined sequence 👩‍💻",
    "zero width​joiner and a non-breaking space",
    "trailing tab\t",
    "",
  ].join("\n");
  let text = "﻿"; // a byte order mark, which a text round trip often eats
  while (text.length < 50_000) text += unit;
  return text;
}

async function signIn(t) {
  return signedInCookie(t.password);
}

async function create(t, cookie, text) {
  return call(t.api.collection.POST, { method: "POST", path: "/api/notes", cookie, body: text });
}

async function fetchBytes(t, cookie, id) {
  const response = await call(t.api.item.GET, { path: `/api/note?id=${id}`, cookie });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

test("a note of at least 50,000 characters round-trips byte for byte", async () => {
  const t = build();
  const cookie = await signIn(t);
  const text = awkwardNote();
  assert.ok(text.length >= 50_000, `fixture is ${text.length} characters`);
  for (const feature of ["\t", "   \n", "\n\n\n", "\r\n", "\r", "```", "日本語", "Привет", "مرحبا", "🙂", "​"]) {
    assert.ok(text.includes(feature), "the fixture contains each awkward feature");
  }

  const created = await create(t, cookie, text);
  assert.equal(created.status, 201);
  const { id, updatedAt: v1 } = await created.json();

  const first = await fetchBytes(t, cookie, id);
  assert.equal(first.response.status, 200);
  assert.ok(first.bytes.equals(Buffer.from(text, "utf8")), "bytes after create are identical");
  assert.match(first.response.headers.get("content-type"), /^text\/plain/);

  // Edit and save again: the second save replaces the first byte for byte.
  const edited = text + "\r\nlast line, no newline";
  t.clock.now += 1000;
  const saved = await put(t, cookie, id, edited, v1);
  assert.equal(saved.status, 200);
  const second = await fetchBytes(t, cookie, id);
  assert.ok(second.bytes.equals(Buffer.from(edited, "utf8")), "bytes after edit are identical");
  assert.equal(new TextDecoder("utf-8", { ignoreBOM: true }).decode(second.bytes), edited, "decoded text is identical, byte order mark included");
});

test("every awkward character survives on its own, not only in aggregate", async () => {
  const t = build();
  const cookie = await signIn(t);
  const samples = ["", " ", "\t", "\n", "\r\n", "\r", "\n\n\n", "x  ", "`", "```\n```", "\u0000", "﻿", "  ", "🙂", "é"];
  for (const text of samples) {
    const { id } = await (await create(t, cookie, text)).json();
    const { bytes } = await fetchBytes(t, cookie, id);
    assert.ok(bytes.equals(Buffer.from(text, "utf8")), `sample ${JSON.stringify(text)} round-trips`);
  }
});

test("a note just under 1 MB saves, and exactly 1 MB saves", async () => {
  const t = build();
  const cookie = await signIn(t);
  for (const size of [MAX_NOTE_BYTES - 1, MAX_NOTE_BYTES]) {
    const text = "a".repeat(size - 1) + "\n";
    assert.equal(Buffer.byteLength(text), size);
    const response = await create(t, cookie, text);
    assert.equal(response.status, 201, `${size} bytes is accepted`);
    const { id } = await response.json();
    assert.ok((await fetchBytes(t, cookie, id)).bytes.equals(Buffer.from(text)));
  }
});

test("a note over 1 MB is rejected with the plain message and the saved version is untouched", async () => {
  const t = build();
  const cookie = await signIn(t);
  const original = "the saved version\n\twith a tab\r\n";
  const { id, updatedAt: base } = await (await create(t, cookie, original)).json();
  const before = (await t.store.list())[0];

  const tooBig = "b".repeat(MAX_NOTE_BYTES + 1);
  for (const [method, path, handler] of [
    ["PUT", `/api/note?id=${id}`, t.api.item.PUT],
    ["POST", "/api/notes", t.api.collection.POST],
  ]) {
    const response = await call(handler, { method, path, cookie, body: tooBig, headers: { "x-base-updated": base } });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: MESSAGES.tooLarge });
  }
  assert.match(MESSAGES.tooLarge, /over 1 MB/);
  assert.match(MESSAGES.tooLarge, /last saved version is unchanged/);

  assert.ok((await fetchBytes(t, cookie, id)).bytes.equals(Buffer.from(original)), "text untouched");
  const after = (await t.store.list()).find((n) => n.id === id);
  assert.deepEqual(after, before, "title and last-edited time untouched");
  assert.equal(t.store.notes.size, 1, "the rejected create stored nothing");
});

test("the limit is on bytes, not characters", async () => {
  const t = build();
  const cookie = await signIn(t);
  // 600,000 two-byte characters is 1,200,000 bytes: under a million characters, over 1 MB.
  const text = "é".repeat(600_000);
  assert.ok(text.length < MAX_NOTE_BYTES && Buffer.byteLength(text) > MAX_NOTE_BYTES);
  assert.equal((await create(t, cookie, text)).status, 413);
});

test("a declared length over the limit is refused before the body is read", async () => {
  const t = build();
  const cookie = await signIn(t);
  const response = await call(t.api.collection.POST, {
    method: "POST",
    cookie,
    body: "short",
    headers: { "content-length": String(MAX_NOTE_BYTES + 1) },
  }).catch(() => null);
  // Some runtimes refuse a mismatched length themselves; either way nothing is stored.
  if (response) assert.equal(response.status, 413);
  assert.equal(t.store.notes.size, 0);
});

test("bytes that are not valid text are refused and nothing is stored", async () => {
  const t = build();
  const cookie = await signIn(t);
  const response = await call(t.api.collection.POST, { method: "POST", cookie, body: new Uint8Array([0x61, 0xff, 0xfe, 0x62]) });
  assert.equal(response.status, 400);
  assert.equal(t.store.notes.size, 0);
});

test("deleting a note removes it from the list and from storage", async () => {
  const t = build();
  const cookie = await signIn(t);
  const keep = await (await create(t, cookie, "keep me")).json();
  const drop = await (await create(t, cookie, "drop me")).json();
  assert.equal(t.store.notes.size, 2);

  const response = await call(t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${drop.id}`, cookie });
  assert.equal(response.status, 200);

  const list = await (await call(t.api.collection.GET, { cookie })).json();
  assert.deepEqual(list.notes.map((n) => n.id), [keep.id]);
  assert.equal(t.store.notes.has(drop.id), false, "gone from storage");
  assert.equal((await call(t.api.item.GET, { path: `/api/note?id=${drop.id}`, cookie })).status, 404);
  assert.equal(t.store.notes.has(keep.id), true, "the other note is untouched");
});

test("the list is newest first, titled by the first line, and Untitled when there is none", async () => {
  const t = build();
  const cookie = await signIn(t);
  const make = async (text, at) => {
    t.clock.now = at;
    return (await (await create(t, cookie, text)).json()).id;
  };
  const oldest = await make("First note\nbody", Date.parse("2026-10-01T09:00:00Z"));
  const blank = await make("", Date.parse("2026-10-01T10:00:00Z"));
  const windows = await make("  Windows title  \r\nbody", Date.parse("2026-10-01T11:00:00Z"));
  const newest = await make("# Newest", Date.parse("2026-10-01T12:00:00Z"));

  const { notes } = await (await call(t.api.collection.GET, { cookie })).json();
  assert.deepEqual(notes.map((n) => n.id), [newest, windows, blank, oldest]);
  assert.deepEqual(notes.map((n) => n.title), ["# Newest", "Windows title", "Untitled", "First note"]);
  assert.equal(notes[0].updatedAt, "2026-10-01T12:00:00.000Z");

  // Editing a note moves it to the top and changes its time.
  t.clock.now = Date.parse("2026-10-02T08:30:00Z");
  const base = (await (await call(t.api.collection.GET, { cookie })).json()).notes.find((n) => n.id === oldest).updatedAt;
  await put(t, cookie, oldest, "Renamed first line", base);
  const after = (await (await call(t.api.collection.GET, { cookie })).json()).notes;
  assert.equal(after[0].id, oldest);
  assert.equal(after[0].title, "Renamed first line");
  assert.equal(after[0].updatedAt, "2026-10-02T08:30:00.000Z");
});

test("titles are clipped by character, not in the middle of one", () => {
  assert.equal(titleOf("🙂".repeat(300)), "🙂".repeat(200));
  assert.equal(titleOf("\n\nsecond line"), "Untitled");
  assert.equal(titleOf("   "), "Untitled");
});

test("an id that is not a note id never reaches storage", async () => {
  let reached = 0;
  const t = build();
  const real = t.store.read;
  t.store.read = async (...args) => { reached += 1; return real(...args); };
  const cookie = await signIn(t);
  for (const id of ["", "../secrets", "..%2F..%2Fx", "A".repeat(32), "a".repeat(31), "a".repeat(33), "a/b"]) {
    for (const [handler, method] of [[t.api.item.GET, "GET"], [t.api.item.DELETE, "DELETE"], [t.api.item.PUT, "PUT"]]) {
      const response = await call(handler, { method, path: `/api/note?id=${encodeURIComponent(id)}`, cookie, body: method === "PUT" ? "x" : undefined });
      assert.equal(response.status, 404, `${method} ${JSON.stringify(id)}`);
    }
  }
  assert.equal(reached, 0);
  assert.equal(t.store.notes.size, 0);
});
