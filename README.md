# NewsMI

NewsMI is a static market dashboard that shows:
- live quote snapshots for 30 large-cap tickers
- per-ticker news sentiment scoring
- bull/bear probability from combined quote + news signals
- ticker-level news you can browse by clicking stocks

Live data is fetched client-side with fallback data when providers are unavailable.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

- `/home/runner/work/NewsMI/NewsMI/index.html` — page layout
- `/home/runner/work/NewsMI/NewsMI/css/styles.css` — styles
- `/home/runner/work/NewsMI/NewsMI/js/app.js` — data fetch, scoring, rendering

## Deploy

GitHub Pages deploys from `.github/workflows/deploy-pages.yml` on push to `main`.

## License

MIT
