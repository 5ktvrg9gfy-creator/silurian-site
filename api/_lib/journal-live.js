// The real wiring for the journal: the environment, the clock and Vercel Blob.
// Kept apart from live.js so the notes routes are untouched. Importing the Blob
// package is cheap and touches no network, so a route can still answer 401 with
// no storage configured.

import * as blob from "@vercel/blob";
import { createJournalApi } from "./journal-api.js";
import { createJournalStore } from "./journal-store.js";

export const journal = createJournalApi({ store: createJournalStore(blob), env: process.env });
