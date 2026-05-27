# NEXUS TRADER v2.1
### Autonomous AI-Powered Deriv Trading Platform

> Fully autonomous trading agent for Deriv.com — covering Synthetics, Forex, Commodities, Digits, and Accumulators. Real-time WebSocket market data, 6 technical indicators, 8 AI bots, auto-trade execution, signal intelligence, and a professional trading dashboard.

---

## Project Structure

```
nexus-trader/
├── src/
│   ├── server.js          ← Express + WebSocket server (main entry)
│   ├── agent.js           ← Autonomous trading engine + 8 bots
│   └── routes.js          ← REST API (/api/health, /api/markets, etc.)
├── api/
│   └── derivClient.js     ← Deriv WebSocket client (auto-reconnect)
├── strategies/
│   └── indicators.js      ← RSI, MACD, BB, Stoch, ADX, EMA, Williams%R, ATR
├── utils/
│   └── logger.js          ← Structured logging to console + file
├── public/
│   └── index.html         ← Full trading dashboard (auto-served)
├── .env.example           ← All environment variables documented
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── railway.json           ← Railway one-click deploy
├── Procfile               ← Heroku deploy
└── package.json
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
nano .env   # fill in your Deriv API token

# 3. Run
npm run dev        # development (auto-restart)
npm start          # production

# 4. Open
open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DERIV_APP_ID` | Yes | `1089` | Deriv App ID (1089 = public test) |
| `DERIV_API_TOKEN_DEMO` | Yes | — | Demo API token from app.deriv.com |
| `DERIV_API_TOKEN_REAL` | No | — | Real account API token |
| `DERIV_WS_URL` | No | `wss://ws.binaryws.com/websockets/v3` | Deriv WS endpoint |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `production` | Environment |
| `JWT_SECRET` | Yes | — | 64-char random string |
| `DEFAULT_ACCOUNT_MODE` | No | `demo` | `demo` or `real` |
| `DEFAULT_STAKE` | No | `10` | Default trade stake USD |
| `DEFAULT_MIN_CONFIDENCE` | No | `70` | Min AI confidence % to auto-trade |
| `DEFAULT_TARGET_PROFIT` | No | `100` | Session profit target USD |
| `DEFAULT_STOP_LOSS` | No | `50` | Session stop loss USD |
| `MAX_DAILY_LOSS` | No | `200` | Max daily loss USD |
| `MAX_STAKE_REAL` | No | `50` | Max single stake on real account |
| `MAX_STAKE_DEMO` | No | `500` | Max single stake on demo |
| `MAX_CONSECUTIVE_LOSSES` | No | `5` | Pause after N losses |
| `AUTO_TRADE_ENABLED` | No | `false` | Auto-start trading on launch |
| `AUTO_TRADE_MARKETS` | No | `R_10,R_25,R_75` | Markets for auto-trading |
| `MONITOR_MARKETS` | No | all 20 | Markets to subscribe |
| `MARTINGALE_MULTIPLIER` | No | `2.0` | Stake multiplier on loss |
| `MARTINGALE_MAX_STEPS` | No | `4` | Max martingale steps |
| `BOT_SCAN_INTERVAL_MS` | No | `15000` | Bot trade frequency ms |
| `SIGNAL_SCAN_INTERVAL_MS` | No | `20000` | Signal scan frequency ms |
| `LOG_LEVEL` | No | `info` | `error` `warn` `info` `debug` |
| `LOG_TO_FILE` | No | `true` | Save logs to ./logs/ |
| `TELEGRAM_BOT_TOKEN` | No | — | For Telegram trade alerts |
| `TELEGRAM_CHAT_ID` | No | — | Your Telegram chat ID |

### Generate JWT_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Get Your Deriv API Token

1. Go to **[app.deriv.com](https://app.deriv.com)**
2. Account Settings → **API Token**
3. Create token with **Read + Trade** permissions
4. For real money: also enable **Payments** scope
5. Paste into `.env` as `DERIV_API_TOKEN_DEMO` or `DERIV_API_TOKEN_REAL`

> ⚠️ Never commit `.env` to Git. The `.gitignore` excludes it.

---

## Deployment

### Option 1 — Railway (Recommended, free tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard → Variables
# Copy all values from .env.example
```

### Option 2 — Render

1. Push repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect GitHub repo
4. Build command: `npm ci --only=production`
5. Start command: `node src/server.js`
6. Add environment variables in the Render dashboard

### Option 3 — Heroku

```bash
heroku create nexus-trader-app
heroku config:set DERIV_API_TOKEN_DEMO=your_token
heroku config:set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
heroku config:set NODE_ENV=production
git push heroku main
heroku open
```

### Option 4 — Docker

```bash
# Build and run
docker build -t nexus-trader .
docker run -d -p 3000:3000 --env-file .env nexus-trader

# Or with docker-compose
docker-compose up -d

# View logs
docker logs nexus_trader -f
```

### Option 5 — VPS / Ubuntu Server

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Clone and configure
git clone https://github.com/YOUR_USERNAME/nexus-trader.git
cd nexus-trader
npm ci --only=production
cp .env.example .env
nano .env

# Run with PM2 (process manager)
npm install -g pm2
pm2 start src/server.js --name nexus-trader
pm2 startup && pm2 save

# Optional: Nginx reverse proxy
sudo apt install nginx
# Configure nginx to proxy localhost:3000
```

---

## Push to GitHub

```bash
cd nexus-trader

# Initialize git
git init
git add .
git commit -m "feat: initial NEXUS TRADER deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/nexus-trader.git
git branch -M main
git push -u origin main
```

---

## Features

- **20 Markets** — V10/25/50/75/100, Crash 500/1000, Boom 500/1000, Step Index, Jump 10/25, EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, EUR/GBP, Gold, Silver
- **All Contract Types** — Rise/Fall, Digit Odd/Even/Over/Under/Match/Differ, Accumulators
- **8 AI Bots** — NEXUS PRIME, VOLT SCALPER, DIGIT ORACLE, TREND TITAN, BB BOUNCER, CRASH HUNTER, ACCUMULATOR AI, FOREX HAWK
- **9 Indicators** — RSI, MACD, Bollinger Bands, Stochastic, ADX, EMA (9/21/50/200), Williams %R, ATR, Momentum
- **Risk Systems** — Martingale, Anti-Martingale, D'Alembert, trailing stop, daily limits, consecutive loss protection
- **NLP Commands** — "Trade V75 $10 when RSI below 30, target $50, stop loss $20, martingale"
- **Digit Analytics** — Frequency heatmap (0-9), Even/Odd %, Over/Under % from last 50 ticks
- **Telegram Alerts** — Win/Loss notifications to your Telegram chat
- **CSV Export** — Download full trade history
- **Strategy Performance** — Per-strategy P&L tracking

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server status + uptime |
| GET | `/api/markets` | All 20 market definitions |
| GET | `/api/bots` | All 8 bot configurations |
| GET | `/api/config` | Current server configuration |

## WebSocket Events (Server → Browser)

| Event | Description |
|---|---|
| `TICK` | Live price for subscribed markets |
| `SIGNAL` | AI-generated trading signal |
| `TRADE_PLACED` | Trade confirmation |
| `TRADE_RESULT` | Contract closed with P&L |
| `ANALYSIS` | Full indicator analysis |
| `BOT_UPDATE` | Bot status change |
| `ACCOUNT_UPDATE` | Balance / account info |
| `LIMIT_HIT` | Target profit or stop loss reached |

## WebSocket Events (Browser → Server)

| Event | Description |
|---|---|
| `CONNECT_ACCOUNT` | Authorize Deriv token |
| `PLACE_TRADE` | Execute a trade |
| `SET_AUTO_TRADE` | Enable/disable autonomous trading |
| `START_BOT` / `STOP_BOT` | Control individual bots |
| `START_ALL_BOTS` / `STOP_ALL_BOTS` | Bulk bot control |
| `EMERGENCY_STOP` | Halt all trading |
| `PARSE_COMMAND` | NLP trade command |
| `GET_SIGNALS` | Fetch latest signals |
| `GET_HISTORY` | Fetch trade history |
| `SET_ALERT` | Set price alert |
| `GET_BALANCE` | Fetch live balance |

---

## Risk Disclaimer

Trading binary options and CFDs carries significant risk. Past performance does not guarantee future results. Only trade with money you can afford to lose. **Always test on a demo account before using real funds.** This software is provided as-is with no warranty of profit.

---

## License

MIT
