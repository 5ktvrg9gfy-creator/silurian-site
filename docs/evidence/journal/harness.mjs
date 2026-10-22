// A local stand-in for the deployed site, for the journal's browser checks.
// It serves the real files the allowlist publishes, applies the real header
// rules from vercel.json, and runs the real API handlers over in-memory stores
// and a password made for the run. Nothing here reaches the network.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createNotesApi } from '../../../api/_lib/notes-api.js';
import { createJournalApi } from '../../../api/_lib/journal-api.js';
import { ENVIRONMENT_VARIABLE } from '../../../api/_lib/gate.js';
import { journalMemoryStore, staleJournalStore } from '../../../notes-tests/journal-helpers.js';
import { memoryStore } from '../../../notes-tests/helpers.js';

const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium, devices } = require('playwright');

export const ROOT = new URL('../../../', import.meta.url).pathname;
const config = JSON.parse(readFileSync(ROOT + 'vercel.json', 'utf8'));
const allowlist = readFileSync(ROOT + 'site-allowlist.txt', 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const types = {
  '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.js': 'text/javascript',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
};

export async function startServer({ port = 8771, lagMs = 0, pageFile = process.env.JOURNAL_PAGE_FILE, coldInstances = false } = {}) {
  const password = 'pw-' + randomBytes(12).toString('hex');
  const journalStore = lagMs ? staleJournalStore({ lagMs }) : journalMemoryStore();
  const notesStore = memoryStore();
  const env = { [ENVIRONMENT_VARIABLE]: password };
  const notes = createNotesApi({ store: notesStore, env });
  const journal = createJournalApi({ store: journalStore, env });
  const control = { delayMs: 0, failPosts: false, failQuick: false, staleGets: false, loseFirstAnswers: '' };   // a piece of text: changes whose body has it lose their first answer
  const lost = new Set();
  const frozen = new Map();
  const routes = {
    '/api/login': { POST: notes.login },
    '/api/session': { GET: notes.session, DELETE: notes.signOut },
    '/api/notes': notes.collection,
    '/api/note': notes.item,
    '/api/labels': notes.labels,
    // A cold instance remembers nothing it wrote, as a function that has just started:
    // a new one answers each request.
    '/api/journal': coldInstances
      ? Object.fromEntries(['GET', 'POST', 'PUT'].map((m) => [m, (request) => createJournalApi({ store: journalStore, env })[m](request)]))
      : { GET: journal.GET, POST: journal.POST, PUT: journal.PUT },
  };
  const requests = [];

  const matches = (source, path) => new RegExp('^' + source + '$').test(path);
  const headersFor = (path) => {
    const out = {};
    for (const rule of config.headers) if (matches(rule.source, path)) for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
    return out;
  };
  const publicFile = (path) => {
    const name = path.slice(1);
    if (name.includes('..')) return null;
    for (const entry of allowlist) {
      if (entry.endsWith('/') ? name.startsWith(entry) : name === entry) {
        const file = ROOT + name;
        return existsSync(file) && statSync(file).isFile() ? file : null;
      }
    }
    return null;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    requests.push({ method: req.method, path: url.pathname + url.search });
    const route = routes[url.pathname];
    if (route) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const handler = route[req.method];
      if (control.delayMs && req.method === 'POST') await new Promise((r) => setTimeout(r, control.delayMs));
      const quiet = console.error; console.error = () => {};
      let response;
      try {
        response = (control.failPosts && req.method === 'POST' || control.failQuick && req.method === 'PUT') && url.pathname === '/api/journal'
          ? new Response(JSON.stringify({ error: 'down' }), { status: 500, headers: { 'cache-control': 'no-store' } })
          : handler
            ? await handler(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : body }))
            : new Response('', { status: 405 });
      } finally { console.error = quiet; }
      let payload = Buffer.from(await response.arrayBuffer());
      let status = response.status;
      // loseFirstAnswers: the change is made, and the answer never arrives, once for
      // each distinct change. The window sends it again.
      if (control.loseFirstAnswers && req.method === 'POST' && url.pathname === '/api/journal' && body && body.toString().includes(control.loseFirstAnswers)) {
        const key = body.toString();
        if (!lost.has(key)) { lost.add(key); payload = Buffer.from(JSON.stringify({ error: 'answer lost' })); status = 502; }
      }
      let headers = Object.fromEntries(response.headers);
      // staleGets: every read of the journal answers with the first answer this
      // address gave after the switch was turned on, however much has been saved
      // since, as a store that shows the file as it was would.
      if (control.staleGets && req.method === 'GET' && url.pathname === '/api/journal') {
        if (!frozen.has(req.url)) frozen.set(req.url, { payload, status, headers });
        ({ payload, status, headers } = frozen.get(req.url));
      } else if (!control.staleGets) frozen.clear();
      res.writeHead(status, headers);
      res.end(payload);
      return;
    }
    let path = url.pathname;
    for (const rule of config.rewrites) if (matches(rule.source, path)) path = rule.destination;
    if (path === '/journal/' || path === '/notes/') path += 'index.html';
    let file = publicFile(path);
    if (file && pageFile && path === '/journal/index.html') file = pageFile;
    if (!file) { res.writeHead(404); res.end('not found'); return; }
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', ...headersFor(url.pathname) });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${port}`, password, journalStore, notesStore, control, requests,
    close: () => new Promise((r) => server.close(r)),
  };
}
