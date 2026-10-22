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
const add = (f, list, text, type = "task", state) => {
  const id = newId();
  const result = core.applyOp(f, { op: "add", list, entry: { id, type, text, ...(state ? { state } : {}) } });
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  return id;
};
const entry = (f, list, id) => core.entriesOf(f, list).find((e) => e.id === id);
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
  assert.deepEqual(entry(f, list, first), { id: first, type: "task", state: "open", text: "First task", rev: 1 });
  const before = snapshot(f);
  const again = core.applyOp(f, { op: "add", list, entry: { id: first, type: "task", text: "First task" } });
  assert.deepEqual(again.changed, [], "nothing to write");
  assert.equal(snapshot(f), before);
  const clash = core.applyOp(f, { op: "add", list, entry: { id: first, type: "task", text: "Different" } });
  assert.equal(clash.error.code, "invalid", "an id is never reused for other text");
});

test("a line break or control character in an entry becomes a space", () => {
  const f = files(OCT);
  const id = add(f, core.dayList(today), "one\ntwo\tthree\u0007four");
  assert.equal(entry(f, core.dayList(today), id).text, "one two three four");
});

test("a list holds at most 500 entries", () => {
  const f = files(OCT);
  const list = core.migrateList(OCT);
  for (let i = 0; i < core.MAX_ENTRIES_PER_LIST; i += 1) add(f, list, "t" + i);
  const over = core.applyOp(f, { op: "add", list, entry: { id: newId(), type: "task", text: "one too many" } });
  assert.equal(over.error.code, "limit");
  assert.equal(f[OCT].migrate.length, 500);
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

test("edit and remove, and an empty day leaves no trace in the file", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Draft");
  assert.deepEqual(core.applyOp(f, { op: "edit", list, id, rev: 1, text: "Draft" }).changed, [], "the same text is no change and gets no new revision");
  assert.equal(entry(f, list, id).rev, 1);
  core.applyOp(f, { op: "edit", list, id, rev: 1, text: "Final **copy**" });
  assert.equal(entry(f, list, id).text, "Final **copy**");
  assert.equal(entry(f, list, id).rev, 2);
  core.applyOp(f, { op: "remove", list, id, rev: 2 });
  assert.deepEqual(f[OCT].days, {}, "the day is gone, not left empty");
});

test("an entry that has moved, dropped or been ticked cannot be edited or removed as if it were open", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "Moved");
  core.applyOp(f, { op: "move", from: list, to: core.dayList("2026-10-23"), how: "migrated", items: [{ id, rev: 1, copyId: newId() }] });
  assert.equal(core.applyOp(f, { op: "edit", list, id, rev: 2, text: "x" }).error.code, "stale");
  assert.equal(core.applyOp(f, { op: "remove", list, id, rev: 2 }).error.code, "stale");
});

test("a move leaves the original in place with its arrow and puts a copy at the bottom of the target", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const to = core.dayList("2026-10-23");
  const keep = add(f, to, "Already there");
  const id = add(f, from, "Chase the invoice");
  const copyId = newId();
  const result = core.applyOp(f, { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId }] });
  assert.deepEqual(result.created, [copyId]);

  const original = entry(f, from, id);
  assert.equal(original.state, "migrated", "right arrow");
  assert.equal(original.to, to);
  assert.equal(original.toId, copyId);
  assert.equal(original.rev, 2);
  assert.equal(original.text, "Chase the invoice", "the original stays, greyed");

  const target = core.entriesOf(f, to);
  assert.deepEqual(target.map((e) => e.id), [keep, copyId], "at the bottom");
  assert.deepEqual(target[1], { id: copyId, type: "task", state: "open", text: "Chase the invoice", rev: 1 });
});

test("a move to a date is scheduled, a left arrow, and only a date can be scheduled", () => {
  const f = files(OCT);
  const from = core.migrateList(OCT);
  const id = add(f, from, "Renew the licence");
  const toMigrate = core.applyOp(f, { op: "move", from: core.dayList(today), to: from, how: "scheduled", items: [{ id, rev: 1, copyId: newId() }] });
  assert.equal(toMigrate.error.code, "invalid", "scheduling to a Migrate list is not a thing");
  const copyId = newId();
  core.applyOp(f, { op: "move", from, to: core.dayList("2026-10-28"), how: "scheduled", items: [{ id, rev: 1, copyId }] });
  assert.equal(entry(f, from, id).state, "scheduled");
  assert.equal(entry(f, core.dayList("2026-10-28"), copyId).state, "open");
});

test("events and notes move too, and keep their type", () => {
  const f = files(OCT);
  const from = core.dayList(today);
  const event = add(f, from, "Supplier call", "event");
  const note = add(f, from, "Ask about pallets", "note");
  const copies = [newId(), newId()];
  core.applyOp(f, { op: "move", from, to: core.dayList("2026-10-23"), how: "migrated", items: [{ id: event, rev: 1, copyId: copies[0] }, { id: note, rev: 1, copyId: copies[1] }] });
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
    const result = core.applyOp(f, { op: "move", from: list, to: core.dayList("2026-10-23"), how: "migrated", items: [{ id, rev, copyId: newId() }] });
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
  const result = core.applyOp(f, { op: "move", from, to: core.dayList("2026-10-23"), how: "migrated", items: [{ id: a, rev: 1, copyId: newId() }, { id: b, rev: 1, copyId: newId() }] });
  assert.equal(result.error.code, "stale", "one stale item refuses the lot");
  assert.equal(snapshot(f), before, "and A was not moved either");
});

test("a move across months writes the month that receives the copy first, and a repeat makes no second copy", () => {
  const f = files(OCT, NOV);
  const from = core.migrateList(OCT);
  const to = core.migrateList(NOV);
  const id = add(f, from, "Carry me");
  const copyId = newId();
  const op = { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId }] };
  const first = core.applyOp(f, op);
  assert.deepEqual(first.changed, [NOV, OCT], "the copy is written before the original is marked");

  // The write of October failed and the whole change is tried again from a
  // fresh read: November already has the copy, October still has the original.
  const retry = { [OCT]: core.emptyMonth(), [NOV]: JSON.parse(JSON.stringify(f[NOV])) };
  retry[OCT].migrate.push({ id, type: "task", state: "open", text: "Carry me", rev: 1 });
  const again = core.applyOp(retry, op);
  assert.deepEqual(again.changed, [OCT], "November is not written again");
  assert.equal(retry[NOV].migrate.length, 1, "one copy, not two");
  assert.equal(retry[OCT].migrate[0].state, "migrated");
});

test("a move to the same list is refused", () => {
  const f = files(OCT);
  const list = core.dayList(today);
  const id = add(f, list, "x");
  const result = core.applyOp(f, { op: "move", from: list, to: list, how: "migrated", items: [{ id, rev: 1, copyId: newId() }] });
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
  const copyId = newId();
  core.applyOp(f, { op: "move", from, to, how: "migrated", items: [{ id, rev: 1, copyId }] });
  const result = core.applyOp(f, { op: "undo", list: from, id, rev: 2, toList: to });
  assert.deepEqual(result.changed, [OCT]);
  assert.equal(entry(f, from, id).state, "open");
  assert.equal(entry(f, from, id).to, undefined);
  assert.equal(entry(f, from, id).rev, 3);
  assert.deepEqual(f[OCT].days["2026-10-23"], undefined, "the emptied day is gone");

  // Now again, but the copy is ticked before the undo.
  const second = newId();
  core.applyOp(f, { op: "move", from, to, how: "migrated", items: [{ id, rev: 3, copyId: second }] });
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
  assert.deepEqual(f[OCT].days, {}, "a cleared line and an empty log leave no day");
});

test("bad changes are refused before they touch anything", () => {
  const f = files(OCT);
  const id = newId();
  const bad = [
    null, [], "add", { op: "unknown" }, { op: "add" },
    { op: "add", list: "day:2026-10-22", entry: { id: "short", type: "task", text: "x" } },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "memo", text: "x" } },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "task", text: "   " } },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "task", text: "x".repeat(core.MAX_TEXT + 1) } },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "event", text: "x", state: "done" } },
    { op: "add", list: "day:2026-10-22", entry: { id, type: "task", text: "x", state: "migrated" } },
    { op: "state", list: "day:2026-10-22", id, rev: 0, state: "done" },
    { op: "state", list: "day:2026-10-22", id, rev: 1, state: "dropped" },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", how: "deleted", items: [{ id, rev: 1, copyId: newId() }] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", how: "migrated", items: [] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", how: "migrated", items: [{ id, rev: 1 }] },
    { op: "move", from: "day:2026-10-22", to: "day:2026-10-23", how: "migrated", items: [{ id, rev: 1, copyId: id }, { id, rev: 1, copyId: newId() }] },
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

  const copyId = newId();
  core.applyOp(f, { op: "move", from: core.migrateList(OCT), to: core.migrateList(NOV), how: "migrated", items: [{ id: open, rev: 1, copyId }] });
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

test("a damaged month file is refused, never read as an empty one", () => {
  const good = { v: 1, rev: 3, days: { "2026-10-22": { line: "x", lineRev: 1, entries: [{ id: newId(), type: "task", state: "open", text: "t", rev: 1 }] } }, migrate: [] };
  assert.ok(core.normaliseMonth(good));
  for (const broken of [null, {}, { ...good, v: 2 }, { ...good, rev: -1 }, { ...good, days: [] }, { ...good, migrate: "no" },
    { ...good, days: { "2026-10-32": good.days["2026-10-22"] } },
    { ...good, days: { "2026-10-22": { line: 5, lineRev: 1, entries: [] } } },
    { ...good, days: { "2026-10-22": { ...good.days["2026-10-22"], entries: [{ id: "x" }] } } },
    { ...good, migrate: [{ id: newId(), type: "task", state: "open", text: "t", rev: 0 }] }]) {
    assert.equal(core.normaliseMonth(broken), null, JSON.stringify(broken).slice(0, 60));
  }
});

test("the page and the server predict the same revisions: the same change twice gives the same file", () => {
  const make = () => {
    const f = files(OCT, NOV);
    const list = core.dayList(today);
    const id = "a".repeat(32);
    core.applyOp(f, { op: "add", list, entry: { id, type: "task", text: "Same on both sides" } });
    core.applyOp(f, { op: "state", list, id, rev: 1, state: "done" });
    core.applyOp(f, { op: "state", list, id, rev: 2, state: "open" });
    core.applyOp(f, { op: "move", from: list, to: core.migrateList(NOV), how: "migrated", items: [{ id, rev: 3, copyId: "b".repeat(32) }] });
    return f;
  };
  assert.deepEqual(make(), make());
  assert.equal(make()[OCT].days[today].entries[0].rev, 4, "three changes after the add: the revision the page will predict");
});
