// A counting stand-in for the Vercel Blob package, for measuring how many Blob
// operations the notes and the journal cost. It wraps an in-memory stand-in and
// counts every call by kind.
//
// Which calls are billed as what. Vercel's Blob usage and pricing page (quoted from
// a search summary of it on 25 October 2026, because the page itself could not be
// fetched from the build sandbox) says: "Simple Operations: Counts when a blob is
// accessed by its URL and it's a cache MISS, or when you retrieve blob metadata
// without downloading the blob." and "Advanced Operations: Counts when you upload,
// copy, or list blobs, and when you create a Blob store." Cache HITs do not count
// as Simple Operations. The page does not name `del`; it is counted on its own line
// here and never folded into either figure.
//
// So here: advanced = put + copy + list; simple = get + head, every get counted as
// a miss, which is the most it can be (the adapters read with useCache: false).
// Hobby includes 2,000 advanced and 10,000 simple operations a month.

import { staleSdk } from "./stale-sdk.js";

export const ADVANCED = ["put", "copy", "list"];
export const SIMPLE = ["get", "head"];

export function countingSdk({ clock = { now: Date.now() }, pageSize = 1000 } = {}) {
  const inner = staleSdk({ clock, lagMs: 0, listLagMs: 0, pageSize });
  const counts = { put: 0, copy: 0, list: 0, get: 0, head: 0, del: 0, delPaths: 0 };
  const log = [];
  const wrap = (name) => async (...args) => {
    counts[name] += 1;
    if (name === "del") counts.delPaths += [args[0]].flat().length;
    const what = name === "list" ? (args[0] && args[0].prefix) : [args[0]].flat().join(',');
    log.push(`${name} ${what}`);
    return inner[name](...args);
  };
  const sdk = {
    ...inner,
    files: inner.files,
    BlobNotFoundError: inner.BlobNotFoundError,
    put: wrap("put"),
    get: wrap("get"),
    head: wrap("head"),
    list: wrap("list"),
    del: wrap("del"),
  };
  const advanced = (c) => ADVANCED.reduce((n, k) => n + c[k], 0);
  const simple = (c) => SIMPLE.reduce((n, k) => n + c[k], 0);
  return {
    sdk,
    counts,
    log,
    reset() { for (const k of Object.keys(counts)) counts[k] = 0; log.length = 0; },
    snapshot() { return { ...counts }; },
    since(before) {
      const d = {};
      for (const k of Object.keys(counts)) d[k] = counts[k] - before[k];
      return { ...d, advanced: advanced(d), simple: simple(d) };
    },
    totals() { return { ...counts, advanced: advanced(counts), simple: simple(counts) }; },
  };
}
