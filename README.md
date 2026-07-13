# Lighthouse Evaluation Dashboard

Standalone Next.js app for analyzing Lighthouse benchmark outputs from `api/results/lighthouse`.

## Run

```powershell
cd lighthouse-dashboard
npm install
npm run dev
```

The dashboard runs on `http://localhost:3013`.

## What it does

- Scans every dated Lighthouse run folder under `api/results/lighthouse`
- Aggregates all `summary.csv` files, not just the newest one
- Filters by run date folder, framework, platform, route, and iteration range
- Exposes raw JSON, HTML, and CSV reports through the dashboard for auditability
- Provides statistical summaries suitable for thesis-style evaluation

## Notes

- The dashboard is separate from the benchmark apps.
- It reads whatever Lighthouse reports already exist; run the benchmark script in `api/` first.
- For reproducible evaluation, keep the raw output folders archived by run date.
