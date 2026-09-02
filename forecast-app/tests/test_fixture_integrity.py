import hashlib
import json
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).parents[2]
TESTS = Path(__file__).parent
MANIFEST = TESTS / "fixture_hashes.json"
FIXTURE_DIRECTORIES = (
    TESTS / "fixtures",
    TESTS / "quality_fixtures",
    TESTS / "classification_fixtures",
    TESTS / "run_manifest_fixtures",
    TESTS / "run_bundle_fixtures",
)


def controlled_paths():
    paths = {
        path
        for directory in FIXTURE_DIRECTORIES
        for path in directory.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    }
    paths.update(TESTS.rglob("expected_*.json"))
    return {
        path.relative_to(REPOSITORY).as_posix(): path
        for path in paths
    }


class FixtureIntegrityTests(unittest.TestCase):
    def test_committed_fixture_hashes_are_unchanged(self):
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["algorithm"], "sha256")
        recorded = manifest["files"]
        discovered = controlled_paths()
        self.assertEqual(
            set(recorded),
            set(discovered),
            "Fixture integrity manifest is incomplete. "
            f"Missing records: {sorted(set(discovered) - set(recorded))}; "
            f"obsolete records: {sorted(set(recorded) - set(discovered))}",
        )
        for relative_path in sorted(recorded):
            actual = hashlib.sha256(discovered[relative_path].read_bytes()).hexdigest()
            self.assertEqual(
                recorded[relative_path],
                actual,
                f"Fixture integrity check failed for {relative_path}: "
                f"expected {recorded[relative_path]}, got {actual}. "
                "Restore the approved committed bytes or review and record the intended fixture change.",
            )


if __name__ == "__main__":
    unittest.main()
