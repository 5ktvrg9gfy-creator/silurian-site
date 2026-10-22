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

test("vercel.json only touches /notes and /journal", () => {
  assert.deepEqual(
    Object.keys(config).sort(),
    ["$schema", "buildCommand", "headers", "outputDirectory", "regions", "rewrites"],
    "the allowlist build settings, the function region and the /notes rules, and no redirects, cleanUrls, trailingSlash or other keys",
  );
  assert.equal(config.outputDirectory, "public", "only the allowlisted folder is served");
  const sources = [...config.rewrites.map((r) => r.source), ...config.headers.map((h) => h.source)];
  assert.ok(sources.length >= 6, "the rules were read");
  for (const source of sources) assert.match(source, /^\/(notes|journal)(\/\(\.\*\))?$/, `${source} is a /notes or /journal rule`);
  assert.ok(sources.some((s) => s.startsWith("/journal")), "the journal rules were read");
  assert.deepEqual(config.rewrites, [
    { source: "/notes", destination: "/notes/index.html" },
    { source: "/journal", destination: "/journal/index.html" },
  ]);
  assert.equal(config.crons, undefined, "no scheduled work: nothing moves by itself");
});

// The notes functions are the only functions this project has, so the region
// applies to them alone. The static pages are files, not functions, and Assay is
// a separate project whose own forecast-app/vercel.json pins the same region.
test("the notes functions are pinned to London, with no failover region", () => {
  assert.deepEqual(config.regions, ["lhr1"]);
  const assay = JSON.parse(read("forecast-app/vercel.json"));
  assert.deepEqual(assay.regions, ["lhr1"], "Assay stays pinned to London as it was");
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

test("the API folder holds exactly the notes, labels and journal routes, and the library is not a route", () => {
  const entries = readdirSync(join(ROOT, "api")).sort();
  assert.deepEqual(entries, ["_lib", "journal.js", "labels.js", "login.js", "note.js", "notes.js", "session.js"]);
  for (const name of readdirSync(join(ROOT, "api", "_lib"))) {
    assert.ok(statSync(join(ROOT, "api", "_lib", name)).isFile());
  }
});

test("package.json is the minimum: one dependency, no build step", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(Object.keys(pkg.dependencies), ["@vercel/blob"]);
  assert.match(pkg.dependencies["@vercel/blob"], /^\d+\.\d+\.\d+$/, "pinned to an exact version");
  assert.deepEqual(Object.keys(pkg.scripts), ["test", "test:vercel"], "test scripts only: no build, install or start script that would change how the static pages deploy");
  assert.equal(pkg.devDependencies, undefined);
  assert.ok(existsSync(join(ROOT, "package-lock.json")));
});

test("the page takes its type sizes from its own variables and has no dash", () => {
  // The notes page follows the Spud Notes look, not the site's tokens
  // (CLAUDE.md section 9c, ruled 19 October 2026). Its palette, shape and
  // contrast rules are held by forecast-app/tests/test_notes_page.py.
  const html = read("notes/index.html");
  const sizes = [...html.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(sizes.length >= 8, `${sizes.length} font-size declarations read`);
  for (const size of sizes) assert.match(size, /^(?:var\(--notes-size-(?:12|13|14|15|18|30)\))$/, `font-size ${size}`);
  assert.ok(!/[\u2013\u2014]/.test(html), "no em or en dash in the page");
});

// ---------- the journal page, served beside notes ----------

test("the journal page is reached by /journal and /journal/, and by nothing that already exists", () => {
  assert.ok(existsSync(join(ROOT, "journal", "index.html")));
  assert.ok(sourceMatches("/journal", "/journal"));
  assert.ok(sourceMatches("/journal/(.*)", "/journal/"));
  assert.ok(!existsSync(join(ROOT, "journal.html")), "no root page, which the marketing page scans would pick up");
});

test("the journal page carries noindex and nofollow as a tag, and the title and install tags the brief names", () => {
  const html = read("journal/index.html");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<title>Journal<\/title>/);
  assert.match(html, /<link rel="manifest" href="\/journal\/manifest\.webmanifest">/);
  assert.match(html, /<meta name="theme-color" content="#faf8f5" media="\(prefers-color-scheme: light\)">/);
  assert.match(html, /<meta name="theme-color" content="#262422" media="\(prefers-color-scheme: dark\)">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Journal">/);
});

test("nothing on the marketing site links to /journal, and there is no sitemap to list it", () => {
  for (const file of [...EXISTING_PAGES, "tokens.css", "logo-stone.svg", "forecast-app/static/index.html"]) {
    const text = read(file);
    assert.ok(!/["'(=]\s*\/?journal(\/|["')#?\s>]|\.html)/i.test(text), `${file} links to the journal`);
  }
});

test("the journal page loads no analytics and nothing from outside the site, and its script comes from the site", () => {
  const html = read("journal/index.html");
  assert.ok(!html.includes("_vercel"), "no Vercel analytics script");
  assert.ok(!/\b(?:src|href)=["']https?:/i.test(html), "no external src or href");
  assert.ok(!/\bfetch\(\s*["']https?:/i.test(html));
  assert.ok(!/\bimport\s*\(/.test(html), "no dynamic import");
  const imports = [...html.matchAll(/^\s*import\b[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["/journal/core.js"], "the one rules file, served with the page");
  assert.ok(html.includes('href="/tokens.css"'), "the Archivo font face");
});

test("the journal page takes its type sizes from the notes variables and has no dash", () => {
  const html = read("journal/index.html");
  const sizes = [...html.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(sizes.length >= 8, `${sizes.length} font-size declarations read`);
  for (const size of sizes) assert.match(size, /^(?:var\(--notes-size-(?:12|13|14|15|18|30)\))$/, `font-size ${size}`);
  for (const file of ["journal/index.html", "journal/core.js", "journal/manifest.webmanifest", "api/_lib/journal-api.js", "api/_lib/journal-store.js"]) {
    assert.ok(!/[\u2013\u2014]/.test(read(file)), `no em or en dash in ${file}`);
  }
});

test("the manifest names the app, stays inside its scope and lists real icons", () => {
  const manifest = JSON.parse(read("journal/manifest.webmanifest"));
  assert.equal(manifest.name, "Journal");
  assert.equal(manifest.short_name, "Journal");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.start_url.startsWith(manifest.scope), "a start address outside the scope fails the install test");
  assert.equal(manifest.theme_color, "#faf8f5");
  assert.equal(manifest.background_color, "#faf8f5");
  for (const icon of manifest.icons) assert.ok(existsSync(join(ROOT, icon.src.slice(1))), `${icon.src} exists`);
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
});
