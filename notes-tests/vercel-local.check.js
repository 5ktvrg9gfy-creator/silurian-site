// Two checks that need the network, so they are not part of `npm test`. Run them
// with `npm run test:vercel`. They answer one question: do the api/ functions
// still deploy, and do their method exports run, now that the marketing project
// serves the folder `public/` and not the repository root?
//
//   1. `vercel build`, pinned, run locally on a copy of the repository with the
//      real vercel.json. Its output is what Vercel would deploy: the static
//      files and the functions, and the routing between them.
//   2. Vercel's own Node runtime wrapper, pinned, loading each route file and
//      answering real HTTP requests, to show the Web handler exports (GET, POST,
//      PUT, DELETE) are the form that wrapper accepts.
//
// What this cannot show: Vercel's production launcher, the Preview, or a real
// Blob store. Neither check touches Vercel's servers or any storage, and neither
// needs a login.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERCEL_CLI = "vercel@64.5.0";
const NODE_RUNTIME = "@vercel/node@24.0.3";

// Typed out, not read from the allowlist, as in the Python test.
const PUBLIC_FILES = [
  "assets/fonts/Archivo-Variable.ttf",
  "assets/fonts/OFL.txt",
  "assets/hero-stone.svg",
  "delivery.html",
  "forecast-risk.html",
  "forecastability.html",
  "index.html",
  "logo-stone.svg",
  "notes/index.html",
  "privacy.html",
  "tokens.css",
];

const scratch = mkdtempSync(join(tmpdir(), "notes-vercel-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function tracked() {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: ROOT }).toString();
  return out.split("\0").filter((name) => name && !name.startsWith("node_modules/"));
}

function filesUnder(folder, base = folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(path, base));
    else found.push(path.slice(base.length + 1).split("\\").join("/"));
  }
  return found.sort();
}

test("vercel build with the output directory set to public deploys the api functions and only the allowlisted static files", { timeout: 300_000 }, () => {
  const copy = join(scratch, "build");
  for (const name of tracked()) {
    mkdirSync(dirname(join(copy, name)), { recursive: true });
    cpSync(join(ROOT, name), join(copy, name));
  }
  mkdirSync(join(copy, ".vercel"));
  writeFileSync(join(copy, ".vercel", "project.json"), JSON.stringify({ projectId: "prj_local", orgId: "team_local", settings: { framework: null } }));

  const stdout = execFileSync("npx", ["--yes", VERCEL_CLI, "build", "--yes"], { cwd: copy, timeout: 280_000, env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" } }).toString();
  const result = JSON.parse(stdout.slice(stdout.indexOf("{")));
  assert.equal(result.status, "ok");

  const output = join(copy, ".vercel", "output");
  assert.deepEqual(filesUnder(join(output, "static")), PUBLIC_FILES, "the deployed static files are exactly the allowlist");

  const functions = readdirSync(join(output, "functions", "api")).sort();
  assert.deepEqual(functions, ["login.func", "note.func", "notes.func", "session.func"], "the four routes are deployed, and the library folder is not a route");
  for (const name of functions) {
    const config = JSON.parse(readFileSync(join(output, "functions", "api", name, ".vc-config.json"), "utf8"));
    assert.match(config.runtime, /^nodejs\d+\.x$/);
    assert.equal(config.handler, `api/${name.replace(".func", ".js")}`);
  }

  const config = JSON.parse(readFileSync(join(output, "config.json"), "utf8"));
  const rewrite = config.routes.find((r) => r.dest === "/notes/index.html");
  assert.equal(rewrite && rewrite.src, "^/notes$");
  const catchAll = config.routes.filter((r) => r.dest && !r.src.startsWith("^/notes") && !r.src.startsWith("^/api") && !r.handle);
  assert.deepEqual(catchAll.map((r) => r.dest), ["/404.html"], "nothing else is routed anywhere but the 404 page");
});

async function freePort() {
  return new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startRoute(devServer, entry, password) {
  const port = await freePort();
  const child = spawn("node", [devServer], {
    cwd: ROOT,
    env: { ...process.env, SILURIAN_NOTES_PASSWORD: password, VERCEL_DEV_ENTRYPOINT: entry, VERCEL_DEV_PORT: String(port), VERCEL_DEV_CONFIG: "{}" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes("Dev server listening"); i += 1) await new Promise((r) => setTimeout(r, 100));
  assert.ok(log.includes("Dev server listening"), `the runtime started for ${entry}`);
  return { url: `http://127.0.0.1:${port}`, stop: () => child.kill() };
}

test("Vercel's own Node wrapper runs the named method exports of every route", { timeout: 300_000 }, async () => {
  const install = join(scratch, "runtime");
  mkdirSync(install);
  writeFileSync(join(install, "package.json"), "{}");
  execFileSync("npm", ["install", "--no-audit", "--no-fund", NODE_RUNTIME], { cwd: install, timeout: 200_000 });
  const devServer = join(install, "node_modules", "@vercel", "node", "dist", "dev-server.mjs");
  assert.ok(existsSync(devServer));

  const password = `pw-${randomBytes(9).toString("hex")}`;
  const running = [];
  try {
    const login = await startRoute(devServer, "api/login.js", password);
    const session = await startRoute(devServer, "api/session.js", password);
    const note = await startRoute(devServer, "api/note.js", password);
    const notes = await startRoute(devServer, "api/notes.js", password);
    running.push(login, session, note, notes);

    // Every exported method answers through the handler, not a default 404 or 405.
    const id = "a".repeat(32);
    const gated = [
      [session, "GET", "/"],
      [notes, "GET", "/"],
      [notes, "POST", "/"],
      [note, "GET", `/?id=${id}`],
      [note, "PUT", `/?id=${id}`],
      [note, "DELETE", `/?id=${id}`],
    ];
    for (const [route, method, path] of gated) {
      const response = await fetch(route.url + path, { method, body: method === "GET" || method === "DELETE" ? undefined : "x" });
      assert.equal(response.status, 401, `${method} ${route.url.split(":").pop()}`);
      assert.deepEqual(await response.json(), { error: "Sign in to see your notes." });
    }

    // Sign in over real HTTP, then use the cookie, with no storage involved.
    const wrong = await fetch(login.url + "/", { method: "POST", body: JSON.stringify({ password: "not-it" }) });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("set-cookie"), null);
    const right = await fetch(login.url + "/", { method: "POST", body: JSON.stringify({ password }) });
    assert.equal(right.status, 200);
    const cookie = right.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    const signedIn = await fetch(session.url + "/", { headers: { cookie: cookie.split(";")[0] } });
    assert.equal(signedIn.status, 200);
    assert.deepEqual(await signedIn.json(), { signedIn: true });
  } finally {
    for (const route of running) route.stop();
  }
});
