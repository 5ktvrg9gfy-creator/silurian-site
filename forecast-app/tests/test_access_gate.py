"""The password gate: blocks when set, allows on the right value, refuses the
wrong one, and is not there at all when the variable is unset.

The gate reads the environment on every request, so these tests turn it on and
off with `os.environ` rather than reloading the application. Every test restores
the variable, and `setUp` asserts the starting state, because a gate left on by
one test would fail the rest of the suite in a way that looks like a defect in
the diagnostic instead of a defect here.

The password used below is a test string. The real value is set in Vercel by the
owner and is not in this repository.
"""

import inspect
import sys
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))

import os

import access_gate
import app as app_module


TEST_PASSWORD = "a-test-value-not-the-real-one"


class AccessGateTests(unittest.TestCase):
    def setUp(self):
        self.previous = os.environ.pop(access_gate.ENVIRONMENT_VARIABLE, None)
        self.assertIsNone(access_gate.configured_password())

    def tearDown(self):
        os.environ.pop(access_gate.ENVIRONMENT_VARIABLE, None)
        if self.previous is not None:
            os.environ[access_gate.ENVIRONMENT_VARIABLE] = self.previous

    def gate_on(self, value=TEST_PASSWORD):
        os.environ[access_gate.ENVIRONMENT_VARIABLE] = value

    def client(self):
        return TestClient(app_module.app, follow_redirects=False)

    # 1. Absent when the variable is unset.

    def test_the_application_is_ungated_when_the_variable_is_unset(self):
        client = self.client()
        landing = client.get("/")
        self.assertEqual(landing.status_code, 200)
        self.assertIn("Silurian Assay", landing.text)
        self.assertNotIn(access_gate.RESTRICTED_LINE, landing.text)
        self.assertEqual(client.get("/health").status_code, 200)
        self.assertEqual(client.get("/api/glossary").status_code, 200)
        self.assertEqual(client.get("/sample-portfolio.csv").status_code, 200)

    def test_a_blank_variable_counts_as_unset(self):
        self.gate_on("   ")
        self.assertIsNone(access_gate.configured_password())
        self.assertEqual(self.client().get("/").status_code, 200)

    # 2. Blocks when the variable is set.

    def test_no_page_or_endpoint_serves_anything_while_the_gate_is_shut(self):
        self.gate_on()
        client = self.client()
        for path in ("/", "/health", "/sample-data.csv", "/sample-portfolio.csv", "/workspace-assets/logo-stone.svg"):
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual(response.status_code, 401)
                self.assertIn(access_gate.RESTRICTED_LINE, response.text)
                self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_the_api_is_shut_and_answers_as_json(self):
        self.gate_on()
        client = self.client()
        glossary = client.get("/api/glossary")
        self.assertEqual(glossary.status_code, 401)
        self.assertEqual(glossary.json(), {"detail": access_gate.LOCKED_DETAIL})
        upload = client.post("/api/validate", files={"file": ("demand.csv", b"sku,date,demand\n", "text/csv")})
        self.assertEqual(upload.status_code, 401)
        self.assertEqual(upload.json(), {"detail": access_gate.LOCKED_DETAIL})

    def test_the_landing_page_leaks_no_workspace_content_while_shut(self):
        self.gate_on()
        page = self.client().get("/").text
        for marker in ("data-workspace-panel", "Portfolio classification matrix", "runReadiness", "Open items"):
            with self.subTest(marker=marker):
                self.assertNotIn(marker, page)

    def test_only_the_typeface_is_served_before_the_password(self):
        self.gate_on()
        client = self.client()
        self.assertEqual(client.get("/workspace-assets/Archivo-Variable.ttf").status_code, 200)
        self.assertEqual(client.get("/workspace-assets/logo-stone.svg").status_code, 401)

    # 3. Allows through on the correct value, refuses a wrong one.

    def test_the_correct_password_opens_the_tool_for_the_session(self):
        self.gate_on()
        client = self.client()
        submitted = client.post("/access", data={"password": TEST_PASSWORD})
        self.assertEqual(submitted.status_code, 303)
        self.assertEqual(submitted.headers["location"], "/")
        cookie = submitted.cookies.get(access_gate.COOKIE_NAME)
        self.assertIsNotNone(cookie)
        landing = client.get("/")
        self.assertEqual(landing.status_code, 200)
        self.assertIn("data-workspace-panel", landing.text)
        self.assertEqual(client.get("/api/glossary").status_code, 200)

    def test_a_wrong_password_is_refused_and_says_only_that(self):
        self.gate_on()
        response = self.client().post("/access", data={"password": "not-the-value"})
        self.assertEqual(response.status_code, 401)
        self.assertIn(access_gate.INCORRECT_LINE, response.text)
        self.assertIsNone(response.cookies.get(access_gate.COOKIE_NAME))
        self.assertEqual(self.client().get("/").status_code, 401)

    def test_a_refusal_hints_at_nothing(self):
        """No length, no format, no word about whether a gate is configured."""
        self.gate_on()
        shut = self.client().post("/access", data={"password": "wrong"}).text
        os.environ.pop(access_gate.ENVIRONMENT_VARIABLE, None)
        ungated = self.client().post("/access", data={"password": "wrong"}).text
        self.assertEqual(shut, ungated)
        self.assertNotIn(access_gate.ENVIRONMENT_VARIABLE, shut)
        for word in ("length", "characters", "configured", "not set", "environment", "password protection"):
            with self.subTest(word=word):
                self.assertNotIn(word, shut.lower())

    def test_a_failed_attempt_costs_a_fixed_delay(self):
        self.gate_on()
        started = time.monotonic()
        self.client().post("/access", data={"password": "wrong"})
        self.assertGreaterEqual(time.monotonic() - started, access_gate.FAILURE_DELAY_SECONDS)

    # 4. The comparison and the cookie.

    def test_the_password_is_compared_in_constant_time(self):
        """Read the comparison itself, not the module.

        An earlier version of this test searched the whole file, which stayed
        green when the comparison was swapped for == because the cookie check
        uses compare_digest a few lines away. A control that cannot fail is
        worse than none, so it reads only the function it is about.
        """
        comparison = inspect.getsource(access_gate.password_is_correct)
        self.assertIn("hmac.compare_digest", comparison)
        self.assertNotRegex(comparison, r"return\s+supplied\s*==")
        self.assertNotRegex(comparison, r"return\s+password\s*==")
        cookie_check = inspect.getsource(access_gate.cookie_is_valid)
        self.assertIn("hmac.compare_digest", cookie_check)
        self.assertTrue(access_gate.password_is_correct(TEST_PASSWORD, TEST_PASSWORD))
        self.assertFalse(access_gate.password_is_correct(TEST_PASSWORD[:-1], TEST_PASSWORD))
        self.assertFalse(access_gate.password_is_correct("", TEST_PASSWORD))

    def test_the_cookie_carries_a_signed_expiry_and_never_the_password(self):
        value = access_gate.issue_cookie_value(TEST_PASSWORD)
        self.assertNotIn(TEST_PASSWORD, value)
        self.assertTrue(access_gate.cookie_is_valid(value, TEST_PASSWORD))
        payload, _, signature = value.partition(".")
        self.assertFalse(access_gate.cookie_is_valid(f"{int(payload) + 86400}.{signature}", TEST_PASSWORD))
        self.assertFalse(access_gate.cookie_is_valid(value, "a-different-value"))
        self.assertFalse(access_gate.cookie_is_valid(None, TEST_PASSWORD))
        self.assertFalse(access_gate.cookie_is_valid("nonsense", TEST_PASSWORD))

    def test_an_expired_cookie_is_refused(self):
        stale = access_gate.issue_cookie_value(TEST_PASSWORD, now=time.time() - access_gate.SESSION_SECONDS - 60)
        self.assertFalse(access_gate.cookie_is_valid(stale, TEST_PASSWORD))
        self.gate_on()
        client = self.client()
        client.cookies.set(access_gate.COOKIE_NAME, stale)
        self.assertEqual(client.get("/").status_code, 401)

    def test_changing_the_password_invalidates_every_cookie_already_issued(self):
        old = access_gate.issue_cookie_value(TEST_PASSWORD)
        self.gate_on("a-replacement-value")
        client = self.client()
        client.cookies.set(access_gate.COOKIE_NAME, old)
        self.assertEqual(client.get("/").status_code, 401)

    def test_the_session_cookie_is_http_only_and_same_site(self):
        self.gate_on()
        header = self.client().post("/access", data={"password": TEST_PASSWORD}).headers["set-cookie"]
        self.assertIn("HttpOnly", header)
        self.assertIn("SameSite=lax", header)
        self.assertIn("Path=/", header)
        self.assertIn(f"Max-Age={access_gate.SESSION_SECONDS}", header)

    # 5. Nothing about the gate is written down or handed back.

    def test_the_password_is_never_echoed_to_the_browser(self):
        self.gate_on()
        client = self.client()
        for body in (TEST_PASSWORD, "wrong-but-distinctive-9f2c"):
            with self.subTest(body=body):
                response = client.post("/access", data={"password": body})
                self.assertNotIn(body, response.text)
                self.assertNotIn(body, str(response.headers))

    def test_no_default_password_is_committed(self):
        source = (Path(__file__).parents[1] / "access_gate.py").read_text(encoding="utf-8")
        self.assertIn('os.getenv(ENVIRONMENT_VARIABLE)', source)
        self.assertNotIn('os.getenv(ENVIRONMENT_VARIABLE,', source)
        self.assertNotIn("os.environ.get(ENVIRONMENT_VARIABLE,", source)

    def test_the_startup_line_names_the_state_and_no_value(self):
        self.gate_on()
        with self.assertLogs(access_gate.logger, level="INFO") as recorded:
            access_gate.log_gate_state()
        self.assertEqual(len(recorded.records), 1)
        self.assertIn("Silurian access gate: on", recorded.output[0])
        self.assertNotIn(TEST_PASSWORD, recorded.output[0])
        os.environ.pop(access_gate.ENVIRONMENT_VARIABLE, None)
        with self.assertLogs(access_gate.logger, level="INFO") as recorded:
            access_gate.log_gate_state()
        self.assertIn("Silurian access gate: off", recorded.output[0])

    def test_nothing_about_the_gate_reaches_a_manifest(self):
        """The manifest records named variables only, never the environment.

        A run is driven through the open tool so the assertion is made against a
        real manifest rather than a constructed one.
        """
        self.gate_on()
        client = self.client()
        client.post("/access", data={"password": TEST_PASSWORD})
        fixture = Path(__file__).parent / "fixtures" / "31_routing_portfolio.csv"
        response = client.post(
            "/api/quality",
            files={"file": (fixture.name, fixture.read_bytes(), "text/csv")},
            data={"analysis_date": "2026-08-01"},
        )
        self.assertEqual(response.status_code, 200)
        body = response.text
        self.assertNotIn(TEST_PASSWORD, body)
        self.assertNotIn(access_gate.ENVIRONMENT_VARIABLE, body)
        self.assertNotIn(access_gate.COOKIE_NAME, body)
        manifest = response.json()["manifest"]
        self.assertEqual(
            sorted(manifest["environment"]),
            ["app_version", "git_commit", "key_libraries", "region", "runtime"],
        )


class GateScreenTests(unittest.TestCase):
    """The gate screen is the first thing anyone sees, so it obeys the design
    system and the house copy rules. The existing copy scan lists the production
    files explicitly and does not know about this module, so the same checks are
    made here rather than by widening a test this story must not edit."""

    def setUp(self):
        self.page = access_gate.gate_page()
        self.failed = access_gate.gate_page(error=True)

    def test_the_screen_uses_the_approved_visual_tokens(self):
        self.assertIn("--bg:#f3f2f2", self.page)
        self.assertIn("--surface:#eae9e9", self.page)
        self.assertIn("--text:#3f3d3b", self.page)
        self.assertIn("--ink-deep:#1a1918", self.page)
        self.assertIn("--accent:#ec6917", self.page)
        self.assertIn("font:15px/1.5 Archivo", self.page)
        self.assertIn("border-radius:0!important", self.page)
        self.assertNotIn("Arial", self.page)
        self.assertNotIn("monospace", self.page)

    def test_the_screen_is_one_field_one_button_a_wordmark_and_one_line(self):
        self.assertEqual(self.page.count("<input"), 1)
        self.assertEqual(self.page.count("<button"), 1)
        self.assertEqual(self.page.count("<form"), 1)
        self.assertIn('type="password"', self.page)
        self.assertIn("Silurian Assay", self.page)
        self.assertIn(access_gate.RESTRICTED_LINE, self.page)

    def test_the_screen_explains_nothing_about_what_is_behind_it(self):
        for word in ("forecast", "diagnostic", "demand", "planner", "portfolio", "upload"):
            with self.subTest(word=word):
                self.assertNotIn(word, self.page.lower())

    def test_the_failure_line_appears_only_on_a_failure(self):
        self.assertNotIn(access_gate.INCORRECT_LINE, self.page)
        self.assertIn(access_gate.INCORRECT_LINE, self.failed)
        self.assertIn(access_gate.RESTRICTED_LINE, self.failed)

    def test_the_gate_carries_no_banned_dash_or_banned_phrase(self):
        source = (Path(__file__).parents[1] / "access_gate.py").read_text(encoding="utf-8")
        for text in (source, self.page, self.failed):
            self.assertNotIn("\u2014", text, "em dash in the gate")
            self.assertNotIn("\u2013", text, "en dash in the gate")
            self.assertNotRegex(text, r"(?i)&(?:mdash|ndash|#8212|#8211|#x201[34]);")
            self.assertNotRegex(text, r"(?i)nine[ -]box")


if __name__ == "__main__":
    unittest.main()
