// The real wiring: the environment, the clock and Vercel Blob. Route files take
// their handlers from here. Importing the Blob package is cheap and touches no
// network, so a route can still answer 401 with no storage configured.

import * as blob from "@vercel/blob";
import { createNotesApi } from "./notes-api.js";
import { createBlobStore } from "./store.js";

export const api = createNotesApi({ store: createBlobStore(blob), env: process.env });
