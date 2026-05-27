'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const cors       = require('cors');
const helmet     = require('helmet');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const logger     = require('../utils/logger');
const DerivClient= require('../api/derivClient');
const AgentEngine= require('./agent');
const router     = require('./routes');

// ── App ──────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs:60000, max:300, message:{ error:'Rate limit exceeded' } }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', router);

// ── WebSocket server (browser ↔ backend) ────────────────────
const wss     = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  logger.info(`Browser connected: ${req.socket.remoteAddress}`);

  // Send welcome packet
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    data: { version:'2.1.0', ts: Date.now(),
      autoTradeEnabled: process.env.AUTO_TRADE_ENABLED === 'true',
      accountMode: process.env.DEFAULT_ACCOUNT_MODE || 'demo' }
  }));

  ws.on('message', async raw => {
    try {
      const msg = JSON.parse(raw);
      await handleMsg(ws, msg);
    } catch(e) {
      ws.send(JSON.stringify({ type:'ERROR', error: e.message }));
    }
  });

  ws.on('close', () => { clients.delete(ws); logger.info('Browser disconnected'); });
  ws.on('error', e  => logger.error('WS client error:', e.message));
});

function broadcast(data) {
  const str = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(str); });
}

// ── Deriv client & Agent ─────────────────────────────────────
const deriv = new DerivClient();
const agent = new AgentEngine(deriv);

// Forward live data to browsers
deriv.on('tick',         tick  => broadcast({ type:'TICK',           data: tick  }));
deriv.on('candle',       c     => broadcast({ type:'CANDLE',         data: c     }));
deriv.on('balance',      b     => broadcast({ type:'BALANCE',        data: b     }));
deriv.on('account',      a     => broadcast({ type:'ACCOUNT_UPDATE', data: a     }));
deriv.on('trade_result', r     => {
  broadcast({ type:'TRADE_RESULT', data: r });
  logger.info(`Trade result: ${r.is_win?'WIN':'LOSS'} $${parseFloat(r.profit).toFixed(2)}`);
});
deriv.on('contract_update', c => broadcast({ type:'CONTRACT_UPDATE', data: c }));

agent.on('signal',      s => broadcast({ type:'SIGNAL',       data: s }));
agent.on('trade_placed',t => broadcast({ type:'TRADE_PLACED', data: t }));
agent.on('analysis',    a => broadcast({ type:'ANALYSIS',     data: a }));
agent.on('bot_update',  b => broadcast({ type:'BOT_UPDATE',   data: b }));
agent.on('limit',       l => broadcast({ type:'LIMIT_HIT',    data: l }));

// ── Message handler ──────────────────────────────────────────
async function handleMsg(ws, msg) {
  const { type, data = {} } = msg;

  switch (type) {

    case 'CONNECT_ACCOUNT': {
      try {
        const acct = await deriv.authorize(data.token, data.mode || 'demo');
        // Subscribe all monitored markets after auth
        const mkts = (process.env.MONITOR_MARKETS || 'R_10,R_25,R_50,R_75,R_100,CRASH500,BOOM500,frxEURUSD,frxGBPUSD,frxXAUUSD').split(',');
        mkts.forEach(m => deriv.subscribe(m.trim()));
        ws.send(JSON.stringify({ type:'AUTHORIZED', data: acct }));
      } catch(e) {
        ws.send(JSON.stringify({ type:'AUTH_ERROR', error: e.message }));
      }
      break;
    }

    case 'PLACE_TRADE': {
      try {
        const trade = await agent.placeTrade(data);
        ws.send(JSON.stringify({ type:'TRADE_ACCEPTED', data: trade }));
      } catch(e) {
        ws.send(JSON.stringify({ type:'TRADE_ERROR', error: e.message }));
      }
      break;
    }

    case 'SET_AUTO_TRADE': {
      agent.setAutoTrade(data.enabled, data.config || {});
      broadcast({ type:'AUTO_TRADE_STATUS', data:{ enabled: data.enabled, config: data.config } });
      break;
    }

    case 'START_BOT': {
      agent.startBot(data.botId, data.config || {});
      break;
    }

    case 'STOP_BOT': {
      agent.stopBot(data.botId);
      break;
    }

    case 'START_ALL_BOTS': {
      const bots = ['nexus-prime','volt-scalper','digit-oracle','trend-titan','bb-bouncer','crash-hunter','accum-ai','forex-hawk'];
      bots.forEach(id => agent.startBot(id, data.config || {}));
      break;
    }

    case 'STOP_ALL_BOTS': {
      const bots = ['nexus-prime','volt-scalper','digit-oracle','trend-titan','bb-bouncer','crash-hunter','accum-ai','forex-hawk'];
      bots.forEach(id => agent.stopBot(id));
      break;
    }

    case 'EMERGENCY_STOP': {
      agent.emergencyStop();
      broadcast({ type:'EMERGENCY_STOP', data:{ ts: Date.now() } });
      break;
    }

    case 'GET_SIGNALS': {
      ws.send(JSON.stringify({ type:'SIGNALS', data: agent.getSignals(data.limit || 20) }));
      break;
    }

    case 'GET_HISTORY': {
      ws.send(JSON.stringify({ type:'HISTORY', data: agent.getHistory(data.limit || 50) }));
      break;
    }

    case 'SUBSCRIBE_MARKET': {
      deriv.subscribe(data.symbol);
      ws.send(JSON.stringify({ type:'SUBSCRIBED', data:{ symbol: data.symbol } }));
      break;
    }

    case 'GET_HISTORY_DATA': {
      try {
        const candles = await deriv.getHistory(data.symbol, data.granularity || 300, data.count || 300);
        ws.send(JSON.stringify({ type:'HISTORY_DATA', data:{ symbol: data.symbol, candles } }));
      } catch(e) {
        ws.send(JSON.stringify({ type:'ERROR', error: e.message }));
      }
      break;
    }

    case 'PARSE_COMMAND': {
      const parsed = agent.parseCommand(data.command);
      ws.send(JSON.stringify({ type:'COMMAND_PARSED', data: parsed }));
      break;
    }

    case 'SET_ALERT': {
      agent.addAlert(data.symbol, data.price, data.direction);
      ws.send(JSON.stringify({ type:'ALERT_SET', data }));
      break;
    }

    case 'GET_BALANCE': {
      try {
        const bal = await deriv.getBalance();
        ws.send(JSON.stringify({ type:'BALANCE', data: bal }));
      } catch(e) {
        ws.send(JSON.stringify({ type:'ERROR', error: e.message }));
      }
      break;
    }

    case 'GET_STATEMENT': {
      try {
        const stmt = await deriv.getStatement(data.limit || 25);
        ws.send(JSON.stringify({ type:'STATEMENT', data: stmt }));
      } catch(e) {
        ws.send(JSON.stringify({ type:'ERROR', error: e.message }));
      }
      break;
    }

    case 'PING': {
      ws.send(JSON.stringify({ type:'PONG', ts: Date.now() }));
      break;
    }

    default:
      ws.send(JSON.stringify({ type:'UNKNOWN', received: type }));
  }
}

// ── Catch-all → serve SPA ────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, async () => {
  logger.info('');
  logger.info('╔═══════════════════════════════════════════╗');
  logger.info('║      NEXUS TRADER v2.1  —  ONLINE         ║');
  logger.info(`║      http://${HOST}:${PORT}                  ║`);
  logger.info('╚═══════════════════════════════════════════╝');
  logger.info('');

  // Auto-connect with env token
  const mode  = process.env.DEFAULT_ACCOUNT_MODE || 'demo';
  const token = mode === 'real' ? process.env.DERIV_API_TOKEN_REAL : process.env.DERIV_API_TOKEN_DEMO;

  if (token && !token.startsWith('your_')) {
    try {
      await deriv.authorize(token, mode);
      logger.info(`Auto-connected to Deriv (${mode})`);

      // Subscribe all markets
      const mkts = (process.env.MONITOR_MARKETS ||
        'R_10,R_25,R_50,R_75,R_100,CRASH500,BOOM500,CRASH1000,BOOM1000,stpRNG,JD10,JD25,frxEURUSD,frxGBPUSD,frxUSDJPY,frxAUDUSD,frxUSDCAD,frxEURGBP,frxXAUUSD,frxXAGUSD'
      ).split(',');
      mkts.forEach(m => deriv.subscribe(m.trim()));

      // Auto-start trading if configured
      if (process.env.AUTO_TRADE_ENABLED === 'true') {
        agent.setAutoTrade(true, {});
        logger.info('Auto-trade engine ACTIVATED');
      }
    } catch(e) {
      logger.warn('Auto-connect failed:', e.message, '— connect manually via dashboard');
    }
  } else {
    logger.info('No API token configured — connect manually via dashboard');
  }
});

module.exports = { app, server, agent, deriv };
