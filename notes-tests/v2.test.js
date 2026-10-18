// Notes version 2: sign out, delete from the list, search. One test or more per
// acceptance criterion in the brief, numbered to match it. Criterion 6, every
// existing notes test still passing, is the rest of this suite.

import assert from "node:assert/strict";
import { test } from "node:test";
import { COOKIE, build, call, freshSecret, memoryStore, signedInCookie } from "./helpers.js";
import { LINE_MAX_CHARACTERS, MESSAGES, SEARCH_MAX_CHARACTERS, matchingLine } from "../api/_lib/notes-api.js";

const SIGNED_OUT = { error: "Sign in to see your notes." };

async function create(t, cookie, text) {
  const response = await call(t.api.collection.POST, { method: "POST", cookie, body: text });
  assert.equal(response.status, 201);
  return (await response.json()).id;
}

function search(t, cookie, query) {
  const headers = query === undefined ? {} : { "x-note-search": encodeURIComponent(query) };
  return call(t.api.collection.GET, { cookie, headers });
}

async function found(t, cookie, query) {
  const response = await search(t, cookie, query);
  assert.equal(response.status, 200, `search for ${JSON.stringify(query)}`);
  return (await response.json()).notes;
}

// Every route as (label, handler, request shape), sign out included.
function everyRoute(api, id) {
  return [
    ["session GET", api.session, { path: "/api/session" }],
    ["session DELETE", api.signOut, { method: "DELETE", path: "/api/session" }],
    ["notes GET", api.collection.GET, {}],
    ["notes GET search", api.collection.GET, { headers: { "x-note-search": "hello" } }],
    ["notes POST", api.collection.POST, { method: "POST", body: "new" }],
    ["note GET", api.item.GET, { path: `/api/note?id=${id}` }],
    ["note PUT", api.item.PUT, { method: "PUT", path: `/api/note?id=${id}`, body: "x", headers: { "x-base-updated": "2026-10-01T12:00:00.000Z" } }],
    ["note DELETE", api.item.DELETE, { method: "DELETE", path: `/api/note?id=${id}` }],
  ];
}

/* ---------- 1. Sign out ---------- */

test("1. sign out answers with an expired cookie of the same name, path and flags", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const response = await call(t.api.signOut, { method: "DELETE", path: "/api/session", cookie });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { signedIn: false });
  const header = response.headers.get("set-cookie");
  assert.ok(header.startsWith(`${COOKIE}=;`), "an empty value under the same name");
  assert.match(header, /; Path=\/api(;|$)/, "the same path the cookie was set on, or the browser keeps the original");
  assert.match(header, /; Max-Age=0(;|$)/);
  assert.match(header, /; Expires=Thu, 01 Jan 1970 00:00:00 GMT(;|$)/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict"]) assert.match(header, new RegExp(`; ${flag}(;|$)`));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("1. a browser that obeys the expired cookie sends nothing next time, and every route answers 401", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const id = await create(t, cookie, "secret text");
  await call(t.api.signOut, { method: "DELETE", path: "/api/session", cookie });
  // What the browser sends after it drops the cookie: no cookie at all.
  let checked = 0;
  for (const [label, handler, shape] of everyRoute(t.api, id)) {
    const response = await call(handler, shape);
    assert.equal(response.status, 401, label);
    assert.deepEqual(await response.json(), SIGNED_OUT, label);
    checked += 1;
  }
  assert.equal(checked, 8);
  assert.equal(new TextDecoder().decode(t.store.notes.get(id).bytes), "secret text", "nothing was written");
});

test("1. the known limit: the gate is stateless, so a copy of the old cookie value still opens the API after sign out", async () => {
  // Pinned deliberately so the limit is written down and cannot change
  // silently. If session storage is ever added, this test should be turned
  // around to expect 401.
  const t = build();
  const cookie = signedInCookie(t.password);
  const id = await create(t, cookie, "secret text");
  await call(t.api.signOut, { method: "DELETE", path: "/api/session", cookie });
  for (const [label, handler, shape] of everyRoute(t.api, id).filter(([l]) => l.endsWith("GET"))) {
    assert.equal((await call(handler, { ...shape, cookie })).status, 200, `${label} still accepts the copied value`);
  }
  // What does revoke it: changing the password.
  const changed = build({ password: freshSecret("new"), store: t.store });
  assert.equal((await call(changed.api.session, { path: "/api/session", cookie })).status, 401);
});

test("1. sign out without a valid cookie is a 401 and sets nothing", async () => {
  const t = build();
  const response = await call(t.api.signOut, { method: "DELETE", path: "/api/session" });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

/* ---------- 2. Delete from the list ---------- */

test("2. deleting from the list removes the note from storage and from the list", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const keep = await create(t, cookie, "keep me");
  const gone = await create(t, cookie, "delete me");
  const response = await call(t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${gone}`, cookie });
  assert.equal(response.status, 200);
  assert.ok(!t.store.notes.has(gone), "gone from storage");
  const listed = (await (await call(t.api.collection.GET, { cookie })).json()).notes.map((n) => n.id);
  assert.deepEqual(listed, [keep], "gone from the list, and the other note untouched");
});

test("2. a failed delete leaves the note in storage and in the list", async () => {
  const store = memoryStore();
  const t = build({ store });
  const cookie = signedInCookie(t.password);
  const id = await create(t, cookie, "still here");
  store.remove = async () => { throw new Error("storage refused"); };
  const quiet = console.error;
  console.error = () => {};
  let response;
  try {
    response = await call(t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${id}`, cookie });
  } finally {
    console.error = quiet;
  }
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: MESSAGES.storage });
  assert.equal(new TextDecoder().decode(store.notes.get(id).bytes), "still here");
  const listed = (await (await call(t.api.collection.GET, { cookie })).json()).notes.map((n) => n.id);
  assert.deepEqual(listed, [id]);
});

/* ---------- 3. Search the full text ---------- */

test("3. search finds a word that appears only deep inside a 50,000 character note, not in its title", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const filler = "lorem ipsum dolor sit amet\n".repeat(1900);
  const deep = `Deploy notes\n${filler}  ssh deploy@host && run zephyrine --force\n${"x".repeat(1000)}`;
  assert.ok(deep.length >= 50_000, `${deep.length} characters`);
  assert.ok(deep.indexOf("zephyrine") > 50_000, "the word sits past the 50,000th character");
  const deepId = await create(t, cookie, deep);
  await create(t, cookie, "Shopping\nmilk\neggs");

  const results = await found(t, cookie, "zephyrine");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, deepId);
  assert.equal(results[0].title, "Deploy notes", "the title does not contain the word");
  assert.equal(results[0].line, "ssh deploy@host && run zephyrine --force", "the line that matched");
  assert.deepEqual(Object.keys(results[0]).sort(), ["id", "line", "title", "updatedAt"], "the title and the line, never the note text");
});

test("3. search matches the title too, and a note matching nowhere is left out", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const id = await create(t, cookie, "Backup script\necho one");
  await create(t, cookie, "Other\nnothing here");
  const results = await found(t, cookie, "backup");
  assert.deepEqual(results.map((n) => [n.id, n.line]), [[id, "Backup script"]]);
});

test("3. a long matching line is cut to keep the match in view, without splitting a character", () => {
  const line = `${"🙂".repeat(300)} needle ${"b".repeat(300)}`;
  const shown = matchingLine(line, "NEEDLE");
  assert.ok(shown.includes("needle"));
  assert.ok(Array.from(shown).length <= LINE_MAX_CHARACTERS + 2, "the cut plus its two ellipses");
  assert.ok(shown.startsWith("\u2026") && shown.endsWith("\u2026"));
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(shown), "no half of a character");
});

test("3. clearing the search restores the full list", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  await create(t, cookie, "alpha");
  await create(t, cookie, "beta");
  assert.equal((await found(t, cookie, "alpha")).length, 1);
  for (const cleared of [undefined, "", "   "]) {
    const notes = await found(t, cookie, cleared);
    assert.equal(notes.length, 2, `search ${JSON.stringify(cleared)} lists everything`);
    assert.ok(notes.every((n) => !("line" in n)), "a plain list, not search results");
  }
});

/* ---------- 4. Case and symbols ---------- */

test("4. search ignores case", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  await create(t, cookie, "Notes\nRestart the NGINX server");
  for (const query of ["nginx", "NGINX", "NgInX", "restart THE"]) {
    assert.equal((await found(t, cookie, query)).length, 1, query);
  }
});

test("4. symbols in the search text are plain characters, never a pattern", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const text = [
    "Symbols",
    "run `npm ci` first",
    "# heading line",
    "--dry-run flag",
    "glob **/*.js here",
    "array[0] and (group) and {brace}",
    "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe",
  ].join("\n");
  await create(t, cookie, text);
  await create(t, cookie, "decoy\naXXXb and a b and abc");
  const plain = [
    ["`npm ci`", "run `npm ci` first"],
    ["# heading", "# heading line"],
    ["--dry-run", "--dry-run flag"],
    ["**/*.js", "glob **/*.js here"],
    ["array[0]", "array[0] and (group) and {brace}"],
    ["(group)", "array[0] and (group) and {brace}"],
    ["{brace}", "array[0] and (group) and {brace}"],
    ["C:\\temp\\x", "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe"],
    ["100%", "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe"],
    ["a+b?", "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe"],
    ["^start$", "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe"],
    ["end|pipe", "path C:\\temp\\x and 100% sure, a+b? ^start$ end|pipe"],
  ];
  for (const [query, line] of plain) {
    const results = await found(t, cookie, query);
    assert.deepEqual(results.map((n) => n.line), [line], `${query} found as typed`);
  }
  // As patterns these would match the decoy. As plain text they match nothing.
  for (const query of ["a.*b", "a.b", "[abc]", "a|zzz", "(a)", "\\w+"]) {
    assert.deepEqual(await found(t, cookie, query), [], `${query} is not treated as a pattern`);
  }
});

test("4. a search too long or not readable is refused with a plain message", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  const long = await search(t, cookie, "a".repeat(SEARCH_MAX_CHARACTERS + 1));
  assert.equal(long.status, 400);
  assert.deepEqual(await long.json(), { error: MESSAGES.searchTooLong });
  const broken = await call(t.api.collection.GET, { cookie, headers: { "x-note-search": "%E0%A4%A" } });
  assert.equal(broken.status, 400);
  assert.deepEqual(await broken.json(), { error: MESSAGES.searchUnreadable });
  assert.equal((await search(t, cookie, "a".repeat(SEARCH_MAX_CHARACTERS))).status, 200, "exactly the limit is allowed");
});

/* ---------- 5. No content without a valid cookie ---------- */

test("5. every search without a valid cookie gets 401 and no content, and storage is never read", async () => {
  const store = memoryStore();
  const t = build({ store });
  const good = signedInCookie(t.password);
  await create(t, good, "Secret title\nthe hidden word is quokka");
  let reads = 0;
  let lists = 0;
  const read = store.read;
  const list = store.list;
  store.read = async (id) => { reads += 1; return read(id); };
  store.list = async () => { lists += 1; return list(); };

  const [, value] = good.split("=");
  const bad = {
    "no cookie": undefined,
    "an empty cookie": `${COOKIE}=`,
    "a tampered cookie": `${COOKIE}=${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`,
    "an expired cookie": signedInCookie(t.password, Date.parse("2026-01-01T00:00:00Z")),
    "a cookie under another password": signedInCookie(freshSecret("other")),
  };
  let checked = 0;
  for (const [what, cookie] of Object.entries(bad)) {
    for (const query of ["quokka", "secret", "", "%", "a".repeat(SEARCH_MAX_CHARACTERS + 50)]) {
      const response = await call(t.api.collection.GET, { cookie, headers: { "x-note-search": encodeURIComponent(query) } });
      assert.equal(response.status, 401, `${what}, search ${JSON.stringify(query.slice(0, 20))}`);
      const body = await response.text();
      assert.deepEqual(JSON.parse(body), SIGNED_OUT);
      assert.ok(!/quokka|Secret/i.test(body));
      checked += 1;
    }
  }
  assert.equal(checked, 25);
  assert.equal(reads, 0, "no note was read");
  assert.equal(lists, 0, "the list was not read");
  // The same search with the good cookie does find it, so the 401s were not vacuous.
  assert.equal((await found(t, good, "quokka")).length, 1);
});
