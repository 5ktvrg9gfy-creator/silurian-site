// Builds the folder the marketing Vercel project serves: a copy of exactly the
// files named in site-allowlist.txt and nothing else. Vercel serves that folder
// (outputDirectory in vercel.json), so a file that is not on the list is not
// deployed and answers 404. A new file is private until someone adds it.
//
// Plain Node with no dependencies, so the build needs no install step.
//
//   node scripts/build-public.mjs [--root <repository>] [--out <folder>]

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const root = resolve(option("--root", join(dirname(fileURLToPath(import.meta.url)), "..")));
const out = resolve(option("--out", join(root, "public")));

function fail(message) {
  console.error(`build-public: ${message}`);
  process.exit(1);
}

const inside = (parent, child) => child !== parent && child.startsWith(parent + sep);

// The output folder is emptied before every build, so it must never be the
// repository or anything that holds it.
if (out === root || root.startsWith(out + sep)) fail("the output folder must not be the repository or contain it");

const entries = readFileSync(join(root, "site-allowlist.txt"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

if (entries.length === 0) fail("the allowlist is empty");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let copied = 0;
for (const entry of entries) {
  if (isAbsolute(entry) || entry.startsWith("/") || entry.split("/").includes("..") || /[*?[\]{}!]/.test(entry)) {
    fail(`"${entry}" is not a plain relative path`);
  }
  const source = resolve(root, entry);
  if (!inside(root, source)) fail(`"${entry}" is outside the repository`);
  // A missing file stops the build. A public page that silently turned into a
  // 404 would be worse than a failed deploy.
  if (!existsSync(source)) fail(`"${entry}" is on the allowlist but does not exist`);
  if (entry.endsWith("/") !== statSync(source).isDirectory()) fail(`"${entry}" must end in a slash exactly when it is a directory`);
  cpSync(source, join(out, relative(root, source)), { recursive: true });
  copied += 1;
}

console.log(`build-public: ${copied} allowlist entries copied to ${relative(root, out) || "."}`);
