// The journal's rules, in journal/core.js, held without a server or a page.
// The API and the page both apply a change with this one file, so this is where
// a rule is proved; the API tests prove the wiring and the browser run proves
// the page.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as core from "../journal/core.js";
import { newId } from "./journal-helpers.js";

const OCT = "2026-10";
const NOV = "2026-11";
const today = "2026-10-22";

const files = (...months) => Object.fromEntries(months.map((m) => [m, core.emptyMonth()]));
// The page's clock, as it stamps each add and move: one tick later every time.
let tick = 1_800_000_000_000;
const at = () => (tick += 1);
const add = (f, list, text, type = "task", state) => {
  const id = newId();
  const result = core.applyOp(f, { op: "add", list, at: at(), entry: { id, type, text, ...(state ? { state } : {}) } });
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  return id;
};
const entry = (f, list, id) => core.entriesOf(f, list).find((e) => e.id === id);
const moveOf = (from, to, how, ...items) => ({ op: "move", from, to, how, at: at(), items });
const copyOf = (id, rev, to) => core.copyIdFor(id, rev, to);
const snapshot = (f) => JSON.stringify(f);

test("dates, months and list names are checked, not trusted", () => {
  assert.ok(core.isDate("2026-02-28"));
  assert.ok(!core.isDate("2026-02-30"), "no 30 February");
  assert.ok(!core.isDate("2026-2-3") && !core.isDate("26-02-03") && !core.isDate(20260203) && !core.isDate("1999-01-01"));
  assert.ok(core.isMonth("2026-12") && !core.isMonth("2026-13") && !core.isMonth("2026-00"));
  assert.deepEqual(core.parseList("day:2026-10-22"), { kind: "day", date: "2026-10-22", month: OCT });
  assert.deepEqual(core.parseList("migrate:2026-10"), { kind: "migrate", month: OCT });
  for (const bad of ["day:2026-13-01", "migrate:2026-10-01", "notes:2026-10", "", null, 5, "day:"]) assert.equal(core.parseList(bad), null, String(bad));
  assert.equal(core.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(core.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(core.addMonths("2026-12", 1), "2027-01");
  assert.equal(core.addMonths("2026-01", -1), "2025-12");
  assert.equal(core.daysInMonth("2028-02"), 29);
});

test("an entry is added at the bottom with revision 1, and the same add sent twice is added once", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const first = add(f, list, "  First   task ");
  const second = add(f, list, "Second", "event");
  assert.deepEqual(core.entriesOf(f, list).map((e) => e.id), [first, second]);
  const stored = entry(f, list, first);
  assert.deepEqual({ ...stored, order: 0 }, { id: first, type: "task", state: "open", text: "First task", rev: 1, order: 0 });
  assert.ok(entry(f, list, second).order > stored.order, "each entry sorts after the one added before it");
  const before = snapshot(f);
  const again = core.applyOp(f, { op: "add", list, at: at(), entry: { id: first, type: "task", text: "First task" } });
  assert.deepEqual(again.changed, [], "nothing to write");
  assert.equal(snapshot(f), before);
  const clash = core.applyOp(f, { op: "add", list, at: at(), entry: { id: first, type: "task", text: "Different" } });
  assert.equal(clash.error.code, "invalid", "an id is never reused for other text");
});

test("a line break or control character in an entry becomes a space", () => {
  const f = files(OCT);
  const id = add(f, core.dayList(today), "one\ntwo\tthree\u0007four");
  assert.equal(entry(f, core.dayList(today), id).text, "one two three four");
});

test("an add starts from nothing and reads nothing, and no list is read to be counted", () => {
  const id = newId();
  assert.deepEqual(core.needs({ op: "add", list: core.dayList(today), at: at(), entry: { id, type: "task", text: "x" } }), []);
  const f = files(OCT);
  const list = core.migrateList(OCT);
  for (let i = 0; i < 600; i += 1) add(f, list, "t" + i);
  assert.equal(f[OCT].migrate.length, 600, "there is no per-list limit to count against, because that would mean reading the list first");
});

test("every change to an existing entry names its revision, and a stale one changes nothing", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Ring the supplier");
  const other = add(f, list, "Book the van", "event");

  const tick = core.applyOp(f, { op: "state", list, id, rev: 1, state: "done" });
  assert.deepEqual(tick.changed, [OCT]);
  assert.equal(entry(f, list, id).state, "done");
  assert.equal(entry(f, list, id).rev, 2, "one added per change");
  assert.equal(entry(f, list, other).rev, 1, "another entry is untouched");

  const before = snapshot(f);
  for (const op of [
    { op: "state", list, id, rev: 1, state: "open" },
    { op: "edit", list, id, rev: 1, text: "changed" },
    { op: "remove", list, id, rev: 1 },
    { op: "state", list, id: newId(), rev: 1, state: "done" },
  ]) {
    const result = core.applyOp(f, op);
    assert.equal(result.error.code, "stale", op.op);
    assert.equal(result.error.message, core.MESSAGES.stale);
    assert.equal(snapshot(f), before, op.op + " wrote something");
  }
  assert.equal(core.applyOp(f, { op: "state", list, id: other, rev: 1, state: "done" }).error.code, "stale", "an event cannot be ticked");
  assert.equal(snapshot(f), before);
});

test("edit and remove: a removed entry stays as a removed revision and is not shown", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Draft");
  assert.deepEqual(core.applyOp(f, { op: "edit", list, id, rev: 1, text: "Draft" }).changed, [], "the same text is no change and gets no new revision");
  assert.equal(entry(f, list, id).rev, 1);
  core.applyOp(f, { op: "edit", list, id, rev: 1, text: "Final **copy**" });
  assert.equal(entry(f, list, id).text, "Final **copy**");
  assert.equal(entry(f, list, id).rev, 2);
  const removed = core.applyOp(f, { op: "remove", list, id, rev: 2 });
  assert.deepEqual(removed.changed, [OCT]);
  assert.equal(f[OCT].days[today].entries[0].state, "removed", "kept as a revision, so another device learns it is gone");
  assert.equal(f[OCT].days[today].entries[0].rev, 3);
  assert.deepEqual(core.entriesOf(f, list), [], "and not shown");
  assert.equal(core.dayHas(f[OCT], today), false);
});

test("an entry that has moved, dropped or been ticked cannot be edited or removed as if it were open", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Moved");
  core.applyOp(f, moveOf(list, core.dayList("2026-10-23"), "migrated", { id, rev: 1 }));
  assert.equal(core.applyOp(f, { op: "edit", list, id, rev: 2, text: "x" }).error.code, "stale");
  assert.equal(core.applyOp(f, { op: "remove", list, id, rev: 2 }).error.code, "stale");
});

test("a move leaves the original in place with its arrow and puts a copy at the bottom of the target", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const to = core.dayList("2026-10-23");
  const keep = add(f, to, "Already there");
  const id = add(f, from, "Chase the invoice");
  const copyId = copyOf(id, 1, to);
  const result = core.applyOp(f, moveOf(from, to, "migrated", { id, rev: 1 }));
  assert.deepEqual(result.created, [copyId], "the copy's id is worked out, not chosen");

  const original = entry(f, from, id);
  assert.equal(original.state, "migrated", "right arrow");
  assert.equal(original.to, to);
  assert.equal(original.toId, copyId);
  assert.equal(original.rev, 2);
  assert.equal(original.text, "Chase the invoice", "the original stays, greyed");

  const target = core.entriesOf(f, to);
  assert.deepEqual(target.map((e) => e.id), [keep, copyId], "at the bottom");
  assert.deepEqual({ ...target[1], order: 0 }, { id: copyId, type: "task", state: "open", text: "Chase the invoice", rev: 1, order: 0 });
  assert.ok(target[1].order > target[0].order, "and sorts after what was there");
});

test("a move to a date is scheduled, a left arrow, and only a date can be scheduled", () => {
  const f = files(OCT);
  const from = core.migrateList(OCT);
  const id = add(f, from, "Renew the licence");
  const toMigrate = core.applyOp(f, moveOf(core.dayList(today), from, "scheduled", { id, rev: 1 }));
  assert.equal(toMigrate.error.code, "invalid", "scheduling to a Migrate list is not a thing");
  const copyId = copyOf(id, 1, core.dayList("2026-10-28"));
  core.applyOp(f, moveOf(from, core.dayList("2026-10-28"), "scheduled", { id, rev: 1 }));
  assert.equal(entry(f, from, id).state, "scheduled");
  assert.equal(entry(f, core.dayList("2026-10-28"), copyId).state, "open");
});

test("events and notes move too, and keep their type", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const event = add(f, from, "Supplier call", "event");
  const note = add(f, from, "Ask about pallets", "note");
  core.applyOp(f, moveOf(from, core.dayList("2026-10-23"), "migrated", { id: event, rev: 1 }, { id: note, rev: 1 }));
  assert.deepEqual(core.entriesOf(f, core.dayList("2026-10-23")).map((e) => e.type), ["event", "note"]);
});

test("only an open entry moves: done, dropped, migrated and scheduled ones do not", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const done = add(f, list, "Done one");
  core.applyOp(f, { op: "state", list, id: done, rev: 1, state: "done" });
  const dropped = add(f, list, "Dropped one");
  core.applyOp(f, { op: "drop", list, items: [{ id: dropped, rev: 1 }] });
  const before = snapshot(f);
  for (const [id, rev] of [[done, 2], [dropped, 2]]) {
    const result = core.applyOp(f, moveOf(list, core.dayList("2026-10-23"), "migrated", { id, rev }));
    assert.equal(result.error.code, "stale");
  }
  assert.equal(snapshot(f), before);
});

test("a move of several entries is all or nothing", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const a = add(f, from, "A");
  const b = add(f, from, "B");
  core.applyOp(f, { op: "state", list: from, id: b, rev: 1, state: "done" });
  const before = snapshot(f);
  const result = core.applyOp(f, moveOf(from, core.dayList("2026-10-23"), "migrated", { id: a, rev: 1 }, { id: b, rev: 1 }));
  assert.equal(result.error.code, "stale", "one stale item refuses the lot");
  assert.equal(snapshot(f), before, "and A was not moved either");
});

test("a move across months makes the copy first, and a repeat makes no second copy", () => {
  const f = files(OCT, NOV);
  const from = core.migrateList(OCT);
  const to = core.migrateList(NOV);
  const id = add(f, from, "Carry me");
  const copyId = copyOf(id, 1, to);
  const op = moveOf(from, to, "migrated", { id, rev: 1 });
  const before = JSON.parse(JSON.stringify(f));
  const first = core.applyOp(f, op);
  assert.deepEqual(first.changed, [NOV, OCT], "the copy is made before the original is marked");
  const wrote = core.writesFor(before, f);
  assert.deepEqual(wrote.entries.map((w) => [w.list, w.entry.id, w.entry.rev]).sort(), [[from, id, 2], [to, copyId, 1]].sort());

  // The create of the original failed and the whole change is tried again from
  // a fresh read: November already has the copy, October still has the original.
  const retry = { [OCT]: core.emptyMonth(), [NOV]: JSON.parse(JSON.stringify(f[NOV])) };
  retry[OCT].migrate.push({ id, type: "task", state: "open", text: "Carry me", rev: 1, order: 1 });
  const again = core.applyOp(retry, op);
  assert.deepEqual(again.changed, [OCT], "November is not written again");
  assert.equal(retry[NOV].migrate.length, 1, "one copy, not two");
  assert.equal(retry[OCT].migrate[0].state, "migrated");
});

test("a move to the same list is refused", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "x");
  const result = core.applyOp(f, moveOf(list, list, "migrated", { id, rev: 1 }));
  assert.equal(result.error.code, "invalid");
});

test("drop strikes an open task and keeps it; it never drops an event or a note", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const task = add(f, list, "Not needed now");
  const event = add(f, list, "Lunch", "event");
  assert.equal(core.applyOp(f, { op: "drop", list, items: [{ id: event, rev: 1 }] }).error.code, "stale");
  core.applyOp(f, { op: "drop", list, items: [{ id: task, rev: 1 }] });
  assert.equal(entry(f, list, task).state, "dropped");
  assert.equal(entry(f, list, task).text, "Not needed now", "kept, not deleted");
});

test("undo puts a moved entry back and takes the copy away, only while the copy is untouched", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const to = core.dayList("2026-10-23");
  const id = add(f, from, "Maybe tomorrow");
  const copyId = copyOf(id, 1, to);
  core.applyOp(f, moveOf(from, to, "migrated", { id, rev: 1 }));
  const result = core.applyOp(f, { op: "undo", list: from, id, rev: 2, toList: to });
  assert.deepEqual(result.changed, [OCT]);
  assert.equal(entry(f, from, id).state, "open");
  assert.equal(entry(f, from, id).to, undefined);
  assert.equal(entry(f, from, id).rev, 3);
  assert.deepEqual(core.entriesOf(f, to), [], "the copy is gone from the day");
  assert.equal(f[OCT].days["2026-10-23"].entries[0].state, "removed", "as a removed revision");
  assert.equal(f[OCT].days["2026-10-23"].entries[0].id, copyId);

  // Now again, to the same place: the copy is a new one, because the entry is at a new revision.
  const second = copyOf(id, 3, to);
  assert.notEqual(second, copyId, "a move after an undo does not meet the removed copy");
  core.applyOp(f, moveOf(from, to, "migrated", { id, rev: 3 }));
  core.applyOp(f, { op: "state", list: to, id: second, rev: 1, state: "done" });
  const before = snapshot(f);
  const refused = core.applyOp(f, { op: "undo", list: from, id, rev: 4, toList: to });
  assert.equal(refused.error.code, "undo");
  assert.equal(refused.error.message, core.MESSAGES.undo);
  assert.equal(snapshot(f), before, "work done on the copy is never thrown away");
});

test("undo of a drop reopens the task; undo from a stale revision does nothing", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Dropped by mistake");
  core.applyOp(f, { op: "drop", list, items: [{ id, rev: 1 }] });
  assert.equal(core.applyOp(f, { op: "undo", list, id, rev: 1 }).error.code, "stale");
  core.applyOp(f, { op: "undo", list, id, rev: 2 });
  assert.equal(entry(f, list, id).state, "open");
  assert.equal(core.applyOp(f, { op: "undo", list, id, rev: 3 }).error.code, "stale", "an open entry has nothing to undo");
});

test("the calendar line is separate from the log and has its own revision", () => {
  const f = files(OCT);
  const date = "2026-10-23";
  const log = add(f, core.dayList(date), "A task for that day");
  assert.deepEqual(core.lineOf(f, date), { text: "", rev: 0 });
  core.applyOp(f, { op: "line", date, rev: 0, text: " Dentist 9:30 " });
  assert.deepEqual(core.lineOf(f, date), { text: "Dentist 9:30", rev: 1 });
  assert.equal(core.entriesOf(f, core.dayList(date)).length, 1, "the log is untouched by the line");
  assert.equal(entry(f, core.dayList(date), log).rev, 1);
  const before = snapshot(f);
  assert.equal(core.applyOp(f, { op: "line", date, rev: 0, text: "Stale" }).error.code, "stale");
  assert.equal(snapshot(f), before);
  core.applyOp(f, { op: "line", date, rev: 1, text: "" });
  assert.equal(core.lineOf(f, date).text, "");
  core.applyOp(f, { op: "remove", list: core.dayList(date), id: log, rev: 1 });
  assert.equal(core.dayHas(f[OCT], date), false, "a cleared line and a removed log leave nothing to show");
  assert.equal(f[OCT].days[date].lineRev, 2, "and the line keeps its revision, because the next change to it starts from there");
});

test("bad changes are refused before they touch anything", () => {
  const f = files(OCT);
  const id = newId();
  const bad = [
    null, [], "add", { op: "unknown" }, { op: "add" },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "task", text: "x" } },
    { op: "add", list: "day:2026-10-22", at: -1, entry: { id, type: "task", text: "x" } },
    { op: "add", list: "day:2026-10-22", at: 1.5, entry: { id, type: "task", text: "x" } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id: "short", type: "task", text: "x" } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id, type: "memo", text: "x" } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id, type: "task", text: "   " } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id, type: "task", text: "x".repeat(core.MAX_TEXT + 1) } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id, type: "event", text: "x", state: "done" } },
    { op: "add", list: "day:2026-10-22", at: 1, entry: { id, type: "task", text: "x", state: "migrated" } },
    { op: "state", list: "day:2026-10-22", id, rev: 0, state: "done" },
    { op: "state", list: "day:2026-10-22", id, rev: 1, state: "dropped" },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", at: 1, how: "deleted", items: [{ id, rev: 1 }] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", at: 1, how: "migrated", items: [] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", how: "migrated", items: [{ id, rev: 1 }] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", at: 1, how: "migrated", items: [{ id, rev: 1 }, { id, rev: 1 }] },
    { op: "line", date: "2026-10-22", rev: -1, text: "x" },
    { op: "line", date: "2026-02-31", rev: 0, text: "x" },
    { op: "line", date: "2026-10-22", rev: 0, text: "x".repeat(core.MAX_LINE + 1) },
  ];
  for (const op of bad) {
    assert.notEqual(core.validateOp(op), null, JSON.stringify(op));
    assert.equal(core.applyOp(f, op).error?.code, "invalid", JSON.stringify(op));
  }
  assert.deepEqual(f[OCT], core.emptyMonth());
});

test("nothing in the rules runs on a clock: no timer, no cron and no reading of the time", () => {
  const source = readFileSync(new URL("../journal/core.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/Date\.now|new Date\(\)|setTimeout|setInterval|requestAnimationFrame/.test(source));
  assert.ok(!/new Date\((?!Date\.UTC)/.test(source), "dates are only ever built from given text");
  // applyOp takes the files and the change and nothing else, so nothing about
  // the time of day can decide a move.
  assert.equal(core.applyOp.length, 2);
});

test("the morning strip offers open tasks from the most recent earlier day that has any, and never anything else", () => {
  const f = files(OCT);
  const friday = "2026-10-16";
  const thursday = "2026-10-15";
  const t1 = add(f, core.dayList(friday), "Friday task");
  add(f, core.dayList(friday), "Friday event", "event");
  add(f, core.dayList(friday), "Friday note", "note");
  const done = add(f, core.dayList(friday), "Friday done");
  core.applyOp(f, { op: "state", list: core.dayList(friday), id: done, rev: 1, state: "done" });
  add(f, core.dayList(thursday), "Thursday task");
  add(f, core.dayList("2026-10-26"), "A future task");
  const monday = "2026-10-19";
  const group = core.stripFrom(f, monday).daily;
  assert.equal(group.date, friday, "Friday is offered on Monday");
  assert.deepEqual(group.tasks.map((t) => t.id), [t1], "open tasks only: no event, no note, no ticked task");
  assert.equal(core.stripFrom(f, "2026-10-14").daily, null, "nothing before the first day");

  core.applyOp(f, { op: "drop", list: core.dayList(friday), items: [{ id: t1, rev: 1 }] });
  assert.equal(core.stripFrom(f, monday).daily.date, thursday, "once Friday is handled, the next earlier day is next");
  assert.equal(core.stripFrom(f, today).daily.date, thursday, "and today's own tasks are never offered");
});

test("last month's open Migrate tasks are offered in a new month, and handled ones are not", () => {
  const f = files(OCT, NOV);
  const open = add(f, core.migrateList(OCT), "Still to do");
  const done = add(f, core.migrateList(OCT), "Finished");
  core.applyOp(f, { op: "state", list: core.migrateList(OCT), id: done, rev: 1, state: "done" });
  add(f, core.migrateList(OCT), "A note", "note");
  add(f, core.migrateList(NOV), "This month's own task");
  const group = core.stripFrom(f, "2026-11-02").monthly;
  assert.equal(group.month, OCT);
  assert.equal(group.list, "migrate:2026-10");
  assert.deepEqual(group.tasks.map((t) => t.id), [open]);
  assert.equal(core.stripFrom(f, "2026-10-22").monthly, null, "in October there is no earlier month with files");

  const copyId = copyOf(open, 1, core.migrateList(NOV));
  core.applyOp(f, moveOf(core.migrateList(OCT), core.migrateList(NOV), "migrated", { id: open, rev: 1 }));
  assert.equal(core.stripFrom(f, "2026-11-02").monthly, null, "brought forward, so no longer offered");
  assert.equal(core.entriesOf(f, core.migrateList(NOV)).at(-1).id, copyId, "and it sits at the bottom of the new month's Migrate");
});

test("the strip only reads what is loaded and changes nothing", () => {
  const f = files(OCT);
  add(f, core.dayList("2026-10-21"), "Yesterday");
  const before = snapshot(f);
  core.stripFrom(f, today);
  core.stripFrom(f, today);
  assert.equal(snapshot(f), before);
});

test("bold and strike-through markers read as styled pieces, and an unmatched marker is just text", () => {
  assert.deepEqual(core.parseMarks("plain"), [{ text: "plain", bold: false, strike: false }]);
  assert.deepEqual(core.parseMarks("a **b** c"), [
    { text: "a ", bold: false, strike: false },
    { text: "b", bold: true, strike: false },
    { text: " c", bold: false, strike: false },
  ]);
  assert.deepEqual(core.parseMarks("~~gone~~ **kept**").map((p) => [p.text, p.bold, p.strike]), [["gone", false, true], [" ", false, false], ["kept", true, false]]);
  assert.deepEqual(core.parseMarks("**both ~~styles~~**").map((p) => [p.text, p.bold, p.strike]), [["both ", true, false], ["styles", true, true]]);
  assert.equal(core.plainText("2 ** 3 and **bold**"), "2  3 and bold**", "markers pair from the left, so an odd one out is the last");
  assert.equal(core.plainText("2 ** 3"), "2 ** 3", "a lone marker is text");
  assert.equal(core.plainText("a **dangling"), "a **dangling");
  assert.equal(core.parseMarks("").length, 0);
});

test("a damaged entry or line file is refused, never read as if it were not there", () => {
  const good = core.entryRecord("day:2026-10-22", { id: newId(), type: "task", state: "open", text: "t", rev: 1, order: 5 });
  assert.ok(core.normaliseEntryFile(good));
  assert.deepEqual(core.normaliseEntryFile(good).list, "day:2026-10-22");
  for (const broken of [null, {}, { ...good, v: 2 }, { ...good, list: "notes:2026-10" }, { ...good, rev: 0 }, { ...good, order: "1" }, { ...good, id: "x" },
    { ...good, state: "gone" }, { ...good, type: "memo" }, { ...good, text: 5 }, { ...good, to: "elsewhere" }, { ...good, toId: "x" }]) {
    assert.equal(core.normaliseEntryFile(broken), null, JSON.stringify(broken).slice(0, 80));
  }
  const line = core.lineRecord("2026-10-22", 2, "Dentist");
  assert.deepEqual(core.normaliseLineFile(line), { date: "2026-10-22", rev: 2, text: "Dentist" });
  for (const broken of [null, { ...line, rev: 0 }, { ...line, date: "2026-02-31" }, { ...line, text: 5 }, { ...line, v: 9 }]) {
    assert.equal(core.normaliseLineFile(broken), null, JSON.stringify(broken));
  }
});

test("the page and the server predict the same revisions: the same change twice gives the same entries", () => {
  const make = () => {
    const f = files(OCT, NOV);
    const list = core.dayList(today);
    const id = "a".repeat(32);
    core.applyOp(f, { op: "add", list, at: 1000, entry: { id, type: "task", text: "Same on both sides" } });
    core.applyOp(f, { op: "state", list, id, rev: 1, state: "done" });
    core.applyOp(f, { op: "state", list, id, rev: 2, state: "open" });
    core.applyOp(f, { op: "move", from: list, to: core.migrateList(NOV), how: "migrated", at: 2000, items: [{ id, rev: 3 }] });
    return f;
  };
  assert.deepEqual(make(), make());
  assert.equal(make()[OCT].days[today].entries[0].rev, 4, "three changes after the add: the revision the page will predict");
  assert.equal(make()[NOV].migrate[0].order, 2000 * 1000 + 1, "and the order the copy will be given");
});

test("a change sent again after its answer was lost has already happened, and changes nothing a second time", () => {
  const f = files(OCT, NOV);
  const list = core.dayList(today);
  const id = add(f, list, "Once only");
  const ops = [
    { op: "edit", list, id, rev: 1, text: "Edited once" },
    { op: "state", list, id, rev: 2, state: "done" },
  ];
  for (const op of ops) {
    assert.notDeepEqual(core.applyOp(f, op).changed, []);
    const after = snapshot(f);
    const repeat = core.applyOp(f, op);
    assert.equal(repeat.error, undefined, op.op + " again");
    assert.deepEqual(repeat.changed, [], op.op + " again writes nothing");
    assert.equal(snapshot(f), after, op.op + " again changes nothing");
  }
  // a delete of what is already gone is done
  core.applyOp(f, { op: "remove", list, id, rev: 3 });
  assert.deepEqual(core.applyOp(f, { op: "remove", list, id, rev: 3 }).changed, []);

  const a = add(f, list, "Drop me");
  const drop = { op: "drop", list, items: [{ id: a, rev: 1 }] };
  core.applyOp(f, drop);
  assert.deepEqual(core.applyOp(f, drop).changed, [], "drop again");
  assert.equal(entry(f, list, a).rev, 2);

  const b = add(f, list, "Move me");
  const move = moveOf(list, core.migrateList(NOV), "migrated", { id: b, rev: 1 });
  core.applyOp(f, move);
  const moved = snapshot(f);
  assert.deepEqual(core.applyOp(f, move).changed, [], "move again");
  assert.equal(snapshot(f), moved, "one copy, one mark");
  assert.equal(f[NOV].migrate.length, 1);

  const undo = { op: "undo", list, id: b, rev: 2, toList: core.migrateList(NOV) };
  core.applyOp(f, undo);
  assert.deepEqual(core.applyOp(f, undo).changed, [], "undo again");

  const line = { op: "line", date: today, rev: 0, text: "Dentist" };
  core.applyOp(f, line);
  assert.deepEqual(core.applyOp(f, line).changed, [], "a line saved again");
});

test("a repeated move whose copy went missing makes the copy again, and only the copy", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Lost copy");
  const move = moveOf(list, core.dayList("2026-10-23"), "migrated", { id, rev: 1 });
  core.applyOp(f, move);
  f[OCT].days["2026-10-23"].entries.length = 0;
  const repair = core.applyOp(f, move);
  assert.equal(repair.error, undefined);
  assert.equal(core.entriesOf(f, core.dayList("2026-10-23")).length, 1);
  assert.equal(entry(f, list, id).rev, 2, "the original is not marked a second time");
});

test("two views put together never lose an entry, and the higher revision of each wins", () => {
  const list = core.dayList(today);
  const f = files(OCT);
  const kept = add(f, list, "Held by this device");
  const edited = add(f, list, "Before");
  const mine = JSON.parse(JSON.stringify(f[OCT]));

  // An older read: it lacks an entry this device saved and shows another at an older revision.
  const older = JSON.parse(JSON.stringify(f[OCT]));
  older.days[today].entries = older.days[today].entries.filter((e) => e.id !== kept);
  core.applyOp(f, { op: "edit", list, id: edited, rev: 1, text: "After" });
  const newer = core.mergeMonth(older, f[OCT]);
  assert.equal(newer.days[today].entries.find((e) => e.id === edited).text, "After", "the higher revision wins");
  assert.ok(newer.days[today].entries.find((e) => e.id === kept), "an entry the other view lacks is kept");

  const back = core.mergeMonth(newer, mine);
  assert.equal(back.days[today].entries.find((e) => e.id === edited).text, "After", "an older view never draws over a newer one");
  assert.equal(back.days[today].entries.length, 2);

  // A removal arrives as a revision, so it removes.
  core.applyOp(f, { op: "remove", list, id: kept, rev: 1 });
  const gone = core.mergeMonth(back, f[OCT]);
  assert.deepEqual(core.entriesOf({ [OCT]: gone }, list).map((e) => e.id), [edited]);

  // Lines follow the same rule.
  const a = core.emptyMonth(); a.days["2026-10-23"] = { line: "new", lineRev: 2, entries: [] };
  const b = core.emptyMonth(); b.days["2026-10-23"] = { line: "old", lineRev: 1, entries: [] };
  assert.equal(core.mergeMonth(a, b).days["2026-10-23"].line, "new");
  assert.equal(core.mergeMonth(b, a).days["2026-10-23"].line, "new");
  assert.equal(core.mergeMonth(undefined, a).days["2026-10-23"].lineRev, 2);
});

test("a month view is built from stored entries in the order they were made, and the highest revision of an entry is the one shown", () => {
  const list = core.dayList(today);
  const make = (id, rev, text, order) => ({ list, entry: { id, type: "task", state: "open", text, rev, order } });
  const a = "a".repeat(32), b = "b".repeat(32), c = "c".repeat(32);
  const view = core.viewFrom([OCT, NOV], [make(b, 1, "second", 2000), make(a, 1, "first", 1000), make(c, 1, "old", 3000), make(c, 2, "new", 3000)], [{ date: today, rev: 3, text: "Dentist" }]);
  assert.deepEqual(view[OCT].days[today].entries.map((e) => e.text), ["first", "second", "new"]);
  assert.deepEqual(view[OCT].days[today].line, "Dentist");
  assert.deepEqual(view[NOV], core.emptyMonth(), "a month asked for with nothing in it is an empty view, not a missing one");
  assert.equal(view["2026-09"], undefined);
});

test("what a change wrote is exactly the entries and lines it made new or moved on a revision", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "A");
  const other = add(f, list, "B");
  const before = JSON.parse(JSON.stringify(f));
  core.applyOp(f, { op: "edit", list, id, rev: 1, text: "A2" });
  core.applyOp(f, { op: "line", date: today, rev: 0, text: "Dentist" });
  const wrote = core.writesFor(before, f);
  assert.deepEqual(wrote.entries.map((w) => [w.entry.id, w.entry.rev]), [[id, 2]], "only the entry that changed, and not the one beside it");
  assert.notEqual(wrote.entries[0].entry.id, other);
  assert.deepEqual(wrote.lines, [{ date: today, rev: 1, text: "Dentist" }]);
  assert.deepEqual(core.writesFor(f, JSON.parse(JSON.stringify(f))), { entries: [], lines: [] }, "nothing changed, nothing written");
});

test("a copy's id is worked out from the entry, its revision and the place, and nothing else", () => {
  const id = "c".repeat(32);
  const to = core.dayList("2026-10-28");
  const copy = core.copyIdFor(id, 1, to);
  assert.ok(core.isId(copy));
  assert.equal(core.copyIdFor(id, 1, to), copy, "the same move always names the same copy");
  assert.notEqual(core.copyIdFor(id, 2, to), copy, "a later revision makes another copy");
  assert.notEqual(core.copyIdFor(id, 1, core.dayList("2026-10-29")), copy, "another place makes another copy");
  assert.notEqual(core.copyIdFor("d".repeat(32), 1, to), copy, "another entry makes another copy");
  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) seen.add(core.copyIdFor(newId(), 1, to));
  assert.equal(seen.size, 5000, "no two of five thousand different entries share a copy id");
});

test("the laterStamp rule for quick notes is unchanged", () => {
  assert.equal(core.laterStamp("2026-10-22T09:00:01.000Z", "2026-10-22T09:00:00.000Z"), true);
  assert.equal(core.laterStamp("2026-10-22T09:00:00.000Z", "2026-10-22T09:00:01.000Z"), false);
  assert.equal(core.laterStamp("2026-10-22T09:00:00.000Z", "none"), true);
  assert.equal(core.laterStamp("none", "2026-10-22T09:00:00.000Z"), false);
  assert.equal(core.laterStamp("none", "none"), false);
});
