import unittest
import sys
from datetime import date
from types import ModuleType
from types import SimpleNamespace

try:
    import google.auth.identity_pool  # noqa: F401
except ModuleNotFoundError:
    google = ModuleType("google")
    auth = ModuleType("google.auth")
    identity_pool = ModuleType("google.auth.identity_pool")
    identity_pool.SubjectTokenSupplier = object
    auth.identity_pool = identity_pool
    google.auth = auth
    sys.modules.setdefault("google", google)
    sys.modules.setdefault("google.auth", auth)
    sys.modules.setdefault("google.auth.identity_pool", identity_pool)

from bigquery_timesfm import BigQueryTimesFMProvider


class FakeQueryJobConfig:
    def __init__(self, **values):
        self.__dict__.update(values)


class FakeBigQuery:
    QueryJobConfig = FakeQueryJobConfig

    @staticmethod
    def ArrayQueryParameter(name, kind, values):
        return {"name": name, "kind": kind, "values": values}


class FakeJob:
    def __init__(self, cache_hit=False):
        self.cache_hit = cache_hit

    def result(self):
        return [SimpleNamespace(forecast_value=12.5, ai_forecast_status=None)]


class FakeClient:
    def __init__(self, job):
        self.job = job
        self.calls = []

    def query(self, query, *, job_config, location):
        self.calls.append({"query": query, "job_config": job_config, "location": location})
        return self.job


def provider_for(job):
    provider = BigQueryTimesFMProvider.__new__(BigQueryTimesFMProvider)
    provider._bigquery = FakeBigQuery
    provider._client = FakeClient(job)
    provider._location = "europe-west2"
    provider._maximum_bytes = 10_000_000
    provider.last_cache_hit = True
    return provider


class BigQueryTimesFMTests(unittest.TestCase):
    def test_forecast_disables_cache_and_pins_london(self):
        provider = provider_for(FakeJob(cache_hit=False))
        result = provider.forecast([10.0], 1, [date(2026, 1, 1)])
        call = provider._client.calls[0]
        self.assertEqual(result, [12.5])
        self.assertFalse(call["job_config"].use_query_cache)
        self.assertEqual(call["location"], "europe-west2")
        self.assertFalse(provider.last_cache_hit)

    def test_any_production_cache_hit_stops_the_run(self):
        provider = provider_for(FakeJob(cache_hit=True))
        with self.assertRaisesRegex(RuntimeError, "cached forecast result"):
            provider.forecast([10.0], 1, [date(2026, 1, 1)])


if __name__ == "__main__":
    unittest.main()
