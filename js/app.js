const TICKERS = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','JPM','V','XOM','UNH','LLY','WMT','MA','COST','HD','PG','NFLX','BAC','CRM','ADBE','AMD','ORCL','KO','PEP','DIS','INTC','QCOM','TXN'];

const POS_WORDS = ['beat','beats','bullish','upgrade','surge','rally','gain','gains','growth','strong','record','outperform','buyback','expands','rise','raises','profit'];
const NEG_WORDS = ['miss','misses','bearish','downgrade','drop','falls','fall','decline','weak','lawsuit','probe','cut','cuts','risk','selloff','loss','pressure'];

const state = {
  quotes: {},
  newsByTicker: {},
  models: {},
  stories: [],
  selectedTicker: TICKERS[0],
  asOf: null,
  scatterChart: null
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function scoreClass(score) { return score > 0.15 ? 'bull' : score < -0.15 ? 'bear' : 'neutral'; }
function scoreLabel(score) { return `${score > 0 ? '+' : ''}${score.toFixed(2)}`; }

function nyDateFrom(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function formatNyDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(date);
}

function getMarketStatus() {
  const ny = nyDateFrom();
  const day = ny.getDay();
  const minutes = ny.getHours() * 60 + ny.getMinutes();
  if (day === 0 || day === 6) return 'MARKET CLOSED · WEEKEND';
  if (minutes < 570) return 'PRE-MARKET';
  if (minutes >= 570 && minutes < 960) return 'MARKET OPEN';
  return 'AFTER HOURS';
}

function tickClock() {
  const now = new Date();
  const stamp = formatNyDateTime(now);
  const hhmmss = stamp.split(', ')[1];
  document.getElementById('clock').textContent = `${hhmmss} ET`;
  document.getElementById('marketStatus').textContent = getMarketStatus();
}

async function fetchText(url) {
  const attempts = [
    async () => {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('fetch-failed');
      return r.text();
    },
    async () => {
      const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const r = await fetch(proxied, { cache: 'no-store' });
      if (!r.ok) throw new Error('proxy-failed');
      return r.text();
    }
  ];

  for (const run of attempts) {
    try { return await run(); } catch (_e) { }
  }
  throw new Error('all-fetch-attempts-failed');
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function fallbackQuotes() {
  const out = {};
  TICKERS.forEach((t, i) => {
    const base = 80 + (i * 7.5);
    const drift = (Math.sin(Date.now() / 600000 + i) * 2.8);
    const changePercent = drift;
    out[t] = {
      price: +(base + drift).toFixed(2),
      changePercent: +changePercent.toFixed(2)
    };
  });
  return out;
}

async function fetchQuotes() {
  try {
    const symbols = TICKERS.join(',');
    const data = await fetchJSON(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`);
    const result = data?.quoteResponse?.result || [];
    if (!result.length) throw new Error('no-results');
    const quotes = {};
    result.forEach((q) => {
      if (!q.symbol || q.regularMarketPrice == null) return;
      quotes[q.symbol] = {
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent ?? 0
      };
    });
    return Object.keys(quotes).length ? quotes : fallbackQuotes();
  } catch (_e) {
    return fallbackQuotes();
  }
}

function scoreHeadline(title) {
  const text = title.toLowerCase();
  let score = 0;
  POS_WORDS.forEach((w) => { if (text.includes(w)) score += 1; });
  NEG_WORDS.forEach((w) => { if (text.includes(w)) score -= 1; });
  if (score === 0) return 0;
  return clamp(score / 4, -1, 1);
}

function parseRss(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  const items = [...xml.querySelectorAll('item')];
  return items.slice(0, 8).map((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
    const link = item.querySelector('link')?.textContent?.trim() || '#';
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
    const score = scoreHeadline(title);
    return { title, link, pubDate, score };
  });
}

function fallbackNews(ticker) {
  const templates = [
    `${ticker} faces mixed outlook as traders weigh macro data`,
    `Analysts discuss ${ticker} after latest sector moves`,
    `${ticker} sees active options flow ahead of next session`,
    `${ticker} sentiment shifts as weekend headlines digest`
  ];
  return templates.map((title, idx) => ({
    title,
    link: '#',
    pubDate: new Date(Date.now() - idx * 3600 * 1000).toUTCString(),
    score: scoreHeadline(title)
  }));
}

async function fetchTickerNews(ticker) {
  const query = encodeURIComponent(`${ticker} stock`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(url);
    const parsed = parseRss(xml);
    return parsed.length ? parsed : fallbackNews(ticker);
  } catch (_e) {
    return fallbackNews(ticker);
  }
}

function buildModel(ticker) {
  const quote = state.quotes[ticker] || { price: 0, changePercent: 0 };
  const news = state.newsByTicker[ticker] || [];
  const avgNews = news.length ? news.reduce((a, n) => a + n.score, 0) / news.length : 0;
  const priceBias = clamp((quote.changePercent || 0) / 4, -1, 1);
  const compositeScore = clamp(avgNews * 0.7 + priceBias * 0.3, -1, 1);
  const bull = Math.round(clamp((compositeScore + 1) * 50, 0, 100));
  const bear = 100 - bull;
  return { ticker, quote, news, avgNews, priceBias, compositeScore, bull, bear };
}

function renderSources() {
  const sourceStrip = document.getElementById('sourceStrip');
  sourceStrip.innerHTML = '';
  ['Yahoo Finance Quotes', 'Google News RSS', 'AllOrigins CORS Proxy (fallback)', 'Local fallback synthesis'].forEach((name) => {
    const el = document.createElement('span');
    el.textContent = name;
    sourceStrip.appendChild(el);
  });
}

function renderTape() {
  const tapeEl = document.getElementById('tape');
  let html = '';
  for (let rep = 0; rep < 2; rep++) {
    TICKERS.forEach((t) => {
      const m = state.models[t];
      const chg = m?.quote?.changePercent ?? 0;
      const up = chg >= 0;
      html += `<div class="tick" data-ticker="${t}"><b>$${t}</b><span class="chg ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%</span></div>`;
    });
  }
  tapeEl.innerHTML = html;
  [...tapeEl.querySelectorAll('.tick')].forEach((el) => {
    el.addEventListener('click', () => setSelectedTicker(el.dataset.ticker));
  });
}

function renderStockList() {
  const stockList = document.getElementById('stockList');
  stockList.innerHTML = '';
  TICKERS.forEach((t) => {
    const m = state.models[t];
    const row = document.createElement('div');
    row.className = `stock-row${state.selectedTicker === t ? ' active' : ''}`;
    row.dataset.ticker = t;
    row.innerHTML = `
      <div class="symbol">$${t}</div>
      <div class="price">$${(m?.quote?.price ?? 0).toFixed(2)} · ${(m?.quote?.changePercent ?? 0) >= 0 ? '+' : ''}${(m?.quote?.changePercent ?? 0).toFixed(2)}%</div>
      <div class="score ${scoreClass(m?.compositeScore ?? 0)}">${scoreLabel(m?.compositeScore ?? 0)}</div>`;
    row.addEventListener('click', () => setSelectedTicker(t));
    stockList.appendChild(row);
  });
}

function renderFeed() {
  const ticker = state.selectedTicker;
  const stories = state.newsByTicker[ticker] || [];
  const feedEl = document.getElementById('feed');
  feedEl.innerHTML = '';

  stories.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'story';
    div.innerHTML = `
      <div class="story-top"><span class="src">${s.pubDate || 'Recent'} </span></div>
      <h3><a href="${s.link}" target="_blank" rel="noopener noreferrer">${s.title}</a></h3>
      <div class="story-meta">
        <span class="tag">$${ticker}</span>
        <span class="sent ${scoreClass(s.score) === 'bull' ? 'pos' : scoreClass(s.score) === 'bear' ? 'neg' : 'neu'}">${scoreLabel(s.score)}</span>
        ${Math.abs(s.score) > 0.35 ? '<span class="flag">HIGH-IMPACT</span>' : ''}
      </div>`;
    feedEl.appendChild(div);
  });

  document.getElementById('feedCount').textContent = `${stories.length} stories for ${ticker}`;
}

function renderStatsAndSelected() {
  const m = state.models[state.selectedTicker];
  if (!m) return;
  const bias = m.compositeScore > 0.15 ? 'BULL' : m.compositeScore < -0.15 ? 'BEAR' : 'NEUTRAL';
  document.getElementById('statArticles').textContent = m.news.length;
  document.getElementById('statPrice').textContent = `$${m.quote.price.toFixed(2)}`;
  document.getElementById('statScore').textContent = scoreLabel(m.compositeScore);
  document.getElementById('statSignal').textContent = bias;
  document.getElementById('selectedTickerLabel').textContent = `$${m.ticker} selected`;
  document.getElementById('selectedPrice').textContent = `$${m.quote.price.toFixed(2)}`;
  document.getElementById('selectedMeta').textContent = `Change ${(m.quote.changePercent >= 0 ? '+' : '')}${m.quote.changePercent.toFixed(2)}% · Score ${scoreLabel(m.compositeScore)} · ${m.bull}% bull / ${m.bear}% bear`;
}

function renderScatter() {
  const points = TICKERS.map((t) => {
    const m = state.models[t];
    const s = m?.compositeScore ?? 0;
    return {
      x: s,
      y: m?.quote?.changePercent ?? 0,
      r: 7 + Math.abs(s) * 8,
      color: s > 0.15 ? '#00E68C' : s < -0.15 ? '#FF4B5C' : '#888E98'
    };
  });

  const ctx = document.getElementById('scatterChart').getContext('2d');
  if (state.scatterChart) state.scatterChart.destroy();
  state.scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        data: points,
        backgroundColor: points.map((p) => p.color + 'CC'),
        borderWidth: 0,
        radius: points.map((p) => p.r)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: -1.1,
          max: 1.1,
          title: { display: true, text: 'Composite sentiment score', color: '#888E98', font: { family: 'IBM Plex Mono', size: 11 } },
          grid: { color: '#1E2228' },
          ticks: { color: '#888E98', font: { family: 'IBM Plex Mono', size: 10 } }
        },
        y: {
          title: { display: true, text: 'Live price move (%)', color: '#888E98', font: { family: 'IBM Plex Mono', size: 11 } },
          grid: { color: '#1E2228' },
          ticks: { color: '#888E98', font: { family: 'IBM Plex Mono', size: 10 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `score ${c.raw.x.toFixed(2)} · move ${c.raw.y.toFixed(2)}%`
          }
        }
      }
    }
  });
}

function renderScenario() {
  const scenList = document.getElementById('scenarioList');
  scenList.innerHTML = '';
  const top = [...TICKERS]
    .map((t) => state.models[t])
    .sort((a, b) => Math.abs(b.compositeScore) - Math.abs(a.compositeScore))
    .slice(0, 8);

  top.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'scen-row';
    row.innerHTML = `
      <div class="scen-ticker">$${m.ticker}</div>
      <div class="scen-bar-track">
        <div class="scen-bar" style="width:${m.bull}%;background:var(--up)"></div>
        <div class="scen-bar" style="width:${m.bear}%;background:var(--down)"></div>
      </div>
      <div class="scen-prob">${m.bull}% bull / ${m.bear}% bear</div>`;
    scenList.appendChild(row);
  });
}

function renderAsOf() {
  const asOf = state.asOf || new Date();
  const stamp = formatNyDateTime(asOf);
  document.getElementById('asOf').textContent = `${stamp} ET`;
  document.getElementById('footNote').textContent = `Scoring uses all fetched ticker news + live quotes. Snapshot as of ${stamp} ET.`;
}

function setSelectedTicker(ticker) {
  state.selectedTicker = ticker;
  renderStockList();
  renderFeed();
  renderStatsAndSelected();
}

async function refreshAll() {
  state.asOf = new Date();
  state.quotes = await fetchQuotes();

  const newsEntries = await Promise.all(TICKERS.map(async (t) => [t, await fetchTickerNews(t)]));
  state.newsByTicker = Object.fromEntries(newsEntries);

  TICKERS.forEach((t) => {
    state.models[t] = buildModel(t);
  });

  renderSources();
  renderAsOf();
  renderTape();
  renderStockList();
  renderScatter();
  renderScenario();
  setSelectedTicker(state.selectedTicker);
}

async function init() {
  tickClock();
  setInterval(tickClock, 1000);
  await refreshAll();
  setInterval(refreshAll, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
