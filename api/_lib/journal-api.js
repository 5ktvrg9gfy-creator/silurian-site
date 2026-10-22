// The journal API as plain functions of (Request) -> Response, with the store,
// the environment and the clock passed in, like notes-api.js. The route file
// api/journal.js wires the real ones. It uses the notes gate and cookie and no
// other: one password, one cookie, signed out and in together. Nothing here logs
// a request, a header, a body or an error message, because any of them can hold
// the password, the cookie or a storage token.
//
// The rules of a change live in journal/core.js and are applied there. This
// file reads only the entries a change starts from (each named by its id and the
// revision the page started from), asks core to apply the change, and creates the
// files it made. It never reads a whole month to change one entry, and never
// rewrites a file shared with others. Nothing moves, migrates or drops unless a
// request says so: there is no scheduled work and no clock-driven change anywhere
// in this file.
//
// The version check is the create. A change to an entry creates the next
// revision of that one entry, and a create is refused if that revision already
// exists, so a change made from an out of date copy writes nothing and the answer
// is a 409 with what is there now. The same change sent again finds its own
// result already there, recognises it as the same change and is answered as done.
// Two devices never overwrite each other, and no read of a file that is only ever
// created can be older than the file.

import { requestIsSignedIn } from "./gate.js";
import {
  MAX_QUICK_BYTES,
  addDays,
  applyOp,
  isDate,
  isMonth,
  laterStamp,
  monthOf,
  monthsFor,
  needs,
  parseList,
  validateOp,
  viewFrom,
  writesFor,
} from "../../journal/core.js";

export const MESSAGES = {
  signedOut: "Sign in to see your journal.",
  storage: "Storage is not available right now. Nothing was changed. Try again in a moment.",
  badChange: "That change could not be read, so it was not saved. Reload the page.",
  badRequest: "That request could not be read. Reload the page.",
  busy: "The journal is busy on another device. Nothing was changed. Try again.",
  quickChanged:
    "Your quick notes were changed on another device, so this was not saved. Your text is still on screen. Copy it, then reload to see the latest.",
  quickTooLarge: "Your quick notes are over 256 KB, so they were not saved. Cut them down and they will save.",
  quickNotText: "Your quick notes are not valid text, so they were not saved.",
  quickMissingVersion: "This save did not say which version of the quick notes it started from, so it was not saved. Reload the page.",
};

const MAX_JSON_BYTES = 64 * 1024;
// Quick notes are the one overwritten file, so they are the one place that still
// waits and tries again when the store shows a version older than the one the page
// holds. Entries and lines never do: they are only ever created.
// An undo asks how far a copy has got, one revision at a time, and a copy that
// has been changed more times than this is treated as touched.
const MAX_PROBE = 64;
const QUICK_WAITS_MS = [100, 200, 400, 800, 1600, 3200];
// Months sent with the first load: this month, the month tomorrow falls in and
// up to three earlier months that have a file, for the morning strip.
const EARLIER_MONTHS = 3;
const MAX_MONTHS_PER_READ = 6;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

function reply(status, body) {
  const headers = new Headers({ ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8" });
  return new Response(JSON.stringify(body), { status, headers });
}

const fail = (status, message, extra = {}) => reply(status, { error: message, ...extra });

const STATUS = { stale: 409, undo: 409, invalid: 400 };

export function createJournalApi({ store, env, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const signedIn = (request) => requestIsSignedIn(request, env, now());

  // Every route starts here, before it looks at anything else.
  const guarded = (handler) => async (request) => {
    if (!signedIn(request)) return fail(401, MESSAGES.signedOut);
    try {
      return await handler(request);
    } catch (error) {
      // The name only. The message of a storage error can name the store.
      console.error("journal: storage error", error && error.name);
      return fail(500, MESSAGES.storage);
    }
  };

  async function readJson(request) {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) return null;
    try {
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength > MAX_JSON_BYTES) return null;
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  // What this instance last wrote to the quick notes, for a minute. A store can
  // show an overwritten file as it was a few seconds ago, so a read straight after
  // a write may be older than the write. It is only ever a shortcut: a write still
  // goes against an etag.
  let recentQuick = null;
  const RECENT_MS = 60 * 1000;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const view = (files, months) => Object.fromEntries(months.map((month) => [month, files[month]]));

  // The months as views, built from what is stored: a listing of each month's
  // entry files and its calendar lines.
  async function loadMonths(months) {
    const [entries, lines] = await Promise.all([
      Promise.all(months.map((month) => store.entriesOfMonth(month))),
      Promise.all(months.map((month) => store.linesOfMonth(month))),
    ]);
    return viewFrom(months, entries.flat(), lines.flat());
  }

  // A time for a quick notes save that is never equal to or earlier than the one
  // already stored.
  function nextStamp(previous) {
    const floor = previous && previous !== "none" ? Date.parse(previous) + 1 : 0;
    return new Date(Math.max(now(), floor)).toISOString();
  }

  // The stored records a change starts from, as { records: [{ list, entry }],
  // lines: [{ date, rev, text }] }. Only what the change names is read.
  async function startingPoint(op) {
    const records = [];
    const lines = [];
    for (const need of needs(op)) {
      const found = await store.readEntry(need.list, need.id, need.rev);
      if (found) records.push(found);
    }
    if (op.op === "line" && op.rev > 0) {
      const line = await store.readLine(op.date, op.rev);
      if (line) lines.push(line);
    }
    // An undo also needs the copy it takes back, at the latest revision made of
    // it: untouched is revision 1 with nothing after it.
    if (op.op === "undo" && records.length === 1) {
      const entry = records[0].entry;
      if ((entry.state === "migrated" || entry.state === "scheduled") && entry.to === op.toList) {
        let rev = 1;
        let latest = null;
        for (; rev <= MAX_PROBE; rev += 1) {
          const found = await store.readEntry(entry.to, entry.toId, rev);
          if (!found) break;
          latest = found;
        }
        if (latest) records.push(latest);
      }
    }
    return { records, lines };
  }

  const putRecord = (records, record) => {
    const at = records.findIndex((r) => r.entry.id === record.entry.id);
    if (at < 0) records.push(record);
    else if (record.entry.rev > records[at].entry.rev) records[at] = record;
  };

  // Takes back copies of a move that this call made and the move then could not
  // use, by creating the copy's removed revision. The create is refused if anyone
  // has made a revision of it since, and then the copy is left, as their work.
  async function takeBackCopies(copies, files) {
    const used = new Set();
    for (const file of Object.values(files)) {
      const entries = [...file.migrate, ...Object.values(file.days).flatMap((d) => d.entries)];
      for (const e of entries) if (e.toId) used.add(e.toId);
    }
    for (const { list, entry } of copies) {
      if (!used.has(entry.id)) await store.createEntry(list, { ...entry, state: "removed", rev: entry.rev + 1 });
    }
  }

  async function change(op) {
    const months = monthsFor(op);
    const { records, lines } = await startingPoint(op);
    const primary = op.list || op.from;
    const madeCopies = [];
    const MAX_ROUNDS = 5 + (op.items ? op.items.length : 1);
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const files = viewFrom(months, records, lines);
      const before = clone(files);
      const result = applyOp(files, op);
      if (result.error) {
        if (op.op === "move") await takeBackCopies(madeCopies, files);
        return fail(STATUS[result.error.code] || 400, result.error.message, { code: result.error.code, months: view(files, months) });
      }
      const writes = writesFor(before, files);
      if (writes.entries.length === 0 && writes.lines.length === 0) {
        return reply(200, { ok: true, created: result.created, months: view(files, months) });
      }
      // Copies and removals in another list first, so that a failure between two
      // creates leaves a duplicate and never an entry that is lost from view.
      const ordered = [...writes.entries].sort((a, b) => Number(a.list === primary) - Number(b.list === primary));
      let clash = null;
      for (const w of ordered) {
        const made = await store.createEntry(w.list, w.entry);
        if (made) {
          putRecord(records, w);
          if (w.entry.rev === 1 && op.op === "move") madeCopies.push(w);
          continue;
        }
        // A copy that was already there was made by an earlier try of this same change.
        if (op.op === "move" && w.entry.rev === 1 && w.list === op.to) {
          const existing = await store.readEntry(w.list, w.entry.id, 1);
          if (existing) { putRecord(records, existing); continue; }
        }
        // Something is at that revision already: read it and decide again from it.
        const there = await store.readEntry(w.list, w.entry.id, w.entry.rev);
        if (!there) throw new Error("journal revision refused and not readable");
        putRecord(records, there);
        clash = true;
        break;
      }
      if (!clash) {
        for (const line of writes.lines) {
          if (await store.createLine(line.date, line.rev, line.text)) { lines.push(line); continue; }
          const there = await store.readLine(line.date, line.rev);
          if (!there) throw new Error("journal revision refused and not readable");
          lines.push(there);
          clash = true;
          break;
        }
      }
      if (!clash) return reply(200, { ok: true, created: result.created, months: view(viewFrom(months, records, lines), months) });
    }
    return fail(503, MESSAGES.busy);
  }

  return {
    GET: guarded(async (request) => {
      const params = new URL(request.url).searchParams;
      const kind = params.get("view");

      if (kind === "months") {
        const months = (params.get("months") || "").split(",");
        if (months.length < 1 || months.length > MAX_MONTHS_PER_READ || !months.every(isMonth) || new Set(months).size !== months.length) {
          return fail(400, MESSAGES.badRequest);
        }
        const files = await loadMonths(months);
        return reply(200, { months: view(files, months) });
      }

      if (kind === "home") {
        const today = params.get("today");
        if (!isDate(today)) return fail(400, MESSAGES.badRequest);
        const thisMonth = monthOf(today);
        const tomorrowMonth = monthOf(addDays(today, 1));
        const wanted = [thisMonth];
        if (tomorrowMonth !== thisMonth) wanted.push(tomorrowMonth);
        const [onFile, quick] = await Promise.all([store.months(), store.readQuick()]);
        const earlier = onFile.filter((m) => m < thisMonth).slice(0, EARLIER_MONTHS);
        const months = [...wanted, ...earlier];
        const files = await loadMonths(months);
        return reply(200, { today, months: view(files, months), quick: { text: quick.text, updatedAt: quick.updatedAt } });
      }

      return fail(400, MESSAGES.badRequest);
    }),

    POST: guarded(async (request) => {
      const op = await readJson(request);
      if (op === null || validateOp(op) !== null) return fail(400, MESSAGES.badChange);
      return change(op);
    }),

    // Quick notes: one block of text. The same rule as a note: a save names the
    // version it started from, and if that is no longer the stored one nothing
    // is written and the page keeps its own text.
    PUT: guarded(async (request) => {
      if (new URL(request.url).searchParams.get("part") !== "quick") return fail(400, MESSAGES.badRequest);
      const declared = Number(request.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_QUICK_BYTES) return fail(413, MESSAGES.quickTooLarge);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength > MAX_QUICK_BYTES) return fail(413, MESSAGES.quickTooLarge);
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        return fail(400, MESSAGES.quickNotText);
      }
      const base = request.headers.get("x-base-updated");
      if (!base) return fail(400, MESSAGES.quickMissingVersion);

      for (let attempt = 0; ; attempt += 1) {
        let current = await store.readQuick();
        if (recentQuick) {
          if (now() - recentQuick.at > RECENT_MS || !laterStamp(recentQuick.updatedAt, current.updatedAt)) recentQuick = null;
          else current = { text: recentQuick.text, updatedAt: recentQuick.updatedAt, tag: recentQuick.tag };
        }
        // Already saved: the same text sent again after the answer was lost.
        if (current.text === text && current.updatedAt !== "none" && current.updatedAt !== base && !laterStamp(base, current.updatedAt)) {
          return reply(200, { updatedAt: current.updatedAt });
        }
        const behind = laterStamp(base, current.updatedAt);
        if (!behind) {
          if (current.updatedAt !== base) return fail(409, MESSAGES.quickChanged, { updatedAt: current.updatedAt });
          const updatedAt = nextStamp(current.updatedAt);
          const written = await store.writeQuick(text, updatedAt, current.tag);
          if (written) {
            recentQuick = typeof written === "string" ? { text, updatedAt, tag: written, at: now() } : null;
            return reply(200, { updatedAt });
          }
          recentQuick = null;
        }
        if (attempt >= QUICK_WAITS_MS.length) break;
        await sleep(QUICK_WAITS_MS[attempt]);
      }
      return fail(503, MESSAGES.busy);
    }),
  };
}
