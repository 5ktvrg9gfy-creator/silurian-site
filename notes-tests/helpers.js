// Shared test fixtures. Every secret here is generated at run time, so no
// password, cookie or token is ever written into the repository.

import { randomBytes } from "node:crypto";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { ENVIRONMENT_VARIABLE, COOKIE_NAME, sessionCookieHeader } from "../api/_lib/gate.js";

export const freshSecret = (label) => `${label}-${randomBytes(12).toString("hex")}`;

export const NOW = Date.parse("2026-10-01T12:00:00Z");

// An in-memory stand-in for the note store, with the same calls and the same
// promises as the Blob adapter: a save is made only on top of the version it
// started from, and the same save sent again is recognised and makes nothing new.
// (The adapter's own way of keeping revisions is held by notes-tests/revisions.test.js.)
export function memoryStore() {
  const notes = new Map();
  const state = { labelsFile: null };
  const held = (n) => ({ labels: n.meta.labels || [], archived: n.meta.archived === true });
  const open = (n) => ({ title: n.meta.title, updatedAt: n.meta.updatedAt, ...held(n) });
  return {
    notes,
    state,
    async list() {
      return Object.assign([...notes].map(([id, n]) => ({ id, title: n.meta.title, updatedAt: n.meta.updatedAt, ...held(n) })), { gone: [] });
    },
    async read(id) {
      const n = notes.get(id);
      return n ? { bytes: n.bytes, updatedAt: n.meta.updatedAt, ...held(n) } : null;
    },
    async text(id) {
      const n = notes.get(id);
      return n ? n.bytes : null;
    },
    async stamp(id) {
      const n = notes.get(id);
      return n ? n.meta.updatedAt : null;
    },
    async meta(id) {
      const n = notes.get(id);
      return n ? open(n) : null;
    },
    async repeat(id, base, fp) {
      const n = notes.get(id);
      return n && n.last && n.last.from === base && n.last.fp === fp ? { updatedAt: n.meta.updatedAt } : null;
    },
    async write(id, bytes, meta, base, fp) {
      const n = notes.get(id);
      if (base === null ? n : !n) return { ok: false, current: n ? open(n) : null };
      if (base !== null && n.meta.updatedAt !== base) {
        return n.last && n.last.from === base && n.last.fp === fp ? { ok: true, updatedAt: n.meta.updatedAt, repeated: true } : { ok: false, current: open(n) };
      }
      notes.set(id, { bytes: new Uint8Array(bytes), meta, last: { from: base, fp } });
      return { ok: true, updatedAt: meta.updatedAt };
    },
    async writeMeta(id, meta, base, fp) {
      const n = notes.get(id);
      if (!n) return { ok: false, current: null };
      if (n.meta.updatedAt !== base) {
        return n.last && n.last.from === base && n.last.fp === fp ? { ok: true, updatedAt: n.meta.updatedAt, repeated: true } : { ok: false, current: open(n) };
      }
      n.meta = meta;
      n.last = { from: base, fp };
      return { ok: true, updatedAt: meta.updatedAt };
    },
    async readLabels() {
      return state.labelsFile ? structuredClone({ labels: state.labelsFile.labels, updatedAt: state.labelsFile.updatedAt }) : null;
    },
    async labelsRepeat(base, fp) {
      const f = state.labelsFile;
      return f && f.from === base && f.fp === fp ? { labels: structuredClone(f.labels), updatedAt: f.updatedAt, created: f.created || null } : null;
    },
    async writeLabels(file, base, fp, created = null) {
      const version = state.labelsFile ? state.labelsFile.updatedAt : "none";
      if (version !== base) return { ok: false };
      state.labelsFile = { ...structuredClone(file), from: base, fp, created };
      return { ok: true };
    },
    async remove(id) {
      notes.delete(id);
    },
  };
}

export function build({ password = freshSecret("pw"), store = memoryStore(), now = NOW, env } = {}) {
  const clock = { now };
  const sleeps = [];
  const environment = env ?? (password === null ? {} : { [ENVIRONMENT_VARIABLE]: password });
  const api = createNotesApi({
    store,
    env: environment,
    now: () => clock.now,
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { api, store, password, clock, sleeps, env: environment };
}

// The Cookie header a browser would send after a good login.
export function signedInCookie(password, now = NOW) {
  return sessionCookieHeader(password, now).split(";")[0];
}

export const url = (path) => `https://notes.test${path}`;

export function call(handler, { method = "GET", path = "/api/notes", cookie, body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (cookie) init.headers.cookie = cookie;
  if (body !== undefined) init.body = body;
  return handler(new Request(url(path), init));
}

export const COOKIE = COOKIE_NAME;

// A save of an existing note, starting from the version the caller last saw.
export function put(t, cookie, id, body, base) {
  return call(t.api.item.PUT, {
    method: "PUT",
    path: `/api/note?id=${id}`,
    cookie,
    body,
    headers: base === undefined ? {} : { "x-base-updated": base },
  });
}
