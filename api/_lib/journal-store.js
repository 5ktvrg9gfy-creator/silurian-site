// Journal storage on Vercel Blob, private, in its own prefix:
//
//   journal/month/YYYY-MM.json   one file per month: every day's calendar line
//                                and log, and that month's Migrate list
//   journal/quick.json           the Quick notes scratch area
//
// Nothing here is under notes/, so the notes list, the notes index and notes
// search never see a journal entry. Notes lists only the notes/ prefix and the
// notes index is its own file outside this one.
//
// One file per month, not one per day: the Month panel needs every day of the
// month at once, and a file per day would mean thirty one reads to draw it.
//
// Every write is conditional on the version of the file it read (its etag), so a
// write from another device in between makes this one fail instead of replacing
// it. A file that does not exist yet is created without overwriting, which fails
// the same way if another device created it first.
//
// Credentials: none are passed, exactly as in store.js. The package uses the
// store ID and the identity token Vercel puts on each request. This file must
// not name a token or pass one. Held by notes-tests/blob-auth.test.js.
//
// The Blob functions are passed in so the adapter can be tested against an
// in-memory stand-in.

import { emptyMonth, normaliseMonth } from "../../journal/core.js";

const MONTH_PREFIX = "journal/month/";
const QUICK_PATH = "journal/quick.json";
const JSON_TYPE = "application/json";

const monthPath = (month) => `${MONTH_PREFIX}${month}.json`;

async function readBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function createJournalStore(sdk) {
  const isMissing = (error) => Boolean(sdk.BlobNotFoundError) && error instanceof sdk.BlobNotFoundError;
  const isRefused = (error) =>
    (Boolean(sdk.BlobPreconditionFailedError) && error instanceof sdk.BlobPreconditionFailedError) ||
    Boolean(error && typeof error.message === "string" && /already exists/i.test(error.message));

  // A private read that never comes from the CDN, so a change made on one device
  // is what the next device reads.
  async function getPrivate(path) {
    try {
      const result = await sdk.get(path, { access: "private", useCache: false });
      return result && result.statusCode === 200 ? result : null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  // The new etag (or true) when written, false when another write got there first.
  async function putConditional(path, body, tag) {
    const options = { access: "private", addRandomSuffix: false, contentType: JSON_TYPE };
    try {
      const result = await sdk.put(path, body, tag === null ? { ...options, allowOverwrite: false } : { ...options, allowOverwrite: true, ifMatch: tag });
      // The etag of what was just written, so the next change can continue from it
      // without reading the store again; true when the package gives none.
      return result && typeof result.etag === "string" ? result.etag : true;
    } catch (error) {
      if (isRefused(error)) return false;
      // A first write that failed for a reason the package words differently: if
      // the file is there now, someone else created it first, which is a refusal.
      if (tag === null) {
        let there = false;
        try { there = Boolean(await getPrivate(path)); } catch { there = false; }
        if (there) return false;
      }
      throw error;
    }
  }

  return {
    // The month file and the tag to write it back against. A month with no file
    // is an empty one with a null tag. A damaged file throws, and is never read
    // as empty, because the next change would overwrite it.
    async readMonth(month) {
      const result = await getPrivate(monthPath(month));
      if (!result) return { file: emptyMonth(), tag: null };
      const file = normaliseMonth(JSON.parse(new TextDecoder().decode(await readBytes(result.stream))));
      if (!file) throw new Error("month file unreadable");
      // A file with no version to write against cannot be written safely.
      if (!result.blob || typeof result.blob.etag !== "string") throw new Error("month file has no version");
      return { file, tag: result.blob.etag, exists: true };
    },

    writeMonth(month, file, tag) {
      return putConditional(monthPath(month), JSON.stringify(file), tag);
    },

    // Months that have a file, newest first.
    async months() {
      const found = [];
      let cursor;
      do {
        const page = await sdk.list({ prefix: MONTH_PREFIX, limit: 1000, cursor });
        for (const blob of page.blobs) {
          const name = blob.pathname.slice(MONTH_PREFIX.length);
          if (/^\d{4}-\d{2}\.json$/.test(name)) found.push(name.slice(0, -".json".length));
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return found.sort().reverse();
    },

    // { text, updatedAt, tag }. A journal with no quick notes yet has the empty
    // text and the version "none".
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

    writeQuick(text, updatedAt, tag) {
      return putConditional(QUICK_PATH, JSON.stringify({ v: 1, text, updatedAt }), tag);
    },
  };
}
