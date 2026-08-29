import unittest
from datetime import date

from determinism import measure_forecast_determinism
from run_manifest import ManifestError


class FakeProvider:
    def __init__(self, outputs, cache_hits=None):
        self.outputs = list(outputs)
        self.cache_hits = list(cache_hits or [False] * len(self.outputs))
        self.last_cache_hit = True

    def forecast(self, history, horizon, dates):
        self.last_cache_hit = self.cache_hits.pop(0)
        return self.outputs.pop(0)


class DeterminismTests(unittest.TestCase):
    def test_bitwise_requires_ten_uncached_results(self):
        provider = FakeProvider([[0.0, 10.0]] * 10)
        result = measure_forecast_determinism(provider, [1.0], [date(2026, 1, 1)], 2, environment_ref="test")
        self.assertEqual(result["class"], "bitwise")
        self.assertEqual(result["measurement"]["runs"], 10)
        self.assertEqual(result["measurement"]["zero_denominator_points"], 9)
        self.assertEqual(result["measurement"]["points_compared"], 18)

    def test_tolerant_excludes_zero_from_percentage(self):
        provider = FakeProvider([[0.0, 100.0], [2.0, 101.0]])
        result = measure_forecast_determinism(provider, [1.0], [date(2026, 1, 1)], 2, runs=2, environment_ref="test")
        self.assertEqual(result["class"], "tolerant")
        self.assertEqual(result["measurement"]["max_abs_diff"], 2.0)
        self.assertEqual(result["measurement"]["max_pct_diff"], 1.0)
        self.assertEqual(result["measurement"]["zero_denominator_points"], 1)

    def test_cache_hit_invalidates_measurement(self):
        provider = FakeProvider([[1.0], [1.0]], [False, True])
        with self.assertRaises(ManifestError):
            measure_forecast_determinism(provider, [1.0], [date(2026, 1, 1)], 1, runs=2, environment_ref="test")


if __name__ == "__main__":
    unittest.main()
