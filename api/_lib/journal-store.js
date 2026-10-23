// Journal storage on Vercel Blob, private, in its own prefix:
//
//   journal/e/YYYY-MM/<entry id>.<rev>.json     one file per entry revision
//   journal/l/YYYY-MM/<YYYY-MM-DD>.<rev>.json   one file per calendar line revision
//   journal/spans/<span id>.<rev>.json          one file per span revision, keyed by id only
//   journal/quick.json                          the Quick notes scratch area
//
// Nothing here is under notes/, so the notes list, the notes index and notes
// search never see a journal entry. Notes lists only the notes/ prefix and the
// notes index is its own file outside this one.
//
// No file is ever shared by two entries, and no entry file is ever overwritten.
// Adding an entry creates its revision 1. A change creates the next revision of
// that one entry. A file is created only if there is nothing at its path, so the
// create is the version check: if another device made that revision first, the
// create is refused and nothing is replaced. The month in the path is the month
// of the list the entry belongs to, which never changes, because a move makes a
// new entry in the new list and leaves the original where it was.
//
// Why not overwrite in place. Vercel's Blob documentation says that deleting or
// overwriting a blob "may take up to 60 seconds to propagate through our cache"
// and that browsers can keep serving their own cached copy. An overwritten file
// can therefore be read as it was a minute ago, and a change made from that old
// copy loses what came after it. A file that is only ever created has no old copy
// to be read, so a read of it is the file, whenever it is made. Reads here also
// pass useCache: false, which bypasses the CDN. A file's content is fixed once
// created, so what has been read once is kept by path and never read again.
//
// Credentials: none are passed, exactly as in store.js. The package uses the
// store ID and the identity token Vercel puts on each request. This file must
// not name a token or pass one. Held by notes-tests/blob-auth.test.js.
//
// The Blob functions are passed in so the adapter can be tested against an
// in-memory stand-in.

import { normaliseEntryFile, normaliseLineFile, normaliseSpanFile, entryRecord, lineRecord, spanRecord, parseList, monthOf } from "../../journal/core.js";

const ENTRY_PREFIX = "journal/e/";
const LINE_PREFIX = "journal/l/";
const SPAN_PREFIX = "journal/spans/";
const QUICK_PATH = "journal/quick.json";
const JSON_TYPE = "application/json";
// How many files are read at once when a view is built.
const READ_AT_ONCE = 16;

const entryPath = (list, id, rev) => `${ENTRY_PREFIX}${parseList(list).month}/${id}.${rev}.json`;
const linePath = (date, rev) => `${LINE_PREFIX}${monthOf(date)}/${date}.${rev}.json`;
const spanPath = (id, rev) => `${SPAN_PREFIX}${id}.${rev}.json`;

async function readBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inBatches(items, work) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_AT_ONCE, items.length) }, run));
  return out;
}

export function createJournalStore(sdk) {
  const isMissing = (error) => Boolean(sdk.BlobNotFoundError) && error instanceof sdk.BlobNotFoundError;
  const isRefused = (error) =>
    (Boolean(sdk.BlobPreconditionFailedError) && error instanceof sdk.BlobPreconditionFailedError) ||
    Boolean(error && typeof error.message === "string" && /already exists/i.test(error.message));

  // Files that cannot change once made, kept by path for the life of this instance.
  const kept = new Map();

  // A private read that never comes from the CDN.
  async function getPrivate(path) {
    try {
      const result = await sdk.get(path, { access: "private", useCache: false });
      return result && result.statusCode === 200 ? result : null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async function readJson(path) {
    const result = await getPrivate(path);
    return result ? JSON.parse(new TextDecoder().decode(await readBytes(result.stream))) : null;
  }

  // True when the file was made, false when something was already at the path.
  async function createOnly(path, value) {
    try {
      await sdk.put(path, JSON.stringify(value), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: JSON_TYPE });
      kept.set(path, value);
      return true;
    } catch (error) {
      if (isRefused(error)) return false;
      // A create that failed for a reason the package words differently: if the
      // file is there now, someone else made it first, which is a refusal.
      let there = false;
      try { there = Boolean(await getPrivate(path)); } catch { there = false; }
      if (there) return false;
      throw error;
    }
  }

  async function readKept(path, normalise) {
    if (kept.has(path)) return kept.get(path);
    const raw = await readJson(path);
    if (raw === null) return null;
    const value = normalise(raw);
    if (!value) throw new Error("journal file unreadable");
    kept.set(path, raw);
    return raw;
  }

  async function listNames(prefix) {
    const names = [];
    let cursor;
    do {
      const page = await sdk.list({ prefix, limit: 1000, cursor });
      for (const blob of page.blobs) names.push(blob.pathname.slice(prefix.length));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return names;
  }

  return {
    // The entry at exactly this revision as { list, entry }, or null if there is none.
    async readEntry(list, id, rev) {
      const raw = await readKept(entryPath(list, id, rev), normaliseEntryFile);
      return raw ? normaliseEntryFile(raw) : null;
    },

    // True when made, false when that revision of that entry already exists.
    createEntry(list, entry) {
      return createOnly(entryPath(list, entry.id, entry.rev), entryRecord(list, entry));
    },

    // Every entry of a month at its highest revision, as { list, entry }. The
    // listing says which revision is highest and the files are read in parallel.
    async entriesOfMonth(month) {
      const names = await listNames(`${ENTRY_PREFIX}${month}/`);
      const latest = new Map();
      for (const name of names) {
        const match = /^([0-9a-f]{32})\.(\d+)\.json$/.exec(name);
        if (!match) continue;
        const rev = Number(match[2]);
        if (!latest.has(match[1]) || rev > latest.get(match[1])) latest.set(match[1], rev);
      }
      const wanted = [...latest.entries()];
      const read = await inBatches(wanted, async ([id, rev]) => {
        const raw = await readKept(`${ENTRY_PREFIX}${month}/${id}.${rev}.json`, normaliseEntryFile);
        // A file the listing named and a read cannot find is not an empty list.
        if (!raw) throw new Error("journal file listed and not readable");
        return normaliseEntryFile(raw);
      });
      return read;
    },

    async readLine(date, rev) {
      const raw = await readKept(linePath(date, rev), normaliseLineFile);
      return raw ? normaliseLineFile(raw) : null;
    },

    createLine(date, rev, text) {
      return createOnly(linePath(date, rev), lineRecord(date, rev, text));
    },

    // Every calendar line of a month at its highest revision, as { date, rev, text }.
    async linesOfMonth(month) {
      const names = await listNames(`${LINE_PREFIX}${month}/`);
      const latest = new Map();
      for (const name of names) {
        const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)\.json$/.exec(name);
        if (!match) continue;
        const rev = Number(match[2]);
        if (!latest.has(match[1]) || rev > latest.get(match[1])) latest.set(match[1], rev);
      }
      return inBatches([...latest.entries()], async ([date, rev]) => {
        const raw = await readKept(linePath(date, rev), normaliseLineFile);
        if (!raw) throw new Error("journal file listed and not readable");
        return normaliseLineFile(raw);
      });
    },

    // The span at exactly this revision, or null if there is none.
    async readSpan(id, rev) {
      const raw = await readKept(spanPath(id, rev), normaliseSpanFile);
      return raw ? normaliseSpanFile(raw) : null;
    },

    // True when made, false when that revision of that span already exists.
    createSpan(span) {
      return createOnly(spanPath(span.id, span.rev), spanRecord(span));
    },

    // Every span at its highest revision, removed ones included so that a device
    // that still holds one learns it is gone. A span is keyed by its id alone and
    // can cover any run of months, so there is no month to list by: this lists the
    // prefix once. That is fine for the tens of spans a person keeps, and is the
    // first thing to change if they ever reach hundreds (see journal-spans-open-questions.md).
    async spans() {
      const names = await listNames(SPAN_PREFIX);
      const latest = new Map();
      for (const name of names) {
        const match = /^([0-9a-f]{32})\.(\d+)\.json$/.exec(name);
        if (!match) continue;
        const rev = Number(match[2]);
        if (!latest.has(match[1]) || rev > latest.get(match[1])) latest.set(match[1], rev);
      }
      return inBatches([...latest.entries()], async ([id, rev]) => {
        const raw = await readKept(spanPath(id, rev), normaliseSpanFile);
        if (!raw) throw new Error("journal file listed and not readable");
        return normaliseSpanFile(raw);
      });
    },

    // Months that have an entry file, newest first.
    async months() {
      const found = [];
      let cursor;
      do {
        const page = await sdk.list({ prefix: ENTRY_PREFIX, mode: "folded", limit: 1000, cursor });
        for (const folder of page.folders || []) {
          const name = folder.slice(ENTRY_PREFIX.length).replace(/\/$/, "");
          if (/^\d{4}-\d{2}$/.test(name)) found.push(name);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return found.sort().reverse();
    },

    // { text, updatedAt, tag }. A journal with no quick notes yet has the empty
    // text and the version "none". Quick notes are the one file that is
    // overwritten, with the rule a note has: a save names the version it started
    // from, and is made only against that version's etag.
    async readQuick() {
      const result = await getPrivate(QUICK_PATH);
      if (!result) return { text: "", updatedAt: "none", tag: null };
      try {
        const file = JSON.parse(new TextDecoder().decode(await readBytes(result.stream)));
        if (file && file.v === 1 && typeof file.text === "string" && typeof file.updatedAt === "string") {
          if (!result.blob || typeof result.blob.etag !== "string") throw new Error("quick notes file has no version");
          return { text: file.text, updatedAt: file.updatedAt, tag: result.blob.etag };
        }
      } catch {
        // Falls through to the error below.
      }
      throw new Error("quick notes file unreadable");
    },

    // The new etag (or true) when written, false when another write got there first.
    async writeQuick(text, updatedAt, tag) {
      const options = { access: "private", addRandomSuffix: false, contentType: JSON_TYPE };
      const body = JSON.stringify({ v: 1, text, updatedAt });
      try {
        const result = await sdk.put(QUICK_PATH, body, tag === null ? { ...options, allowOverwrite: false } : { ...options, allowOverwrite: true, ifMatch: tag });
        return result && typeof result.etag === "string" ? result.etag : true;
      } catch (error) {
        if (isRefused(error)) return false;
        if (tag === null) {
          let there = false;
          try { there = Boolean(await getPrivate(QUICK_PATH)); } catch { there = false; }
          if (there) return false;
        }
        throw error;
      }
    },
  };
}
