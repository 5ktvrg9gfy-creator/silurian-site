// Shared test fixtures. Every secret here is generated at run time, so no
// password, cookie or token is ever written into the repository.

import { randomBytes } from "node:crypto";
import { createNotesApi } from "../api/_lib/notes-api.js";
import { ENVIRONMENT_VARIABLE, COOKIE_NAME, sessionCookieHeader } from "../api/_lib/gate.js";

export const freshSecret = (label) => `${label}-${randomBytes(12).toString("hex")}`;

export const NOW = Date.parse("2026-10-01T12:00:00Z");

// An in-memory stand-in for the note store, with the same four calls.
export function memoryStore() {
  const notes = new Map();
  return {
    notes,
    async list() {
      return [...notes].map(([id, n]) => ({ id, title: n.meta.title, updatedAt: n.meta.updatedAt }));
    },
    async read(id) {
      const n = notes.get(id);
      return n ? { bytes: n.bytes, updatedAt: n.meta.updatedAt } : null;
    },
    async stamp(id) {
      const n = notes.get(id);
      return n ? n.meta.updatedAt : null;
    },
    async write(id, bytes, meta) {
      notes.set(id, { bytes: new Uint8Array(bytes), meta });
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
