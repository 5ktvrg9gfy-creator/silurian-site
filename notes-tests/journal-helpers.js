// Shared fixtures for the journal tests. Every secret is made at run time.

import { randomBytes } from "node:crypto";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import { emptyMonth, normaliseMonth } from "../journal/core.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";

export { NOW, freshSecret, signedInCookie };

export const newId = () => randomBytes(16).toString("hex");

// An in-memory stand-in for the journal store with the same calls and the same
// promise: a write succeeds only against the version it read. Every write gives
// the file a new version, as the real store gives a new etag.
export function journalMemoryStore() {
  const files = new Map();
  let version = 0;
  const writes = [];
  const state = { quick: null, hook: null };
  return {
    files,
    writes,
    state,
    async readMonth(month) {
      const held = files.get(month);
      if (!held) return { file: emptyMonth(), tag: null };
      const file = normaliseMonth(JSON.parse(held.json));
      if (!file) throw new Error("month file unreadable");
      return { file, tag: held.tag, exists: true };
    },
    async writeMonth(month, file, tag) {
      // A hook lets a test make another device write between this one's read
      // and this one's write.
      if (state.hook) {
        const hook = state.hook;
        state.hook = null;
        await hook();
      }
      const held = files.get(month);
      if (held ? held.tag !== tag : tag !== null) return false;
      files.set(month, { json: JSON.stringify(file), tag: `etag-${(version += 1)}` });
      writes.push(month);
      return true;
    },
    async months() {
      return [...files.keys()].sort().reverse();
    },
    async readQuick() {
      const q = state.quick;
      return q ? { text: q.text, updatedAt: q.updatedAt, tag: q.tag } : { text: "", updatedAt: "none", tag: null };
    },
    async writeQuick(text, updatedAt, tag) {
      const q = state.quick;
      if (q ? q.tag !== tag : tag !== null) return false;
      state.quick = { text, updatedAt, tag: `etag-${(version += 1)}` };
      return true;
    },
  };
}

// A store whose reads lag behind its writes, as an eventually consistent store
// can: for lagMs after a write, a read returns what the file was lagMs ago (or
// no file at all). Writes are strongly consistent, as a write against an etag is:
// one made against an old version is refused. `now` says what time it is, so a
// test can move the clock with a fake sleep and a browser run can use the real one.
const assert_ok = (v) => { if (!v) throw new Error("preload refused"); };

export function staleJournalStore({ lagMs = 5000, now = () => Date.now() } = {}) {
  const inner = journalMemoryStore();
  const timeline = new Map();   // month -> [{ at, json, tag }] in write order
  const quickTimeline = [];
  const seen = (list) => {
    const visible = list.filter((v) => v.at <= now() - lagMs);
    return visible.length ? visible[visible.length - 1] : null;
  };
  const store = {
    ...inner,
    inner,
    lagMs,
    async readMonth(month) {
      const view = seen(timeline.get(month) || []);
      if (!view) return { file: emptyMonth(), tag: null };
      return { file: normaliseMonth(JSON.parse(view.json)), tag: view.tag, exists: true };
    },
    async writeMonth(month, file, tag) {
      const ok = await inner.writeMonth(month, file, tag);
      if (ok) {
        const held = inner.files.get(month);
        if (!timeline.has(month)) timeline.set(month, []);
        timeline.get(month).push({ at: now(), json: held.json, tag: held.tag });
        // Like the real package, a write answers with the etag it made.
        return held.tag;
      }
      return ok;
    },
    // Puts a file in the store as if it had been there long enough to be read.
    async preload(month, file) {
      const held = inner.files.get(month);
      assert_ok(await inner.writeMonth(month, file, held ? held.tag : null));
      const now2 = inner.files.get(month);
      if (!timeline.has(month)) timeline.set(month, []);
      timeline.get(month).push({ at: now() - lagMs - 1, json: now2.json, tag: now2.tag });
    },
    async readQuick() {
      const view = seen(quickTimeline);
      return view ? { text: view.text, updatedAt: view.updatedAt, tag: view.tag } : { text: "", updatedAt: "none", tag: null };
    },
    async writeQuick(text, updatedAt, tag) {
      const ok = await inner.writeQuick(text, updatedAt, tag);
      if (ok) {
        quickTimeline.push({ at: now(), text, updatedAt, tag: inner.state.quick.tag });
        return inner.state.quick.tag;
      }
      return ok;
    },
  };
  return store;
}

export function buildJournal({ password = freshSecret("pw"), store, lagMs, now = NOW, env } = {}) {
  const clock = { now };
  const held = store ?? (lagMs ? staleJournalStore({ lagMs, now: () => clock.now }) : journalMemoryStore());
  const environment = env ?? (password === null ? {} : { [ENVIRONMENT_VARIABLE]: password });
  const sleeps = [];
  // A fake pause moves the clock instead of waiting, so a lagging store catches up.
  const sleep = async (ms) => { sleeps.push(ms); clock.now += ms; };
  const api = createJournalApi({ store: held, env: environment, now: () => clock.now, sleep });
  return { api, store: held, password, clock, sleeps, env: environment, cookie: password === null ? undefined : signedInCookie(password) };
}

export function send(handler, { method = "GET", path = "/api/journal", cookie, body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (cookie) init.headers.cookie = cookie;
  if (body !== undefined) init.body = typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body);
  return handler(new Request(`https://journal.test${path}`, init));
}

export const post = (t, op, cookie = t.cookie) => send(t.api.POST, { method: "POST", cookie, body: op });
export const home = (t, today = "2026-10-22", cookie = t.cookie) => send(t.api.GET, { path: `/api/journal?view=home&today=${today}`, cookie });
export const months = (t, list, cookie = t.cookie) => send(t.api.GET, { path: `/api/journal?view=months&months=${list}`, cookie });

export const day = (date) => `day:${date}`;

// Adds a task and answers its id, through the real API.
export async function addEntry(t, list, text, type = "task") {
  const id = newId();
  const response = await post(t, { op: "add", list, entry: { id, type, text } });
  if (response.status !== 200) throw new Error("seed add " + response.status);
  return id;
}

export async function entryOf(t, list, id) {
  const month = list.startsWith("day:") ? list.slice(4, 11) : list.slice(8);
  const answer = await (await months(t, month)).json();
  const file = answer.months[month];
  const entries = list.startsWith("migrate:") ? file.migrate : (file.days[list.slice(4)] || { entries: [] }).entries;
  return entries.find((e) => e.id === id) || null;
}
