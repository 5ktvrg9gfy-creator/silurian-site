// The theme switch on the notes page (CLAUDE.md section 9c). The two theme
// scripts are lifted out of notes/index.html and run in a bare Node context
// against a small stand-in for the page, because the repository has no DOM
// library and the page's own scripts are plain browser code. The real browser
// run is docs/evidence/notes-page/browser-check-v3.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "notes", "index.html"), "utf8");
const KEY = "silurian-notes-theme";

function script(id) {
  const match = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  assert.ok(match, `the page has no script ${id}`);
  return match[1];
}

// A page with an html element, the switch button, a device preference and a
// storage that can be made to throw on every call.
function page({ stored = null, deviceDark = false, storageThrows = false } = {}) {
  const attributes = new Map();
  const listeners = {};
  const store = new Map(stored === null ? [] : [[KEY, stored]]);
  const button = {
    attributes: new Map([["aria-label", "Switch to dark mode"]]),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  const documentElement = {
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => { attributes.set(name, value); },
  };
  const localStorage = {
    getItem(name) { if (storageThrows) throw new Error("storage blocked"); return store.has(name) ? store.get(name) : null; },
    setItem(name, value) { if (storageThrows) throw new Error("storage blocked"); store.set(name, String(value)); },
  };
  const context = {
    document: { documentElement, getElementById: (id) => (id === "theme-switch" ? button : null) },
    window: { matchMedia: () => ({ matches: deviceDark, addEventListener() {} }) },
    localStorage,
  };
  context.window.localStorage = localStorage;
  return {
    context, button, store,
    theme: () => attributes.get("data-theme") ?? null,
    label: () => button.getAttribute("aria-label"),
    press: () => listeners.click(),
  };
}

function boot(options) {
  const p = page(options);
  runInNewContext(script("theme-init"), p.context);
  runInNewContext(script("theme-switch-script"), p.context);
  return p;
}

test("with no saved choice the switch follows the device and offers the other theme", () => {
  const light = boot({ deviceDark: false });
  assert.equal(light.theme(), null, "nothing is forced");
  assert.equal(light.label(), "Switch to dark mode");
  const dark = boot({ deviceDark: true });
  assert.equal(dark.theme(), null);
  assert.equal(dark.label(), "Switch to light mode");
});

test("pressing it toggles data-theme, swaps the label and saves the choice", () => {
  const p = boot({ deviceDark: false });
  p.press();
  assert.equal(p.theme(), "dark");
  assert.equal(p.label(), "Switch to light mode");
  assert.equal(p.store.get(KEY), "dark");
  p.press();
  assert.equal(p.theme(), "light");
  assert.equal(p.label(), "Switch to dark mode");
  assert.equal(p.store.get(KEY), "light");
});

test("a device in dark mode goes light on the first press", () => {
  const p = boot({ deviceDark: true });
  p.press();
  assert.equal(p.theme(), "light");
  assert.equal(p.label(), "Switch to dark mode");
  assert.equal(p.store.get(KEY), "light");
});

test("a saved choice is applied before anything paints, whatever the device says", () => {
  const p = boot({ stored: "dark", deviceDark: false });
  assert.equal(p.theme(), "dark");
  assert.equal(p.label(), "Switch to light mode");
  const q = boot({ stored: "light", deviceDark: true });
  assert.equal(q.theme(), "light");
  assert.equal(q.label(), "Switch to dark mode");
});

test("anything else in storage is ignored", () => {
  for (const junk of ["", "blue", "DARK", "null"]) {
    assert.equal(boot({ stored: junk }).theme(), null, `stored ${JSON.stringify(junk)}`);
  }
});

test("when localStorage throws, the page loads and the switch still works for the visit", () => {
  const p = boot({ storageThrows: true, deviceDark: false });
  assert.equal(p.theme(), null);
  p.press();
  assert.equal(p.theme(), "dark");
  assert.equal(p.label(), "Switch to light mode");
  p.press();
  assert.equal(p.theme(), "light");
  assert.equal(p.label(), "Switch to dark mode");
  assert.equal(p.store.size, 0, "nothing was saved");
});

test("the theme choice is not sent to the server and is not cleared by sign out", () => {
  const main = html.split('<script>\n(function () {\n  "use strict";\n\n  var MAX_BYTES')[1];
  assert.ok(main, "the notes script was not found");
  assert.ok(!/localStorage|silurian-notes-theme|data-theme/.test(main), "the notes script never touches the theme");
  assert.ok(!/localStorage\.(?:clear|removeItem)|sessionStorage\.clear/.test(html), "nothing clears storage");
});

test("the scripts can fail: a switch that forgot to save would be caught", () => {
  const broken = page();
  const source = script("theme-switch-script").replace("localStorage.setItem(KEY, next);", "");
  runInNewContext(source, broken.context);
  broken.press();
  assert.equal(broken.store.has(KEY), false, "the mutated script does not save, and this test notices");
});
