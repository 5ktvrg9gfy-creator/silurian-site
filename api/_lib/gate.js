// A password gate for the private notes page, modelled on
// forecast-app/access_gate.py and deliberately not shared with it. The two
// products deploy separately and a change to one gate must never reach the other.
//
// The password is never stored, logged or returned. It is read from the
// environment on every request and compared in constant time. The session
// cookie carries an expiry and a signature, and the signing key is derived from
// the password, so changing the password in Vercel invalidates every cookie
// already issued. The gate holds no state, which is what makes it safe on a
// serverless platform where any request can land on a cold instance.
//
// With no password configured the gate refuses everything. It never opens up.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The name is public configuration. The value is set in Vercel by the owner and
// is never committed, defaulted or printed.
export const ENVIRONMENT_VARIABLE = "SILURIAN_NOTES_PASSWORD";

export const COOKIE_NAME = "silurian_notes";

export const SESSION_SECONDS = 30 * 24 * 60 * 60;

// Fixed, not random. A wrong password costs the same every time.
export const FAILURE_DELAY_MS = 1000;

// A password longer than this is wrong by definition and is not hashed.
export const MAX_PASSWORD_BYTES = 1024;

// Domain separation, so a signature from this scheme cannot be replayed into
// the Assay gate or any other use of the same password.
const SIGNING_CONTEXT = "silurian-notes-gate-v1";

// The cookie is only ever sent to the API. Static pages never see it.
const COOKIE_PATH = "/api";

export function configuredPassword(env) {
  const raw = env[ENVIRONMENT_VARIABLE];
  if (typeof raw !== "string") return null;
  // A value pasted into a dashboard field commonly picks up a trailing newline.
  const password = raw.trim();
  return password === "" ? null : password;
}

function signingKey(password) {
  return createHash("sha256").update(`${SIGNING_CONTEXT}:${password}`, "utf8").digest();
}

function signature(password, payload) {
  return createHmac("sha256", signingKey(password)).update(payload, "ascii").digest("hex");
}

function sameBytes(a, b) {
  // Hashing first gives both sides one length, so timingSafeEqual never throws
  // and the comparison time does not depend on how long either input is.
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

export function passwordIsCorrect(supplied, password) {
  if (typeof supplied !== "string" || password === null) return false;
  if (Buffer.byteLength(supplied, "utf8") > MAX_PASSWORD_BYTES) return false;
  return sameBytes(supplied, password);
}

export function issueCookieValue(password, nowMs) {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${signature(password, payload)}`;
}

export function cookieIsValid(value, password, nowMs) {
  if (password === null || typeof value !== "string") return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const payload = value.slice(0, dot);
  const supplied = value.slice(dot + 1);
  if (!/^[0-9]{1,15}$/.test(payload)) return false;
  if (Number(payload) <= Math.floor(nowMs / 1000)) return false;
  return sameBytes(supplied, signature(password, payload));
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

export function requestIsSignedIn(request, env, nowMs) {
  const password = configuredPassword(env);
  if (password === null) return false;
  return cookieIsValid(readCookie(request, COOKIE_NAME), password, nowMs);
}

export function sessionCookieHeader(password, nowMs) {
  return [
    `${COOKIE_NAME}=${issueCookieValue(password, nowMs)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${SESSION_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}
