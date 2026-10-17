// Acceptance criterion 8: no output, log line or response body carries the
// password, the cookie value or a storage token.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { build, call, freshSecret, signedInCookie } from "./helpers.js";

function capture() {
  const lines = [];
  const original = {};
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    original[name] = console[name];
    console[name] = (...args) => lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  }
  const out = process.stdout.write;
  const err = process.stderr.write;
  process.stdout.write = (chunk, ...rest) => { lines.push(String(chunk)); return typeof rest.at(-1) === "function" ? rest.at(-1)() : true; };
  process.stderr.write = (chunk, ...rest) => { lines.push(String(chunk)); return typeof rest.at(-1) === "function" ? rest.at(-1)() : true; };
  return {
    lines,
    stop() {
      for (const name of Object.keys(original)) console[name] = original[name];
      process.stdout.write = out;
      process.stderr.write = err;
    },
  };
}

test("a full session writes the password, cookie and token nowhere", async () => {
  const token = freshSecret("blob-token");
  const t = build();
  const cookieHeader = signedInCookie(t.password);
  const cookieValue = cookieHeader.split("=")[1];
  const secrets = { password: t.password, cookie: cookieValue, token };

  // A storage layer that fails with a message containing the token, to prove the
  // error path does not echo it.
  const failing = {
    list: async () => { throw new Error(`denied for ${token}`); },
    read: async () => { throw new Error(`denied for ${token}`); },
    write: async () => { throw new Error(`denied for ${token}`); },
    remove: async () => { throw new Error(`denied for ${token}`); },
  };
  const broken = build({ password: t.password, store: failing });

  const bodies = [];
  const seen = capture();
  try {
    const record = async (response) => {
      bodies.push(await response.clone().text());
      return response;
    };
    await record(await call(t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: freshSecret("wrong") }) }));
    await record(await call(t.api.login, { method: "POST", path: "/api/login", body: JSON.stringify({ password: t.password }) }));
    await record(await call(t.api.session, { path: "/api/session", cookie: cookieHeader }));
    await record(await call(t.api.session, { path: "/api/session" }));
    const created = await record(await call(t.api.collection.POST, { method: "POST", cookie: cookieHeader, body: "hello" }));
    const { id } = JSON.parse(bodies.at(-1));
    assert.equal(created.status, 201);
    await record(await call(t.api.collection.GET, { cookie: cookieHeader }));
    await record(await call(t.api.item.GET, { path: `/api/note?id=${id}`, cookie: cookieHeader }));
    await record(await call(t.api.item.PUT, { method: "PUT", path: `/api/note?id=${id}`, cookie: cookieHeader, body: "changed" }));
    await record(await call(t.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${id}`, cookie: cookieHeader }));
    for (const [handler, init] of [
      [broken.api.collection.GET, {}],
      [broken.api.collection.POST, { method: "POST", body: "x" }],
      [broken.api.item.GET, { path: `/api/note?id=${"a".repeat(32)}` }],
      [broken.api.item.PUT, { method: "PUT", path: `/api/note?id=${"a".repeat(32)}`, body: "x" }],
      [broken.api.item.DELETE, { method: "DELETE", path: `/api/note?id=${"a".repeat(32)}` }],
    ]) {
      const response = await record(await call(handler, { ...init, cookie: cookieHeader }));
      assert.equal(response.status, 500);
    }
  } finally {
    seen.stop();
  }

  assert.ok(seen.lines.length > 0, "the error path did log, so this check saw something");
  const logged = seen.lines.join("\n");
  const everything = `${logged}\n${bodies.join("\n")}`;
  for (const [what, value] of Object.entries(secrets)) {
    assert.ok(!everything.includes(value), `the ${what} appears in a log line or a response body`);
  }
  assert.ok(seen.lines.every((l) => l.includes("notes: storage error")), "only the one fixed storage line is ever logged");
});

test("the only console call in the API is the fixed storage line", () => {
  const files = ["api/_lib/gate.js", "api/_lib/notes-api.js", "api/_lib/store.js", "api/_lib/live.js", "api/login.js", "api/session.js", "api/notes.js", "api/note.js"];
  let calls = 0;
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const found = source.match(/console\.\w+\([^)]*\)/g) ?? [];
    calls += found.length;
    for (const call of found) assert.match(call, /"notes: storage error"/, `${file}: ${call}`);
  }
  assert.equal(calls, 1);
});

test("no file in the notes work holds a literal secret", () => {
  const roots = ["api", "api/_lib", "notes", "notes-tests"];
  let scanned = 0;
  for (const root of roots) {
    for (const entry of readdirSync(new URL(`../${root}/`, import.meta.url), { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const source = readFileSync(new URL(`../${root}/${entry.name}`, import.meta.url), "utf8");
      scanned += 1;
      assert.ok(!/BLOB_READ_WRITE_TOKEN\s*[:=]\s*["'`][^"'`\s]{8,}/.test(source), `${root}/${entry.name} assigns a token`);
      assert.ok(!/vercel_blob_rw_[A-Za-z0-9_]{8,}/.test(source), `${root}/${entry.name} holds a Blob token`);
    }
  }
  assert.ok(scanned >= 10, `scanned ${scanned} files`);
});
