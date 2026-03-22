# Garmin Dashboard

Personal running training dashboard. Single-page coach's view that synthesizes Garmin Connect data into a clear narrative: where you are, what's wrong, what to do about it.

Data comes from the [`garmin`](https://github.com/co42/garmin-cli) CLI. All fetching is done server-side, stored in SQLite, and served via SvelteKit.

## Sections

- **Banner** — training status, ACWR, readiness, recovery time, VO2max trend
- **Runner Profile** — radar chart (6 axes: VO2max, Speed, Endurance, Balance, Hill Str, Hill End) with 3-month peak/low overlay, weekly trend chart
- **Race Times** — personal records + VO2max-based predictions for 5K/10K/Semi/Marathon
- **Body** — body battery, sleep score, resting HR, stress, readiness gauge with factor breakdown
- **Training** — load balance, training polarization (Seiler model), ACWR + HRV trends, weekly volume
- **Activity Log** — recent runs with date, type, distance, pace, GAP, training load, HR zone bars

## Requirements

- [garmin CLI](https://github.com/co42/garmin-cli) installed and authenticated (`garmin auth login`)
- Node.js 22+

## Development

```sh
npm install
npm run dev
```

Click "Sync Data" in the top bar to pull data from Garmin Connect. First sync fetches 90 days of history.

## Docker

```sh
docker build -t garmin-dashboard .
docker run -p 3000:3000 -v ./data:/app/data garmin-dashboard
```

The `garmin` CLI must be available in the container or mounted as a binary for sync to work.

## Release

```sh
make release VERSION=1.0.0
```

Tags, pushes, waits for GitHub Actions to build multi-arch Docker images (amd64 + arm64), and creates a GitHub release. Images are pushed to `ghcr.io/co42/garmin-dashboard`.

## Stack

- SvelteKit (TypeScript, adapter-node)
- Tailwind CSS 4
- Apache ECharts
- better-sqlite3
- Inter + JetBrains Mono
