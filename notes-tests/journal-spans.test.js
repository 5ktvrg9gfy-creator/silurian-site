// Multi-day spans (23 October 2026): a calendar line that covers a run of days as
// one entry, not copies. The rules are in journal/core.js, the storage is one file
// per span revision keyed by the span's id alone (journal/spans/<id>.<rev>.json),
// and a change goes through the same revision rule as an entry: it names the
// revision it started from, the create of the next revision is the version check,
// two devices never silently overwrite, and a retry never makes a second span.
//
// The stale part runs the API against the stand-in that serves an overwritten file
// as it was for 60 seconds and leaves a file made in the last 60 seconds out of a
// listing, the worst the real Blob store may do (Vercel's documentation: an
// overwritten blob "may take up to 60 seconds to propagate through our cache").

import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../journal/core.js";
import { createJournalApi } from "../api/_lib/journal-api.js";
import { createJournalStore } from "../api/_lib/journal-store.js";
import { staleSdk } from "./stale-sdk.js";
import { NOW, buildJournal, day, home, months, newId, post, send, signedInCookie, freshSecret } from "./journal-helpers.js";

const LAG = 60_000;
const SECOND = 1000;
const NOV = "2026-11";
const id = () => newId();
const spanAdd = (span) => ({ op: "spanAdd", span });
const make = (t, start = "2026-11-09", end = "2026-11-12", text = "Possible Germany", spanId = id()) =>
  post(t, spanAdd({ id: spanId, start, end, text })).then(async (r) => ({ response: r, id: spanId, body: await r.json() }));
const another = (t) => createJournalApi({ store: t.store, env: t.env, now: () => t.clock.now, sleep: async (ms) => { t.sleeps.push(ms); t.clock.now += ms; } });
const lagging = () => buildJournal({ lagMs: LAG, listLagMs: LAG });

// What is really stored, whatever a lagging read or listing would show.
function truth(t) {
  const latest = new Map();
  for (const [key, held] of t.store.spanFiles) {
    const found = core.normaliseSpanFile(JSON.parse(held.json));
    if (!latest.has(found.id) || found.rev > latest.get(found.id).rev) latest.set(found.id, found);
  }
  return Object.fromEntries(latest);
}

/* ---------- the rules ---------- */

test("a span needs two or more days, at most 366, and words", () => {
  const ok = (span) => core.validateOp(spanAdd(span)) === null;
  const base = { id: id(), start: "2026-11-09", end: "2026-11-12", text: "Away" };
  assert.ok(ok(base));
  assert.ok(!ok({ ...base, end: "2026-11-09" }), "one day is a line, not a span");
  assert.ok(!ok({ ...base, end: "2026-11-08" }), "it does not end before it starts");
  assert.ok(ok({ ...base, start: "2026-01-01", end: "2026-12-31" }), "366 days, with the 365 day year, is fine");
  assert.ok(ok({ ...base, start: "2028-01-01", end: "2028-12-31" }), "366 days exactly (a leap year) is the longest");
  assert.ok(!ok({ ...base, start: "2028-01-01", end: "2029-01-01" }), "367 days is over");
  assert.ok(!ok({ ...base, text: "   " }));
  assert.ok(!ok({ ...base, text: "x".repeat(201) }));
  assert.ok(!ok({ ...base, id: "nope" }));
  assert.ok(!ok({ ...base, start: "2026-02-30" }));
  assert.ok(core.validateOp({ op: "spanEdit", id: id(), rev: 1, end: "2026-11-13" }) === null);
  assert.ok(core.validateOp({ op: "spanEdit", id: id(), rev: 1 }) !== null, "an edit changes something");
  assert.ok(core.validateOp({ op: "spanEdit", id: id(), rev: 1, text: "" }) !== null);
  assert.ok(core.validateOp({ op: "spanRemove", id: id(), rev: 0 }) !== null);
});

test("an id made from the line is the same every time and differs by day and revision", () => {
  assert.equal(core.spanIdFor("2026-11-09", 3), core.spanIdFor("2026-11-09", 3));
  assert.notEqual(core.spanIdFor("2026-11-09", 3), core.spanIdFor("2026-11-09", 4));
  assert.notEqual(core.spanIdFor("2026-11-09", 3), core.spanIdFor("2026-11-10", 3));
  assert.ok(core.isId(core.spanIdFor("2026-11-09", 3)));
});

test("add, edit the text, resize, remove: each adds one to the revision and a repeat is done", () => {
  const spans = {};
  const sid = id();
  const add = { op: "spanAdd", span: { id: sid, start: "2026-11-09", end: "2026-11-12", text: "**Possible** Germany" } };
  assert.deepEqual(core.applySpanOp(spans, add).created, [sid]);
  assert.deepEqual(spans[sid], { id: sid, rev: 1, start: "2026-11-09", end: "2026-11-12", text: "**Possible** Germany", state: "open" });
  assert.deepEqual(core.applySpanOp(spans, add), { changed: [], created: [sid] }, "the same add again is not a second span");
  assert.equal(Object.keys(spans).length, 1);
  const edit = { op: "spanEdit", id: sid, rev: 1, text: "Germany" };
  assert.deepEqual(core.applySpanOp(spans, edit).changed, [sid]);
  assert.equal(spans[sid].rev, 2);
  assert.deepEqual(core.applySpanOp(spans, edit), { changed: [], created: [] }, "the same edit again has already happened");
  assert.equal(spans[sid].rev, 2);
  const longer = { op: "spanEdit", id: sid, rev: 2, end: "2026-11-15" };
  assert.deepEqual(core.applySpanOp(spans, longer).changed, [sid]);
  assert.equal(spans[sid].end, "2026-11-15");
  assert.equal(core.applySpanOp(spans, { op: "spanEdit", id: sid, rev: 3, end: "2026-11-09" }).error.code, "invalid", "a span ends after it starts: a one day span is made by removing it and keeping the line");
  assert.equal(core.applySpanOp(spans, { op: "spanEdit", id: sid, rev: 2, text: "Old" }).error.code, "stale", "a change from an old revision is refused");
  const gone = { op: "spanRemove", id: sid, rev: 3 };
  assert.deepEqual(core.applySpanOp(spans, gone).changed, [sid]);
  assert.equal(spans[sid].state, "removed");
  assert.equal(spans[sid].rev, 4);
  assert.deepEqual(core.applySpanOp(spans, gone), { changed: [], created: [] }, "removing what is gone is done");
  assert.equal(core.applySpanOp(spans, { op: "spanEdit", id: sid, rev: 4, text: "Back" }).error.code, "stale", "a removed span is not edited");
  assert.equal(core.applyOp({}, gone).error.code, "invalid", "the entry rules do not take a span change");
});

test("two spans put together keep the higher revision and drop nothing", () => {
  const a = { id: id(), rev: 2, start: "2026-11-09", end: "2026-11-12", text: "A", state: "open" };
  const b = { id: id(), rev: 1, start: "2026-11-10", end: "2026-11-11", text: "B", state: "open" };
  const merged = core.mergeSpans({ [a.id]: a, [b.id]: b }, { [a.id]: { ...a, rev: 1, text: "old" }, [b.id]: { ...b, rev: 2, state: "removed" } });
  assert.equal(merged[a.id].text, "A");
  assert.equal(merged[b.id].state, "removed");
  assert.deepEqual(Object.keys(core.mergeSpans({ [a.id]: a }, {})), [a.id]);
});

const lay = (list, month = NOV) => {
  const spans = Object.fromEntries(list.map((s) => [s.id, { rev: 1, state: "open", ...s }]));
  return core.layoutSpans(spans, month);
};

test("a span puts its words on the first day and a bar with a foot on each day after", () => {
  const s = { id: id(), start: "2026-11-09", end: "2026-11-12", text: "Possible Germany" };
  const { rows, overflow } = lay([s]);
  assert.deepEqual(overflow, []);
  assert.deepEqual(rows["2026-11-09"].texts.map((t) => [t.span.id, t.continued]), [[s.id, false]]);
  assert.deepEqual(rows["2026-11-09"].bars, [], "the first day has the words and no bar");
  assert.deepEqual(["2026-11-10", "2026-11-11", "2026-11-12"].map((d) => rows[d].bars.map((b) => [b.lane, b.foot, b.top, b.day, b.total])), [[[0, false, false, 2, 4]], [[0, false, false, 3, 4]], [[0, true, false, 4, 4]]]);
  assert.equal(rows["2026-11-13"].bars.length + rows["2026-11-08"].bars.length, 0);
  assert.equal(rows["2026-11-10"].lanes, 1);
  assert.equal(rows["2026-11-09"].lanes, 0);
});

test("spans that overlap take lanes, a lane is reused once free, and words indent past the lanes in use", () => {
  const a = { id: "a".repeat(32), start: "2026-11-02", end: "2026-11-10", text: "A" };
  const b = { id: "b".repeat(32), start: "2026-11-04", end: "2026-11-06", text: "B" };
  const c = { id: "c".repeat(32), start: "2026-11-07", end: "2026-11-09", text: "C" };
  const { rows } = lay([a, b, c]);
  const lane = (date, sid) => rows[date].bars.find((x) => x.id === sid).lane;
  assert.equal(lane("2026-11-05", a.id), 0);
  assert.equal(lane("2026-11-05", b.id), 1);
  assert.equal(lane("2026-11-08", c.id), 1, "B is over, so C takes its lane");
  assert.equal(rows["2026-11-05"].lanes, 2, "the words on this day indent past two lanes");
  assert.equal(rows["2026-11-10"].lanes, 1);
  assert.equal(rows["2026-11-04"].lanes, 1, "B's first day: its words indent past A's bar");
});

test("a fourth span on a day is an ordinary line with its range, with no bar", () => {
  const four = ["1", "2", "3", "4"].map((n) => ({ id: n.repeat(32), start: `2026-11-0${n}`, end: "2026-11-12", text: "S" + n }));
  const { rows, overflow } = lay(four);
  assert.deepEqual(overflow, ["4".repeat(32)]);
  assert.equal(rows["2026-11-05"].bars.length, 3, "three lanes");
  assert.ok(!rows["2026-11-05"].bars.some((b) => b.id === "4".repeat(32)));
  assert.deepEqual(rows["2026-11-04"].texts.map((t) => t.span.id), ["4".repeat(32)], "its words are still on its first day");
  assert.equal(rows["2026-11-12"].lanes, 3);
});

test("at the month end the bar runs off with no foot, and the next month repeats the words with the bar from the top", () => {
  const s = { id: id(), start: "2026-11-27", end: "2026-12-03", text: "Away" };
  const nov = lay([s], NOV);
  assert.deepEqual(["2026-11-28", "2026-11-30"].map((d) => nov.rows[d].bars.map((b) => [b.foot, b.top])), [[[false, false]], [[false, false]]], "no foot in November");
  const dec = lay([s], "2026-12");
  assert.deepEqual(dec.rows["2026-12-01"].texts.map((t) => [t.span.id, t.continued]), [[s.id, true]]);
  assert.deepEqual(dec.rows["2026-12-01"].bars.map((b) => [b.top, b.foot, b.day, b.total]), [[true, false, 5, 7]], "the bar is there from the top of the 1st");
  assert.deepEqual(dec.rows["2026-12-03"].bars.map((b) => b.foot), [true], "and ends in a foot on the last day");
  assert.equal(dec.rows["2026-12-04"].bars.length, 0);
  assert.equal(lay([s], "2026-10").rows["2026-10-31"].texts.length, 0, "nothing in a month the span does not touch");
});

test("a span that starts on the last day of the month has its words there and no bar until the next month", () => {
  const s = { id: id(), start: "2026-11-30", end: "2026-12-02", text: "Away" };
  const nov = lay([s], NOV);
  assert.equal(nov.rows["2026-11-30"].texts.length, 1);
  assert.equal(Object.values(nov.rows).reduce((n, r) => n + r.bars.length, 0), 0);
  assert.deepEqual(lay([s], "2026-12").rows["2026-12-01"].bars.map((b) => b.top), [true]);
});

test("a removed span is not shown, and a damaged span file is refused", () => {
  const { rows } = lay([{ id: id(), start: "2026-11-09", end: "2026-11-12", text: "Gone", state: "removed" }]);
  assert.equal(Object.values(rows).reduce((n, r) => n + r.texts.length + r.bars.length, 0), 0);
  for (const raw of [null, {}, { v: 2 }, { v: 1, id: "x", rev: 1, start: "2026-11-09", end: "2026-11-12", text: "t", state: "open" },
    { v: 1, id: id(), rev: 0, start: "2026-11-09", end: "2026-11-12", text: "t", state: "open" },
    { v: 1, id: id(), rev: 1, start: "2026-11-12", end: "2026-11-09", text: "t", state: "open" },
    { v: 1, id: id(), rev: 1, start: "2026-11-09", end: "2026-11-12", text: 5, state: "open" },
    { v: 1, id: id(), rev: 1, start: "2026-11-09", end: "2026-11-12", text: "t", state: "weird" }]) {
    assert.equal(core.normaliseSpanFile(raw), null, JSON.stringify(raw));
  }
  // A file in some other version of the format is refused, whatever else in it looks right.
  const sound = core.spanRecord({ id: id(), rev: 1, start: "2026-11-09", end: "2026-11-12", text: "t", state: "open" });
  assert.equal(core.normaliseSpanFile({ ...sound, v: 2 }), null, "a newer version of the file is not read partially");
  assert.equal(core.normaliseSpanFile({ ...sound, v: undefined }), null);
  assert.ok(core.normaliseSpanFile(core.spanRecord({ id: id(), rev: 1, start: "2026-11-09", end: "2026-11-12", text: "t", state: "open" })));
});

test("no span rule reads a clock", async () => {
  const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("../journal/core.js", import.meta.url), "utf8"));
  const spanPart = source.slice(source.indexOf("/* ---------- spans ---------- */"), source.indexOf("/* ---------- the morning strip ---------- */"));
  assert.ok(spanPart.length > 2000);
  assert.doesNotMatch(spanPart, /Date\.now|new Date\(\)|setTimeout|setInterval|Math\.random/);
});

/* ---------- the API ---------- */

test("every span change answers 401 without a cookie, and with a wrong one, and writes and reads nothing", async () => {
  const t = buildJournal();
  const wrong = signedInCookie(freshSecret("other"));
  for (const cookie of [undefined, wrong, "silurian-notes-session=garbage"]) {
    for (const op of [spanAdd({ id: id(), start: "2026-11-09", end: "2026-11-12", text: "x" }), { op: "spanEdit", id: id(), rev: 1, text: "y" }, { op: "spanRemove", id: id(), rev: 1 }]) {
      const response = await send(t.api.POST, { method: "POST", cookie, body: op });
      assert.equal(response.status, 401, `${op.op} with ${cookie}`);
    }
  }
  assert.equal((await send(t.api.GET, { path: "/api/journal?view=months&months=2026-11" })).status, 401);
  assert.equal(t.store.spanFiles.size + t.store.creates.length + t.store.state.reads, 0);
});

test("an add creates revision 1 of one span file, reads nothing, and writes no day, entry or line", async () => {
  const t = buildJournal();
  const { response, id: sid, body } = await make(t);
  assert.equal(response.status, 200);
  assert.deepEqual(body.created, [sid]);
  assert.deepEqual(body.spans.map((s) => [s.id, s.rev, s.start, s.end, s.text, s.state]), [[sid, 1, "2026-11-09", "2026-11-12", "Possible Germany", "open"]]);
  assert.deepEqual([...t.store.spanFiles.keys()], [`${sid}|1`]);
  assert.deepEqual(t.store.creates, [`span:${sid}|1`], "one create, and nothing else");
  assert.equal(t.store.entries.size + t.store.lines.size, 0, "a span is never written into a day or a shared file");
  assert.equal(t.store.state.reads, 0, "an add reads nothing");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("an edit reads one file and creates one, and a resize and a delete do the same", async () => {
  const t = buildJournal();
  const { id: sid } = await make(t);
  t.store.state.reads = 0;
  const edit = await post(t, { op: "spanEdit", id: sid, rev: 1, text: "Germany trip" });
  assert.equal(edit.status, 200);
  assert.equal(t.store.state.reads, 1);
  assert.deepEqual(t.store.creates.slice(1), [`span:${sid}|2`]);
  const resize = await post(t, { op: "spanEdit", id: sid, rev: 2, end: "2026-11-14" });
  assert.equal(resize.status, 200);
  const remove = await post(t, { op: "spanRemove", id: sid, rev: 3 });
  assert.equal(remove.status, 200);
  assert.deepEqual(truth(t)[sid], { id: sid, rev: 4, start: "2026-11-09", end: "2026-11-14", text: "Germany trip", state: "removed" });
  assert.deepEqual([...t.store.spanFiles.keys()], [`${sid}|1`, `${sid}|2`, `${sid}|3`, `${sid}|4`], "every revision is its own file, none replaced");
});

test("the same add, edit and remove sent again make no second span and no new revision", async () => {
  const t = buildJournal();
  const sid = id();
  const add = spanAdd({ id: sid, start: "2026-11-09", end: "2026-11-12", text: "Away" });
  assert.equal((await post(t, add)).status, 200);
  assert.equal((await post(t, add)).status, 200);
  assert.equal(t.store.spanFiles.size, 1);
  const edit = { op: "spanEdit", id: sid, rev: 1, text: "Away longer" };
  assert.equal((await post(t, edit)).status, 200);
  assert.equal((await post(t, edit)).status, 200);
  assert.equal(t.store.spanFiles.size, 2, "the repeat made no revision 3");
  const remove = { op: "spanRemove", id: sid, rev: 2 };
  assert.equal((await post(t, remove)).status, 200);
  assert.equal((await post(t, remove)).status, 200);
  assert.equal(t.store.spanFiles.size, 3);
});

test("two devices: the second edit from the same revision is refused with the plain message and the first stays", async () => {
  const t = buildJournal();
  const { id: sid } = await make(t);
  const a = await send(another(t).POST, { method: "POST", cookie: t.cookie, body: { op: "spanEdit", id: sid, rev: 1, text: "From A" } });
  assert.equal(a.status, 200);
  const b = await send(another(t).POST, { method: "POST", cookie: t.cookie, body: { op: "spanEdit", id: sid, rev: 1, text: "From B" } });
  assert.equal(b.status, 409);
  const body = await b.json();
  assert.equal(body.error, core.MESSAGES.stale, "the plain message the page shows, with the typed text kept on screen");
  assert.equal(body.spans.find((s) => s.id === sid).text, "From A", "and what is there now, so the page can show it");
  assert.equal(truth(t)[sid].text, "From A");
  assert.equal(t.store.spanFiles.size, 2, "nothing was replaced and nothing extra was made");
});

test("two devices that race to the same revision: the create is refused, nothing is replaced, and the loser is told", async () => {
  const t = buildJournal();
  const { id: sid } = await make(t);
  t.store.state.hook = async () => {
    await another(t).POST(new Request("https://journal.test/api/journal", { method: "POST", headers: { cookie: t.cookie }, body: JSON.stringify({ op: "spanEdit", id: sid, rev: 1, end: "2026-11-20" }) }));
  };
  const loser = await post(t, { op: "spanEdit", id: sid, rev: 1, text: "Lost the race" });
  assert.equal(loser.status, 409);
  assert.equal(truth(t)[sid].end, "2026-11-20");
  assert.equal(truth(t)[sid].text, "Possible Germany", "the other device's change is not undone by the loser");
  assert.equal(t.store.spanFiles.size, 2);
});

test("a race between two devices making the very same change is done, not refused", async () => {
  const t = buildJournal();
  const { id: sid } = await make(t);
  const op = { op: "spanEdit", id: sid, rev: 1, end: "2026-11-20" };
  t.store.state.hook = async () => { await another(t).POST(new Request("https://journal.test/api/journal", { method: "POST", headers: { cookie: t.cookie }, body: JSON.stringify(op) })); };
  assert.equal((await post(t, op)).status, 200);
  assert.equal(t.store.spanFiles.size, 2);
});

test("a change to a span that was removed on another device is refused as a clash", async () => {
  const t = buildJournal();
  const { id: sid } = await make(t);
  assert.equal((await post(t, { op: "spanRemove", id: sid, rev: 1 })).status, 200);
  assert.equal((await post(t, { op: "spanEdit", id: sid, rev: 1, text: "Typed on the other device" })).status, 409);
});

test("the months and home views carry the spans that touch them, removed ones included, and no others", async () => {
  const t = buildJournal();
  const across = (await make(t, "2026-10-28", "2026-11-03", "Across")).id;
  const inside = (await make(t, "2026-11-09", "2026-11-12", "Inside")).id;
  const later = (await make(t, "2027-03-01", "2027-03-05", "Later")).id;
  const gone = (await make(t, "2026-11-20", "2026-11-22", "Gone")).id;
  await post(t, { op: "spanRemove", id: gone, rev: 1 });
  const nov = await (await months(t, NOV)).json();
  assert.deepEqual(nov.spans.map((s) => s.id).sort(), [across, inside, gone].sort());
  assert.equal(nov.spans.find((s) => s.id === gone).state, "removed");
  assert.ok(!nov.spans.some((s) => s.id === later));
  const dec = await (await months(t, "2026-12")).json();
  assert.deepEqual(dec.spans, []);
  const both = await (await months(t, "2026-10,2026-11")).json();
  assert.ok(both.spans.some((s) => s.id === across));
  const first = await (await home(t, "2026-11-10")).json();
  assert.ok(first.spans.some((s) => s.id === inside));
});

test("a span longer than 366 days, or one day long, is refused before anything is written", async () => {
  const t = buildJournal();
  assert.equal((await post(t, spanAdd({ id: id(), start: "2028-01-01", end: "2029-01-01", text: "Too long" }))).status, 400);
  assert.equal((await post(t, spanAdd({ id: id(), start: "2026-11-09", end: "2026-11-09", text: "One day" }))).status, 400);
  assert.equal(t.store.spanFiles.size + t.store.creates.length, 0);
});

test("spans never reach notes: the journal keeps them under its own prefix on the real adapter, created and never overwritten", async () => {
  const clock = { now: NOW };
  const sdk = staleSdk({ clock, lagMs: LAG, listLagMs: LAG });
  const env = { SILURIAN_NOTES_PASSWORD: freshSecret("pw") };
  const api = createJournalApi({ store: createJournalStore(sdk), env, now: () => clock.now });
  const cookie = signedInCookie(env.SILURIAN_NOTES_PASSWORD);
  const sid = id();
  const run = (body) => send(api.POST, { method: "POST", cookie, body });
  assert.equal((await run(spanAdd({ id: sid, start: "2026-11-09", end: "2026-11-12", text: "Away" }))).status, 200);
  assert.equal((await run({ op: "spanEdit", id: sid, rev: 1, text: "Away more" })).status, 200);
  assert.equal((await run({ op: "spanEdit", id: sid, rev: 2, end: "2026-11-14" })).status, 200);
  assert.equal((await run({ op: "spanRemove", id: sid, rev: 3 })).status, 200);
  const puts = sdk.calls.filter((c) => c.op === "put");
  assert.deepEqual(puts.map((c) => c.pathname), [1, 2, 3, 4].map((r) => `journal/spans/${sid}.${r}.json`), "the id alone in the name, never a month or a date");
  assert.ok(puts.every((c) => c.options.allowOverwrite === false && c.options.access === "private"), "created, never overwritten, private");
  assert.ok(sdk.calls.every((c) => c.op !== "del"), "nothing deleted");
  assert.ok(puts.every((c) => !c.pathname.startsWith("notes/") && c.pathname.startsWith("journal/spans/")));
  clock.now += LAG + 1;
  const read = await (await send(api.GET, { path: "/api/journal?view=months&months=2026-11", cookie })).json();
  assert.deepEqual(read.spans.map((s) => [s.id, s.rev, s.state]), [[sid, 4, "removed"]]);
});

/* ---------- the 60 second stale stand-in ---------- */

test("the stand-in is not vacuous: a span made in the last 60 seconds is not in a listing, and is after", async () => {
  const t = lagging();
  const { id: sid } = await make(t);
  assert.deepEqual(await t.store.spans(), [], "listed late");
  assert.equal((await t.store.readSpan(sid, 1)).id, sid, "but read by its path at once");
  t.clock.now += LAG + 1;
  assert.deepEqual((await t.store.spans()).map((s) => s.id), [sid]);
});

test("add, edit, resize and delete a second apart lose nothing, double nothing and never wait", async () => {
  const t = lagging();
  const { id: sid, response } = await make(t);
  assert.equal(response.status, 200);
  t.clock.now += SECOND;
  assert.equal((await post(t, { op: "spanEdit", id: sid, rev: 1, text: "Edited" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await post(t, { op: "spanEdit", id: sid, rev: 2, end: "2026-11-15" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await post(t, { op: "spanEdit", id: sid, rev: 3, end: "2026-11-10" })).status, 200, "shorter");
  t.clock.now += SECOND;
  assert.deepEqual({ ...truth(t)[sid] }, { id: sid, rev: 4, start: "2026-11-09", end: "2026-11-10", text: "Edited", state: "open" });
  assert.equal((await post(t, { op: "spanRemove", id: sid, rev: 4 })).status, 200);
  assert.equal(truth(t)[sid].state, "removed");
  assert.equal(t.store.spanFiles.size, 5, "one file for each of the five changes");
  assert.deepEqual(t.sleeps, [], "no waiting");
});

test("the same add sent twice during the lag makes one span", async () => {
  const t = lagging();
  const sid = id();
  const add = spanAdd({ id: sid, start: "2026-11-09", end: "2026-11-12", text: "Away" });
  assert.equal((await post(t, add)).status, 200);
  t.clock.now += SECOND;
  assert.equal((await post(t, add)).status, 200);
  assert.equal((await send(another(t).POST, { method: "POST", cookie: t.cookie, body: add })).status, 200);
  assert.equal(t.store.spanFiles.size, 1);
});

test("a view read during the lag is shorter than the truth and never wrong, and after the lag it is the truth", async () => {
  const t = lagging();
  const { id: sid } = await make(t);
  const during = await (await months(t, NOV)).json();
  assert.deepEqual(during.spans, []);
  t.clock.now += LAG + 1;
  const after = await (await months(t, NOV)).json();
  assert.deepEqual(after.spans.map((s) => s.id), [sid]);
  // What the page does with a short read: it puts it together with what it holds.
  const held = { [sid]: { id: sid, rev: 2, start: "2026-11-09", end: "2026-11-12", text: "Held", state: "open" } };
  assert.equal(core.mergeSpans(held, Object.fromEntries(after.spans.map((s) => [s.id, s])))[sid].text, "Held", "an older read never draws over a newer save");
});

test("every change goes to an instance that remembers nothing, and none is lost or refused", async () => {
  const t = lagging();
  const run = (body) => send(another(t).POST, { method: "POST", cookie: t.cookie, body });
  const sid = id();
  assert.equal((await run(spanAdd({ id: sid, start: "2026-11-09", end: "2026-11-12", text: "Away" }))).status, 200);
  t.clock.now += SECOND;
  assert.equal((await run({ op: "spanEdit", id: sid, rev: 1, text: "Edited" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await run({ op: "spanEdit", id: sid, rev: 2, end: "2026-11-13" })).status, 200);
  t.clock.now += SECOND;
  assert.equal((await run({ op: "spanEdit", id: sid, rev: 2, text: "Stale" })).status, 409, "a real clash is still a clash");
  assert.equal((await run({ op: "spanRemove", id: sid, rev: 3 })).status, 200);
  assert.deepEqual(truth(t)[sid], { id: sid, rev: 4, start: "2026-11-09", end: "2026-11-13", text: "Edited", state: "removed" });
  assert.deepEqual(t.sleeps, []);
});

test("two hundred span changes, some sent twice and each to a different instance, end as one device would have left them", async () => {
  const t = lagging();
  // A model written out by hand, not with the rules under test: id -> what one device holds.
  const model = new Map();
  let seed = 20261023;
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 12) % n; };
  const day = (n) => `2026-11-${String(1 + Math.min(n, 29)).padStart(2, "0")}`;
  let sent = 0;
  for (let i = 0; i < 200; i += 1) {
    t.clock.now += random(4) * SECOND;
    const live = [...model.values()].filter((m) => m.state === "open");
    const kind = live.length < 2 ? 0 : random(8);
    let op;
    let apply = () => {};
    if (kind <= 2) {
      const start = random(20);
      const span = { id: id(), start: day(start), end: day(start + 1 + random(8)), text: "Span " + i };
      op = spanAdd(span);
      apply = () => model.set(span.id, { ...span, rev: 1, state: "open" });
    } else if (kind <= 3) {
      const m = live[random(live.length)];
      op = { op: "spanEdit", id: m.id, rev: m.rev, text: "Edited " + i };
      apply = () => { m.text = "Edited " + i; m.rev += 1; };
    } else if (kind <= 5) {
      const m = live[random(live.length)];
      const end = day(Number(m.start.slice(8)) + random(12));
      op = { op: "spanEdit", id: m.id, rev: m.rev, end };
      if (end <= m.start) continue;
      apply = () => { if (end !== m.end) { m.end = end; m.rev += 1; } };
    } else if (kind === 6 && live.length > 6) {
      const m = live[random(live.length)];
      op = { op: "spanRemove", id: m.id, rev: m.rev };
      apply = () => { m.state = "removed"; m.rev += 1; };
    } else {
      // A clash: a change from a revision that is out of date.
      const m = live[random(live.length)];
      if (m.rev < 2) continue;
      op = { op: "spanEdit", id: m.id, rev: m.rev - 1, text: "Out of date " + i };
      const response = await send(another(t).POST, { method: "POST", cookie: t.cookie, body: op });
      assert.equal(response.status, 409, `change ${i}: out of date`);
      sent += 1;
      continue;
    }
    apply();
    const attempts = 1 + (random(4) === 0 ? 1 + random(2) : 0);
    for (let n = 0; n < attempts; n += 1) {
      const response = await send(another(t).POST, { method: "POST", cookie: t.cookie, body: op });
      sent += 1;
      assert.equal(response.status, 200, `change ${i} (${op.op}) sent ${n + 1} of ${attempts}`);
    }
    t.clock.now += SECOND;
  }
  const stored = truth(t);
  assert.ok(sent > 200 && model.size > 10, `a real mix: ${sent} sent, ${model.size} spans`);
  assert.deepEqual(Object.keys(stored).sort(), [...model.keys()].sort());
  for (const [sid, m] of model) assert.deepEqual(stored[sid], { id: sid, rev: m.rev, start: m.start, end: m.end, text: m.text, state: m.state }, `span ${sid}`);
  assert.equal(t.store.spanFiles.size, [...model.values()].reduce((n, m) => n + m.rev, 0), "one file for each revision and no more, so no repeat made a second");
  assert.deepEqual(t.sleeps, [], "not one change waited for the store");
});
