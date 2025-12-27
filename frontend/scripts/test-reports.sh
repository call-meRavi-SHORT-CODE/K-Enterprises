#!/usr/bin/env bash
# Quick manual tests for report endpoints (run from frontend folder)
set -e
BASE=http://localhost:3000/api

echo "Current stock (json):"
curl -s "$BASE/reports/current-stock?start_date=2025-01-01&end_date=2025-12-31" | jq '.report | length, .report[0]'

echo "Low stock (json):"
curl -s "$BASE/reports/low-stock" | jq '.alerts | length'

echo "Monthly sales (json):"
curl -s "$BASE/reports/sales/monthly-summary?start_date=2025-01-01&end_date=2025-12-31" | jq '.report | length'

echo "Top selling (json):"
curl -s "$BASE/reports/sales/top-selling?limit=5" | jq '.report'

echo "Dead stock (json):"
curl -s "$BASE/reports/sales/dead-stock?days=60" | jq '.report | length'

echo "Monthly purchase (json):"
curl -s "$BASE/reports/purchases/monthly-summary?start_date=2025-01-01&end_date=2025-12-31" | jq '.report | length'

echo "Vendor-wise purchase (json):"
curl -s "$BASE/reports/purchases/vendor-wise?start_date=2025-01-01&end_date=2025-12-31" | jq '.report | length'

echo "Price variations (json):"
curl -s "$BASE/reports/purchases/price-variations?start_date=2025-01-01&end_date=2025-12-31" | jq '.report | length'

echo "KPIs:"
curl -s "$BASE/reports/kpis" | jq '.kpis' || true

# To test csv output, run:
# curl -s "$BASE/reports/current-stock?format=csv&start_date=2025-01-01&end_date=2025-12-31" | head -n 5
