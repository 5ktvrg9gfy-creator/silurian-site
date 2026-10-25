// How a deployed function reaches the Blob store, with the real @vercel/blob
// package and exactly the variables Vercel provides.
//
// Connecting a private store to the project on 18 October 2026 added two
// variables, BLOB_STORE_ID and BLOB_WEBHOOK_PUBLIC_KEY, and no
// BLOB_READ_WRITE_TOKEN. The package authenticates with the store ID plus the
// short-lived identity token Vercel's runtime puts on each request as the
// x-vercel-oidc-token header, which it reads through @vercel/oidc. It only
// falls back to a read-write token when no identity token is present.
//
// This test sets up what a Vercel function sees: the store ID, the webhook key,
// the notes password, a request context carrying an identity token, and no
// read-write token. It then drives the real adapter through every call it makes
// and catches the HTTP requests before they leave the process. It fails if the
// adapter, or anything it calls, needs a variable Vercel no longer provides.
//
// What it cannot prove: that Vercel's runtime sends the header, or that the
// store accepts the token. That is the Preview.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import * as blob from "@vercel/blob";
import { createBlobStore } from "../api/_lib/store.js";
import { createJournalStore } from "../api/_lib/journal-store.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Lowercase, because the private read goes to <store id>.private.blob.vercel-storage.com
// and a hostname arrives lowercased.
const STORE_ID = "teststore0123456";
const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

// What Vercel added when the store was connected, and the password James adds.
const VERCEL_PROVIDES = {
  BLOB_STORE_ID: `store_${STORE_ID}`,
  BLOB_WEBHOOK_PUBLIC_KEY: "stand-in-webhook-key",
  SILURIAN_NOTES_PASSWORD: "stand-in-password-for-this-test",
};
// Variables the store connection no longer provides, or only provides outside
// a function: VERCEL_OIDC_TOKEN is set for builds and local development, not
// on a running function, which gets the token from the request instead.
const NOT_PROVIDED = ["BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN"];

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// An unsigned token with a future expiry. @vercel/oidc reads the expiry and
// would try to refresh an expired one; it does not check the signature.
const IDENTITY_TOKEN = [
  base64url({ alg: "none", typ: "JWT" }),
  base64url({ sub: "stand-in", exp: Math.floor(Date.now() / 1000) + 3600 }),
  "stand-in-signature",
].join(".");

const saved = {};
const requests = [];
let previousDispatcher;
let agent;
const files = new Map();

function onRequest(handler) {
  return (options) => {
    requests.push({ origin: options.origin, path: options.path, method: options.method, headers: { ...options.headers } });
    return handler(options);
  };
}

function blobMeta(pathname) {
  const file = files.get(pathname);
  return {
    url: `https://${STORE_ID}.private.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://${STORE_ID}.private.blob.vercel-storage.com/${pathname}?download=1`,
    pathname,
    size: file.bytes.length,
    uploadedAt: file.uploadedAt,
    contentType: file.contentType,
    contentDisposition: "inline",
    cacheControl: "private",
    etag: "\"e\"",
  };
}

// The package sends either a pathname or a full blob URL; reduce both to the
// pathname.
function pathnameOf(value) {
  return /^https?:\/\//.test(value) ? decodeURIComponent(new URL(value).pathname.slice(1)) : value;
}

function header(options, name) {
  const headers = options.headers || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

before(() => {
  for (const name of [...Object.keys(VERCEL_PROVIDES), ...NOT_PROVIDED]) saved[name] = process.env[name];
  for (const name of NOT_PROVIDED) delete process.env[name];
  Object.assign(process.env, VERCEL_PROVIDES);

  // Vercel's runtime keeps the current request here; @vercel/oidc reads its
  // headers. This stands in for the runtime and nothing else.
  globalThis[REQUEST_CONTEXT] = { get: () => ({ headers: { "x-vercel-oidc-token": IDENTITY_TOKEN } }) };

  previousDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);

  const api = agent.get("https://vercel.com");
  api
    .intercept({ path: (p) => p.startsWith("/api/blob/"), method: "PUT" })
    .reply(
      onRequest((options) => {
        const pathname = new URL(options.path, "https://vercel.com").searchParams.get("pathname");
        // A create that may not overwrite is refused where a file is. The wording is
        // not one the adapter matches, so it must find out for itself.
        if (header(options, "x-allow-overwrite") === "0" && files.has(pathname)) {
          return { statusCode: 400, data: JSON.stringify({ error: { code: "bad_request", message: "Something is at that pathname" } }) };
        }
        files.set(pathname, {
          bytes: Buffer.from(options.body),
          contentType: header(options, "x-content-type") || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
        });
        return { statusCode: 200, data: JSON.stringify(blobMeta(pathname)) };
      }),
    )
    .persist();
  api
    .intercept({ path: (p) => p.startsWith("/api/blob") && new URL(p, "https://vercel.com").searchParams.has("url"), method: "GET" })
    .reply(
      onRequest((options) => {
        const pathname = pathnameOf(new URL(options.path, "https://vercel.com").searchParams.get("url"));
        if (!files.has(pathname)) return { statusCode: 404, data: JSON.stringify({ error: { code: "not_found", message: "not found" } }) };
        return { statusCode: 200, data: JSON.stringify(blobMeta(pathname)) };
      }),
    )
    .persist();
  api
    .intercept({ path: (p) => p.startsWith("/api/blob"), method: "GET" })
    .reply(
      onRequest((options) => {
        const prefix = new URL(options.path, "https://vercel.com").searchParams.get("prefix") || "";
        const blobs = [...files.keys()].filter((p) => p.startsWith(prefix)).map(blobMeta);
        return { statusCode: 200, data: JSON.stringify({ blobs, hasMore: false }) };
      }),
    )
    .persist();
  api
    .intercept({ path: (p) => p.startsWith("/api/blob/delete"), method: "POST" })
    .reply(
      onRequest((options) => {
        for (const url of JSON.parse(options.body).urls) files.delete(pathnameOf(url));
        return { statusCode: 200, data: "{}" };
      }),
    )
    .persist();

  agent
    .get(`https://${STORE_ID}.private.blob.vercel-storage.com`)
    .intercept({ path: () => true, method: "GET" })
    .reply(
      onRequest((options) => {
        const pathname = decodeURIComponent(new URL(options.path, "https://x").pathname.slice(1));
        const file = files.get(pathname);
        if (!file) return { statusCode: 404, data: "" };
        return {
          statusCode: 200,
          data: file.bytes,
          responseOptions: { headers: { "content-type": file.contentType, "last-modified": new Date(file.uploadedAt).toUTCString(), etag: "\"e\"" } },
        };
      }),
    )
    .persist();
});

after(async () => {
  setGlobalDispatcher(previousDispatcher);
  await agent.close();
  delete globalThis[REQUEST_CONTEXT];
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("the adapter works with only what Vercel provides, and every request carries the identity token and store ID", async () => {
  // An hour on, so that what a later save supersedes is old enough to be tidied away.
  const store = createBlobStore(blob, { now: () => Date.now() + 60 * 60 * 1000 });
  const meta = { title: "Deploy script", updatedAt: "2026-10-18T09:00:00.000Z" };
  const text = new TextEncoder().encode("echo hello\r\n");
  const id = "e".repeat(32);

  assert.deepEqual(await store.write(id, text, meta, null, "t:a"), { ok: true, updatedAt: meta.updatedAt, rev: 1 });
  assert.equal((await store.list()).length, 1);
  const read = await store.read(id);
  assert.deepEqual([...read.bytes], [...text]);
  assert.equal(read.updatedAt, meta.updatedAt);
  assert.equal(await store.stamp(id), meta.updatedAt);
  const next = { title: "Deploy script", updatedAt: "2026-10-18T09:05:00.000Z" };
  assert.equal((await store.write(id, text, next, meta.updatedAt, "t:b")).ok, true, "a second revision");
  assert.equal(await store.readLabels(), null, "no label list yet, which is looked for under both names");
  await store.list();
  await store.remove(id, "2026-10-18T09:10:00.000Z");
  assert.equal(await store.stamp(id), null);
  const after = await store.list();
  assert.equal(after.length, 0);
  assert.deepEqual(after.gone, [id], "a removed note is not listed and is reported as gone");

  // Every kind of call the adapter makes went out, so none was skipped.
  const kinds = new Set(requests.map((r) => `${r.method} ${r.origin}`));
  assert.ok(kinds.has("PUT https://vercel.com"), "put");
  assert.ok(requests.some((r) => r.method === "GET" && /[?&]url=/.test(r.path)), "head");
  assert.ok(requests.some((r) => r.method === "GET" && /[?&]prefix=/.test(r.path)), "list");
  assert.ok(kinds.has("POST https://vercel.com"), "delete");
  assert.ok(kinds.has(`GET https://${STORE_ID}.private.blob.vercel-storage.com`), "private read");

  for (const request of requests) {
    const auth = request.headers.authorization || request.headers.Authorization;
    assert.equal(auth, `Bearer ${IDENTITY_TOKEN}`, `${request.method} ${request.path} authenticates with the identity token`);
    if (request.origin === "https://vercel.com") {
      assert.equal(request.headers["x-vercel-blob-store-id"], STORE_ID, `${request.method} ${request.path} names the store`);
    }
  }
});

test("the journal adapter reaches the store the same way, and creates each entry revision without overwriting", async () => {
  const store = createJournalStore(blob);
  const before = requests.length;
  const list = "day:2026-10-22";
  const id = "a".repeat(32);
  const entry = { id, type: "task", state: "open", text: "Order labels", rev: 1, order: 5 };
  assert.equal(await store.createEntry(list, entry), true, "created");
  assert.equal(await store.createEntry(list, { ...entry, text: "Another text" }), false, "a second create of the same revision is refused, and the adapter finds that out for itself");
  const fresh = createJournalStore(blob);
  assert.equal((await fresh.readEntry(list, id, 1)).entry.text, "Order labels", "what is there is what was made first");
  assert.equal(await fresh.createEntry(list, { ...entry, rev: 2, text: "Edited" }), true);
  assert.equal(await fresh.createLine("2026-10-22", 1, "Dentist"), true);
  assert.deepEqual((await createJournalStore(blob).entriesOfMonth("2026-10")).map((e) => [e.entry.text, e.entry.rev]), [["Edited", 2]]);
  assert.deepEqual((await createJournalStore(blob).linesOfMonth("2026-10")).map((l) => l.text), ["Dentist"]);
  await createJournalStore(blob).months();   // the stand-in does not fold folders, so this only shows the call is made the same way
  const mine = requests.slice(before);

  const puts = mine.filter((r) => r.method === "PUT" && r.origin === "https://vercel.com");
  assert.equal(puts.length, 4, "four creates, one of them refused");
  assert.deepEqual(puts.map((p) => new URL(p.path, "https://vercel.com").searchParams.get("pathname")), [
    `journal/e/2026-10/${id}.1.json`, `journal/e/2026-10/${id}.1.json`, `journal/e/2026-10/${id}.2.json`, "journal/l/2026-10/2026-10-22.1.json",
  ]);
  for (const put of puts) {
    assert.equal(header(put, "x-vercel-blob-access"), "private");
    assert.equal(header(put, "x-add-random-suffix"), "0");
    assert.equal(header(put, "x-allow-overwrite"), "0", "no entry or line file is ever overwritten");
    assert.equal(header(put, "x-if-match"), undefined, "so there is no etag to match");
  }
  assert.ok(mine.some((r) => r.method === "GET" && /[?&]prefix=journal%2Fe%2F2026-10%2F|[?&]prefix=journal\/e\/2026-10\//.test(r.path)), "a month is listed under its own prefix only");

  for (const request of mine) {
    const auth = request.headers.authorization || request.headers.Authorization;
    assert.equal(auth, `Bearer ${IDENTITY_TOKEN}`, `${request.method} ${request.path} authenticates with the identity token`);
  }
});

test("the journal's quick notes are the one overwritten file, against the version that was read", async () => {
  const store = createJournalStore(blob);
  const before = requests.length;
  assert.equal(await store.writeQuick("one", "2026-10-22T09:00:00.000Z", null), '"e"');
  const read = await store.readQuick();
  assert.equal(await store.writeQuick("two", "2026-10-22T09:01:00.000Z", read.tag), '"e"');
  const puts = requests.slice(before).filter((r) => r.method === "PUT" && r.origin === "https://vercel.com");
  assert.equal(header(puts[0], "x-allow-overwrite"), "0", "a first write cannot replace a file");
  assert.equal(header(puts[1], "x-if-match"), read.tag, "a later write names the version that was read");
  assert.equal(header(puts[1], "x-allow-overwrite"), "1");
  for (const put of puts) assert.equal(new URL(put.path, "https://vercel.com").searchParams.get("pathname"), "journal/quick.json");
});

test("without BLOB_STORE_ID the adapter cannot reach the store, so the test above depends on it", async () => {
  const value = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_STORE_ID;
  try {
    await assert.rejects(
      createBlobStore(blob).write("note-b", new Uint8Array([1]), { title: "t", updatedAt: "2026-10-18T09:00:00.000Z" }),
      /No blob credentials found/,
    );
  } finally {
    process.env.BLOB_STORE_ID = value;
  }
});

// Guard on the stripper itself, so a too-greedy pattern cannot pass the scan by
// deleting the code it should be reading.
function stripsToNothing() {
  const code = 'const t = process.env.BLOB_READ_WRITE_TOKEN; // why\nconst u = "https://x";';
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return !stripped.includes("BLOB_READ_WRITE_TOKEN") || !stripped.includes("https://x");
}

test("no server code names BLOB_READ_WRITE_TOKEN or passes its own token to the package", () => {
  assert.ok(!stripsToNothing(), "the comment stripper leaves code alone");
  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".js")) sources.push(path);
    }
  };
  walk(join(ROOT, "api"));
  assert.ok(sources.length >= 6, "the scan read the api folder");
  for (const path of sources) {
    // Code only: a comment may explain why the variable is not used.
    const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.ok(!source.includes("BLOB_READ_WRITE_TOKEN"), `${path} names BLOB_READ_WRITE_TOKEN, which Vercel no longer provides`);
    assert.ok(!/\btoken\s*:/.test(source), `${path} passes a token option, which would take the place of the identity token`);
  }
});
