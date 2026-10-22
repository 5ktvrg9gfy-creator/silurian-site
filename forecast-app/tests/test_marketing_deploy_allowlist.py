"""The marketing site deploys an allowlist, never the whole repository.

Found on 17 October 2026: the static project served the repository root in full,
so CLAUDE.md, PROJECT_HANDOFF.md, docs/ and forecast-app/ were public on
Production. The fix is that the project serves a folder built by
`scripts/build-public.mjs` from `site-allowlist.txt`, and nothing else.

The list is pinned twice on purpose, here and in `site-allowlist.txt`. A file
becomes public only when both agree, so it cannot be published by editing one
place or by dropping a file in the repository. This test deliberately has no way
to pass by deriving its expectation from the file it is checking.
"""

import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).parents[2]
SCRIPT = REPOSITORY / "scripts" / "build-public.mjs"

# Every file the public site is allowed to serve. Adding to this is a decision to
# publish, which is why it is typed out and not read from the allowlist.
PUBLIC_FILES = frozenset(
    {
        "index.html",
        "delivery.html",
        "forecast-risk.html",
        "forecastability.html",
        "privacy.html",
        "tokens.css",
        "logo-stone.svg",
        "assets/fonts/Archivo-Variable.ttf",
        "assets/fonts/OFL.txt",
        "assets/hero-stone.svg",
        "notes/index.html",
        "journal/index.html",
        "journal/core.js",
        "journal/manifest.webmanifest",
        "journal/icon-32.png",
        "journal/icon-192.png",
        "journal/icon-512.png",
        "journal/icon-512-maskable.png",
        "journal/apple-touch-icon.png",
    }
)

PAGES = ("index.html", "delivery.html", "forecast-risk.html", "forecastability.html", "privacy.html")

# A reference a page makes to another file on the same site.
LOCAL_REFERENCE = re.compile(r"""(?:\bhref|\bsrc)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)""")


def node() -> str:
    path = shutil.which("node")
    if path is None:
        raise AssertionError(
            "node is not installed, so the allowlist build did not run. Install Node 22."
        )
    return path


def build(root: Path, out: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [node(), str(SCRIPT), "--root", str(root), "--out", str(out)],
        capture_output=True,
        text=True,
        timeout=60,
    )


def files_under(folder: Path) -> set[str]:
    return {path.relative_to(folder).as_posix() for path in folder.rglob("*") if path.is_file()}


def tracked_files() -> set[str]:
    listing = subprocess.run(
        ["git", "ls-files", "-z"], cwd=REPOSITORY, capture_output=True, check=True
    ).stdout
    return {name for name in listing.decode("utf-8").split("\0") if name}


class MarketingDeployAllowlist(unittest.TestCase):
    def setUp(self) -> None:
        self.work = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.work, ignore_errors=True)

    def test_the_project_serves_the_built_folder_and_nothing_overrides_it(self) -> None:
        config = json.loads((REPOSITORY / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual(config.get("buildCommand"), "node scripts/build-public.mjs")
        self.assertEqual(config.get("outputDirectory"), "public")
        for key in ("builds", "routes", "redirects", "cleanUrls", "trailingSlash"):
            self.assertNotIn(key, config, f"vercel.json sets {key}, which can change what is served")
        # The notes page and the journal are the only paths with rules of their own.
        for rule in (*config.get("rewrites", []), *config.get("headers", [])):
            self.assertRegex(rule["source"], r"^/(notes|journal)(/\(\.\*\))?$", f"{rule['source']} is not a /notes or /journal rule")
        gitignore = (REPOSITORY / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("public/", gitignore, "the build output must never be committed")
        self.assertNotIn("public", {name.split("/")[0] for name in tracked_files()})

    def test_only_the_pinned_public_files_are_deployed(self) -> None:
        out = self.work / "public"
        result = build(REPOSITORY, out)
        self.assertEqual(result.returncode, 0, result.stderr)
        deployed = files_under(out)
        self.assertEqual(
            deployed - PUBLIC_FILES,
            set(),
            "These files would be public but are not in the pinned list: "
            + ", ".join(sorted(deployed - PUBLIC_FILES)),
        )
        self.assertEqual(
            PUBLIC_FILES - deployed,
            set(),
            "These public files would not be deployed: " + ", ".join(sorted(PUBLIC_FILES - deployed)),
        )

    def test_no_tracked_file_outside_the_list_is_deployed(self) -> None:
        out = self.work / "public"
        self.assertEqual(build(REPOSITORY, out).returncode, 0)
        deployed = files_under(out)
        private = tracked_files() - PUBLIC_FILES
        # Zero private files would mean the check saw nothing.
        self.assertGreater(len(private), 100, f"only {len(private)} private tracked files were checked")
        tracked = tracked_files()
        for name in ("CLAUDE.md", "PROJECT_HANDOFF.md", "MAINTENANCE.md", ".gitattributes", ".gitignore", "vercel.json", "site-allowlist.txt"):
            self.assertTrue(name in tracked, f"{name} should be tracked and private")
        leaked = sorted(private & deployed)
        self.assertEqual(leaked, [], "Private tracked files would be deployed: " + ", ".join(leaked))
        for prefix in ("docs/", "forecast-app/", "scripts/", "tests/"):
            self.assertFalse(any(name.startswith(prefix) for name in deployed), prefix)

    def test_a_new_file_is_private_by_default(self) -> None:
        # A copy of the public files plus decoys, as it would look the day someone
        # adds a file and forgets the allowlist.
        source = self.work / "repo"
        source.mkdir()
        shutil.copy(REPOSITORY / "site-allowlist.txt", source)
        for name in PUBLIC_FILES:
            target = source / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(REPOSITORY / name, target)
        decoys = ["CLAUDE.md", "notes.html", "docs/plan.md", "forecast-app/app.py", "private.json", "assets/../sibling.txt"]
        for name in decoys:
            target = source / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("decoy", encoding="utf-8")
        out = self.work / "public"
        self.assertEqual(build(source, out).returncode, 0)
        deployed = files_under(out)
        self.assertEqual(deployed, set(PUBLIC_FILES))
        for decoy in ("CLAUDE.md", "notes.html", "docs/plan.md", "forecast-app/app.py", "private.json", "sibling.txt"):
            self.assertNotIn(decoy, deployed)

    def test_every_local_file_the_pages_load_is_deployed(self) -> None:
        out = self.work / "public"
        self.assertEqual(build(REPOSITORY, out).returncode, 0)
        deployed = files_under(out)
        checked = 0
        for name in (*PAGES, "tokens.css"):
            text = (REPOSITORY / name).read_text(encoding="utf-8")
            for match in LOCAL_REFERENCE.finditer(text):
                reference = (match.group(1) or match.group(2)).strip()
                if re.match(r"^(?:[a-z][a-z0-9+.-]*:|//|data:)", reference, re.I) or reference.startswith("/_vercel/"):
                    continue
                target = reference.lstrip("/")
                checked += 1
                self.assertIn(target, deployed, f"{name} loads {reference}, which would answer 404")
        self.assertGreater(checked, 25, f"only {checked} references were read")

    def test_a_missing_allowlisted_file_stops_the_build(self) -> None:
        source = self.work / "repo"
        source.mkdir()
        (source / "site-allowlist.txt").write_text("index.html\nmissing.html\n", encoding="utf-8")
        (source / "index.html").write_text("x", encoding="utf-8")
        result = build(source, self.work / "public")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing.html", result.stderr)

    def test_the_build_refuses_paths_that_could_reach_outside_the_list(self) -> None:
        for bad in ("../outside.txt", "/etc/passwd", "docs/*.md", "assets/{a,b}", "sub/../../x"):
            source = self.work / "repo"
            shutil.rmtree(source, ignore_errors=True)
            source.mkdir()
            (source / "site-allowlist.txt").write_text(f"index.html\n{bad}\n", encoding="utf-8")
            (source / "index.html").write_text("x", encoding="utf-8")
            result = build(source, self.work / "public")
            self.assertNotEqual(result.returncode, 0, f"{bad} was accepted")

    def test_the_build_never_empties_the_repository(self) -> None:
        source = self.work / "repo"
        source.mkdir()
        (source / "site-allowlist.txt").write_text("index.html\n", encoding="utf-8")
        (source / "index.html").write_text("x", encoding="utf-8")
        for out in (source, self.work):
            result = build(source, out)
            self.assertNotEqual(result.returncode, 0, f"output {out} was accepted")
            self.assertTrue((source / "index.html").exists())


if __name__ == "__main__":
    unittest.main()
