// The journal's rules, written once. The API applies every change with this file
// and the page applies the same change to its own copy with this file, so the
// page can show a change at once and know the revision the server will give it.
// Two implementations of one rule agree on the day they are written and drift
// apart on the next change (CLAUDE.md section 5, one implementation of any
// judgement), so there is only this one.
//
// Plain functions of plain data. No network, no storage, no clock, no DOM. It
// holds nothing private: it is served to the page like the page itself, so it
// must stay free of anything that is not a rule.
//
// What is stored is one file per entry revision, never a file shared by several
// entries (see api/_lib/journal-store.js). What the page and the API work on is a
// month view built from those, { v: 2, days, migrate }:
//   days     { "YYYY-MM-DD": { line, lineRev, entries } }, a day's calendar line
//            (free text, kept apart from the log) and that day's log
//   migrate  that month's task list
// An entry is { id, type, state, text, rev, order } and, once moved, { to, toId }.
// A removed entry stays in the view as a removed state, so that a device that
// still holds it learns it is gone. Every change to an entry adds one to its rev.
// A change to an existing entry or line names the rev it started from, and a
// stale one changes nothing. Nothing in a view has a version of its own: the
// highest rev of each entry and each line wins when two views are put together.

export const FILE_VERSION = 2;
export const ENTRY_VERSION = 1;
export const MAX_TEXT = 1000;
export const MAX_LINE = 200;
export const MAX_BATCH = 100;
export const MAX_QUICK_BYTES = 256 * 1024;

export const TYPES = ["task", "event", "note"];
export const STATES = ["open", "done", "migrated", "scheduled", "dropped", "removed"];

const ID = /^[0-9a-f]{32}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/* ---------- dates and list names ---------- */

export function isDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function isMonth(value) {
  if (typeof value !== "string" || !MONTH.test(value)) return false;
  const [y, m] = value.split("-").map(Number);
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
}

export const isId = (value) => typeof value === "string" && ID.test(value);
export const monthOf = (date) => date.slice(0, 7);

const pad = (n) => String(n).padStart(2, "0");

export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const dayList = (date) => `day:${date}`;
export const migrateList = (month) => `migrate:${month}`;

// "day:2026-10-22" or "migrate:2026-10" as { kind, date?, month }, or null.
export function parseList(key) {
  if (typeof key !== "string") return null;
  if (key.startsWith("day:") && isDate(key.slice(4))) return { kind: "day", date: key.slice(4), month: monthOf(key.slice(4)) };
  if (key.startsWith("migrate:") && isMonth(key.slice(8))) return { kind: "migrate", month: key.slice(8) };
  return null;
}

/* ---------- views and stored entries ---------- */

export const emptyMonth = () => ({ v: FILE_VERSION, days: {}, migrate: [] });

const isOrder = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;

function soundEntry(e) {
  return (
    e && typeof e === "object" &&
    isId(e.id) && TYPES.includes(e.type) && STATES.includes(e.state) &&
    typeof e.text === "string" && e.text.length <= MAX_TEXT * 2 &&
    Number.isInteger(e.rev) && e.rev >= 1 && isOrder(e.order) &&
    (e.to === undefined || parseList(e.to) !== null) &&
    (e.toId === undefined || isId(e.toId))
  );
}

const keepEntry = (e) => {
  const out = { id: e.id, type: e.type, state: e.state, text: e.text, rev: e.rev, order: e.order };
  if (e.to !== undefined) out.to = e.to;
  if (e.toId !== undefined) out.toId = e.toId;
  return out;
};

// What one stored entry revision holds: { v, list, ...entry }.
export const entryRecord = (list, entry) => ({ v: ENTRY_VERSION, list, ...keepEntry(entry) });

// A stored entry file as { list, entry }, or null when it is not one. A damaged
// file is never skipped as if it were not there: the caller treats null as an error.
export function normaliseEntryFile(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== ENTRY_VERSION || parseList(raw.list) === null || !soundEntry(raw)) return null;
  return { list: raw.list, entry: keepEntry(raw) };
}

// What one stored calendar line revision holds: { v, date, rev, text }.
export const lineRecord = (date, rev, text) => ({ v: ENTRY_VERSION, date, rev, text });

export function normaliseLineFile(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== ENTRY_VERSION || !isDate(raw.date)) return null;
  if (!Number.isInteger(raw.rev) || raw.rev < 1 || typeof raw.text !== "string" || raw.text.length > MAX_LINE * 2) return null;
  return { date: raw.date, rev: raw.rev, text: raw.text };
}

export const cloneMonth = (file) => JSON.parse(JSON.stringify(file));

const byOrder = (a, b) => (a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Month views from stored entries and lines. records are { list, entry } and
// lines are { date, rev, text }; months says which views to build, so a month with
// nothing in it is an empty view and not a missing one. Where two records share an
// entry id the higher rev wins, so a list that shows an older file as well as a
// newer one still gives the newer.
export function viewFrom(months, records, lines = []) {
  const views = {};
  for (const month of months) views[month] = emptyMonth();
  const best = new Map();
  for (const record of records) {
    const held = best.get(record.entry.id);
    if (!held || record.entry.rev > held.entry.rev) best.set(record.entry.id, record);
  }
  for (const { list, entry: held } of best.values()) {
    // A copy, so applying a change to a view never changes the records it came from.
    const entry = keepEntry(held);
    const parsed = parseList(list);
    const file = views[parsed.month];
    if (!file) continue;
    if (parsed.kind === "migrate") file.migrate.push(entry);
    else {
      if (!file.days[parsed.date]) file.days[parsed.date] = { line: "", lineRev: 0, entries: [] };
      file.days[parsed.date].entries.push(entry);
    }
  }
  const bestLine = new Map();
  for (const line of lines) {
    const held = bestLine.get(line.date);
    if (!held || line.rev > held.rev) bestLine.set(line.date, line);
  }
  for (const line of bestLine.values()) {
    const file = views[monthOf(line.date)];
    if (!file) continue;
    if (!file.days[line.date]) file.days[line.date] = { line: "", lineRev: 0, entries: [] };
    file.days[line.date].line = line.text;
    file.days[line.date].lineRev = line.rev;
  }
  for (const file of Object.values(views)) {
    file.migrate.sort(byOrder);
    for (const day of Object.values(file.days)) day.entries.sort(byOrder);
  }
  return views;
}

// Two views of one month put together. Nothing is ever dropped because the other
// view lacks it: a device that has saved an entry keeps it whatever a later read
// shows, and the higher rev of each entry and each line wins, so an older read
// cannot draw over a newer save. A removal arrives as a rev, not as an absence.
export function mergeMonth(current, incoming) {
  if (!current) return incoming ? cloneMonth(incoming) : emptyMonth();
  if (!incoming) return current;
  const out = cloneMonth(current);
  const take = (mine, theirs) => {
    const have = new Map(mine.map((e) => [e.id, e]));
    for (const e of theirs) {
      const held = have.get(e.id);
      if (!held) mine.push(JSON.parse(JSON.stringify(e)));
      else if (e.rev > held.rev) mine[mine.indexOf(held)] = JSON.parse(JSON.stringify(e));
    }
    mine.sort(byOrder);
  };
  take(out.migrate, incoming.migrate);
  for (const [date, day] of Object.entries(incoming.days)) {
    const mine = out.days[date];
    if (!mine) { out.days[date] = JSON.parse(JSON.stringify(day)); continue; }
    if (day.lineRev > mine.lineRev) { mine.line = day.line; mine.lineRev = day.lineRev; }
    take(mine.entries, day.entries);
  }
  return out;
}

// Quick notes carry a time as their version; "none" is before any save.
export const laterStamp = (a, b) => a !== "none" && (b === "none" || a > b);

const isGone = (entry) => entry.state === "removed";

// Entries of a list, for reading, without the removed ones. A day with nothing in
// it has no entry in the view, so this answers an empty list for it.
export function entriesOf(files, key) {
  const parsed = parseList(key);
  const file = parsed && files[parsed.month];
  if (!file) return [];
  const all = parsed.kind === "migrate" ? file.migrate : file.days[parsed.date] ? file.days[parsed.date].entries : [];
  return all.filter((e) => !isGone(e));
}

export const liveEntries = (entries) => entries.filter((e) => !isGone(e));

// Whether a date has anything to show: a calendar line or an entry that is not removed.
export function dayHas(file, date) {
  const day = file && file.days[date];
  return Boolean(day && (day.line !== "" || liveEntries(day.entries).length > 0));
}

export const lineOf = (files, date) => {
  const file = files[monthOf(date)];
  const day = file && file.days[date];
  return day ? { text: day.line, rev: day.lineRev } : { text: "", rev: 0 };
};

function listFor(files, key) {
  const parsed = parseList(key);
  const file = files[parsed.month];
  if (!file) throw new Error("month not loaded: " + parsed.month);
  if (parsed.kind === "migrate") return file.migrate;
  if (!file.days[parsed.date]) file.days[parsed.date] = { line: "", lineRev: 0, entries: [] };
  return file.days[parsed.date].entries;
}

// A day that was only opened to look in leaves nothing behind. A day that has a
// line revision keeps it, because the next change to the line starts from it.
function dropEmptyDays(file) {
  for (const [date, day] of Object.entries(file.days)) {
    if (day.entries.length === 0 && day.line === "" && day.lineRev === 0) delete file.days[date];
  }
}

// A copy's id is worked out from the entry it copies, the revision it was copied
// at and where it goes, so that the same move sent twice, from the page or from
// another device, makes the same copy and never a second one. A hash, not a
// secret: 128 bits of two rounds of mixing, in plain code so the page and the
// server agree without waiting for a browser call.
export function copyIdFor(id, rev, to) {
  const input = `${id}|${rev}|${to}`;
  let h1 = 0x9e3779b9, h2 = 0x243f6a88, h3 = 0xb7e15162, h4 = 0x85ebca6b;
  for (let i = 0; i < input.length; i += 1) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(h1 ^ h2 ^ h3) + hex(h2 ^ h1) + hex(h3 ^ h1) + hex(h4 ^ h1);
}

/* ---------- text ---------- */

// One line. Line breaks and control characters become a space.
export function cleanText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/ {2,}/g, " ").trim();
}

// The bold and strike-through markers in a stored line as pieces of text:
// [{ text, bold, strike }]. A marker with no partner is ordinary text.
export function parseMarks(value) {
  const parts = String(value).split(/(\*\*|~~)/);
  const flags = { "**": false, "~~": false };
  const out = [];
  const push = (text) => {
    if (text === "") return;
    const last = out[out.length - 1];
    if (last && last.bold === flags["**"] && last.strike === flags["~~"]) last.text += text;
    else out.push({ text, bold: flags["**"], strike: flags["~~"] });
  };
  parts.forEach((part, index) => {
    if (part !== "**" && part !== "~~") {
      push(part);
      return;
    }
    if (flags[part]) {
      flags[part] = false;
      return;
    }
    // Opens only when the same marker comes again later.
    const later = parts.slice(index + 1).includes(part);
    if (later) flags[part] = true;
    else push(part);
  });
  return out;
}

// The text with the markers taken out, for a screen reader, a count or a search.
export const plainText = (value) => parseMarks(value).map((p) => p.text).join("");

/* ---------- changes ---------- */

const bad = (message) => message;
const MAX_AT = 9e12;

export function validateOp(op) {
  if (!op || typeof op !== "object" || Array.isArray(op) || typeof op.op !== "string") return bad("not a change");
  const listOk = (key) => parseList(key) !== null;
  const revOk = (n) => Number.isInteger(n) && n >= 1;
  const atOk = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_AT;
  const textOk = (t) => typeof t === "string" && t.length <= MAX_TEXT * 2 && cleanText(t).length >= 1 && cleanText(t).length <= MAX_TEXT;
  const items = () =>
    Array.isArray(op.items) && op.items.length >= 1 && op.items.length <= MAX_BATCH &&
    op.items.every((i) => i && isId(i.id) && revOk(i.rev)) &&
    new Set(op.items.map((i) => i.id)).size === op.items.length;
  switch (op.op) {
    case "add":
      if (!listOk(op.list) || !atOk(op.at) || !op.entry || !isId(op.entry.id) || !TYPES.includes(op.entry.type) || !textOk(op.entry.text)) return bad("add");
      if (op.entry.state !== undefined && !["open", "done"].includes(op.entry.state)) return bad("add");
      if (op.entry.state === "done" && op.entry.type !== "task") return bad("add");
      return null;
    case "edit":
      return listOk(op.list) && isId(op.id) && revOk(op.rev) && textOk(op.text) ? null : bad("edit");
    case "state":
      return listOk(op.list) && isId(op.id) && revOk(op.rev) && ["open", "done"].includes(op.state) ? null : bad("state");
    case "remove":
      return listOk(op.list) && isId(op.id) && revOk(op.rev) ? null : bad("remove");
    case "move":
      if (!listOk(op.from) || !listOk(op.to) || op.from === op.to || !atOk(op.at) || !["migrated", "scheduled"].includes(op.how) || !items()) return bad("move");
      if (op.how === "scheduled" && parseList(op.to).kind !== "day") return bad("move");
      return null;
    case "drop":
      return listOk(op.list) && items() ? null : bad("drop");
    case "undo":
      if (!listOk(op.list) || !isId(op.id) || !revOk(op.rev)) return bad("undo");
      return op.toList === undefined || listOk(op.toList) ? null : bad("undo");
    case "line":
      return isDate(op.date) && Number.isInteger(op.rev) && op.rev >= 0 && typeof op.text === "string" && cleanText(op.text).length <= MAX_LINE && op.text.length <= MAX_LINE * 2
        ? null
        : bad("line");
    default:
      return bad("not a change");
  }
}

// The months a change reads and writes, in the order they must be loaded.
export function monthsFor(op) {
  const months = [];
  const add = (key) => {
    const parsed = parseList(key);
    if (parsed && !months.includes(parsed.month)) months.push(parsed.month);
  };
  switch (op.op) {
    case "move": add(op.from); add(op.to); break;
    case "undo": add(op.list); if (op.toList) add(op.toList); break;
    case "line": add(dayList(op.date)); break;
    default: add(op.list);
  }
  return months;
}

// The stored entries a change starts from, each at the revision the change names:
// [{ list, id, rev }]. An add starts from nothing, so it reads nothing. A line
// change starts from the line revision it names, answered by lineNeeds.
export function needs(op) {
  switch (op.op) {
    case "edit": case "state": case "remove": case "undo":
      return [{ list: op.list, id: op.id, rev: op.rev }];
    case "drop":
      return op.items.map((i) => ({ list: op.list, id: i.id, rev: i.rev }));
    case "move":
      return op.items.map((i) => ({ list: op.from, id: i.id, rev: i.rev }));
    default:
      return [];
  }
}

// The copy an item of a move makes, as { list, id }.
export const copyOf = (op, item) => ({ list: op.to, id: copyIdFor(item.id, item.rev, op.to) });

export const MESSAGES = {
  stale: "This changed on another device. Your text is still on screen. Reload to see the latest, then add it again.",
  undo: "That entry has changed since it moved, so it was not moved back.",
  invalid: "That change could not be read, so it was not saved. Reload the page.",
};

const stale = () => ({ error: { code: "stale", message: MESSAGES.stale } });

const find = (list, id) => list.find((e) => e.id === id);

// Apply one change to the loaded month views, in place. files is { month: view }
// and holds every month monthsFor(op) names, with the entries the change starts
// from in it. Answers { error: { code, message } } with nothing changed, or
// { changed, created } where changed lists the months a write touches and created
// the ids of what was made.
export function applyOp(files, op) {
  const problem = validateOp(op);
  if (problem) return { error: { code: "invalid", message: MESSAGES.invalid } };

  switch (op.op) {
    case "add": {
      const list = listFor(files, op.list);
      const month = parseList(op.list).month;
      const text = cleanText(op.entry.text);
      const existing = find(list, op.entry.id);
      // The same add sent again, after a lost answer, is not added twice.
      if (existing) {
        const same = existing.type === op.entry.type && existing.text === text;
        dropEmptyDays(files[month]);
        return same ? { changed: [], created: [existing.id] } : { error: { code: "invalid", message: MESSAGES.invalid } };
      }
      list.push({ id: op.entry.id, type: op.entry.type, state: op.entry.state || "open", text, rev: 1, order: op.at * 1000 });
      return { changed: [month], created: [op.entry.id] };
    }

    case "edit":
    case "state":
    case "remove": {
      const month = parseList(op.list).month;
      const list = listFor(files, op.list);
      const entry = find(list, op.id);
      // The same change sent again after its answer was lost has already happened.
      // Deleting what is already gone is done, not a clash.
      const repeat =
        (op.op === "remove" && (!entry || (isGone(entry) && entry.rev === op.rev + 1))) ||
        (entry && entry.rev === op.rev + 1 &&
          ((op.op === "edit" && entry.text === cleanText(op.text)) ||
           (op.op === "state" && entry.type === "task" && entry.state === op.state)));
      if (repeat) {
        dropEmptyDays(files[month]);
        return { changed: [], created: [] };
      }
      const live = entry && (entry.state === "open" || entry.state === "done");
      if (!live || entry.rev !== op.rev || (op.op === "state" && entry.type !== "task")) {
        dropEmptyDays(files[month]);
        return stale();
      }
      if (op.op === "edit") {
        const text = cleanText(op.text);
        if (text === entry.text) { dropEmptyDays(files[month]); return { changed: [], created: [] }; }
        entry.text = text;
        entry.rev += 1;
      } else if (op.op === "state") {
        if (entry.state === op.state) return { changed: [], created: [] };
        entry.state = op.state;
        entry.rev += 1;
      } else {
        entry.state = "removed";
        entry.rev += 1;
      }
      dropEmptyDays(files[month]);
      return { changed: [month], created: [] };
    }

    case "drop": {
      const month = parseList(op.list).month;
      const list = listFor(files, op.list);
      const entries = op.items.map((item) => ({ item, entry: find(list, item.id) }));
      const done = ({ item, entry }) => entry && entry.state === "dropped" && entry.rev === item.rev + 1;
      if (entries.some((x) => !done(x) && (!x.entry || x.entry.rev !== x.item.rev || x.entry.type !== "task" || x.entry.state !== "open"))) {
        dropEmptyDays(files[month]);
        return stale();
      }
      const todo = entries.filter((x) => !done(x));
      for (const { entry } of todo) {
        entry.state = "dropped";
        entry.rev += 1;
      }
      if (todo.length === 0) return { changed: [], created: [] };
      return { changed: [month], created: [] };
    }

    case "move": {
      const from = parseList(op.from);
      const to = parseList(op.to);
      const source = listFor(files, op.from);
      const target = listFor(files, op.to);
      const clean = () => { dropEmptyDays(files[from.month]); dropEmptyDays(files[to.month]); };
      const entries = op.items.map((item, index) => ({ item, index, entry: find(source, item.id), copyId: copyOf(op, item).id }));
      // An item whose move already happened (the same copy, the same target) is
      // done: a repeat of a change whose answer was lost makes no second copy.
      const done = ({ entry, copyId, item }) =>
        entry && entry.state === op.how && entry.to === op.to && entry.toId === copyId && entry.rev === item.rev + 1;
      if (entries.some((x) => !done(x) && (!x.entry || x.entry.rev !== x.item.rev || x.entry.state !== "open"))) {
        clean();
        return stale();
      }
      // A copy that is already there was made by an earlier try of this same
      // change, so it is kept and not made again. One that is missing is made.
      const fresh = entries.filter((x) => !find(target, x.copyId));
      for (const { entry, index, copyId } of fresh) {
        target.push({ id: copyId, type: entry.type, state: "open", text: entry.text, rev: 1, order: op.at * 1000 + 1 + index });
      }
      const todo = entries.filter((x) => !done(x));
      for (const { entry, copyId } of todo) {
        entry.state = op.how;
        entry.to = op.to;
        entry.toId = copyId;
        entry.rev += 1;
      }
      clean();
      const created = entries.map((x) => x.copyId);
      const changed = [];
      if (fresh.length > 0) changed.push(to.month);
      if (todo.length > 0 && !changed.includes(from.month)) changed.push(from.month);
      return { changed, created };
    }

    case "undo": {
      const from = parseList(op.list);
      const source = listFor(files, op.list);
      const entry = find(source, op.id);
      const movable = entry && (entry.state === "migrated" || entry.state === "scheduled");
      // Already undone: a repeat after a lost answer.
      if (entry && entry.state === "open" && entry.rev === op.rev + 1 && entry.to === undefined) {
        dropEmptyDays(files[from.month]);
        return { changed: [], created: [] };
      }
      if (!entry || entry.rev !== op.rev || !(movable || entry.state === "dropped")) {
        dropEmptyDays(files[from.month]);
        return stale();
      }
      const changed = [];
      if (movable) {
        const to = parseList(entry.to);
        if (op.toList !== entry.to || !files[to.month]) {
          dropEmptyDays(files[from.month]);
          return stale();
        }
        const target = listFor(files, entry.to);
        const copy = find(target, entry.toId);
        // Only a copy nobody has touched is taken back. One that was ticked,
        // edited, moved or deleted is someone's work, and stays. One that is
        // already removed was taken back by an earlier try of this same change.
        if (!copy || (!isGone(copy) && (copy.rev !== 1 || copy.state !== "open"))) {
          dropEmptyDays(files[from.month]);
          dropEmptyDays(files[to.month]);
          return { error: { code: "undo", message: MESSAGES.undo } };
        }
        if (!isGone(copy)) {
          copy.state = "removed";
          copy.rev += 1;
          changed.push(to.month);
        }
        dropEmptyDays(files[to.month]);
        delete entry.to;
        delete entry.toId;
      }
      entry.state = "open";
      entry.rev += 1;
      if (!changed.includes(from.month)) changed.push(from.month);
      dropEmptyDays(files[from.month]);
      return { changed, created: [] };
    }

    case "line": {
      const month = monthOf(op.date);
      const file = files[month];
      const day = file.days[op.date] || { line: "", lineRev: 0, entries: [] };
      const text = cleanText(op.text);
      if (day.lineRev === op.rev + 1 && day.line === text) return { changed: [], created: [] };
      if (day.lineRev !== op.rev) return stale();
      if (text === day.line) return { changed: [], created: [] };
      day.line = text;
      day.lineRev += 1;
      file.days[op.date] = day;
      dropEmptyDays(file);
      return { changed: [month], created: [] };
    }

    default:
      return { error: { code: "invalid", message: MESSAGES.invalid } };
  }
}

// What a change wrote, as the files to store: every entry whose rev went up or
// that is new, as { list, entry }, and every line whose rev went up, as
// { date, rev, text }. before is a clone of the views taken before applyOp.
export function writesFor(before, after) {
  const was = new Map();
  const lineWas = new Map();
  const walk = (files, onEntry, onLine) => {
    for (const [month, file] of Object.entries(files)) {
      file.migrate.forEach((e) => onEntry(migrateList(month), e));
      for (const [date, day] of Object.entries(file.days)) {
        day.entries.forEach((e) => onEntry(dayList(date), e));
        onLine(date, day);
      }
    }
  };
  walk(before, (list, e) => was.set(e.id, e.rev), (date, day) => lineWas.set(date, day.lineRev));
  const entries = [];
  const lines = [];
  walk(
    after,
    (list, e) => { if (!was.has(e.id) || e.rev > was.get(e.id)) entries.push({ list, entry: keepEntry(e) }); },
    (date, day) => { if (day.lineRev > (lineWas.get(date) || 0)) lines.push({ date, rev: day.lineRev, text: day.line }); },
  );
  return { entries, lines };
}

// Takes back copies a move made before the rest of it was refused. Only a copy
// nobody has touched (revision 1, still open) is taken back, by removing it.
// Not a change a caller can ask for, so it is not an op: the API uses it on a
// move that could not be finished.
export function discardCopies(files, listKey, ids) {
  const file = files[parseList(listKey).month];
  const list = listFor(files, listKey);
  let removed = 0;
  for (const id of ids) {
    const copy = find(list, id);
    if (copy && copy.rev === 1 && copy.state === "open") {
      copy.state = "removed";
      copy.rev += 1;
      removed += 1;
    }
  }
  dropEmptyDays(file);
  return removed;
}

/* ---------- the morning strip ---------- */

export const isOpenTask = (entry) => entry.type === "task" && entry.state === "open";

// The most recent day before `before` that has any open task, as
// { date, list, tasks }, or null. Looks only in the one file.
export function dailyGroup(file, before) {
  const dates = Object.keys(file.days).filter((d) => d < before).sort().reverse();
  for (const date of dates) {
    const tasks = file.days[date].entries.filter(isOpenTask);
    if (tasks.length > 0) return { date, list: dayList(date), tasks };
  }
  return null;
}

// A month's open Migrate tasks as { month, list, tasks }, or null.
export function monthlyGroup(file, month) {
  const tasks = file.migrate.filter(isOpenTask);
  return tasks.length > 0 ? { month, list: migrateList(month), tasks } : null;
}

// Both groups from whatever months are loaded. Nothing here moves anything: it
// only says what is waiting, and the person chooses.
export function stripFrom(files, today) {
  const thisMonth = monthOf(today);
  const earlier = Object.keys(files).filter((m) => m < thisMonth).sort().reverse();
  let daily = files[thisMonth] ? dailyGroup(files[thisMonth], today) : null;
  for (const month of earlier) {
    if (daily) break;
    daily = dailyGroup(files[month], "9999-99-99");
  }
  let monthly = null;
  for (const month of earlier) {
    monthly = monthlyGroup(files[month], month);
    if (monthly) break;
  }
  return { daily, monthly };
}
