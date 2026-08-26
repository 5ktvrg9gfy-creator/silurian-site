import unittest

from forecast_engine import BaselineProvider, ForecastError, analyse, analyse_portfolio, parse_demand_csv, parse_portfolio_csv


CSV = b"""sku,date,demand
TEST-1,2026-01-05,10
TEST-1,2026-01-12,11
TEST-1,2026-01-19,12
TEST-1,2026-01-26,13
TEST-1,2026-02-02,14
TEST-1,2026-02-09,15
TEST-1,2026-02-16,16
TEST-1,2026-02-23,17
TEST-1,2026-03-02,18
TEST-1,2026-03-09,19
TEST-1,2026-03-16,20
TEST-1,2026-03-23,21
"""


class ForecastEngineTests(unittest.TestCase):
    def test_parse_and_analyse(self):
        series = parse_demand_csv(CSV)
        result = analyse(series, BaselineProvider(), 4, 100, 20, 30)
        self.assertEqual(result["sku"], "TEST-1")
        self.assertEqual(len(result["forecast"]), 4)
        self.assertEqual(len(result["inventory_projection"]), 4)
        self.assertTrue(result["baseline_scores"])
        self.assertEqual(result["selected_baseline"], result["baseline_scores"][0]["method"])
        self.assertEqual(result["backtest_periods"], 3)
        for score in result["baseline_scores"]:
            self.assertIn("wape", score)
            self.assertIn("rmse", score)
            self.assertIn("bias_percent", score)

    def test_backtest_selects_lowest_wape(self):
        scores = BaselineProvider().score([10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12])
        self.assertEqual(scores, sorted(scores, key=lambda row: (row["wape"], row["mae"])))

    def test_rejects_multiple_skus(self):
        with self.assertRaises(ForecastError):
            parse_demand_csv(CSV.replace(b"TEST-1,2026-03-23", b"TEST-2,2026-03-23"))

    def test_portfolio_is_ranked_by_risk(self):
        header = b"sku,date,demand,inventory,receipts,safety_stock\n"
        rows = []
        for sku, inventory in (("SAFE", 500), ("RISK", 20)):
            for index in range(12):
                rows.append(f"{sku},2026-{index // 4 + 1:02d}-{index % 4 * 7 + 1:02d},10,{inventory},0,30\n".encode())
        result = analyse_portfolio(parse_portfolio_csv(header + b"".join(rows)), BaselineProvider(), 4)
        self.assertEqual(result["total_skus"], 2)
        self.assertEqual(result["results"][0]["sku"], "RISK")
        self.assertEqual(result["results"][0]["risk"], "RED")


if __name__ == "__main__":
    unittest.main()

