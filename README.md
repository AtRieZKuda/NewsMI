# NewsMI — News-Driven Market Intelligence Platform

A dashboard concept for a real-time news intelligence platform: an event feed with source-reliability weighting and sentiment scoring, a sentiment-vs-price-move signal scatter, a probabilistic next-close scenario model, and a 30-ticker sentiment heatmap.

This repo is a **static front-end demo** — all data in `js/app.js` is generated client-side to illustrate the UI and the shape of the underlying signal (sentiment score vs. same-day price move, source-weighted event flagging, correlation analysis). It's built to drop a real backend in behind it with minimal changes.

**[View the live site](https://atriezkuda.github.io/NewsMI/)**

## Project structure

```
newsmi/
├── index.html        # page markup
├── css/
│   └── styles.css     # all styling (dark theme, layout, components)
├── js/
│   └── app.js          # data generation + rendering (swap generateMockData()
│                        #   for real API calls to go live)
└── README.md
```

## Running locally

No build step — it's plain HTML/CSS/JS plus Chart.js from a CDN.

```bash
git clone https://github.com/<your-username>/newsmi.git
cd newsmi
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly in a browser also works, since there's no bundler.)

## Deploying with GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the site automatically on every push to `main`.

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to `GitHub Actions`.
3. Push to `main` (or re-run the **Deploy GitHub Pages** workflow from the **Actions** tab).
4. The site is published at:
   ```
   https://atriezkuda.github.io/NewsMI/
   ```

## Wiring up real data

To move from mock to live, replace `generateMockData()` in `js/app.js` with calls to:
- **News source** — e.g. NewsAPI, Alpha Vantage News Sentiment, Polygon.io, or a licensed feed, filtered to market hours and your ticker list.
- **NLP / sentiment scoring** — your event-extraction and sentiment pipeline (e.g. an LLM-based classifier or a finance-tuned sentiment model), producing a `-1..1` score per story.
- **Price data** — an intraday quotes API (e.g. Polygon, IEX, Alpha Vantage) to compute same-day close move and validate flagged events, feeding the scatter chart and correlation stat.

The render functions (`renderFeed`, `renderTape`, `renderScatter`, `renderHeatmap`, etc.) already expect the same shapes `generateMockData()` produces, so a live data layer can be swapped in without touching the UI.

## Tech

- Vanilla HTML/CSS/JS (no framework, no build step)
- [Chart.js](https://www.chartjs.org/) for the sentiment/price scatter plot
- IBM Plex Mono + Inter (Google Fonts)

## License

MIT — use, modify, and extend freely.
