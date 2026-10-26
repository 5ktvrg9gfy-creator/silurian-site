// Note storage on Vercel Blob. Private blobs. Nothing is ever overwritten: every
// save writes a new revision beside the old ones, and the newest revision wins.
//
//   notes/<id>.<rev>.json   one revision of a note's small file: the title, the
//                           last-edited time, the ids of its labels, whether it is
//                           archived, which text file it uses, and what it started
//                           from. Revision 1 is the first save. A removed note is a
//                           revision that says so.
//   notes/<id>.<token>.txt  the note text exactly as saved, under a name made at
//                           random for that save, so two saves never share a file.
//                           A label or archive change makes a new small file that
//                           names the same text file again.
//   notes/<id>.json         a note made before revisions, with notes/<id>.txt: read
//   notes/<id>.txt          as its revision 0. Never rewritten and not migrated; the
//                           first save after this change makes revision 1 and the
//                           old pair is tidied away like any superseded revision.
//   labels/<rev>.json       one revision of the label list, outside notes/ so the
//                           notes listing never sees it. labels.json made before
//                           revisions is revision 0.
//   notes-index.json        a copy of every note's newest small file, so the list
//                           reads one file instead of one per note. It is the one
//                           file still overwritten in place and it is only a copy:
//                           each entry is tagged with the revision it was made from,
//                           a revision never changes, and every list is checked
//                           against a fresh listing, so an old copy of the index can
//                           cost a read and can never put a wrong row on screen.
//
// Why revisions. Vercel's Blob documentation says that deleting or overwriting a
// blob "may take up to 60 seconds to propagate through our cache", so an overwritten
// file can be read as it was a minute ago. A save that checked the version on such a
// read and then overwrote the file could overwrite a newer save from another device.
// A file that is only ever created has no old copy. The create of the next revision
// is the version check: it is refused if that revision exists, whatever a read showed.
//
// How the newest revision is found. The listing of one note's files gives the highest
// revision it shows, and the instance remembers the newest it has seen or made. A
// caller that says which version it started from (the last-edited time) is checked
// against that. If the version the caller started from is newer than anything the
// listing shows, the listing is behind, and the files after it are asked for by their
// paths, which a listing does not govern, until one is missing. Whatever is missed
// anyway is caught by the create, which is refused if the revision exists.
//
// The same save sent again, after its answer was lost, is recognised: the newest
// revision, or one of the two before it, started from the same version and says the
// same thing (the same text, or the same label change). It is answered as done and
// makes no second revision.
//
// Tidying. A revision is deleted only once a newer one has been in the listing for
// over 60 seconds, and never the newest. A text file is deleted once no kept revision
// uses it and either it is older than the revision that settled or it is over two
// minutes old, which also takes the one left behind by a save that lost its race. The last revision of a removed note is kept, so that a
// device that still shows the note can learn it is gone; it is a few bytes.
//
// Credentials: none are passed. Connecting the store to the project adds
// BLOB_STORE_ID and no read-write token. The package then authenticates each
// call with the store ID and the short-lived identity token Vercel's runtime
// puts on the request (x-vercel-oidc-token, read through @vercel/oidc). It falls
// back to BLOB_READ_WRITE_TOKEN only when there is no identity token, and that
// variable is not set on this project. Passing a token option here would take
// the place of the identity token, so this file must not. Held by
// notes-tests/blob-auth.test.js.
//
// The Blob functions are passed in, not imported here, so the adapter can be
// tested against an in-memory stand-in and the real package is only touched by
// the route files.

import { randomBytes } from "node:crypto";

const PREFIX = "notes/";
const LABELS_PREFIX = "labels/";
const TEXT_TYPE = "text/plain; charset=utf-8";
const META_TYPE = "application/json";

const LEGACY_LABELS_PATH = "labels.json";
const INDEX_PATH = "notes-index.json";
const INDEX_VERSION = 2;
const REVISION_VERSION = 2;

// How long a newer revision must have been listed before the ones under it go.
export const SUPERSEDED_MS = 60 * 1000;
// How many notes the index may be behind on before a list rewrites it.
const INDEX_REWRITE_MIN = 8;

// How old a text file no kept revision uses must be before it goes.
export const ORPHAN_MS = 2 * 60 * 1000;
const MAX_PROBE = 64;
const MAX_DELETES = 50;
const REMOVE_TRIES = 5;

const ID = "[0-9a-f]{32}";
const LEGACY_META = new RegExp(`^(${ID})\\.json$`);
const LEGACY_TEXT = new RegExp(`^(${ID})\\.txt$`);
const REV_META = new RegExp(`^(${ID})\\.(\\d+)\\.json$`);
const REV_TEXT = new RegExp(`^(${ID})\\.([0-9a-f]{12})\\.txt$`);

const metaPath = (id, rev) => (rev === 0 ? `${PREFIX}${id}.json` : `${PREFIX}${id}.${rev}.json`);
const textPath = (id, token) => (token === "legacy" ? `${PREFIX}${id}.txt` : `${PREFIX}${id}.${token}.txt`);
const labelsPath = (rev) => (rev === 0 ? LEGACY_LABELS_PATH : `${LABELS_PREFIX}${rev}.json`);

async function readBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const isoOf = (value) => new Date(value).toISOString();
const ageOf = (blob, now) => now - new Date(blob.uploadedAt).getTime();

export function createBlobStore(sdk, { now = () => Date.now() } = {}) {
  // The package signals a missing blob with this error in some paths and with a
  // null result in others. Both mean the same thing here.
  const isMissing = (error) => Boolean(sdk.BlobNotFoundError) && error instanceof sdk.BlobNotFoundError;
  const isRefused = (error) => Boolean(error && typeof error.message === "string" && /already exists/i.test(error.message));

  async function getPrivate(path) {
    try {
      // useCache false: a note saved on one device must be what the next device
      // reads, not a copy the CDN has held on to.
      const result = await sdk.get(path, { access: "private", useCache: false });
      return result && result.statusCode === 200 ? result : null;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async function headOrNull(path) {
    try {
      return await sdk.head(path);
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
  async function createOnly(path, body, contentType) {
    try {
      await sdk.put(path, body, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType });
      return true;
    } catch (error) {
      if (isRefused(error)) return false;
      // A create that failed for a reason the package words differently: if the
      // file is there now, someone else made it first, which is a refusal.
      let there = false;
      try { there = Boolean(await headOrNull(path)); } catch { there = false; }
      if (there) return false;
      throw error;
    }
  }

  async function deleteAll(paths) {
    if (paths.length === 0) return;
    try {
      await sdk.del(paths);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  async function listPrefix(prefix) {
    const found = [];
    let cursor;
    do {
      const page = await sdk.list({ prefix, limit: 1000, cursor });
      found.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }

  /* ---------- revisions of a note ---------- */

  // A revision's small file as a plain record, or null when the file is not a
  // sound one (which is then treated as not there and repaired by the next save).
  function sound(raw, rev) {
    if (!raw || typeof raw !== "object" || typeof raw.updatedAt !== "string") return null;
    if (raw.deleted === true) return { rev, deleted: true, title: "", updatedAt: raw.updatedAt, labels: [], archived: false, text: null, from: null, fp: null };
    if (typeof raw.title !== "string") return null;
    return {
      rev,
      deleted: false,
      title: raw.title,
      updatedAt: raw.updatedAt,
      labels: Array.isArray(raw.labels) ? raw.labels.filter((x) => typeof x === "string") : [],
      archived: raw.archived === true,
      text: typeof raw.text === "string" ? raw.text : "legacy",
      from: typeof raw.from === "string" ? raw.from : null,
      fp: typeof raw.fp === "string" ? raw.fp : null,
    };
  }

  // Revisions never change once made, so one that has been read is kept by path for
  // the life of this instance. A legacy file (revision 0) is only ever replaced by
  // the revisions after it, never rewritten.
  const kept = new Map();
  // The newest revision of each note this instance has seen or made.
  const newestSeen = new Map();
  // Which text file each note used when the list was last made, for search.
  const textOf = new Map();
  // What a request found a moment ago, so the read that checks a version and the
  // save that follows it do not both list the note's files. Only a shortcut for the
  // check: the create of the next revision is what decides.
  const moment = new Map();
  const MOMENT_MS = 1000;

  async function readRevision(id, rev) {
    const path = metaPath(id, rev);
    if (kept.has(path)) return kept.get(path);
    let raw = null;
    try {
      raw = await readJson(path);
    } catch {
      // A damaged file is treated as not there.
      return null;
    }
    const record = raw === null ? null : sound(raw, rev);
    if (record) kept.set(path, record);
    return record;
  }

  // What the listing of a note's own files shows: { revs: Map(rev -> blob), texts:
  // Map(token -> blob) } with the legacy pair as revision 0 and token "legacy".
  function scanNames(blobs) {
    const notes = new Map();
    const of = (id) => {
      if (!notes.has(id)) notes.set(id, { revs: new Map(), texts: new Map() });
      return notes.get(id);
    };
    for (const blob of blobs) {
      const name = blob.pathname.slice(PREFIX.length);
      let match;
      if ((match = REV_META.exec(name))) of(match[1]).revs.set(Number(match[2]), blob);
      else if ((match = LEGACY_META.exec(name))) of(match[1]).revs.set(0, blob);
      else if ((match = REV_TEXT.exec(name))) of(match[1]).texts.set(match[2], blob);
      else if ((match = LEGACY_TEXT.exec(name))) of(match[1]).texts.set("legacy", blob);
    }
    return notes;
  }

  const highestOf = (entry) => (entry && entry.revs.size > 0 ? Math.max(...entry.revs.keys()) : -1);

  // The newest revision of a note, as { rev, ...record, scan }, or null when the note
  // has none. `atLeast` is a version the caller knows exists: when it is newer than
  // what the listing and this instance's memory show, the files after them are asked
  // for by path. A note with a text file and no small file is revision 0 made up from
  // the text file's own time, and is repaired by the next save.
  async function newestOf(id, { scan = undefined, atLeast = null, hint = null } = {}) {
    const recent = moment.get(id);
    if (scan === undefined && recent && now() - recent.at < MOMENT_MS && (atLeast === null || atLeast !== "9999")) {
      const value = recent.value;
      if (value === null || atLeast === null || value.updatedAt >= atLeast) return value;
    }
    const value = await findNewest(id, { scan, atLeast, hint });
    if (scan === undefined) moment.set(id, { value, at: now() });
    return value;
  }

  async function findNewest(id, { scan, atLeast, hint = null }) {
    // A caller that says which revision it started from, and that revision is there,
    // saves a listing: revisions are only ever made one after another, so the
    // newest one is that revision or a later one, and the create of the next
    // revision is what checks the version. There is then no listing to tidy from.
    let entry = scan;
    let rev = -1;
    if (entry === undefined && atLeast !== null && Number.isInteger(hint) && hint >= 1 && (await readRevision(id, hint))) {
      entry = null;
      rev = hint;
    } else if (entry === undefined) {
      entry = scanNames(await listPrefix(`${PREFIX}${id}.`)).get(id);
    }
    if (rev < 0) rev = highestOf(entry);
    const floor = newestSeen.get(id);
    if (floor !== undefined && floor > rev) rev = floor;
    let found = rev >= 0 ? await readRevision(id, rev) : null;
    if (atLeast !== null && (!found || found.updatedAt < atLeast)) {
      for (let next = Math.max(rev, 0) + 1, steps = 0; steps < MAX_PROBE; next += 1, steps += 1) {
        const there = await readRevision(id, next);
        if (!there) break;
        found = there;
        rev = next;
      }
    }
    if (found) {
      newestSeen.set(id, found.rev);
      return { ...found, scan: entry };
    }
    const text = entry && entry.texts.get("legacy");
    if (rev < 0 && text) {
      return { rev: 0, deleted: false, title: "", updatedAt: isoOf(text.uploadedAt), labels: [], archived: false, text: "legacy", from: null, fp: null, scan: entry };
    }
    return null;
  }

  const publicMeta = (n) => ({ title: n.title, updatedAt: n.updatedAt, labels: n.labels, archived: n.archived });

  // The paths to delete for one note, from what its listing shows: every revision
  // under the newest one that has been listed for over a minute, and the text files
  // none of the kept revisions use. `newest` is what the caller already knows of the
  // newest revision, so an ordinary note costs no read here.
  async function garbageOf(id, entry, newest = null) {
    if (!entry || entry.revs.size === 0) return [];
    const t = now();
    const revs = [...entry.revs.keys()].sort((a, b) => a - b);
    const top = revs[revs.length - 1];
    const settled = revs.filter((r) => ageOf(entry.revs.get(r), t) > SUPERSEDED_MS);
    if (settled.length === 0) return [];
    const floor = Math.max(...settled);
    const paths = revs.filter((r) => r < floor).map((r) => entry.revs.get(r).pathname);
    if (paths.length === 0 && entry.texts.size <= 1) return [];
    const used = new Set();
    for (const r of revs.filter((x) => x >= floor)) {
      const record = r === top && newest && newest.rev === top ? newest : await readRevision(id, r);
      // A file that cannot be read keeps every text file, because it may use any.
      if (!record) return paths;
      if (!record.deleted) used.add(record.text);
    }
    // A text file no kept revision uses goes if it was made before the revision that
    // settled (a superseded one), or is over two minutes old (one left by a save that
    // lost its race, which no revision will ever name).
    const settledAt = new Date(entry.revs.get(floor).uploadedAt).getTime();
    for (const [token, blob] of entry.texts) {
      if (used.has(token)) continue;
      if (new Date(blob.uploadedAt).getTime() <= settledAt || ageOf(blob, t) > ORPHAN_MS) paths.push(blob.pathname);
    }
    return paths;
  }

  async function tidyOne(id, entry, newest) {
    try {
      await deleteAll((await garbageOf(id, entry, newest)).slice(0, MAX_DELETES));
    } catch {
      // Tidying is never a reason for a save to fail. The next one tries again.
    }
  }

  // The same save sent again: the newest revision, or one of the two before it,
  // started from this version and says the same thing.
  async function repeatOf(id, base, fp, newest) {
    for (let rev = newest.rev; rev >= Math.max(newest.rev - 2, 1); rev -= 1) {
      const record = rev === newest.rev ? newest : await readRevision(id, rev);
      if (record && !record.deleted && record.from === base && record.fp === fp) return record;
    }
    return null;
  }

  // Makes the next revision of a note after `newest` (null for a new note). The
  // create is the version check.
  async function makeRevision(id, newest, base, fp, meta, token) {
    const rev = newest ? newest.rev + 1 : 1;
    const file = { v: REVISION_VERSION, title: meta.title, updatedAt: meta.updatedAt, labels: meta.labels, archived: meta.archived, text: token, from: base, fp };
    const made = await createOnly(metaPath(id, rev), JSON.stringify(file), META_TYPE);
    if (made) {
      kept.set(metaPath(id, rev), sound(file, rev));
      newestSeen.set(id, rev);
      moment.delete(id);
      return { ok: true, updatedAt: meta.updatedAt, rev };
    }
    // Something is at that revision: read it, and decide again from it.
    const there = await readRevision(id, rev);
    if (!there) throw new Error("revision refused and not readable");
    if (!there.deleted && there.from === base && there.fp === fp) return { ok: true, updatedAt: there.updatedAt, rev: there.rev, repeated: true };
    const latest = await newestOf(id, { atLeast: "9999" });
    return { ok: false, current: latest && !latest.deleted ? publicMeta(latest) : null };
  }

  /* ---------- the list ---------- */

  // The index, or an empty one when it is missing, damaged or from another
  // version. Never throws for a bad file: the list simply reads the notes.
  async function readIndex() {
    try {
      const file = await readJson(INDEX_PATH);
      return file && file.v === INDEX_VERSION && file.entries && typeof file.entries === "object" ? file.entries : {};
    } catch {
      return {};
    }
  }

  async function writeIndex(entries) {
    try {
      await sdk.put(INDEX_PATH, JSON.stringify({ v: INDEX_VERSION, entries }), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: META_TYPE,
      });
    } catch {
      // Only a copy. The next list tries again.
    }
  }

  /* ---------- revisions of the label list ---------- */

  async function labelsRevision(rev) {
    const path = labelsPath(rev);
    if (kept.has(path)) return kept.get(path);
    // A file that is there and not JSON is damaged, which is an error and not no file.
    const raw = await readJson(path);
    if (raw === null) return null;
    const soundFile =
      typeof raw.updatedAt === "string" && Array.isArray(raw.labels) && raw.labels.every((l) => l && typeof l.id === "string" && typeof l.name === "string");
    // A damaged label file is never treated as an empty one: the next change
    // would drop every label. The route answers with a storage error.
    if (!soundFile) throw new Error("labels file unreadable");
    const record = {
      rev,
      labels: raw.labels.map((l) => ({ id: l.id, name: l.name })),
      updatedAt: raw.updatedAt,
      from: typeof raw.from === "string" ? raw.from : null,
      fp: typeof raw.fp === "string" ? raw.fp : null,
      created: typeof raw.created === "string" ? raw.created : null,
    };
    kept.set(path, record);
    return record;
  }

  let labelsSeen = -1;

  async function newestLabels(atLeast = null) {
    const blobs = await listPrefix(LABELS_PREFIX);
    let rev = -1;
    const known = new Map();
    for (const blob of blobs) {
      const match = /^labels\/(\d+)\.json$/.exec(blob.pathname);
      if (match) { rev = Math.max(rev, Number(match[1])); known.set(Number(match[1]), blob); }
    }
    if (rev < 0) {
      const legacy = await headOrNull(LEGACY_LABELS_PATH);
      if (legacy) { rev = 0; known.set(0, legacy); }
    }
    if (labelsSeen > rev) rev = labelsSeen;
    let found = rev >= 0 ? await labelsRevision(rev) : null;
    if (atLeast !== null && atLeast !== "none" && (!found || found.updatedAt < atLeast)) {
      for (let next = Math.max(rev, 0) + 1, steps = 0; steps < MAX_PROBE; next += 1, steps += 1) {
        const there = await labelsRevision(next);
        if (!there) break;
        found = there;
        rev = next;
      }
    }
    if (found) labelsSeen = found.rev;
    return { found, known };
  }

  async function tidyLabels(known) {
    try {
      const t = now();
      const settled = [...known.entries()].filter(([, blob]) => ageOf(blob, t) > SUPERSEDED_MS).map(([rev]) => rev);
      if (settled.length === 0) return;
      const floor = Math.max(...settled);
      await deleteAll([...known.entries()].filter(([rev]) => rev < floor).map(([rev]) => labelsPath(rev)).slice(0, MAX_DELETES));
    } catch {
      // Never a reason for a change to fail.
    }
  }

  /* ---------- what the API uses ---------- */

  return {
    // One listing and one read of the index, then a read of a small file only for a
    // note whose newest revision the index was not made from. The tag is the
    // revision number, which never changes for a file, so an entry made from an
    // older revision never matches. Removed notes are not listed; their ids come
    // back as .gone, so a page that still shows one can drop it. Garbage that has
    // become safe to delete is deleted in one call.
    async list() {
      const [blobs, entries] = await Promise.all([listPrefix(PREFIX), readIndex()]);
      const scan = scanNames(blobs);
      const fresh = {};
      const gone = [];
      // An index with nothing in it (missing, damaged or from another version) is made.
      let repaired = Object.keys(entries).some((id) => !scan.has(id)) || (Object.keys(entries).length === 0 && scan.size > 0);
      let stale = 0;
      const garbage = [];
      const listed = await Promise.all(
        [...scan].map(async ([id, entry]) => {
          const rev = highestOf(entry);
          const text = entry.texts.get("legacy");
          if (rev < 0 && !text) return null;
          const tag = rev >= 0 ? `r${rev}` : `t:${text.etag || text.uploadedAt}`;
          const held = entries[id];
          let item;
          if (held && held.tag === tag) {
            item = held;
          } else {
            const record = rev >= 0 ? await readRevision(id, rev) : null;
            item = record
              ? { tag, title: record.title, updatedAt: record.updatedAt, labels: record.labels, archived: record.archived, text: record.text, deleted: record.deleted }
              : { tag, title: "", updatedAt: isoOf((text || entry.revs.get(rev)).uploadedAt), labels: [], archived: false, text: "legacy", deleted: false };
            stale += 1;
            // A removed note is recorded at once, or every list would read its file again.
            if (item.deleted) repaired = true;
          }
          fresh[id] = item;
          garbage.push(...(await garbageOf(id, entry, rev >= 0 ? { rev, text: item.text, deleted: item.deleted } : null)).slice(0, MAX_DELETES));
          if (item.deleted) { gone.push(id); return null; }
          newestSeen.set(id, Math.max(rev, newestSeen.get(id) ?? -1));
          return { id, title: item.title, updatedAt: item.updatedAt, labels: item.labels, archived: item.archived, text: item.text };
        }),
      );
      // The index is only a copy, and writing it costs an advanced operation, while a
      // note it is behind on costs one small read in the next list. So it is rewritten
      // when it names a note that has gone, or when enough notes are behind.
      if (repaired || stale >= INDEX_REWRITE_MIN) await writeIndex(fresh);
      if (garbage.length > 0) {
        try { await deleteAll(garbage.slice(0, MAX_DELETES)); } catch { /* the next list tries again */ }
      }
      const notes = listed.filter(Boolean);
      textOf.clear();
      for (const n of notes) textOf.set(n.id, n.text);
      return Object.assign(notes.map(({ text, ...rest }) => rest), { gone });
    },

    // The note text alone, for search. The list has just said which text file each
    // note uses; without that, the newest revision says.
    async text(id) {
      let token = textOf.get(id);
      if (token === undefined) {
        const newest = await newestOf(id);
        if (!newest || newest.deleted) return null;
        token = newest.text;
      }
      const result = await getPrivate(textPath(id, token));
      return result ? readBytes(result.stream) : null;
    },

    // The newest revision and its text. The text file the listing shows last is asked
    // for while the small file is read, since it is nearly always the one the newest
    // revision uses; if it is not, the right one is asked for after.
    async read(id) {
      const entry = scanNames(await listPrefix(`${PREFIX}${id}.`)).get(id);
      const guess = entry ? [...entry.texts].sort((a, b) => new Date(b[1].uploadedAt) - new Date(a[1].uploadedAt))[0] : undefined;
      const [newest, guessed] = await Promise.all([newestOf(id, { scan: entry }), guess ? getPrivate(textPath(id, guess[0])) : null]);
      if (!newest || newest.deleted) return null;
      const result = guess && guess[0] === newest.text ? guessed : await getPrivate(textPath(id, newest.text));
      if (!result) return null;
      return { bytes: await readBytes(result.stream), updatedAt: newest.updatedAt, rev: newest.rev, labels: newest.labels, archived: newest.archived };
    },

    // The last-edited time of a note, or null when there is no such note.
    async stamp(id) {
      const newest = await newestOf(id);
      return newest && !newest.deleted ? newest.updatedAt : null;
    },

    // Title, time, labels and archived flag of the newest revision, or null. atLeast
    // is a version the caller knows exists (the one its save started from).
    async meta(id, atLeast = null, hint = null) {
      const newest = await newestOf(id, { atLeast, hint });
      return newest && !newest.deleted ? publicMeta(newest) : null;
    },

    // The same save sent again: { updatedAt } when the newest revision, or one of the
    // two before it, started from `base` and says the same thing (`fp`), else null.
    async repeat(id, base, fp, hint = null) {
      const newest = await newestOf(id, { atLeast: base, hint });
      if (!newest) return null;
      const record = await repeatOf(id, base, fp, newest);
      return record ? { updatedAt: record.updatedAt, rev: record.rev } : null;
    },

    // Saves new text. base is the version the save started from, or null for a new
    // note. Answers { ok: true, updatedAt } or { ok: false, current } with current the
    // newest revision's small file (null when the note is gone) and nothing changed.
    async write(id, bytes, meta, base, fp, hint = null) {
      // A new note has an id nobody has used, so there is nothing to look for.
      const newest = base === null ? null : await newestOf(id, { atLeast: base, hint });
      if (base !== null && (!newest || newest.deleted)) return { ok: false, current: null };
      if (base !== null && newest.updatedAt !== base) {
        const record = await repeatOf(id, base, fp, newest);
        return record ? { ok: true, updatedAt: record.updatedAt, rev: record.rev, repeated: true } : { ok: false, current: publicMeta(newest) };
      }
      const token = randomBytes(6).toString("hex");
      await sdk.put(textPath(id, token), Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: TEXT_TYPE });
      const result = await makeRevision(id, newest, base, fp, meta, token);
      if (result.ok && newest) await tidyOne(id, newest.scan, newest);
      return result;
    },

    // Labels and the archived flag change the small file only: a new revision that
    // names the same text file. Same answers as write.
    async writeMeta(id, meta, base, fp, hint = null) {
      const newest = await newestOf(id, { atLeast: base, hint });
      if (!newest || newest.deleted) return { ok: false, current: null };
      if (newest.updatedAt !== base) {
        const record = await repeatOf(id, base, fp, newest);
        return record ? { ok: true, updatedAt: record.updatedAt, rev: record.rev, repeated: true } : { ok: false, current: publicMeta(newest) };
      }
      const result = await makeRevision(id, newest, base, fp, meta, newest.text);
      if (result.ok) await tidyOne(id, newest.scan, newest);
      return result;
    },

    // Removes a note by making a revision that says it is gone. Nothing to do when it
    // is gone already. A save that lands in between is not waited for: the removal is
    // asked for with no version, so it goes on top of whatever is newest.
    async remove(id, stamp) {
      for (let attempt = 0; attempt < REMOVE_TRIES; attempt += 1) {
        const newest = await newestOf(id, { atLeast: "9999" });
        if (!newest || newest.deleted) return;
        const file = { v: REVISION_VERSION, deleted: true, updatedAt: stamp > newest.updatedAt ? stamp : newest.updatedAt };
        if (await createOnly(metaPath(id, newest.rev + 1), JSON.stringify(file), META_TYPE)) {
          kept.set(metaPath(id, newest.rev + 1), sound(file, newest.rev + 1));
          newestSeen.set(id, newest.rev + 1);
          moment.delete(id);
          textOf.delete(id);
          return;
        }
      }
      throw new Error("removal refused");
    },

    // { labels, updatedAt } of the newest revision, or null when there is none.
    async readLabels() {
      const { found } = await newestLabels();
      return found ? { labels: found.labels, updatedAt: found.updatedAt } : null;
    },

    // The same label change sent again: { labels, updatedAt, created } when the newest
    // revision, or one of the two before it, started from `base` and made the same
    // change (`fp`), else null.
    async labelsRepeat(base, fp) {
      const { found } = await newestLabels(base);
      if (!found) return null;
      for (let rev = found.rev; rev >= Math.max(found.rev - 2, 0); rev -= 1) {
        const record = rev === found.rev ? found : await labelsRevision(rev);
        if (record && record.from === base && record.fp === fp) return { labels: record.labels, updatedAt: record.updatedAt, created: record.created };
      }
      return null;
    },

    // Makes the next revision of the label list. base is the version it started from
    // ("none" for the first). Answers { ok: true } or { ok: false } with nothing changed.
    async writeLabels(file, base, fp, created = null) {
      const { found, known } = await newestLabels(base);
      const version = found ? found.updatedAt : "none";
      if (version !== base) return { ok: false };
      const rev = found ? found.rev + 1 : 1;
      const body = { labels: file.labels, updatedAt: file.updatedAt, from: base, fp, ...(created ? { created } : {}) };
      const made = await createOnly(labelsPath(rev), JSON.stringify(body), META_TYPE);
      if (!made) return { ok: false };
      kept.set(labelsPath(rev), { rev, labels: file.labels, updatedAt: file.updatedAt, from: base, fp, created });
      labelsSeen = rev;
      await tidyLabels(known);
      return { ok: true };
    },
  };
}
