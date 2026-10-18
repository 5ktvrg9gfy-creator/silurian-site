// Note storage on Vercel Blob. Private blobs, two small files per note:
//
//   notes/<id>.txt   the note text, exactly the bytes that were saved
//   notes/<id>.json  the title and last-edited time, so the list does not have
//                    to read every note in full to draw itself
//
// The text is written first. A note whose metadata write failed still lists,
// with the title "Untitled" and the blob's own upload time, and is repaired by
// the next save. The list is driven by the text files for that reason.
//
// The Blob functions are passed in, not imported here, so the adapter can be
// tested against an in-memory stand-in and the real package is only touched by
// the route files.

const PREFIX = "notes/";
const TEXT_TYPE = "text/plain; charset=utf-8";
const META_TYPE = "application/json";

const textPath = (id) => `${PREFIX}${id}.txt`;
const metaPath = (id) => `${PREFIX}${id}.json`;

async function readBytes(stream) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function createBlobStore(sdk) {
  // The package signals a missing blob with this error in some paths and with a
  // null result in others. Both mean the same thing here.
  const isMissing = (error) => Boolean(sdk.BlobNotFoundError) && error instanceof sdk.BlobNotFoundError;

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

  async function deleteIfPresent(path) {
    try {
      await sdk.del(path);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  async function readMeta(id) {
    const result = await getPrivate(metaPath(id));
    if (!result) return null;
    try {
      const meta = JSON.parse(new TextDecoder().decode(await readBytes(result.stream)));
      if (typeof meta.title === "string" && typeof meta.updatedAt === "string") return meta;
    } catch {
      // A damaged metadata file is treated as missing and repaired on next save.
    }
    return null;
  }

  async function textBlobs() {
    const found = [];
    let cursor;
    do {
      const page = await sdk.list({ prefix: PREFIX, limit: 1000, cursor });
      for (const blob of page.blobs) {
        if (blob.pathname.endsWith(".txt")) found.push(blob);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }

  return {
    async list() {
      const blobs = await textBlobs();
      return Promise.all(
        blobs.map(async (blob) => {
          const id = blob.pathname.slice(PREFIX.length, -".txt".length);
          const meta = await readMeta(id);
          return {
            id,
            title: meta ? meta.title : "",
            updatedAt: meta ? meta.updatedAt : new Date(blob.uploadedAt).toISOString(),
          };
        }),
      );
    },

    async read(id) {
      const result = await getPrivate(textPath(id));
      if (!result) return null;
      const bytes = await readBytes(result.stream);
      const meta = await readMeta(id);
      return {
        bytes,
        updatedAt: meta ? meta.updatedAt : new Date(result.blob.uploadedAt).toISOString(),
      };
    },

    // The last-edited time of a note, or null when there is no such note. Two
    // small calls and no note text, so a save can check for a newer version
    // without reading the note.
    async stamp(id) {
      const text = await headOrNull(textPath(id));
      if (!text) return null;
      const meta = await readMeta(id);
      return meta ? meta.updatedAt : new Date(text.uploadedAt).toISOString();
    },

    async write(id, bytes, meta) {
      const options = { access: "private", addRandomSuffix: false, allowOverwrite: true };
      await sdk.put(textPath(id), Buffer.from(bytes), { ...options, contentType: TEXT_TYPE });
      await sdk.put(metaPath(id), JSON.stringify(meta), { ...options, contentType: META_TYPE });
    },

    async remove(id) {
      // Text first, so a failure half way leaves an orphaned metadata file,
      // which the list ignores, and never a listed note with no text.
      await deleteIfPresent(textPath(id));
      await deleteIfPresent(metaPath(id));
    },
  };
}
