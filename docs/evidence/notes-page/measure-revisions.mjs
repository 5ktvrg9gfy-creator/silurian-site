// Counts the storage requests each notes call makes, for the code in the checkout it
// is run from, against the stand-in for the Blob package. Run from the repository root:
//   node docs/evidence/notes-page/measure-revisions.mjs
// Each call goes to an instance that remembers nothing. "Rounds" is the number of
// requests that had to wait for an earlier one, which is what a person waits for.
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { createBlobStore } from '../../../api/_lib/store.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { NOW, freshSecret, signedInCookie } from '../../../notes-tests/helpers.js';
import { staleSdk } from '../../../notes-tests/stale-sdk.js';

const clock = { now: NOW };
const sdk = staleSdk({ clock, lagMs: 0 });
const password = freshSecret('pw');
const env = { [ENVIRONMENT_VARIABLE]: password };
const cookie = signedInCookie(password);
// A request waits for the ones that were in flight when it began.
let depth = 0; let rounds = 0; const inFlight = new Set();
for (const op of ['put', 'get', 'head', 'list', 'del']) {
  const real = sdk[op].bind(sdk);
  sdk[op] = async (...args) => {
    const waited = inFlight.size;
    const token = Symbol();
    inFlight.add(token);
    depth = Math.max(depth, inFlight.size);
    rounds = Math.max(rounds, 0);
    await new Promise((r) => setTimeout(r, 1));
    try { return await real(...args); } finally { inFlight.delete(token); void waited; }
  };
}
const instance = () => createNotesApi({ store: createBlobStore(sdk, { now: () => clock.now }), env, now: () => clock.now, sleep: async () => {} });
const call = (h, path, method = 'GET', body, headers = {}) => h(new Request('https://n.test' + path, { method, headers: { cookie, ...headers }, body }));

// Rounds: the longest chain of requests where each began after the one before it finished.
async function measure(label, work) {
  const start = sdk.calls.length;
  const t0 = performance.now();
  await work();
  const calls = sdk.calls.slice(start);
  const kinds = {};
  for (const c of calls) kinds[c.op] = (kinds[c.op] || 0) + 1;
  console.log(label.padEnd(44), String(calls.length).padStart(3), 'requests', JSON.stringify(kinds));
  return t0;
}
const note = await (await call(instance().collection.POST, '/api/notes', 'POST', 'Title\nbody')).json();
for (let i = 0; i < 6; i += 1) await call(instance().collection.POST, '/api/notes', 'POST', `Other ${i}\nbody`);
clock.now += 5000;
await call(instance().collection.GET, '/api/notes?view=all');   // makes the index
let version = note.updatedAt;
await measure('create a note', () => call(instance().collection.POST, '/api/notes', 'POST', 'New\nbody'));
await measure('open a note (cold instance)', () => call(instance().item.GET, `/api/note?id=${note.id}`));
await measure('save a note (cold instance)', async () => { const r = await call(instance().item.PUT, `/api/note?id=${note.id}`, 'PUT', 'Title\nedited', { 'x-base-updated': version }); version = (await r.json()).updatedAt; });
await measure('archive a note (cold instance)', async () => { const r = await call(instance().item.PATCH, `/api/note?id=${note.id}`, 'PATCH', JSON.stringify({ archived: true }), { 'x-base-updated': version }); version = (await r.json()).updatedAt; });
await measure('the list, index current (cold instance)', () => call(instance().collection.GET, '/api/notes?view=all'));
await call(instance().collection.GET, '/api/notes?view=all');
await measure('the list again', () => call(instance().collection.GET, '/api/notes?view=all'));
await measure('the label list (cold instance)', () => call(instance().labels.GET, '/api/labels'));
await measure('add a label (cold instance)', () => call(instance().labels.POST, '/api/labels', 'POST', JSON.stringify({ name: 'Work' }), { 'x-base-labels': 'none' }));
await measure('delete a note (cold instance)', () => call(instance().item.DELETE, `/api/note?id=${note.id}`, 'DELETE'));
