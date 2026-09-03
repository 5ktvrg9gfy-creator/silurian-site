"""A password gate in front of the whole Forecast Diagnostic.

Vercel's own password protection is a paid feature, so the gate lives in the
application instead. It is deliberately small and has one job: until the
password is entered, nothing is served.

Three properties are worth stating because they are easy to lose in a later
change.

The password is never stored, never logged, never returned to the browser and
never written to a run manifest or a bundle. It is read from the environment on
every request and compared in constant time. The session cookie carries only an
expiry and a signature, and the signing key is derived from the password, so
changing the password in Vercel invalidates every cookie already issued without
anything else having to be cleared.

Nothing here reveals whether a gate is configured at all. A wrong password and
an unconfigured gate produce the same response after the same delay, and the
message never mentions length, format or configuration.

The gate holds no state, which is what makes it safe on a serverless platform
where any request can land on a cold instance.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time


# The name is public configuration. The value is set in Vercel by the owner and
# is never committed, defaulted or printed.
ENVIRONMENT_VARIABLE = "SILURIAN_ACCESS_PASSWORD"

COOKIE_NAME = "silurian_access"

# Long enough that a planner working through the test pack is asked once, short
# enough that a shared machine does not stay open for a week.
SESSION_SECONDS = 12 * 60 * 60

# Fixed, not random. A wrong password costs the same every time.
FAILURE_DELAY_SECONDS = 1.0

# The form posts here. It is the only path the gate lets through, and it reveals
# nothing: it answers the same way whether or not a gate is configured.
GATE_PATH = "/access"

# The typeface is not content. Without it the gate screen renders in a fallback
# font, which is the one place in the product where the design system would be
# visibly wrong to the person being asked for a password. The stone mark is
# inlined below rather than exempted, so this is the only file served before the
# password, and it carries nothing about the tool.
UNGATED_PATHS = frozenset({"/workspace-assets/Archivo-Variable.ttf"})

# Domain separation, so a signature from this scheme cannot be replayed into
# another use of the same password.
SIGNING_CONTEXT = b"silurian-access-gate-v1"

RESTRICTED_LINE = "Access is restricted."
INCORRECT_LINE = "That password is incorrect."
LOCKED_DETAIL = "Access is restricted"

logger = logging.getLogger("silurian.access")


def configured_password() -> str | None:
    """The password in force, or None when the application runs ungated.

    Surrounding whitespace is stripped because a value pasted into a dashboard
    field commonly picks up a trailing newline, and an invisible character that
    locks the owner out of his own tool is a worse failure than a password that
    cannot begin or end with a space. A variable set to blank counts as unset.
    """
    raw = os.getenv(ENVIRONMENT_VARIABLE)
    if raw is None:
        return None
    password = raw.strip()
    return password or None


def gate_is_configured() -> bool:
    return configured_password() is not None


def log_gate_state() -> None:
    """One line at startup, naming the state and nothing else."""
    if not logger.handlers:
        logger.addHandler(logging.StreamHandler())
        logger.propagate = False
    logger.setLevel(logging.INFO)
    state = "on" if gate_is_configured() else "off"
    logger.info("Silurian access gate: %s", state)


def is_ungated_path(path: str) -> bool:
    return path in UNGATED_PATHS


def _signing_key(password: str) -> bytes:
    return hashlib.sha256(SIGNING_CONTEXT + b":" + password.encode("utf-8")).digest()


def _signature(password: str, payload: str) -> str:
    return hmac.new(_signing_key(password), payload.encode("ascii"), hashlib.sha256).hexdigest()


def issue_cookie_value(password: str, *, now: float | None = None) -> str:
    """A cookie carrying its own expiry and a signature over it.

    The expiry is inside the signed payload, so it cannot be extended by
    editing the cookie.
    """
    expires_at = int((time.time() if now is None else now) + SESSION_SECONDS)
    payload = str(expires_at)
    return f"{payload}.{_signature(password, payload)}"


def cookie_is_valid(value: str | None, password: str, *, now: float | None = None) -> bool:
    if not value or "." not in value:
        return False
    payload, _, supplied = value.partition(".")
    if not payload.isdigit():
        return False
    if int(payload) <= (time.time() if now is None else now):
        return False
    return hmac.compare_digest(supplied, _signature(password, payload))


def password_is_correct(supplied: str, password: str) -> bool:
    """Constant time comparison. Never ==, which returns early on the first
    differing byte and leaks the length of the matching prefix."""
    return hmac.compare_digest(supplied.encode("utf-8"), password.encode("utf-8"))


_STONE_MARK = (
    '<svg class="gate-stone" xmlns="http://www.w3.org/2000/svg" viewBox="110 80 200 290" role="img"'
    ' aria-label="Silurian"><defs><clipPath id="gs"><polygon points="130,180 285,90 300,360 120,360">'
    '</polygon></clipPath><clipPath id="gtop"><rect x="100" y="0" width="240" height="225"></rect>'
    '</clipPath><clipPath id="gbottom"><rect x="100" y="225" width="240" height="200"></rect></clipPath>'
    '</defs><g clip-path="url(#gs)"><g clip-path="url(#gtop)">'
    '<polygon points="130,180 285,90 300,360 120,360" fill="#2b2a29"></polygon>'
    '<polygon points="130,180 285,90 300,330" fill="#3f3d3b"></polygon>'
    '<polygon points="130,180 300,330 300,360 120,360" fill="#1a1918"></polygon>'
    '<polygon points="285,90 300,360 300,330" fill="#111010"></polygon></g>'
    '<g clip-path="url(#gbottom)">'
    '<polygon points="130,180 285,90 300,360 120,360" fill="#c15613"></polygon>'
    '<polygon points="130,180 285,90 300,330" fill="#ec6917"></polygon></g></g></svg>'
)

# Tokens lifted from the marketing site and the workspace, not re-derived.
# Page ground f3f2f2, the panel darker at eae9e9, zero radius, 2px seams,
# Archivo only, orange spent once as the seam above the card.
_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Silurian Assay</title>
<style>
@font-face{font-family:Archivo;src:url('/workspace-assets/Archivo-Variable.ttf') format('truetype');font-weight:100 900;font-display:swap}
:root{--bg:#f3f2f2;--surface:#eae9e9;--text:#3f3d3b;--ink-deep:#1a1918;--accent:#ec6917;--hair:#b7b4b4}
*{box-sizing:border-box;border-radius:0!important}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg);color:var(--text);font:15px/1.5 Archivo,system-ui,sans-serif;font-feature-settings:"tnum" 1}
main{width:min(380px,100%);background:var(--surface);border-top:4px solid var(--accent);padding:28px}
.gate-brand{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:2px solid var(--text)}
.gate-stone{width:18px;height:26px}
.gate-word{font-size:18px;font-weight:800;letter-spacing:-.02em}
.gate-line{margin:18px 0 22px;color:var(--text)}
label{display:block;margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
input,button{width:100%;min-height:44px;border:2px solid var(--text);padding:8px 10px;font:inherit}
input{background:#fff;color:var(--text)}
button{margin-top:14px;border-color:var(--accent);background:var(--accent);color:var(--ink-deep);font-weight:800;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
button:hover{background:#c15613;border-color:#c15613;color:#fff}
input:focus-visible,button:focus-visible{outline:2px solid var(--ink-deep);outline-offset:2px}
.gate-error{margin:0 0 16px;padding:10px 12px;border-left:4px solid var(--accent);background:#fff;font-weight:700}
</style>
</head>
<body>
<main>
<div class="gate-brand">__STONE__<span class="gate-word">Silurian Assay</span></div>
<p class="gate-line">__LINE__</p>
__ERROR__<form method="post" action="__ACTION__">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
<button type="submit">Enter</button>
</form>
</main>
</body>
</html>
"""


def gate_page(error: bool = False) -> str:
    """The gate screen.

    Only the two fixed lines above are ever rendered. The caller chooses whether
    the failure line appears, and cannot choose its words. Nothing the visitor
    submitted is echoed back, so there is no value to escape and no way to turn
    the field into a reflection point.
    """
    error_block = f'<p class="gate-error">{INCORRECT_LINE}</p>\n' if error else ""
    return (
        _PAGE.replace("__STONE__", _STONE_MARK)
        .replace("__LINE__", RESTRICTED_LINE)
        .replace("__ERROR__", error_block)
        .replace("__ACTION__", GATE_PATH)
    )
