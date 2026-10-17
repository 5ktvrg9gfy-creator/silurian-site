// The notes API as plain functions of (Request) -> Response, with the store, the
// environment, the clock and the failure delay passed in. The route files in
// api/ wire the real ones. Nothing here logs a request, a header, a body or an
// error message, because any of them can hold the password, the cookie or a
// storage token.

import { randomBytes } from "node:crypto";
import {
  FAILURE_DELAY_MS,
  configuredPassword,
  passwordIsCorrect,
  requestIsSignedIn,
  sessionCookieHeader,
} from "./gate.js";

export const MAX_NOTE_BYTES = 1024 * 1024;
export const TITLE_MAX_CHARACTERS = 200;

export const MESSAGES = {
  signedOut: "Sign in to see your notes.",
  wrongPassword: "That password is incorrect.",
  tooLarge:
    "This note is over 1 MB, so it was not saved. The last saved version is unchanged. Cut it down and it will save.",
  notText: "This note is not valid text, so it was not saved.",
  notFound: "That note does not exist.",
  storage: "Storage is not available right now. Nothing was changed. Try again in a moment.",
};

const ID_PATTERN = /^[0-9a-f]{32}$/;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

function reply(status, body, extra = {}) {
  const headers = new Headers({ ...BASE_HEADERS, ...extra });
  if (body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  const payload = body === null || typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body);
  return new Response(payload, { status, headers });
}

const fail = (status, message) => reply(status, { error: message });

export function titleOf(text) {
  const first = text.split(/\r\n|\n|\r/, 1)[0].trim();
  const clipped = Array.from(first).slice(0, TITLE_MAX_CHARACTERS).join("");
  return clipped === "" ? "Untitled" : clipped;
}

export function createNotesApi({
  store,
  env,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  newId = () => randomBytes(16).toString("hex"),
}) {
  const signedIn = (request) => requestIsSignedIn(request, env, now());

  // Every route except login starts here, before it looks at anything else.
  const guarded = (handler) => async (request) => {
    if (!signedIn(request)) return fail(401, MESSAGES.signedOut);
    try {
      return await handler(request);
    } catch (error) {
      // The name only. The message of a storage error can name the store.
      console.error("notes: storage error", error && error.name);
      return fail(500, MESSAGES.storage);
    }
  };

  async function readNoteBody(request) {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_NOTE_BYTES) return { tooLarge: true };
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_NOTE_BYTES) return { tooLarge: true };
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      return { notText: true };
    }
    return { bytes, text };
  }

  async function save(id, body) {
    const updatedAt = new Date(now()).toISOString();
    await store.write(id, body.bytes, { title: titleOf(body.text), updatedAt });
    return updatedAt;
  }

  return {
    session: guarded(async () => reply(200, { signedIn: true })),

    async login(request) {
      const password = configuredPassword(env);
      let supplied = null;
      try {
        const declared = Number(request.headers.get("content-length"));
        if (!(declared > 4096)) supplied = (await request.json()).password;
      } catch {
        supplied = null;
      }
      if (password !== null && passwordIsCorrect(supplied, password)) {
        return reply(200, { signedIn: true }, { "Set-Cookie": sessionCookieHeader(password, now()) });
      }
      // A wrong password and an unconfigured gate cost the same and read the
      // same, so the response says nothing about which one this is.
      await sleep(FAILURE_DELAY_MS);
      return fail(401, MESSAGES.wrongPassword);
    },

    collection: {
      GET: guarded(async () => {
        const notes = await store.list();
        notes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
        return reply(200, {
          notes: notes.map((n) => ({ id: n.id, title: n.title || "Untitled", updatedAt: n.updatedAt })),
        });
      }),

      POST: guarded(async (request) => {
        const body = await readNoteBody(request);
        if (body.tooLarge) return fail(413, MESSAGES.tooLarge);
        if (body.notText) return fail(400, MESSAGES.notText);
        const id = newId();
        const updatedAt = await save(id, body);
        return reply(201, { id, updatedAt });
      }),
    },

    item: {
      GET: guarded(async (request) => {
        const id = new URL(request.url).searchParams.get("id");
        if (!ID_PATTERN.test(id || "")) return fail(404, MESSAGES.notFound);
        const note = await store.read(id);
        if (!note) return fail(404, MESSAGES.notFound);
        return reply(200, note.bytes, {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Note-Updated": note.updatedAt,
        });
      }),

      PUT: guarded(async (request) => {
        const id = new URL(request.url).searchParams.get("id");
        if (!ID_PATTERN.test(id || "")) return fail(404, MESSAGES.notFound);
        const body = await readNoteBody(request);
        if (body.tooLarge) return fail(413, MESSAGES.tooLarge);
        if (body.notText) return fail(400, MESSAGES.notText);
        const updatedAt = await save(id, body);
        return reply(200, { id, updatedAt });
      }),

      DELETE: guarded(async (request) => {
        const id = new URL(request.url).searchParams.get("id");
        if (!ID_PATTERN.test(id || "")) return fail(404, MESSAGES.notFound);
        await store.remove(id);
        return reply(200, { deleted: true });
      }),
    },
  };
}
