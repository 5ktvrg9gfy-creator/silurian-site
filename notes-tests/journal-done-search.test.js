// The Done list, the calendar search and the Quick notes bullets: the rules in
// journal/core.js held without a page, and the two read routes over the real Blob
// adapter and the counting stand-in. The page's wiring is held by
// forecast-app/tests/test_journal_page.py and the page in a browser by
// docs/evidence/journal/browser-check-journal-done-search.mjs.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { createJournalStore } from "../api/_lib/journal-store.js";
import { ENVIRONMENT_VARIABLE } from "../api/_lib/gate.js";
import * as core from "../journal/core.js";
import { NOW, freshSecret, signedInCookie } from "./helpers.js";
import { newId } from "./journal-helpers.js";
import { countingSdk } from "./counting-sdk.js";

const at = (iso) => Date.parse(iso);

function world(start = "2026-10-05T09:00:00Z") {
  const clock = { now: at(start) };
  const counter = countingSdk({ clock });
  const password = freshSecret("pw");
  const env = { [ENVIRONMENT_VARIABLE]: password };
  // Signed in as of the moment of each request, because a test moves the clock for months.
  const cookie = () => signedInCookie(password, clock.now);
  const now = () => clock.now;
  // A new instance for every request: it remembers nothing it read or wrote.
  const api = () => createJournalApi({ store: createJournalStore(counter.sdk), env, now, sleep: async () => {} });
  const ask = (path, method = "GET", body, headers = {}) =>
    api()[method](new Request(`https://x.test${path}`, { method, headers: { cookie: cookie(), ...headers }, body }));
  const op = async (body) => {
    const r = await ask("/api/journal", "POST", JSON.stringify(body), { "content-type": "application/json" });
    assert.equal(r.status, 200, JSON.stringify(body));
    return r.json();
  };
  // Adds a task and returns what later changes need.
  const add = async (list, text, type = "task", state) => {
    const id = newId();
    await op({ op: "add", list, at: clock.now, entry: { id, type, text, ...(state ? { state } : {}) } });
    return { id, list, rev: 1 };
  };
  const change = async (item, kind, extra) => {
    await op({ op: kind, list: item.list, id: item.id, rev: item.rev, ...extra });
    item.rev += 1;
  };
  const at_ = (iso) => { clock.now = at(iso); };
  const done = async (month) => (await (await ask(`/api/journal?view=done&month=${month}`)).json()).items;
  return { clock, counter, ask, op, add, change, at: at_, done, api };
}

const day = (d) => `day:${d}`;

/* ---------- the Done list ---------- */

test("a task counts from the time its tick revision was written, and text edits after it do not move it", async () => {
  const w = world("2026-10-05T09:00:00Z");
  const t = await w.add(day("2026-10-05"), "Ring the supplier");
  w.at("2026-10-07T10:15:00Z");
  await w.change(t, "state", { state: "done" });
  w.at("2026-10-09T08:00:00Z");
  await w.change(t, "edit", { text: "Ring the supplier back" });
  const items = await w.done("2026-10");
  assert.equal(items.length, 1);
  assert.equal(items[0].text, "Ring the supplier back", "the newest text");
  assert.equal(items[0].doneAt, "2026-10-07T10:15:00.000Z", "the tick, not the edit");
  assert.equal(items[0].list, day("2026-10-05"));
});

test("a task ticked, unticked and ticked again counts from the second tick", async () => {
  const w = world();
  const t = await w.add(day("2026-10-05"), "Order labels");
  w.at("2026-10-06T09:00:00Z");
  await w.change(t, "state", { state: "done" });
  w.at("2026-10-08T09:00:00Z");
  await w.change(t, "state", { state: "open" });
  assert.deepEqual(await w.done("2026-10"), [], "an open task is not in the list");
  w.at("2026-10-12T09:00:00Z");
  await w.change(t, "state", { state: "done" });
  const items = await w.done("2026-10");
  assert.equal(items.length, 1);
  assert.equal(items[0].doneAt, "2026-10-12T09:00:00.000Z");
});

test("only tasks that are done: not open, dropped, removed, moved, events or notes", async () => {
  const w = world();
  const list = day("2026-10-05");
  const open = await w.add(list, "Open task");
  const dropped = await w.add(list, "Dropped task");
  const removed = await w.add(list, "Removed task");
  const ticked = await w.add(list, "Ticked task");
  const event = await w.add(list, "An event", "event");
  const moved = await w.add(list, "Moved task");
  w.at("2026-10-06T09:00:00Z");
  await w.change(dropped, "drop", undefined).catch(() => {});
  await w.op({ op: "drop", list, items: [{ id: dropped.id, rev: dropped.rev }] });
  await w.change(ticked, "state", { state: "done" });
  await w.change(removed, "state", { state: "done" });
  await w.change(removed, "remove");
  await w.op({ op: "move", from: list, to: day("2026-10-06"), at: w.clock.now, how: "migrated", items: [{ id: moved.id, rev: moved.rev }] });
  void open; void event;
  const items = await w.done("2026-10");
  assert.deepEqual(items.map((i) => i.text), ["Ticked task"]);
});

test("a task added already done counts from the time it was added", async () => {
  const w = world("2026-10-05T09:00:00Z");
  await w.add(day("2026-10-05"), "Born done", "task", "done");
  const items = await w.done("2026-10");
  assert.equal(items[0].doneAt, "2026-10-05T09:00:00.000Z");
});

test("a task whose log is in the month before is found in the month it was ticked", async () => {
  const w = world("2026-09-28T09:00:00Z");
  const a = await w.add(day("2026-09-28"), "From September");
  const aug = world("2026-08-10T09:00:00Z");
  void aug;
  w.at("2026-10-03T09:00:00Z");
  await w.change(a, "state", { state: "done" });
  const oct = await w.done("2026-10");
  assert.deepEqual(oct.map((i) => i.text), ["From September"]);
  assert.equal(core.doneGroups(oct, "2026-10")[0].date, "2026-10-03");
  assert.deepEqual(core.doneGroups(oct, "2026-09"), [], "the month the log is in does not list it");
  // The month before October has no completions: the task was ticked in October.
  assert.deepEqual(core.doneGroups(await w.done("2026-09"), "2026-09"), []);
});

test("the known limit: a task ticked more than a month after its log's month is not listed (Q3)", async () => {
  const w = world("2026-08-10T09:00:00Z");
  const a = await w.add(day("2026-08-10"), "Old log");
  w.at("2026-10-03T09:00:00Z");
  await w.change(a, "state", { state: "done" });
  assert.deepEqual(await w.done("2026-10"), []);
});

test("the London date decides the day and the month: a tick at 23:30 UTC on 30 September is 1 October in London", () => {
  const items = [
    { id: "a".repeat(32), list: day("2026-09-30"), text: "Late", rev: 2, doneAt: "2026-09-30T23:30:00.000Z" },
    { id: "b".repeat(32), list: day("2026-10-05"), text: "Winter", rev: 2, doneAt: "2026-10-27T23:30:00.000Z" },
    { id: "c".repeat(32), list: day("2026-01-05"), text: "January", rev: 2, doneAt: "2026-01-31T23:30:00.000Z" },
  ];
  assert.equal(core.londonDateOf("2026-09-30T23:30:00.000Z"), "2026-10-01", "BST is an hour ahead of UTC");
  assert.equal(core.londonDateOf("2026-10-27T23:30:00.000Z"), "2026-10-27", "GMT is UTC");
  assert.equal(core.doneGroups(items, "2026-10")[1].date, "2026-10-01");
  assert.deepEqual(core.doneGroups(items, "2026-09"), []);
  assert.deepEqual(core.doneGroups(items, "2026-01").map((g) => g.date), ["2026-01-31"]);
  assert.equal(core.londonDateOf("nonsense"), null);
  assert.equal(core.londonDateOf(null), null);
});

test("groups: newest date first, newest first within a day, and a task with no time last, in the month of its log", () => {
  const item = (n, list, doneAt) => ({ id: String(n).repeat(32), list, text: `T${n}`, rev: 2, doneAt });
  const groups = core.doneGroups([
    item(1, day("2026-10-02"), "2026-10-03T09:00:00.000Z"),
    item(2, day("2026-10-02"), "2026-10-03T15:00:00.000Z"),
    item(3, day("2026-10-01"), "2026-10-07T08:00:00.000Z"),
    item(4, day("2026-10-02"), null),
    item(5, day("2026-09-02"), null),
    item(6, "migrate:2026-10", null),
  ], "2026-10");
  assert.deepEqual(groups.map((g) => g.date), ["2026-10-07", "2026-10-03", null]);
  assert.deepEqual(groups[1].items.map((i) => i.text), ["T2", "T1"]);
  assert.deepEqual(groups[2].items.map((i) => i.text), ["T4", "T6"], "the September log's undated task is not in October");
  assert.deepEqual(core.doneGroups([], "2026-10"), []);
  assert.deepEqual(core.doneGroups([{ id: "x" }, null, { id: "1".repeat(32), list: "nope", text: "", rev: 1, doneAt: null }], "2026-10"), [], "damaged items are left out");
});

test("a listing that does not say when a file was made gives a task with no time, not a guess", async () => {
  const w = world();
  const t = await w.add(day("2026-10-05"), "No time");
  w.at("2026-10-06T09:00:00Z");
  await w.change(t, "state", { state: "done" });
  const real = w.counter.sdk.list;
  w.counter.sdk.list = async (options) => {
    const page = await real(options);
    return { ...page, blobs: page.blobs.map(({ uploadedAt, ...rest }) => rest) };
  };
  const items = await w.done("2026-10");
  assert.equal(items.length, 1);
  assert.equal(items[0].doneAt, null);
  assert.deepEqual(core.doneGroups(items, "2026-10").map((g) => g.date), [null]);
});

test("the Done list is read only, answers no-store and needs the cookie", async () => {
  const w = world();
  const t = await w.add(day("2026-10-05"), "x");
  await w.change(t, "state", { state: "done" });
  const before = w.counter.snapshot();
  const r = await w.ask("/api/journal?view=done&month=2026-10");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const spent = w.counter.since(before);
  assert.equal(spent.put + spent.copy + spent.del, 0, "nothing is written");
  for (const month of ["2026-13", "", "2026-1", "x", "2026-10-01"]) {
    assert.equal((await w.ask(`/api/journal?view=done&month=${month}`)).status, 400, month);
  }
  assert.equal((await w.api().GET(new Request("https://x.test/api/journal?view=done&month=2026-10"))).status, 401);
  assert.equal((await w.api().GET(new Request("https://x.test/api/journal?view=all"))).status, 401);
});

test("entries whose newest revision was written before the month are not read", async () => {
  // Twelve tasks in September's log, written in June: the listing says so, and they cannot count in October.
  const w = world("2026-06-01T09:00:00Z");
  for (let i = 0; i < 12; i += 1) await w.add(day("2026-09-02"), `Old ${i}`);
  w.at("2026-10-05T09:00:00Z");
  const fresh = await w.add(day("2026-10-05"), "October");
  await w.change(fresh, "state", { state: "done" });
  const before = w.counter.snapshot();
  const items = await w.done("2026-10");
  const spent = w.counter.since(before);
  assert.equal(items.length, 1);
  assert.equal(spent.advanced, 2, "one listing for each of the two log months");
  assert.equal(spent.simple, 2, "the newest revision, and the one before it to find the tick");
});

/* ---------- searching the calendar ---------- */

function month(date, f) {
  const views = core.viewFrom([core.monthOf(date)], [], []);
  f(views[core.monthOf(date)]);
  return views;
}

const entry = (id, over) => ({ id: String(id).repeat(32), type: "task", state: "open", text: "x", rev: 1, order: 1, ...over });

test("search finds words in calendar lines, spans and entries, ignoring case, in every month", () => {
  const months = {
    "2026-10": { v: 2, migrate: [entry(1, { text: "Book DENTIST", order: 5 })], days: {
      "2026-10-22": { line: "Dentist at 3", lineRev: 1, entries: [entry(2, { text: "ring the dentist", order: 1 })] },
      "2026-10-23": { line: "", lineRev: 0, entries: [entry(3, { text: "dentist forms", order: 2 })] },
      "2026-10-24": { line: "", lineRev: 0, entries: [entry(4, { text: "dentist the day after" })] },
    } },
    "2025-03": { v: 2, migrate: [], days: { "2025-03-04": { line: "old DENTIST visit", lineRev: 2, entries: [] } } },
  };
  const spans = { s: { id: "5".repeat(32), rev: 1, start: "2026-11-02", end: "2026-11-04", text: "Dentist away", state: "open" } };
  const found = core.searchCalendar(months, spans, "  DenTist ", "2026-10-22");
  assert.deepEqual(found.map((r) => [r.date, r.kind, r.source, r.text]), [
    ["2026-11-02", "span", "Span", "Dentist away"],
    ["2026-10-24", "entry", "Month", "dentist the day after"],
    ["2026-10-23", "entry", "Tomorrow", "dentist forms"],
    ["2026-10-22", "line", "Calendar", "Dentist at 3"],
    ["2026-10-22", "entry", "Today", "ring the dentist"],
    [null, "entry", "Migrate", "Book DENTIST"],
    ["2025-03-04", "line", "Calendar", "old DENTIST visit"],
  ]);
  assert.equal(found[5].month, "2026-10", "a Migrate entry knows its month");
  assert.equal(found[5].list, "migrate:2026-10");
  assert.equal(found[0].end, "2026-11-04");
});

test("search leaves out removed and moved entries and removed spans, finds a dropped one, and sees through bold and strike-through", () => {
  const months = { "2026-10": { v: 2, migrate: [], days: { "2026-10-22": { line: "", lineRev: 0, entries: [
    entry(1, { state: "removed", text: "alpha gone" }),
    entry(2, { state: "migrated", text: "alpha moved", to: "day:2026-10-23", toId: "9".repeat(32) }),
    entry(3, { state: "scheduled", text: "alpha scheduled", to: "day:2026-10-23", toId: "8".repeat(32) }),
    entry(4, { state: "dropped", text: "alpha dropped" }),
    entry(5, { state: "done", text: "alpha **done**" }),
    entry(6, { type: "note", text: "al**ph**a note" }),
  ] } } } };
  const spans = { a: { id: "a".repeat(32), rev: 2, start: "2026-10-01", end: "2026-10-02", text: "alpha span", state: "removed" } };
  const found = core.searchCalendar(months, spans, "alpha", "2026-10-22");
  assert.deepEqual(found.map((r) => r.text).sort(), ["al**ph**a note", "alpha **done**", "alpha dropped"]);
  assert.equal(core.searchCalendar(months, spans, "alpha done", "2026-10-22").length, 1, "words across a marker still match");
});

test("search is a plain substring: a pattern is not a pattern, an empty search finds nothing", () => {
  const months = { "2026-10": { v: 2, migrate: [], days: { "2026-10-22": { line: "axb a.b (x) [y] *", lineRev: 1, entries: [] } } } };
  assert.equal(core.searchCalendar(months, {}, "a.b", "2026-10-22").length, 1);
  assert.equal(core.searchCalendar(months, {}, "(x)", "2026-10-22").length, 1);
  assert.equal(core.searchCalendar(months, {}, "[y]", "2026-10-22").length, 1);
  assert.equal(core.searchCalendar(months, {}, "a.*b", "2026-10-22").length, 0);
  assert.deepEqual(core.searchCalendar(months, {}, "", "2026-10-22"), []);
  assert.deepEqual(core.searchCalendar(months, {}, "   ", "2026-10-22"), []);
  assert.deepEqual(core.searchCalendar(months, {}, undefined, "2026-10-22"), []);
  assert.deepEqual(core.searchCalendar({}, {}, "zzz", "2026-10-22"), []);
});

test("view=all sends every month and every span, skips the months the page holds, and writes nothing", async () => {
  const w = world("2026-03-02T09:00:00Z");
  await w.add(day("2026-03-02"), "March thing");
  await w.op({ op: "line", date: "2026-03-03", rev: 0, text: "March line" });
  w.at("2026-10-05T09:00:00Z");
  await w.add(day("2026-10-05"), "October thing");
  await w.op({ op: "spanAdd", span: { id: newId(), start: "2026-04-01", end: "2026-04-03", text: "April trip" } });
  const before = w.counter.snapshot();
  const all = await (await w.ask("/api/journal?view=all")).json();
  const spent = w.counter.since(before);
  assert.deepEqual(Object.keys(all.months).sort(), ["2026-03", "2026-10"]);
  assert.equal(all.spans.length, 1);
  assert.equal(spent.put + spent.copy + spent.del, 0);
  assert.equal(spent.advanced, 3, "one listing of the entries, one of the lines, one of the spans");
  assert.equal(spent.simple, 4, "two entries, one line, one span");

  const skipped = w.counter.snapshot();
  const some = await (await w.ask("/api/journal?view=all&skip=2026-10")).json();
  assert.deepEqual(Object.keys(some.months), ["2026-03"], "a month the page holds is not sent again");
  assert.equal(w.counter.since(skipped).simple, 3, "and its files are not read");
  for (const bad of ["skip=2026-13", "skip=x", `skip=${Array.from({ length: 37 }, (_, i) => `2020-${String((i % 12) + 1).padStart(2, "0")}`).join(",")}`]) {
    assert.equal((await w.ask(`/api/journal?view=all&${bad}`)).status, 400, bad);
  }
});

test("view=all on an empty journal is empty, not an error", async () => {
  const w = world();
  const all = await (await w.ask("/api/journal?view=all")).json();
  assert.deepEqual(all, { months: {}, spans: [] });
});

/* ---------- Quick notes bullets ---------- */

test("typing '- ' or '* ' at the start of a line makes a bullet, and nothing else does", () => {
  assert.equal(core.bulletFromTyping("- buy milk"), "• buy milk");
  assert.equal(core.bulletFromTyping("* buy milk"), "• buy milk");
  assert.equal(core.bulletFromTyping("- "), "• ", "a no-break space counts");
  assert.equal(core.bulletFromTyping("- "), "• ");
  for (const not of ["-buy", "*bold*", "**bold**", " - indented", "a - b", "-", "• already", "--", ""]) {
    assert.equal(core.bulletFromTyping(not), null, JSON.stringify(not));
  }
});

test("Enter: a bullet with words continues the list, an empty bullet ends it, any other line is plain", () => {
  assert.equal(core.afterEnter("• one"), "continue");
  assert.equal(core.afterEnter("• "), "end");
  assert.equal(core.afterEnter("• "), "end");
  assert.equal(core.afterEnter("•"), "end");
  assert.equal(core.afterEnter("•   "), "end", "only spaces after the marker is empty");
  assert.equal(core.afterEnter("plain"), "plain");
  assert.equal(core.afterEnter(""), "plain");
  assert.equal(core.afterEnter("a • b"), "plain", "a bullet inside a line is not a bullet line");
});

test("the button turns a line into a bullet and back, and the stored text is the plain marker and a space", () => {
  assert.equal(core.toggleBullet("one"), "• one");
  assert.equal(core.toggleBullet("• one"), "one");
  assert.equal(core.toggleBullet(""), "• ");
  assert.equal(core.toggleBullet("• "), "");
  assert.equal(core.toggleBullet(core.toggleBullet("round trip")), "round trip");
  assert.ok(core.isBulletLine("• x") && core.isBulletLine("•") && !core.isBulletLine("x •"));
  assert.equal(core.bulletBody("• words here"), "words here");
  assert.equal(core.BULLET, "•");
  assert.ok(!/[\u2013\u2014]/.test(core.BULLET), "the bullet is not a dash");
});

test("nothing new in the rules runs on a clock", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../journal/core.js", import.meta.url), "utf8");
  assert.ok(!/Date\.now|new Date\(\)|setTimeout|setInterval/.test(source));
  assert.ok(!/new Date\((?!Date\.UTC)/.test(source));
});

void NOW; void month;
