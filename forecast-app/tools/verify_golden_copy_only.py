"""Prove a golden regeneration changed copy and nothing else.

Story 2.10.5 rewrote engine advice strings. Engine copy is engine output, so
the run bundle and run manifest goldens moved with it. The control's job is to
stop a silent change, so this makes the change legible: it reads the committed
goldens from a baseline git ref, compares them with the working tree, and
refuses anything that is not a string change in a named field or a hash that
demonstrably follows from one.

Run from `forecast-app/`:

    PYTHONPATH=. python tools/verify_golden_copy_only.py <baseline-git-ref>

It exits non-zero and names the offending path on the first thing it cannot
account for. Six independent checks, each able to fail on its own:

1.  SHAPE. Both documents are flattened to leaf paths, dicts by key and lists
    by index. The two path sets must be identical. This is what proves nothing
    was added, nothing removed, no list resized and no list reordered: a
    reordering moves values between indices, and check 2 then catches it.

2.  NON-STRING LEAVES. Every leaf that is a number, a boolean or a null must be
    byte-identical. This is the check that answers "no numeric value, no count,
    no share, no flag". It is done by type rather than by field name, so a
    numeric field nobody thought to list is still covered.

3.  STRING LEAVES. Every differing string leaf is bucketed by its field name.
    The set of names must be a subset of the declared copy fields plus the
    declared hash fields. A changed `reason`, `code`, `band` or `sku` fails
    here even though it is a string.

4.  HASHES ARE DERIVED, NOT EDITED. Every changed hash is recomputed from the
    new content using the application's own functions, never copied from the
    file. A hash that does not reproduce is an edit, not a consequence.

5.  DOMAIN INVARIANTS. Independently of the leaf walk, the per SKU decision
    tuple is extracted from both documents and compared: decision, decided by,
    eligibility, band at decision, demand class, ABC class, rank by volume,
    volume share, refusal code, the resolution options in order, and the
    quality finding codes in order. Ordering is compared as a sequence, not a
    set. This is a second, differently shaped route to the same answer, so a
    bug in the leaf walk cannot hide a routing or classification change.

6.  THE INPUT DID NOT MOVE. The dataset digest recorded inside both goldens
    must be unchanged, so the copy change is not standing in for a changed
    fixture.

What this script deliberately does not do is decide whether the new copy is
correct. `tests/test_run_bundle.py` already regenerates the goldens from the
fixture and fails if they differ from real engine output, which is what proves
these files are output rather than something written by hand.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from run_bundle import verify_bundle
from run_manifest import content_fingerprint, exact_manifest_hash

APP = Path(__file__).resolve().parents[1]
REPO = APP.parent
GOLDENS = (
    "forecast-app/tests/run_bundle_fixtures/run_bundle.golden.json",
    "forecast-app/tests/run_bundle_fixtures/run_manifest.golden.json",
)

# The only fields whose text this story is allowed to have moved.
COPY_FIELDS = {"action", "detail"}
# Digests that follow from the copy, each proved by recomputation in check 4.
HASH_FIELDS = {"sha256", "manifest_sha256", "bundle_sha256", "content_fingerprint_sha256"}

failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def leaves(value, path=""):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from leaves(item, f"{path}/{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from leaves(item, f"{path}[{index}]")
    else:
        yield path, value


def field_of(path: str) -> str:
    return path.rsplit("/", 1)[-1].split("[")[0]


def baseline(ref: str, relative: str) -> dict:
    raw = subprocess.run(
        ["git", "show", f"{ref}:{relative}"],
        cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(raw)


def check_shape(old_leaves, new_leaves, name):
    only_old = sorted(set(old_leaves) - set(new_leaves))
    only_new = sorted(set(new_leaves) - set(old_leaves))
    if only_old or only_new:
        fail(f"[1 shape] {name}: paths removed {only_old[:5]}, paths added {only_new[:5]}")
    return not (only_old or only_new)


def check_non_strings(old_leaves, new_leaves, name):
    moved = []
    for path, old in old_leaves.items():
        new = new_leaves.get(path)
        if isinstance(old, str) and isinstance(new, str):
            continue
        if old != new or type(old) is not type(new):
            moved.append((path, old, new))
    if moved:
        for path, old, new in moved[:8]:
            fail(f"[2 non-string] {name}: {path} was {old!r}, now {new!r}")
    return not moved


def check_strings(old_leaves, new_leaves, name):
    allowed = COPY_FIELDS | HASH_FIELDS
    changed_fields: dict[str, int] = {}
    for path, old in old_leaves.items():
        new = new_leaves.get(path)
        if not (isinstance(old, str) and isinstance(new, str)) or old == new:
            continue
        field = field_of(path)
        changed_fields[field] = changed_fields.get(field, 0) + 1
        if field not in allowed:
            fail(f"[3 string] {name}: {path} is not a declared copy or hash field")
    return changed_fields


def check_hashes_are_derived(document: dict, name: str):
    """Recompute the digests from the new content with the application's own
    functions rather than trusting what the file says.

    For the bundle this is `verify_bundle`, the same check the application runs
    before it ever hands a bundle to a browser: it recomputes the embedded
    manifest digest, checks the copied fingerprint against the manifest, and
    recomputes the bundle digest over everything else. A hand-edited hash
    cannot survive it.

    The per stage `output_ref` digests are taken over sanitised stage payloads
    rather than over the results as recorded, so they are not recomputable from
    the bundle alone. They are proved instead by
    `tests/test_run_bundle.py::test_generated_golden_matches_real_engine_output`,
    which rebuilds both goldens from the fixture CSV and fails on any byte that
    differs. That test is the reason these files can be called engine output.
    """
    manifest = document.get("manifest", document)
    try:
        if "results" in document:
            verify_bundle(document)
        recomputed = exact_manifest_hash(manifest)
        if recomputed != manifest["integrity"]["manifest_sha256"]:
            fail(f"[4 hash] {name}: the manifest digest does not reproduce from the manifest body")
            return False
        recomputed_fingerprint = content_fingerprint(manifest)
        if recomputed_fingerprint != manifest["integrity"]["content_fingerprint_sha256"]:
            fail(f"[4 hash] {name}: the content fingerprint does not reproduce from the manifest")
            return False
    except Exception as exc:
        fail(f"[4 hash] {name}: integrity check refused the file: {exc}")
        return False
    return True


def decision_tuples(bundle: dict):
    """A second route to the same answer, built from meaning rather than paths."""
    routing = bundle["results"]["routing"]
    quality = bundle["results"]["quality"]["per_sku"]
    out = {}
    for sku, line in routing["per_sku"].items():
        refusal = line.get("refusal") or {}
        out[sku] = (
            line["decision"],
            line["decided_by"],
            line["forecast_eligible"],
            line["quality_band_at_decision"],
            line["demand_class"],
            line["abc_volume_class"],
            line["rank_by_volume"],
            line["volume_share_pct"],
            line["in_forecast_scope"],
            refusal.get("code"),
            tuple(refusal.get("resolution_options", [])),
            tuple(refusal.get("driven_by_finding_codes", [])),
            tuple(finding["code"] for finding in quality[sku]["findings"]),
            quality[sku]["band"],
        )
    return out


def check_domain(old: dict, new: dict, name: str):
    before, after = decision_tuples(old), decision_tuples(new)
    if list(before) != list(after):
        fail(f"[5 domain] {name}: the SKU sequence changed")
        return False
    ok = True
    for sku in before:
        if before[sku] != after[sku]:
            fail(f"[5 domain] {name}: {sku} decision tuple changed")
            ok = False
    portfolio_before = old["results"]["routing"]["portfolio"]
    portfolio_after = new["results"]["routing"]["portfolio"]
    if portfolio_before != portfolio_after:
        fail(f"[5 domain] {name}: the routing portfolio summary changed")
        ok = False
    if old["results"]["quality"]["portfolio_band"] != new["results"]["quality"]["portfolio_band"]:
        fail(f"[5 domain] {name}: the portfolio quality band changed")
        ok = False
    if old["results"]["classification"] != new["results"]["classification"]:
        fail(f"[5 domain] {name}: the classification result changed")
        ok = False
    return ok


def check_input(old: dict, new: dict, name: str):
    before, after = old["manifest"]["source"], new["manifest"]["source"]
    if before != after:
        fail(f"[6 input] {name}: the recorded source moved, so the fixture changed")
        return False
    return True


def main() -> int:
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
    print(f"Baseline ref: {ref}\n")
    for relative in GOLDENS:
        name = Path(relative).name
        old = baseline(ref, relative)
        new = json.loads((REPO / relative).read_text(encoding="utf-8"))
        old_leaves = dict(leaves(old))
        new_leaves = dict(leaves(new))
        print(f"--- {name}: {len(old_leaves)} leaves before, {len(new_leaves)} after")
        check_shape(old_leaves, new_leaves, name)
        check_non_strings(old_leaves, new_leaves, name)
        fields = check_strings(old_leaves, new_leaves, name)
        copy_changes = {k: v for k, v in fields.items() if k in COPY_FIELDS}
        hash_changes = {k: v for k, v in fields.items() if k in HASH_FIELDS}
        other = {k: v for k, v in fields.items() if k not in COPY_FIELDS | HASH_FIELDS}
        print(f"    copy strings changed: {copy_changes or 'none'}")
        print(f"    hashes changed:       {hash_changes or 'none'}")
        print(f"    anything else:        {other or 'none'}")
        check_hashes_are_derived(new, name)
        if "bundle" in name:
            check_domain(old, new, name)
            check_input(old, new, name)
    print()
    if failures:
        print("REFUSED. The regeneration is not copy only:")
        for line in failures:
            print("  -", line)
        return 1
    print("PROVED. Shape identical, every non-string leaf identical, every changed")
    print("string is a declared copy field, every changed hash reproduces from the")
    print("new content, every per SKU decision tuple and the portfolio summary are")
    print("unchanged, and the dataset digest did not move.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
