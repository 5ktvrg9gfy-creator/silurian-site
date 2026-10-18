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
  signedOutCookieHeader,
} from "./gate.js";

export const MAX_NOTE_BYTES = 1024 * 1024;
export const TITLE_MAX_CHARACTERS = 200;
export const SEARCH_MAX_CHARACTERS = 200;
// How much of a matching line a search result shows, and how much of it sits
// before the match, so a long line still shows the part that matched.
export const LINE_MAX_CHARACTERS = 160;
const LINE_LEAD_CHARACTERS = 40;

export const MESSAGES = {
  signedOut: "Sign in to see your notes.",
  wrongPassword: "That password is incorrect.",
  tooLarge:
    "This note is over 1 MB, so it was not saved. The last saved version is unchanged. Cut it down and it will save.",
  notText: "This note is not valid text, so it was not saved.",
  notFound: "That note does not exist.",
  changedElsewhere:
    "This note was changed on another device, so your edits were not saved. Your text is still on screen. Copy it, then open the note again to see the latest version.",
  deletedElsewhere:
    "This note was deleted on another device, so your edits were not saved. Your text is still on screen. Copy it before you leave.",
  missingVersion: "This save did not say which version of the note it started from, so it was not saved. Reload the page.",
  storage: "Storage is not available right now. Nothing was changed. Try again in a moment.",
  searchTooLong: `Search for ${SEARCH_MAX_CHARACTERS} characters or fewer.`,
  searchUnreadable: "That search could not be read. Clear the box and type it again.",
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

// Cut a line to at most LINE_MAX_CHARACTERS, keeping the match in view, without
// splitting a character in two.
function excerpt(line, at) {
  const chars = Array.from(line);
  if (chars.length <= LINE_MAX_CHARACTERS) return line.trim();
  // `at` counts UTF-16 units; turn it into a character position.
  const atChar = Array.from(line.slice(0, at)).length;
  const start = Math.max(0, Math.min(atChar - LINE_LEAD_CHARACTERS, chars.length - LINE_MAX_CHARACTERS));
  const end = start + LINE_MAX_CHARACTERS;
  return `${start > 0 ? "\u2026" : ""}${chars.slice(start, end).join("").trim()}${end < chars.length ? "\u2026" : ""}`;
}

// The first line of a note containing the query, ignoring case, or null. A
// plain substring test, never a pattern, so every symbol in the query is just a
// character. A query cannot span a line break.
export function matchingLine(text, query) {
  const needle = query.toLowerCase();
  for (const line of text.split(/\r\n|\n|\r/)) {
    const at = line.toLowerCase().indexOf(needle);
    if (at !== -1) return excerpt(line, at);
  }
  return null;
}

// The search text arrives URI-encoded in a header, not in the address, so it
// stays out of request logs. Null means no search; a string is the query.
function searchQuery(request) {
  const raw = request.headers.get("x-note-search");
  if (raw === null || raw === "") return { query: null };
  let query;
  try {
    query = decodeURIComponent(raw);
  } catch {
    return { error: MESSAGES.searchUnreadable };
  }
  if (Array.from(query).length > SEARCH_MAX_CHARACTERS) return { error: MESSAGES.searchTooLong };
  return { query: query.trim() === "" ? null : query };
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

  // The time of this save. Never equal to or earlier than the time already on
  // the note, so two saves in the same millisecond still tell a stale copy from a
  // current one.
  function nextStamp(previous) {
    const stamp = now();
    const floor = previous ? Date.parse(previous) + 1 : 0;
    return new Date(Math.max(stamp, floor)).toISOString();
  }

  async function save(id, body, previous = null) {
    const updatedAt = nextStamp(previous);
    await store.write(id, body.bytes, { title: titleOf(body.text), updatedAt });
    return updatedAt;
  }

  return {
    session: guarded(async () => reply(200, { signedIn: true })),

    // Behind the gate like every route but login: a request with no valid
    // cookie has nothing to sign out of and gets the usual 401.
    signOut: guarded(async () => reply(200, { signedIn: false }, { "Set-Cookie": signedOutCookieHeader() })),

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
      GET: guarded(async (request) => {
        const search = searchQuery(request);
        if (search.error) return fail(400, search.error);
        const notes = await store.list();
        notes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
        const listed = notes.map((n) => ({ id: n.id, title: n.title || "Untitled", updatedAt: n.updatedAt }));
        if (search.query === null) return reply(200, { notes: listed });

        // Search reads every note in full, behind the same cookie check as the
        // list, and returns only the title and the line that matched.
        const found = await Promise.all(
          listed.map(async (n) => {
            const note = await store.read(n.id);
            if (!note) return null;
            const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(note.bytes);
            const line = matchingLine(text, search.query);
            return line === null ? null : { ...n, line };
          }),
        );
        return reply(200, { notes: found.filter(Boolean) });
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

        // A save says which version of the note it started from. If the note has
        // moved on since, or is gone, nothing is written and the caller keeps its
        // own text.
        const base = request.headers.get("x-base-updated");
        if (!base) return fail(400, MESSAGES.missingVersion);
        const current = await store.stamp(id);
        if (current === null) return fail(409, MESSAGES.deletedElsewhere);
        if (current !== base) {
          return reply(409, { error: MESSAGES.changedElsewhere, updatedAt: current });
        }

        const updatedAt = await save(id, body, current);
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
