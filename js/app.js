/* ============================================================
   NewsMI — mock data + rendering
   Swap the functions in the "DATA SOURCE" section for real API
   calls (news provider, sentiment model, price feed) to go live.
   ============================================================ */

const TICKERS = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','JPM','V',
'XOM','UNH','LLY','WMT','MA','COST','HD','PG','NFLX','BAC',
'CRM','ADBE','AMD','ORCL','KO','PEP','DIS','INTC','QCOM','TXN'];

const SOURCES = [
 {name:'Reuters', w:0.95},{name:'Bloomberg', w:0.94},{name:'WSJ', w:0.92},
 {name:'CNBC', w:0.83},{name:'FT', w:0.9},{name:'AP', w:0.88},
 {name:'MarketWatch', w:0.74},{name:'Barron\'s', w:0.8},{name:'Seeking Alpha', w:0.55},
 {name:'Yahoo Finance', w:0.6},{name:'Benzinga', w:0.5},{name:'The Motley Fool', w:0.48}
];

const HEADLINE_TEMPLATES = [
 t=>`${t} beats consensus EPS, raises full-year guidance`,
 t=>`${t} misses revenue estimates amid softening demand`,
 t=>`Analysts upgrade ${t} price target after product event`,
 t=>`${t} announces restructuring, signals margin pressure`,
 t=>`Regulatory filing reveals insider buying at ${t}`,
 t=>`${t} guidance disappoints investors ahead of open`,
 t=>`${t} unveils partnership expanding market reach`,
 t=>`Supply chain update from ${t} cited as bullish catalyst`,
 t=>`${t} faces antitrust scrutiny over recent acquisition`,
 t=>`Institutional flows into ${t} accelerate pre-market`,
 t=>`${t} CEO comments spark volatility in after-hours trade`,
 t=>`Downgrade on ${t} cites valuation concerns`
];

/* ---------------- helpers ---------------- */
function rnd(min,max){return Math.random()*(max-min)+min;}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function seedShuffle(arr){return [...arr].sort(()=>Math.random()-0.5);}
function sentClass(s){ return s>0.15?'pos':(s< -0.15?'neg':'neu'); }
function sentLabel(s){ return (s>0?'+':'') + s.toFixed(2); }

/* ============================================================
   DATA SOURCE — replace this block with real fetch() calls
   ============================================================ */
function generateMockData(){
  const tickerSentiment = {};
  TICKERS.forEach(t=>tickerSentiment[t]=rnd(-0.85,0.85));

  const feedTickers = seedShuffle(TICKERS).slice(0,14);
  const stories = feedTickers.map((t)=>{
    const s = tickerSentiment[t] + rnd(-0.2,0.2);
    const clamped = Math.max(-1,Math.min(1,s));
    const src = pick(SOURCES);
    const flagged = Math.random() < 0.35;
    return {
      ticker:t, src:src.name, weight:src.w,
      headline: pick(HEADLINE_TEMPLATES)(t),
      sentiment: clamped,
      flagged,
      mins: Math.floor(rnd(1,240))
    };
  }).sort((a,b)=>a.mins-b.mins);

  const scatterPoints = [];
  for(let i=0;i<26;i++){
    const sentiment = rnd(-1,1);
    const noise = rnd(-0.6,0.6);
    const move = sentiment*1.6 + noise; // modest positive relationship
    const flagged = Math.abs(move) > 1.3 && Math.random()<0.7;
    scatterPoints.push({
      x: sentiment, y: move, r: rnd(5,15), flagged,
      color: sentiment>0.15?'#00E68C':(sentiment<-0.15?'#FF4B5C':'#888E98')
    });
  }

  return { tickerSentiment, stories, scatterPoints };
}

/* ---------------- render: news feed ---------------- */
function renderFeed(stories){
  const feedEl = document.getElementById('feed');
  feedEl.innerHTML = '';
  stories.forEach(s=>{
    const relBars = Math.round(s.weight*5);
    const div = document.createElement('div');
    div.className='story';
    div.innerHTML = `
      <div class="story-top">
        <span class="src">${s.src} · ${s.mins}m ago</span>
        <div class="rel">${[1,2,3,4,5].map(i=>`<i class="${i<=relBars?'on':''}"></i>`).join('')}</div>
      </div>
      <h3>${s.headline}</h3>
      <div class="story-meta">
        <span class="tag">$${s.ticker}</span>
        <span class="sent ${sentClass(s.sentiment)}">${sentLabel(s.sentiment)}</span>
        ${s.flagged?`<span class="flag">HIGH-IMPACT</span>`:''}
      </div>`;
    feedEl.appendChild(div);
  });
  document.getElementById('feedCount').textContent = stories.length + ' stories · last 4h';
}

/* ---------------- render: ticker tape ---------------- */
function renderTape(tickerSentiment){
  const tapeEl = document.getElementById('tape');
  let html='';
  for(let rep=0;rep<2;rep++){
    TICKERS.forEach(t=>{
      const chg = tickerSentiment[t]*rnd(1.2,2.4);
      const up = chg>=0;
      html += `<div class="tick"><b>$${t}</b><span class="chg ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(chg).toFixed(2)}%</span></div>`;
    });
  }
  tapeEl.innerHTML = html;
}

/* ---------------- render: stat blocks + sources ---------------- */
function renderStats(){
  document.getElementById('statArticles').textContent = Math.floor(rnd(150,250));
  document.getElementById('statMove').textContent = '1.5–2.0%';
  const corr = rnd(0.28,0.42);
  document.getElementById('statCorr').textContent = 'r ≈ '+corr.toFixed(2);
  document.getElementById('corrBig').textContent = 'r ≈ '+corr.toFixed(2);
  document.getElementById('statSources').textContent = SOURCES.length;

  const sourceStrip = document.getElementById('sourceStrip');
  sourceStrip.innerHTML = '';
  SOURCES.forEach(s=>{
    const el=document.createElement('span');
    el.textContent = `${s.name} · w${s.w.toFixed(2)}`;
    sourceStrip.appendChild(el);
  });
}

/* ---------------- render: scatter chart ---------------- */
function renderScatter(scatterPoints){
  const ctx = document.getElementById('scatterChart').getContext('2d');
  new Chart(ctx,{
    type:'scatter',
    data:{
      datasets:[{
        data: scatterPoints,
        backgroundColor: scatterPoints.map(p=>p.color+'CC'),
        borderColor: scatterPoints.map(p=>p.flagged?'#FFB020':'transparent'),
        borderWidth: scatterPoints.map(p=>p.flagged?2:0),
        radius: scatterPoints.map(p=>p.r)
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      scales:{
        x:{ title:{display:true,text:'Sentiment score',color:'#888E98',font:{family:'IBM Plex Mono',size:11}},
            grid:{color:'#1E2228'}, ticks:{color:'#888E98',font:{family:'IBM Plex Mono',size:10}}, min:-1.2,max:1.2},
        y:{ title:{display:true,text:'Same-day close move (%)',color:'#888E98',font:{family:'IBM Plex Mono',size:11}},
            grid:{color:'#1E2228'}, ticks:{color:'#888E98',font:{family:'IBM Plex Mono',size:10}}}
      },
      plugins:{ legend:{display:false},
        tooltip:{
          backgroundColor:'#181B20', borderColor:'#262A31', borderWidth:1,
          titleColor:'#E9EAEC', bodyColor:'#888E98', titleFont:{family:'IBM Plex Mono'}, bodyFont:{family:'IBM Plex Mono'},
          callbacks:{ label: (c)=>`sentiment ${c.raw.x.toFixed(2)} · move ${c.raw.y.toFixed(2)}%` }
        }
      }
    }
  });
}

/* ---------------- render: scenario model ---------------- */
function renderScenario(){
  const scenarioTickers = seedShuffle(TICKERS).slice(0,6);
  const scenList = document.getElementById('scenarioList');
  scenList.innerHTML = '';
  scenarioTickers.forEach(t=>{
    const bull = Math.random()*100;
    const bear = 100-bull;
    const row = document.createElement('div');
    row.className='scen-row';
    row.innerHTML = `
      <div class="scen-ticker">$${t}</div>
      <div class="scen-bar-track">
        <div class="scen-bar" style="width:${bull}%;background:var(--up)"></div>
        <div class="scen-bar" style="width:${bear}%;background:var(--down)"></div>
      </div>
      <div class="scen-prob">${bull.toFixed(0)}% bull / ${bear.toFixed(0)}% bear</div>`;
    scenList.appendChild(row);
  });
}

/* ---------------- render: heatmap ---------------- */
function renderHeatmap(tickerSentiment){
  const heatgrid = document.getElementById('heatgrid');
  heatgrid.innerHTML = '';
  TICKERS.forEach(t=>{
    const s = tickerSentiment[t];
    const intensity = Math.min(1,Math.abs(s));
    let bg;
    if(s>0.1){ bg = `rgba(0,230,140,${0.12+intensity*0.55})`; }
    else if(s<-0.1){ bg = `rgba(255,75,92,${0.12+intensity*0.55})`; }
    else { bg = `rgba(136,142,152,0.18)`; }
    const cell = document.createElement('div');
    cell.className='cell';
    cell.style.background = bg;
    cell.style.color = Math.abs(s)>0.4 ? '#0A0B0D' : '#E9EAEC';
    cell.innerHTML = `<b>${t}</b><small>${s>0?'+':''}${s.toFixed(2)}</small>`;
    heatgrid.appendChild(cell);
  });
}

/* ---------------- clock ---------------- */
function tickClock(){
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock').textContent = `${h}:${m}:${s} EDT`;
}

/* ---------------- boot ---------------- */
function init(){
  const data = generateMockData();
  renderFeed(data.stories);
  renderTape(data.tickerSentiment);
  renderStats();
  renderScatter(data.scatterPoints);
  renderScenario();
  renderHeatmap(data.tickerSentiment);
  tickClock();
  setInterval(tickClock,1000);
}

document.addEventListener('DOMContentLoaded', init);
