// The worst the real Blob store may do, as far as its documentation says, as a
// stand-in for the package. Vercel's Blob documentation says an overwritten blob
// "may take up to 60 seconds to propagate through our cache": for lagMs after a
// file is overwritten, a read of it returns what it was before. As a harder case
// than the documentation promises, listLagMs leaves a file made in the last
// listLagMs out of a listing. A file that is created and never overwritten has no
// old copy, so it reads as itself at once. `clock` says what time it is, so a test
// can move it.

class FakeNotFound extends Error {}

export function staleSdk({ clock, lagMs = 60_000, listLagMs = 0, pageSize = 1000 }) {
  const files = new Map();   // path -> { versions: [{ at, bytes, etag }] }
  const calls = [];
  let version = 0;

  const seen = (file) => {
    if (file.versions.length === 1) return file.versions[0];
    const visible = file.versions.filter((v) => v.at <= clock.now - lagMs);
    return visible.length ? visible[visible.length - 1] : file.versions[0];
  };
  const latest = (file) => file.versions[file.versions.length - 1];

  return {
    files,
    calls,
    BlobNotFoundError: FakeNotFound,
    async put(pathname, body, options = {}) {
      calls.push({ op: "put", pathname, options });
      const held = files.get(pathname);
      if (held && !options.allowOverwrite) throw new Error("This blob already exists, use `allowOverwrite: true` to overwrite it");
      const entry = { at: clock.now, bytes: Buffer.from(body), etag: `etag-${(version += 1)}` };
      if (held) held.versions.push(entry);
      else files.set(pathname, { versions: [entry] });
      return { pathname, etag: entry.etag };
    },
    async get(pathname, options = {}) {
      calls.push({ op: "get", pathname, options });
      const file = files.get(pathname);
      if (!file) return null;
      const v = seen(file);
      return { statusCode: 200, stream: new Response(v.bytes).body, blob: { etag: v.etag, uploadedAt: new Date(v.at) } };
    },
    async head(pathname) {
      calls.push({ op: "head", pathname });
      const file = files.get(pathname);
      if (!file) throw new FakeNotFound();
      const v = seen(file);
      return { size: v.bytes.length, uploadedAt: new Date(v.at), pathname, etag: v.etag };
    },
    async list({ prefix, limit, cursor }) {
      calls.push({ op: "list", prefix, limit, cursor });
      const all = [...files]
        .filter(([path, file]) => path.startsWith(prefix) && file.versions[0].at <= clock.now - listLagMs)
        .map(([path]) => path)
        .sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = all.slice(start, start + pageSize);
      const next = start + pageSize;
      return {
        blobs: slice.map((pathname) => ({ pathname, uploadedAt: new Date(latest(files.get(pathname)).at), size: 1, url: "u", downloadUrl: "d", etag: latest(files.get(pathname)).etag })),
        hasMore: next < all.length,
        cursor: next < all.length ? String(next) : undefined,
      };
    },
    async del(target) {
      calls.push({ op: "del", pathname: target });
      for (const path of [target].flat()) files.delete(path);
    },
  };
}
