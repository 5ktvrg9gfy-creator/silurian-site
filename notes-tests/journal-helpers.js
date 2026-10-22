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

export function buildJournal({ password = freshSecret("pw"), store = journalMemoryStore(), now = NOW, env } = {}) {
  const clock = { now };
  const environment = env ?? (password === null ? {} : { [ENVIRONMENT_VARIABLE]: password });
  const api = createJournalApi({ store, env: environment, now: () => clock.now });
  return { api, store, password, clock, cookie: password === null ? undefined : signedInCookie(password) };
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
