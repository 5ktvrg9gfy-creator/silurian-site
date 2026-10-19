// Sign out fix, 18 October 2026: the notes page and every API answer tell the
// browser not to store them, whatever the answer was. A stored copy is what a
// browser can show on Back or refresh without asking the server.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { build, call, memoryStore, signedInCookie } from "./helpers.js";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

// One request for every kind of answer the API gives: each route, signed in and
// not, success and each failure.
async function everyAnswer() {
  const store = memoryStore();
  const t = build({ store });
  const cookie = signedInCookie(t.password);
  const created = await call(t.api.collection.POST, { method: "POST", cookie, body: "Title\ntext" });
  const { id, updatedAt } = await created.clone().json();
  const answers = { "notes POST 201": created };
  const add = async (label, handler, shape) => { answers[label] = await call(handler, shape); };

  await add("login 200", t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: t.password }) });
  await add("login 401", t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: "wrong" }) });
  await add("session 200", t.api.session, { path: "/api/session", cookie });
  await add("session 401", t.api.session, { path: "/api/session" });
  await add("notes GET 200", t.api.collection.GET, { cookie });
  await add("notes GET search 200", t.api.collection.GET, { cookie, headers: { "x-note-search": "text" } });
  await add("notes GET search 400", t.api.collection.GET, { cookie, headers: { "x-note-search": "%E0%A4%A" } });
  await add("notes GET 401", t.api.collection.GET, {});
  await add("note GET 200", t.api.item.GET, { path: `/api/note?id=${id}`, cookie });
  await add("note GET 404", t.api.item.GET, { path: `/api/note?id=${"b".repeat(32)}`, cookie });
  await add("note PUT 409", t.api.item.PUT, { method: "PUT", path: `/api/note?id=${id}`, cookie, body: "x", headers: { "x-base-updated": "2000-01-01T00:00:00.000Z" } });
  await add("note PUT 413", t.api.item.PUT, { method: "PUT", path: `/api/note?id=${id}`, cookie, body: "x".repeat(1024 * 1024 + 1), headers: { "x-base-updated": updatedAt } });
  await add("note PUT 200", t.api.item.PUT, { method: "PUT", path: `/api/note?id=${id}`, cookie, body: "Title\nnew", headers: { "x-base-updated": updatedAt } });
  store.list = async () => { throw new Error("down"); };
  const quiet = console.error;
  console.error = () => {};
  try {
    await add("notes GET 500", t.api.collection.GET, { cookie });
  } finally {
    console.error = quiet;
  }
  await add("note DELETE 200", t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${id}`, cookie });
  await add("sign out 200", t.api.signOut, { method: "DELETE", path: "/api/session", cookie });
  await add("sign out 401", t.api.signOut, { method: "DELETE", path: "/api/session" });
  return answers;
}

test("every API answer, success or failure, signed in or not, says no-store", async () => {
  const answers = await everyAnswer();
  const statuses = new Set(Object.values(answers).map((r) => r.status));
  for (const status of [200, 201, 400, 401, 404, 409, 413, 500]) {
    assert.ok(statuses.has(status), `the check saw a ${status}, so it is not passing on fewer kinds of answer than it claims`);
  }
  for (const [label, response] of Object.entries(answers)) {
    assert.equal(response.headers.get("cache-control"), "no-store", `${label} must not be stored`);
  }
});

test("the notes page and everything under /notes is served no-store", () => {
  const rules = Object.fromEntries(config.headers.map((r) => [r.source, Object.fromEntries(r.headers.map((h) => [h.key, h.value]))]));
  for (const source of ["/notes", "/notes/(.*)"]) {
    assert.equal(rules[source]?.["Cache-Control"], "no-store", `${source} must not be stored`);
  }
});

test("the page empties itself when left, so a back-forward cache copy holds no note", () => {
  // The browser runs prove the behaviour; this holds the code in place where
  // the fast suite can see it.
  const html = readFileSync(new URL("../notes/index.html", import.meta.url), "utf8");
  const pagehide = /addEventListener\("pagehide",\s*function\s*\(\)\s*\{([\s\S]*?)\n  \}\);/.exec(html);
  assert.ok(pagehide, "a pagehide handler exists");
  assert.match(pagehide[1], /clearContent\(\)/);
  assert.match(pagehide[1], /showOnly\(/);
});
