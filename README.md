# NEXUS TRADER v2.1
### Autonomous AI Deriv Trading Platform — Vercel Edition

A fully standalone frontend trading agent. **No backend required.** 
Your browser connects directly to Deriv's official WebSocket API.
Deploy to Vercel in one command.

---

## Deploy to Vercel (60 seconds)

### Option A — Vercel CLI
```bash
npm i -g vercel
cd nexus-trader
vercel --prod
```

### Option B — Vercel Dashboard
1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Click **Deploy** — done. No env vars needed.

### Option C — One-click (after GitHub push)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## Project Structure (Vercel-ready)

```
nexus-trader/
├── public/
│   └── index.html      ← Entire app (97KB self-contained)
├── vercel.json         ← Static site config
├── .gitignore
└── README.md
```

---

## How It Works

- **No server needed** — pure static HTML/JS/CSS
- **Direct Deriv WebSocket** — connects to `wss://ws.binaryws.com/websockets/v3`
- **Demo mode works immediately** — live tick simulation until you connect your account
- **Connect your account** — click CONNECT, paste your Deriv API token → live trading

## Get Your Deriv API Token

1. Log in at **[app.deriv.com](https://app.deriv.com)**
2. Account Settings → **API Token**
3. Create token with **Read + Trade** permissions
4. In the app: click **CONNECT** → paste token → select Demo or Real

---

## Features

| Feature | Description |
|---|---|
| 20 Markets | V10–V100, Crash/Boom 500/1000, Step, Jump, EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, EUR/GBP, Gold, Silver |
| All Contract Types | Rise/Fall, Digit Odd/Even/Over/Under/Match/Differ, Accumulators |
| 8 AI Bots | NEXUS PRIME, VOLT SCALPER, DIGIT ORACLE, TREND TITAN, BB BOUNCER, CRASH HUNTER, ACCUMULATOR AI, FOREX HAWK |
| 9 Indicators | RSI, MACD, Bollinger Bands, Stochastic, ADX, EMA (9/21/50), Williams %R, ATR, Momentum |
| Auto-Trade | Autonomous execution when AI confidence exceeds your threshold |
| NLP Commands | Type "Trade V75 $10 when RSI below 30, target $50, stop loss $20" |
| Risk Systems | Martingale, trailing stop, daily limits, consecutive loss protection |
| Signal Feed | Real-time multi-market signal scanner |
| Digit Analytics | Frequency heatmap (0–9), Even/Odd %, Over/Under % from last 100 ticks |
| History & Analytics | P&L curve, per-strategy performance, CSV export |
| Emergency Stop | One-click halt of all trading |

---

## Risk Disclaimer

Trading binary options and CFDs involves significant risk. Past performance does not guarantee future results. Always test on **Demo** before using real funds. Only trade money you can afford to lose.

---

## License
MIT
