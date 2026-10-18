// Acceptance criterion 7 and the page's own promises: the existing static site
// is routed exactly as before, and /notes is private, unlinked and quiet.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const config = JSON.parse(read("vercel.json"));

const EXISTING_PAGES = ["index.html", "delivery.html", "forecast-risk.html", "forecastability.html", "privacy.html"];

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

// The URLs the existing site answers on today, from the files on disk.
function existingUrls() {
  const urls = new Set(["/"]);
  for (const page of EXISTING_PAGES) urls.add(`/${page}`);
  for (const file of ["tokens.css", "logo-stone.svg"]) urls.add(`/${file}`);
  for (const file of walk("assets")) urls.add(`/${file.split("\\").join("/")}`);
  return urls;
}

const sourceMatches = (source, path) => new RegExp(`^${source}$`).test(path);

test("vercel.json only touches /notes", () => {
  assert.deepEqual(
    Object.keys(config).sort(),
    ["$schema", "buildCommand", "headers", "outputDirectory", "rewrites"],
    "the allowlist build settings and the /notes rules, and no redirects, cleanUrls, trailingSlash or other keys",
  );
  assert.equal(config.outputDirectory, "public", "only the allowlisted folder is served");
  const sources = [...config.rewrites.map((r) => r.source), ...config.headers.map((h) => h.source)];
  assert.ok(sources.length >= 3, "the rules were read");
  for (const source of sources) assert.match(source, /^\/notes(\/\(\.\*\))?$/, `${source} is a /notes rule`);
  assert.deepEqual(config.rewrites, [{ source: "/notes", destination: "/notes/index.html" }]);
});

test("no existing page or asset is matched by any rule, so each serves as it did", () => {
  const urls = existingUrls();
  assert.ok(urls.size >= 8, `${urls.size} existing URLs checked`);
  for (const url of urls) {
    for (const rule of [...config.rewrites, ...config.headers]) {
      assert.equal(sourceMatches(rule.source, url), false, `${url} must not match ${rule.source}`);
    }
  }
  for (const page of EXISTING_PAGES) assert.ok(existsSync(join(ROOT, page)), `${page} still exists`);
});

test("the notes page is reached by /notes and by nothing that already exists", () => {
  assert.ok(existsSync(join(ROOT, "notes", "index.html")));
  assert.ok(sourceMatches("/notes", "/notes"));
  assert.ok(sourceMatches("/notes/(.*)", "/notes/"));
  assert.ok(!existsSync(join(ROOT, "notes.html")), "no root page, which the marketing page scans would pick up");
});

test("the page carries noindex and nofollow, as a tag and as a header", () => {
  const html = read("notes/index.html");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const rule of config.headers) {
    const headers = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
    assert.equal(headers["X-Robots-Tag"], "noindex, nofollow");
    assert.equal(headers["Cache-Control"], "no-store");
  }
});

test("nothing links to /notes, and there is no sitemap or robots file to list it", () => {
  const candidates = [...EXISTING_PAGES, "tokens.css", "logo-stone.svg", "forecast-app/static/index.html"];
  for (const file of candidates) {
    const text = read(file);
    assert.ok(!/["'(=]\s*\/?notes(\/|["')#?\s>]|\.html)/i.test(text), `${file} links to the notes page`);
  }
  const rootFiles = readdirSync(ROOT);
  for (const name of rootFiles) {
    assert.ok(!/^(sitemap|robots)/i.test(name), `${name} would advertise the page`);
  }
  assert.ok(candidates.length >= 8);
});

test("the page loads no analytics and nothing from outside the site", () => {
  const html = read("notes/index.html");
  assert.ok(!html.includes("_vercel"), "no Vercel analytics script");
  assert.ok(!/\b(?:src|href)=["']https?:/i.test(html), "no external src or href");
  assert.ok(!/\bfetch\(\s*["']https?:/i.test(html));
  assert.ok(html.includes('href="/tokens.css"'), "styled from the site's tokens");
});

test("the API folder holds exactly the notes routes, and the library is not a route", () => {
  const entries = readdirSync(join(ROOT, "api")).sort();
  assert.deepEqual(entries, ["_lib", "login.js", "note.js", "notes.js", "session.js"]);
  for (const name of readdirSync(join(ROOT, "api", "_lib"))) {
    assert.ok(statSync(join(ROOT, "api", "_lib", name)).isFile());
  }
});

test("package.json is the minimum: one dependency, no build step", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(Object.keys(pkg.dependencies), ["@vercel/blob"]);
  assert.match(pkg.dependencies["@vercel/blob"], /^\d+\.\d+\.\d+$/, "pinned to an exact version");
  assert.deepEqual(Object.keys(pkg.scripts), ["test"], "no build, install or start script that would change how the static pages deploy");
  assert.equal(pkg.devDependencies, undefined);
  assert.ok(existsSync(join(ROOT, "package-lock.json")));
});

test("the page uses only tokens: no raw colour and no hand-written type size", () => {
  const html = read("notes/index.html");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(html.replace(/&#\d+;/g, "")), "no hex colour");
  assert.ok(!/\brgba?\(|\bhsla?\(/.test(html), "no rgb or hsl colour");
  const sizes = [...html.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(sizes.length >= 8, `${sizes.length} font-size declarations read`);
  for (const size of sizes) assert.match(size, /^var\(--(?:text-[a-z]+|wordmark-size)\)$/, `font-size ${size}`);
  const radii = [...html.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(radii.length >= 3, `${radii.length} border-radius declarations read`);
  assert.ok(radii.every((r) => r === "0"), "zero radius everywhere");
  assert.ok(!/[\u2013\u2014]/.test(html), "no em or en dash in the page");
});
