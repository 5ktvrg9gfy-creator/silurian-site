"""Fail the build on a committed credential.

`CLAUDE.md` forbids committing credentials, identity tokens, environment
variable values or private Google Cloud identifiers. That rule had no test
behind it, so it held only while somebody read the file.

The scan runs over every file Git tracks, so it covers the application, the
fixtures, the documentation and the marketing site alike. Binary files are
skipped by content, not by extension. This module is scanned like any other
file: every pattern is written so that its own source text does not match it,
and `test_the_scanner_scans_itself` proves that rather than assuming it.

The production code takes every Google Cloud identifier from an environment
variable, so a literal project, dataset or service account in the tree is a
finding rather than configuration. Public deployment settings such as the
`europe-west2` region are not identifiers and are not matched.
"""

import re
import subprocess
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).parents[2]
SCANNER = Path(__file__).resolve()

# Each pattern names what it catches. Keep them specific: a pattern that fires
# on ordinary prose gets weakened later by whoever it blocks, and a weakened
# secret scan is worse than none because it still reads like coverage.
PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "private key block",
        re.compile(r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----"),
    ),
    (
        "service account JSON: type field",
        re.compile(r"[\"']type[\"']\s*:\s*[\"']service_account[\"']"),
    ),
    (
        "service account JSON: private_key_id or private_key field",
        re.compile(r"[\"']private_key(?:_id)?[\"']\s*:\s*[\"'][^\"']{8,}"),
    ),
    (
        "service account address",
        re.compile(r"[A-Za-z0-9._%+-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com"),
    ),
    (
        "bearer token",
        re.compile(r"[Bb]earer\s+[A-Za-z0-9._~+/-]{20,}={0,2}"),
    ),
    (
        "Google OAuth access token",
        re.compile(r"\bya29\.[A-Za-z0-9_-]{20,}"),
    ),
    (
        "Google OAuth refresh token",
        re.compile(r"\b1//[A-Za-z0-9_-]{30,}"),
    ),
    (
        "Google API key",
        re.compile(r"\bAIza[A-Za-z0-9_-]{35}\b"),
    ),
    (
        "GitHub token",
        re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b"),
    ),
    (
        "AWS access key id",
        re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    ),
    (
        "Slack token",
        re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"),
    ),
    (
        "private key assigned in source",
        re.compile(r"(?i)\b(?:private_key|client_secret|refresh_token|access_token)\s*[:=]\s*[\"'][^\"'\s]{16,}[\"']"),
    ),
    (
        "secret-bearing environment variable given a value",
        re.compile(
            r"(?m)^\s*(?:export\s+)?[A-Z][A-Z0-9_]*"
            r"(?:SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIALS?|PRIVATE_KEY|API_KEY)\s*=\s*"
            r"(?![\"']?(?:$|\s|[\"']\s*$))\S+"
        ),
    ),
    (
        "Google Cloud project path with a literal identifier",
        re.compile(r"\bprojects/[a-z][a-z0-9-]{4,28}[a-z0-9]\b"),
    ),
    (
        # SQL context is required. A bare backticked triple also matches a domain
        # name or a dotted field path, both of which are ordinary in the docs.
        "BigQuery fully qualified table with a literal project",
        re.compile(r"(?i)\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`[a-z][a-z0-9-]{4,28}[a-z0-9]\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+`"),
    ),
    (
        "Google Cloud workload identity pool path",
        re.compile(r"\bworkloadIdentityPools/[A-Za-z0-9_-]{4,}"),
    ),
)


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=REPOSITORY,
        capture_output=True,
        check=True,
    )
    names = [name for name in result.stdout.decode("utf-8").split("\0") if name]
    return [REPOSITORY / name for name in names]


def is_binary(raw: bytes) -> bool:
    return b"\0" in raw[:8192]


def scan_text(text: str) -> list[tuple[str, int, str]]:
    findings = []
    for label, pattern in PATTERNS:
        for match in pattern.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            excerpt = match.group(0)
            if len(excerpt) > 24:
                excerpt = f"{excerpt[:12]}...{len(excerpt)} characters"
            findings.append((label, line, excerpt))
    return findings


def scan_repository(extra_paths: tuple[Path, ...] = ()) -> list[str]:
    findings: list[str] = []
    for path in list(tracked_files()) + list(extra_paths):
        if not path.is_file():
            continue
        raw = path.read_bytes()
        if is_binary(raw):
            continue
        for label, line, excerpt in scan_text(raw.decode("utf-8", errors="replace")):
            relative = path.relative_to(REPOSITORY) if REPOSITORY in path.parents else path
            findings.append(f"{relative}:{line}: {label}: {excerpt}")
    return findings


class SecretScanTests(unittest.TestCase):
    def test_no_committed_credential_anywhere_in_the_tree(self):
        findings = scan_repository()
        self.assertEqual(
            findings,
            [],
            "A credential, identity token or private Google Cloud identifier is committed. "
            "Remove it from the working tree, rotate it, and purge it from history before pushing:\n"
            + "\n".join(findings),
        )

    def test_the_scan_actually_reads_the_repository(self):
        """A scan that silently reads nothing would pass for ever."""
        files = tracked_files()
        self.assertGreater(len(files), 50)
        self.assertIn(REPOSITORY / "CLAUDE.md", files)
        self.assertIn(REPOSITORY / "forecast-app" / "app.py", files)

    def test_the_scanner_scans_itself(self):
        """No pattern may be written so that this file is exempt from it."""
        self.assertIn(SCANNER, {path.resolve() for path in tracked_files()})
        self.assertEqual(scan_text(SCANNER.read_text(encoding="utf-8")), [])

    def test_every_pattern_catches_a_planted_secret(self):
        """Prove each pattern fires, and keep this file clean of its own patterns.

        Every sample is assembled from fragments so the literal secret never
        appears in the source. That is what lets the scanner scan itself
        instead of being exempted from its own rules.
        """
        planted = {
            "private key block": "-----BEGIN RSA PRI" + "VATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----",
            "service account JSON: type field": '{"type": "service_' + 'account"}',
            "service account JSON: private_key_id or private_key field": '{"private_key_id": "0123' + '456789abcdef"}',
            "service account address": "silurian-runner@silurian-forecast-000000.iam.gservice" + "account.com",
            "bearer token": "Authorization: Bearer abcdefghij" + "klmnopqrstuvwxyz012345",
            "Google OAuth access token": "ya29." + "a0AfB_by" + "B" * 24,
            "Google OAuth refresh token": "1//" + "0g" + "B" * 38,
            "Google API key": "AIza" + "B" * 35,
            "GitHub token": "ghp_" + "b" * 36,
            "AWS access key id": "AKIA" + "B" * 16,
            "Slack token": "xoxb-" + "1111111111-2222222222-abcdefghijkl",
            "private key assigned in source": 'client_secret = "abcdefghij' + 'klmnopqrst"',
            "secret-bearing environment variable given a value": "GOOGLE_APPLICATION_CREDENTIALS" + "=/etc/gcp/key.json",
            "Google Cloud project path with a literal identifier": "//iam.googleapis.com/proj" + "ects/silurian-prod-01/locations/global",
            "BigQuery fully qualified table with a literal project": "SELECT * FROM " + "`silurian-prod-01.forecasts.demand`",
            "Google Cloud workload identity pool path": "workloadIdentity" + "Pools/silurian-pool/providers/github",
        }
        self.assertEqual(sorted(planted), sorted(label for label, _ in PATTERNS))
        for label, sample in planted.items():
            with self.subTest(pattern=label):
                caught = {found for found, _, _ in scan_text(sample)}
                self.assertIn(label, caught, "the pattern no longer catches the secret it names")

    def test_public_configuration_is_not_a_finding(self):
        """The rule bans private identifiers, not the deployment settings the repository must carry."""
        allowed = [
            'BIGQUERY_LOCATION = "europe-west2"',
            '"regions": ["lhr1"]',
            'os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()',
            'os.getenv("TIMESFM_REFERENCE_BASELINE_SHA256", "").strip().lower()',
            'f"//iam.googleapis.com/projects/{project_number}/locations/global/"',
            '"https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"',
            "TIMESFM_MEASURE_DETERMINISM=1",
            "APP_VERSION=1.6.0",
            "Never commit credentials, identity tokens, environment variable values or private Google Cloud identifiers.",
            "The service account and workload identity pool are configured outside the repository.",
            "The additional domains `silurianconsultinglimited.co.uk` and `silurianconsultingltd.co.uk` redirect.",
            "`determinism.measurement.max_pct_diff` is recorded in the manifest.",
            "Read `forecast-app/tests/fixture_hashes.json` for the recorded hashes.",
        ]
        for sample in allowed:
            with self.subTest(sample=sample[:48]):
                self.assertEqual(scan_text(sample), [])


if __name__ == "__main__":
    unittest.main()
