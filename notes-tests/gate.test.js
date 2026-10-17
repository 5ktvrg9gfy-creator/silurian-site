// Acceptance criteria 3, 4 and 5: who gets in, and who never does.

import assert from "node:assert/strict";
import { test } from "node:test";
import { COOKIE, NOW, build, call, freshSecret, memoryStore, signedInCookie } from "./helpers.js";
import { ENVIRONMENT_VARIABLE, SESSION_SECONDS, cookieIsValid, issueCookieValue } from "../api/_lib/gate.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Every route, as (label, handler getter, request shape).
function routes(api) {
  return [
    ["session GET", api.session, { method: "GET", path: "/api/session" }],
    ["notes GET", api.collection.GET, { method: "GET", path: "/api/notes" }],
    ["notes POST", api.collection.POST, { method: "POST", path: "/api/notes", body: "text" }],
    ["note GET", api.item.GET, { method: "GET", path: `/api/note?id=${"a".repeat(32)}` }],
    ["note PUT", api.item.PUT, { method: "PUT", path: `/api/note?id=${"a".repeat(32)}`, body: "text" }],
    ["note DELETE", api.item.DELETE, { method: "DELETE", path: `/api/note?id=${"a".repeat(32)}` }],
  ];
}

function tamper(cookie) {
  const [name, value] = cookie.split("=");
  const [expiry, sig] = value.split(".");
  return {
    signature: `${name}=${expiry}.${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`,
    longerExpiry: `${name}=${Number(expiry) + 86400}.${sig}`,
    noSignature: `${name}=${expiry}.`,
    noExpiry: `${name}=.${sig}`,
    garbage: `${name}=not-a-cookie`,
    empty: `${name}=`,
  };
}

test("every route answers 401 for every kind of bad or missing cookie", async () => {
  const oldPassword = freshSecret("old");
  const t = build();
  const good = signedInCookie(t.password);
  const cases = {
    "no cookie": undefined,
    "a different cookie name": `other=${good.split("=")[1]}`,
    "an expired cookie": signedInCookie(t.password, NOW - SESSION_SECONDS * 1000 - 1000),
    "a cookie signed under an old password": signedInCookie(oldPassword),
    ...Object.fromEntries(Object.entries(tamper(good)).map(([k, v]) => [`a tampered cookie (${k})`, v])),
  };
  for (const [what, cookie] of Object.entries(cases)) {
    for (const [label, handler, shape] of routes(t.api)) {
      const response = await call(handler, { ...shape, cookie });
      assert.equal(response.status, 401, `${label} with ${what} must be 401`);
      assert.deepEqual(await response.json(), { error: "Sign in to see your notes." });
    }
  }
  assert.equal(t.store.notes.size, 0, "a rejected request must write nothing");
});

test("a good cookie opens every route, so the 401 checks above are not vacuous", async () => {
  const t = build();
  const cookie = signedInCookie(t.password);
  assert.equal((await call(t.api.session, { path: "/api/session", cookie })).status, 200);
  assert.equal((await call(t.api.collection.GET, { cookie })).status, 200);
});

test("changing the password invalidates every cookie already issued", async () => {
  const before = build({ password: freshSecret("one") });
  const cookie = signedInCookie(before.password);
  assert.equal((await call(before.api.session, { path: "/api/session", cookie })).status, 200);
  const after = build({ password: freshSecret("two") });
  assert.equal((await call(after.api.session, { path: "/api/session", cookie })).status, 401);
});

test("a cookie expires exactly at its expiry and lasts 30 days", async () => {
  const password = freshSecret("pw");
  assert.equal(SESSION_SECONDS, 30 * 24 * 60 * 60);
  const value = issueCookieValue(password, NOW);
  assert.equal(Number(value.split(".")[0]), NOW / 1000 + SESSION_SECONDS);
  assert.equal(cookieIsValid(value, password, NOW + 29 * DAY_MS), true);
  assert.equal(cookieIsValid(value, password, NOW + 30 * DAY_MS), false);
});

test("every route file in api/ is wired to the gate: 401 with no cookie, with a password set", async () => {
  const original = process.env[ENVIRONMENT_VARIABLE];
  process.env[ENVIRONMENT_VARIABLE] = freshSecret("real-wiring");
  try {
    const modules = {
      session: await import("../api/session.js"),
      notes: await import("../api/notes.js"),
      note: await import("../api/note.js"),
    };
    let checked = 0;
    for (const [name, mod] of Object.entries(modules)) {
      for (const [method, handler] of Object.entries(mod)) {
        const response = await handler(
          new Request(`https://notes.test/api/${name}?id=${"a".repeat(32)}`, { method, body: method === "GET" || method === "DELETE" ? undefined : "x" }),
        );
        assert.equal(response.status, 401, `api/${name}.js ${method} must be 401 without a cookie`);
        checked += 1;
      }
    }
    assert.equal(checked, 6, "six handlers across the three gated route files; zero checked would mean it did not run");
  } finally {
    if (original === undefined) delete process.env[ENVIRONMENT_VARIABLE];
    else process.env[ENVIRONMENT_VARIABLE] = original;
  }
});

test("with no password configured every route refuses, even with a well-formed cookie", async () => {
  for (const env of [{}, { [ENVIRONMENT_VARIABLE]: "" }, { [ENVIRONMENT_VARIABLE]: "   \n" }]) {
    const t = build({ env });
    // A cookie signed under any password, including the empty one, must not open the gate.
    for (const secret of ["", "undefined", "null", freshSecret("guess")]) {
      const cookie = signedInCookie(secret);
      for (const [label, handler, shape] of routes(t.api)) {
        assert.equal((await call(handler, { ...shape, cookie })).status, 401, label);
      }
    }
    for (const attempt of ["", "undefined", "null", " ", freshSecret("guess")]) {
      const response = await call(t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: attempt }) });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
});

test("a wrong password never sets a cookie, and costs a fixed delay", async () => {
  const t = build();
  const wrong = [
    JSON.stringify({ password: freshSecret("wrong") }),
    JSON.stringify({ password: t.password + " " }),
    JSON.stringify({ password: t.password.toUpperCase() }),
    JSON.stringify({ password: "" }),
    JSON.stringify({}),
    JSON.stringify({ password: 12345 }),
    JSON.stringify({ password: [t.password] }),
    JSON.stringify({ password: null }),
    JSON.stringify({ password: "x".repeat(5000) }),
    "not json",
    "",
  ];
  for (const body of wrong) {
    const response = await call(t.api.login, { method: "POST", path: "/api/login", body });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { error: "That password is incorrect." });
  }
  assert.equal(t.sleeps.length, wrong.length, "every failure is slowed");
  assert.ok(t.sleeps.every((ms) => ms >= 1000), "by at least a second");
});

test("the right password sets a signed, HttpOnly, Secure, SameSite=Strict cookie that works", async () => {
  const t = build();
  const response = await call(t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: t.password }) });
  assert.equal(response.status, 200);
  assert.deepEqual(t.sleeps, [], "success is not slowed");
  const header = response.headers.get("set-cookie");
  const attributes = header.split(";").map((part) => part.trim());
  assert.ok(attributes[0].startsWith(`${COOKIE}=`));
  for (const required of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/api", `Max-Age=${SESSION_SECONDS}`]) {
    assert.ok(attributes.includes(required), `cookie attribute ${required} is present`);
  }
  const session = await call(t.api.session, { path: "/api/session", cookie: attributes[0] });
  assert.equal(session.status, 200);
});

test("a password with surrounding whitespace in the environment still matches the trimmed password", async () => {
  const password = freshSecret("pw");
  const t = build({ env: { [ENVIRONMENT_VARIABLE]: `${password}\n` } });
  const ok = await call(t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password }) });
  assert.equal(ok.status, 200);
});

test("a store that is never reached stays unreached on a 401", async () => {
  let reached = 0;
  const spy = new Proxy(memoryStore(), { get: (target, key) => (...args) => { reached += 1; return target[key](...args); } });
  const t = build({ store: spy });
  for (const [, handler, shape] of routes(t.api)) await call(handler, shape);
  assert.equal(reached, 0);
});
