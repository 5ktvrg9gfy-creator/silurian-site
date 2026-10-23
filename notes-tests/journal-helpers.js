// Shared fixtures for the journal tests. Every secret is made at run time.

import { randomBytes } from "node:crypto";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import { entryRecord, lineRecord, normaliseEntryFile, normaliseLineFile, normaliseSpanFile, spanRecord } from "../journal/core.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";

export { NOW, freshSecret, signedInCookie };

export const newId = () => randomBytes(16).toString("hex");

// An in-memory stand-in for the journal store with the same calls and the same
// promises as the real one: an entry or line revision is created only where
// nothing is, and is never overwritten, so a create is refused if it exists; the
// quick notes file is overwritten against the version it read.
export function journalMemoryStore() {
  const entries = new Map();   // "list|id|rev" -> { json, at }
  const lines = new Map();     // "date|rev" -> { json, at }
  const spanFiles = new Map(); // "id|rev" -> { json, at }
  let version = 0;
  const creates = [];
  const state = { quick: null, hook: null, reads: 0 };
  const key = (list, id, rev) => `${list}|${id}|${rev}`;
  const monthOfList = (list) => (list.startsWith("day:") ? list.slice(4, 11) : list.slice(8));
  const ageNow = { now: () => Date.now(), listLagMs: 0 };
  const listed = (at) => at <= ageNow.now() - ageNow.listLagMs;
  return {
    entries,
    lines,
    spanFiles,
    creates,
    state,
    ageNow,
    async readEntry(list, id, rev) {
      state.reads += 1;
      const held = entries.get(key(list, id, rev));
      if (!held) return null;
      const found = normaliseEntryFile(JSON.parse(held.json));
      if (!found) throw new Error("entry file unreadable");
      return found;
    },
    async createEntry(list, entry) {
      // A hook lets a test make another device write between this one's read
      // and this one's create.
      if (state.hook) {
        const hook = state.hook;
        state.hook = null;
        await hook();
      }
      const k = key(list, entry.id, entry.rev);
      if (entries.has(k)) return false;
      entries.set(k, { json: JSON.stringify(entryRecord(list, entry)), at: ageNow.now() });
      creates.push(k);
      return true;
    },
    async entriesOfMonth(month) {
      state.reads += 1;
      const latest = new Map();
      for (const [k, held] of entries) {
        const [list, id, rev] = k.split("|");
        if (monthOfList(list) !== month || !listed(held.at)) continue;
        if (!latest.has(id) || Number(rev) > latest.get(id).rev) latest.set(id, { rev: Number(rev), json: held.json });
      }
      return [...latest.values()].map((x) => normaliseEntryFile(JSON.parse(x.json)));
    },
    async readLine(date, rev) {
      const held = lines.get(`${date}|${rev}`);
      return held ? normaliseLineFile(JSON.parse(held.json)) : null;
    },
    async createLine(date, rev, text) {
      const k = `${date}|${rev}`;
      if (lines.has(k)) return false;
      lines.set(k, { json: JSON.stringify(lineRecord(date, rev, text)), at: ageNow.now() });
      creates.push("line:" + k);
      return true;
    },
    async linesOfMonth(month) {
      const latest = new Map();
      for (const [k, held] of lines) {
        const [date, rev] = k.split("|");
        if (date.slice(0, 7) !== month || !listed(held.at)) continue;
        if (!latest.has(date) || Number(rev) > latest.get(date).rev) latest.set(date, { rev: Number(rev), json: held.json });
      }
      return [...latest.values()].map((x) => normaliseLineFile(JSON.parse(x.json)));
    },
    async readSpan(id, rev) {
      state.reads += 1;
      const held = spanFiles.get(`${id}|${rev}`);
      if (!held) return null;
      const found = normaliseSpanFile(JSON.parse(held.json));
      if (!found) throw new Error("span file unreadable");
      return found;
    },
    async createSpan(span) {
      if (state.hook) {
        const hook = state.hook;
        state.hook = null;
        await hook();
      }
      const k = `${span.id}|${span.rev}`;
      if (spanFiles.has(k)) return false;
      spanFiles.set(k, { json: JSON.stringify(spanRecord(span)), at: ageNow.now() });
      creates.push("span:" + k);
      return true;
    },
    async spans() {
      const latest = new Map();
      for (const [k, held] of spanFiles) {
        const [id, rev] = k.split("|");
        if (!listed(held.at)) continue;
        if (!latest.has(id) || Number(rev) > latest.get(id).rev) latest.set(id, { rev: Number(rev), json: held.json });
      }
      return [...latest.values()].map((x) => normaliseSpanFile(JSON.parse(x.json)));
    },
    async months() {
      const found = new Set();
      for (const [k, held] of entries) if (listed(held.at)) found.add(monthOfList(k.split("|")[0]));
      return [...found].sort().reverse();
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

// The worst the real store may do, as far as the documentation says. Vercel's
// Blob documentation says an overwritten blob "may take up to 60 seconds to
// propagate through our cache", so a read of a file that was overwritten can
// return what it was up to 60 seconds ago. Here, for lagMs after an overwrite, a
// read returns the file as it was before (or no file at all). That is the quick
// notes file, the only one the journal overwrites; the stand-in applies it to
// every overwrite there is. Listings can lag as well: with listLagMs a file made
// in the last listLagMs does not appear in a listing yet, which is no worse than a
// store that lists a little behind. Creates are strongly consistent, as a create
// of a path that is not there is: one at a path that is taken is refused.
// `now` says what time it is, so a test can move the clock with a fake sleep and a
// browser run can use the real one.
const assert_ok = (v) => { if (!v) throw new Error("preload refused"); };

export function staleJournalStore({ lagMs = 60000, listLagMs = 0, now = () => Date.now() } = {}) {
  const inner = journalMemoryStore();
  inner.ageNow.now = now;
  inner.ageNow.listLagMs = listLagMs;
  const quickTimeline = [];
  const seen = (list) => {
    const visible = list.filter((v) => v.at <= now() - lagMs);
    return visible.length ? visible[visible.length - 1] : null;
  };
  const store = {
    ...inner,
    inner,
    lagMs,
    async readQuick() {
      const view = seen(quickTimeline);
      return view ? { text: view.text, updatedAt: view.updatedAt, tag: view.tag } : { text: "", updatedAt: "none", tag: null };
    },
    async writeQuick(text, updatedAt, tag) {
      const ok = await inner.writeQuick(text, updatedAt, tag);
      if (ok) {
        quickTimeline.push({ at: now(), text, updatedAt, tag: inner.state.quick.tag });
        return inner.state.quick.tag;
      }
      return ok;
    },
    // Puts entries in the store as if they had been there long enough to be listed.
    async preload(list, entry) {
      assert_ok(await inner.createEntry(list, entry));
      const held = inner.entries.get(`${list}|${entry.id}|${entry.rev}`);
      held.at = now() - Math.max(lagMs, listLagMs) - 1;
    },
  };
  return store;
}

export function buildJournal({ password = freshSecret("pw"), store, lagMs, listLagMs, now = NOW, env } = {}) {
  const clock = { now };
  const held = store ?? (lagMs || listLagMs ? staleJournalStore({ lagMs, listLagMs, now: () => clock.now }) : journalMemoryStore());
  const environment = env ?? (password === null ? {} : { [ENVIRONMENT_VARIABLE]: password });
  const sleeps = [];
  // A fake pause moves the clock instead of waiting, so a lagging store catches up.
  // Only quick notes ever pause.
  const sleep = async (ms) => { sleeps.push(ms); clock.now += ms; };
  const api = createJournalApi({ store: held, env: environment, now: () => clock.now, sleep });
  return { api, store: held, password, clock, sleeps, env: environment, cookie: password === null ? undefined : signedInCookie(password) };
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
  const response = await post(t, { op: "add", list, at: (t.clock.now += 1), entry: { id, type, text } });
  if (response.status !== 200) throw new Error("seed add " + response.status);
  return id;
}

export async function entryOf(t, list, id) {
  const month = list.startsWith("day:") ? list.slice(4, 11) : list.slice(8);
  const answer = await (await months(t, month)).json();
  const file = answer.months[month];
  const entries = list.startsWith("migrate:") ? file.migrate : (file.days[list.slice(4)] || { entries: [] }).entries;
  const found = entries.find((e) => e.id === id) || null;
  return found && found.state === "removed" ? null : found;
}
