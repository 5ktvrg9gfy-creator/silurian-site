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
// A month file is { v: 1, rev, days, migrate }:
//   days     { "YYYY-MM-DD": { line, lineRev, entries } }, a day's calendar line
//            (free text, kept apart from the log) and that day's log
//   migrate  that month's task list
// An entry is { id, type, state, text, rev } and, once moved, { to, toId }.
// Every change to an entry adds one to its rev. A change to an existing entry
// or line names the rev it started from, and a stale one changes nothing.

export const FILE_VERSION = 1;
export const MAX_TEXT = 1000;
export const MAX_LINE = 200;
export const MAX_ENTRIES_PER_LIST = 500;
export const MAX_BATCH = 100;
export const MAX_QUICK_BYTES = 256 * 1024;

export const TYPES = ["task", "event", "note"];
export const STATES = ["open", "done", "migrated", "scheduled", "dropped"];

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

/* ---------- the file ---------- */

export const emptyMonth = () => ({ v: FILE_VERSION, rev: 0, days: {}, migrate: [] });

function soundEntry(e) {
  return (
    e && typeof e === "object" &&
    isId(e.id) && TYPES.includes(e.type) && STATES.includes(e.state) &&
    typeof e.text === "string" && e.text.length <= MAX_TEXT * 2 &&
    Number.isInteger(e.rev) && e.rev >= 1 &&
    (e.to === undefined || parseList(e.to) !== null) &&
    (e.toId === undefined || isId(e.toId))
  );
}

const keepEntry = (e) => {
  const out = { id: e.id, type: e.type, state: e.state, text: e.text, rev: e.rev };
  if (e.to !== undefined) out.to = e.to;
  if (e.toId !== undefined) out.toId = e.toId;
  return out;
};

// A month file read from storage, or null when it is not one. A damaged file is
// never treated as an empty one, because the next change would overwrite it.
export function normaliseMonth(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== FILE_VERSION) return null;
  if (!Number.isInteger(raw.rev) || raw.rev < 0) return null;
  if (!raw.days || typeof raw.days !== "object" || Array.isArray(raw.days)) return null;
  if (!Array.isArray(raw.migrate) || !raw.migrate.every(soundEntry)) return null;
  const days = {};
  for (const [date, day] of Object.entries(raw.days)) {
    if (!isDate(date) || !day || typeof day.line !== "string" || !Number.isInteger(day.lineRev) || day.lineRev < 0) return null;
    if (!Array.isArray(day.entries) || !day.entries.every(soundEntry)) return null;
    days[date] = { line: day.line, lineRev: day.lineRev, entries: day.entries.map(keepEntry) };
  }
  return { v: FILE_VERSION, rev: raw.rev, days, migrate: raw.migrate.map(keepEntry) };
}

export const cloneMonth = (file) => JSON.parse(JSON.stringify(file));

// Versions only go up. A file read from the store may be older than one this
// device has already seen (a store can show a file as it was a few seconds ago),
// and an older file must never replace a newer one. Equal is the same file.
export const isNewer = (current, incoming) => !current || (incoming && incoming.rev >= current.rev);

// Quick notes carry a time as their version; "none" is before any save.
export const laterStamp = (a, b) => a !== "none" && (b === "none" || a > b);

// Entries of a list, for reading. A day with nothing in it has no entry in the
// file, so this answers an empty list for it.
export function entriesOf(files, key) {
  const parsed = parseList(key);
  const file = parsed && files[parsed.month];
  if (!file) return [];
  if (parsed.kind === "migrate") return file.migrate;
  return file.days[parsed.date] ? file.days[parsed.date].entries : [];
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

function dropEmptyDays(file) {
  for (const [date, day] of Object.entries(file.days)) {
    if (day.entries.length === 0 && day.line === "") delete file.days[date];
  }
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

export function validateOp(op) {
  if (!op || typeof op !== "object" || Array.isArray(op) || typeof op.op !== "string") return bad("not a change");
  const listOk = (key) => parseList(key) !== null;
  const revOk = (n) => Number.isInteger(n) && n >= 1;
  const textOk = (t) => typeof t === "string" && t.length <= MAX_TEXT * 2 && cleanText(t).length >= 1 && cleanText(t).length <= MAX_TEXT;
  const items = (needCopy) =>
    Array.isArray(op.items) && op.items.length >= 1 && op.items.length <= MAX_BATCH &&
    op.items.every((i) => i && isId(i.id) && revOk(i.rev) && (!needCopy || isId(i.copyId))) &&
    new Set(op.items.map((i) => i.id)).size === op.items.length &&
    (!needCopy || new Set(op.items.map((i) => i.copyId)).size === op.items.length);
  switch (op.op) {
    case "add":
      if (!listOk(op.list) || !op.entry || !isId(op.entry.id) || !TYPES.includes(op.entry.type) || !textOk(op.entry.text)) return bad("add");
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
      if (!listOk(op.from) || !listOk(op.to) || op.from === op.to || !["migrated", "scheduled"].includes(op.how) || !items(true)) return bad("move");
      if (op.how === "scheduled" && parseList(op.to).kind !== "day") return bad("move");
      return null;
    case "drop":
      return listOk(op.list) && items(false) ? null : bad("drop");
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

export const MESSAGES = {
  stale: "This changed on another device. Your text is still on screen. Reload to see the latest, then add it again.",
  undo: "That entry has changed since it moved, so it was not moved back.",
  limit: "That list is full, so nothing was added. Move or delete some entries first.",
  invalid: "That change could not be read, so it was not saved. Reload the page.",
};

const stale = () => ({ error: { code: "stale", message: MESSAGES.stale } });

const find = (list, id) => list.find((e) => e.id === id);

function touch(file) {
  file.rev += 1;
}

// Apply one change to the loaded month files, in place. files is { month: file }
// and holds every month monthsFor(op) names. Answers { error: { code, message } }
// with nothing changed, or { changed, created } where changed lists the months
// whose files must be written, the month that receives a copy before the month
// that gives it up, so a failure between the two writes leaves a duplicate and
// never a lost entry.
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
      if (list.length >= MAX_ENTRIES_PER_LIST) {
        dropEmptyDays(files[month]);
        return { error: { code: "limit", message: MESSAGES.limit } };
      }
      list.push({ id: op.entry.id, type: op.entry.type, state: op.entry.state || "open", text, rev: 1 });
      touch(files[month]);
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
        (op.op === "remove" && !entry) ||
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
        list.splice(list.indexOf(entry), 1);
      }
      dropEmptyDays(files[month]);
      touch(files[month]);
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
      touch(files[month]);
      return { changed: [month], created: [] };
    }

    case "move": {
      const from = parseList(op.from);
      const to = parseList(op.to);
      const source = listFor(files, op.from);
      const target = listFor(files, op.to);
      const clean = () => { dropEmptyDays(files[from.month]); dropEmptyDays(files[to.month]); };
      const entries = op.items.map((item) => ({ item, entry: find(source, item.id) }));
      // An item whose move already happened (the same copy id, the same target) is
      // done: a repeat of a change whose answer was lost makes no second copy.
      const done = ({ item, entry }) =>
        entry && entry.state === op.how && entry.to === op.to && entry.toId === item.copyId && entry.rev === item.rev + 1;
      if (entries.some((x) => !done(x) && (!x.entry || x.entry.rev !== x.item.rev || x.entry.state !== "open"))) {
        clean();
        return stale();
      }
      // A copy that is already there was made by an earlier try of this same
      // change, so it is kept and not made again. One that is missing is made.
      const fresh = entries.filter(({ item }) => !find(target, item.copyId));
      if (target.length + fresh.length > MAX_ENTRIES_PER_LIST) {
        clean();
        return { error: { code: "limit", message: MESSAGES.limit } };
      }
      for (const { entry, item } of fresh) {
        target.push({ id: item.copyId, type: entry.type, state: "open", text: entry.text, rev: 1 });
      }
      const todo = entries.filter((x) => !done(x));
      for (const { entry, item } of todo) {
        entry.state = op.how;
        entry.to = op.to;
        entry.toId = item.copyId;
        entry.rev += 1;
      }
      clean();
      const created = op.items.map((i) => i.copyId);
      if (todo.length === 0 && fresh.length === 0) return { changed: [], created };
      const changed = [];
      if (fresh.length > 0) {
        touch(files[to.month]);
        if (to.month !== from.month) changed.push(to.month);
      }
      if (todo.length > 0) {
        if (to.month === from.month && fresh.length > 0) { /* one file, touched once above */ } else { touch(files[from.month]); }
        changed.push(from.month);
      } else if (to.month === from.month) {
        changed.push(from.month);
      }
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
      let changed = [from.month];
      if (movable) {
        const to = parseList(entry.to);
        if (op.toList !== entry.to || !files[to.month]) {
          dropEmptyDays(files[from.month]);
          return stale();
        }
        const target = listFor(files, entry.to);
        const copy = find(target, entry.toId);
        // Only a copy nobody has touched is taken back. One that was ticked,
        // edited, moved or deleted is someone's work, and stays.
        if (!copy || copy.rev !== 1 || copy.state !== "open") {
          dropEmptyDays(files[from.month]);
          dropEmptyDays(files[to.month]);
          return { error: { code: "undo", message: MESSAGES.undo } };
        }
        target.splice(target.indexOf(copy), 1);
        dropEmptyDays(files[to.month]);
        touch(files[to.month]);
        changed = to.month === from.month ? [from.month] : [to.month, from.month];
        delete entry.to;
        delete entry.toId;
      }
      entry.state = "open";
      entry.rev += 1;
      touch(files[from.month]);
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
      touch(file);
      return { changed: [month], created: [] };
    }

    default:
      return { error: { code: "invalid", message: MESSAGES.invalid } };
  }
}

// Takes back copies a move wrote before the rest of it was refused. Only a copy
// nobody has touched (revision 1, still open) is removed. Not a change a caller
// can ask for, so it is not an op: the API uses it on a failed move.
export function discardCopies(files, listKey, ids) {
  const parsed = parseList(listKey);
  const file = files[parsed.month];
  const list = listFor(files, listKey);
  let removed = 0;
  for (const id of ids) {
    const copy = find(list, id);
    if (copy && copy.rev === 1 && copy.state === "open") {
      list.splice(list.indexOf(copy), 1);
      removed += 1;
    }
  }
  dropEmptyDays(file);
  if (removed > 0) touch(file);
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
