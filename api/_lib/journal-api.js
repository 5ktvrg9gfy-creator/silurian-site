// The journal API as plain functions of (Request) -> Response, with the store,
// the environment and the clock passed in, like notes-api.js. The route file
// api/journal.js wires the real ones. It uses the notes gate and cookie and no
// other: one password, one cookie, signed out and in together. Nothing here logs
// a request, a header, a body or an error message, because any of them can hold
// the password, the cookie or a storage token.
//
// The rules of a change live in journal/core.js and are applied there. This
// file reads the months a change needs, asks core to apply it, and writes the
// result back against the version it read. Nothing moves, migrates or drops
// unless a request says so: there is no scheduled work and no clock-driven
// change anywhere in this file.
//
// Version checks, in two layers. Every write is conditional on the file's own
// version (its etag), so a write from another device in between makes this one
// fail and be tried again against the newer file. And every change to an
// existing entry or calendar line names the revision it started from, so if
// another device changed that entry or line, nothing is written and the answer
// is a 409 with the current months. Two devices never overwrite each other.

import { requestIsSignedIn } from "./gate.js";
import {
  MAX_QUICK_BYTES,
  addDays,
  applyOp,
  discardCopies,
  isDate,
  isMonth,
  monthOf,
  monthsFor,
  parseList,
  validateOp,
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
const MAX_TRIES = 6;
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

const STATUS = { stale: 409, undo: 409, limit: 422, invalid: 400 };

export function createJournalApi({ store, env, now = () => Date.now() }) {
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

  async function loadMonths(months) {
    const read = await Promise.all(months.map((month) => store.readMonth(month)));
    const files = {};
    const tags = {};
    months.forEach((month, index) => {
      files[month] = read[index].file;
      tags[month] = read[index].tag;
    });
    return { files, tags };
  }

  const view = (files, months) => Object.fromEntries(months.map((month) => [month, files[month]]));

  // A time for a quick notes save that is never equal to or earlier than the one
  // already stored.
  function nextStamp(previous) {
    const floor = previous && previous !== "none" ? Date.parse(previous) + 1 : 0;
    return new Date(Math.max(now(), floor)).toISOString();
  }

  async function change(op) {
    const months = monthsFor(op);
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      const { files, tags } = await loadMonths(months);
      const result = applyOp(files, op);
      if (result.error) {
        // A move that wrote its copies on an earlier try and was then refused
        // takes the copies back, so a refusal leaves nothing behind.
        if (op.op === "move" && attempt > 0) await takeBackCopies(op);
        const current = attempt > 0 ? (await loadMonths(months)).files : files;
        return fail(STATUS[result.error.code] || 400, result.error.message, { code: result.error.code, months: view(current, months) });
      }
      if (result.changed.length === 0) return reply(200, { ok: true, created: result.created, months: view(files, months) });

      let written = true;
      for (const month of result.changed) {
        if (!(await store.writeMonth(month, files[month], tags[month]))) {
          written = false;
          break;
        }
      }
      if (written) return reply(200, { ok: true, created: result.created, months: view(files, months) });
    }
    return fail(503, MESSAGES.busy);
  }

  async function takeBackCopies(op) {
    const target = parseList(op.to).month;
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      const { files, tags } = await loadMonths([target]);
      const removed = discardCopies(files, op.to, op.items.map((i) => i.copyId));
      if (removed === 0) return;
      if (await store.writeMonth(target, files[target], tags[target])) return;
    }
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
        const { files } = await loadMonths(months);
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
        const { files } = await loadMonths(months);
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

      for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
        const current = await store.readQuick();
        if (current.updatedAt !== base) return fail(409, MESSAGES.quickChanged, { updatedAt: current.updatedAt });
        const updatedAt = nextStamp(current.updatedAt);
        if (await store.writeQuick(text, updatedAt, current.tag)) return reply(200, { updatedAt });
      }
      return fail(503, MESSAGES.busy);
    }),
  };
}
