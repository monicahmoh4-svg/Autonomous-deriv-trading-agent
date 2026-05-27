'use strict';
const EventEmitter = require('events');
const logger = require('../utils/logger');
const { analyzeMarket, digitFrequency } = require('../strategies/indicators');

const MARKETS = [
  { id:'R_10',     name:'Volatility 10',  type:'synthetic' },
  { id:'R_25',     name:'Volatility 25',  type:'synthetic' },
  { id:'R_50',     name:'Volatility 50',  type:'synthetic' },
  { id:'R_75',     name:'Volatility 75',  type:'synthetic' },
  { id:'R_100',    name:'Volatility 100', type:'synthetic' },
  { id:'CRASH500', name:'Crash 500',      type:'synthetic' },
  { id:'BOOM500',  name:'Boom 500',       type:'synthetic' },
  { id:'CRASH1000',name:'Crash 1000',     type:'synthetic' },
  { id:'BOOM1000', name:'Boom 1000',      type:'synthetic' },
  { id:'stpRNG',   name:'Step Index',     type:'synthetic' },
  { id:'JD10',     name:'Jump 10',        type:'synthetic' },
  { id:'JD25',     name:'Jump 25',        type:'synthetic' },
  { id:'frxEURUSD',name:'EUR/USD',        type:'forex' },
  { id:'frxGBPUSD',name:'GBP/USD',        type:'forex' },
  { id:'frxUSDJPY',name:'USD/JPY',        type:'forex' },
  { id:'frxAUDUSD',name:'AUD/USD',        type:'forex' },
  { id:'frxUSDCAD',name:'USD/CAD',        type:'forex' },
  { id:'frxEURGBP',name:'EUR/GBP',        type:'forex' },
  { id:'frxXAUUSD',name:'Gold/USD',       type:'commodity' },
  { id:'frxXAGUSD',name:'Silver/USD',     type:'commodity' },
];

const BOT_DEFS = {
  'nexus-prime':  { name:'NEXUS PRIME',    mkts:['R_10','R_25','R_75'],             minC:75, dur:5, unit:'t', strat:'multi_indicator' },
  'volt-scalper': { name:'VOLT SCALPER',   mkts:['R_10','R_50'],                    minC:65, dur:3, unit:'t', strat:'price_action'   },
  'digit-oracle': { name:'DIGIT ORACLE',   mkts:['R_10','R_25','R_100'],            minC:60, dur:5, unit:'t', strat:'digit_pattern'  },
  'trend-titan':  { name:'TREND TITAN',    mkts:['CRASH500','BOOM500','frxEURUSD'], minC:68, dur:60,unit:'s', strat:'trend_follow'   },
  'bb-bouncer':   { name:'BB BOUNCER',     mkts:['R_50','R_100','frxGBPUSD'],       minC:70, dur:5, unit:'t', strat:'bb_reversion'  },
  'crash-hunter': { name:'CRASH HUNTER',   mkts:['CRASH500','CRASH1000'],           minC:65, dur:1, unit:'t', strat:'spike_detect'  },
  'accum-ai':     { name:'ACCUMULATOR AI', mkts:['R_10','R_25','R_50'],             minC:72, dur:5, unit:'t', strat:'accumulator'   },
  'forex-hawk':   { name:'FOREX HAWK',     mkts:['frxEURUSD','frxGBPUSD','frxXAUUSD'], minC:67, dur:300, unit:'s', strat:'mtf_ema' },
};

class AgentEngine extends EventEmitter {
  constructor(derivClient) {
    super();
    this.client      = derivClient;
    this.prices      = {};           // symbol → price[]
    this.autoOn      = false;
    this.autoConfig  = {};
    this.runBots     = new Set();
    this.botIvs      = {};
    this.signals     = [];
    this.trades      = [];
    this.alerts      = [];
    this.ivs         = [];
    this.lastAT      = {};
    this.stats = { wins:0, losses:0, pnl:0, staked:0, consW:0, consL:0, bestPnl:0, worstPnl:0 };

    this.cfg = {
      minConf:     parseInt(process.env.DEFAULT_MIN_CONFIDENCE)  || 70,
      stake:       parseFloat(process.env.DEFAULT_STAKE)         || 10,
      targetProfit:parseFloat(process.env.DEFAULT_TARGET_PROFIT) || 100,
      stopLoss:    parseFloat(process.env.DEFAULT_STOP_LOSS)     || 50,
      maxDailyLoss:parseFloat(process.env.MAX_DAILY_LOSS)        || 200,
      maxConsL:    parseInt(process.env.MAX_CONSECUTIVE_LOSSES)  || 5,
      martEnabled: false,
      martMult:    parseFloat(process.env.MARTINGALE_MULTIPLIER) || 2.0,
      martMaxSteps:parseInt(process.env.MARTINGALE_MAX_STEPS)    || 4,
      martStep:    0,
      autoMarkets: (process.env.AUTO_TRADE_MARKETS || 'R_10,R_25,R_75').split(','),
    };

    this._listenClient();
    this._startAnalysis();
    this._startScanner();
    this._startAlerts();
  }

  // ── Wire up Deriv events ─────────────────────────────────
  _listenClient() {
    this.client.on('tick', tick => {
      const sym = tick.symbol;
      if (!this.prices[sym]) this.prices[sym] = [];
      this.prices[sym].push(parseFloat(tick.quote));
      if (this.prices[sym].length > 600) this.prices[sym].shift();
      if (this.autoOn) this._autoCheck(sym);
      this._checkAlerts(sym, parseFloat(tick.quote));
    });

    this.client.on('trade_result', r => this._onResult(r));
  }

  // ── Continuous analysis loop ─────────────────────────────
  _startAnalysis() {
    const ms = parseInt(process.env.ANALYSIS_INTERVAL_MS) || 2000;
    this.ivs.push(setInterval(() => {
      MARKETS.forEach(m => {
        const p = this.prices[m.id];
        if (!p || p.length < 40) return;
        try {
          const a = analyzeMarket(m.id, p);
          this.emit('analysis', a);
        } catch(e) { logger.error(`Analysis ${m.id}:`, e.message); }
      });
    }, ms));
  }

  // ── Periodic signal scanner across all markets ───────────
  _startScanner() {
    const ms = parseInt(process.env.SIGNAL_SCAN_INTERVAL_MS) || 20000;
    const strategies = ['NEXUS AI','RSI Scanner','MACD Watch','BB Scan','Multi-TF','Confluence AI'];
    this.ivs.push(setInterval(() => {
      MARKETS.slice(0, 12).forEach(m => {
        const p = this.prices[m.id];
        if (!p || p.length < 40) return;
        const a = analyzeMarket(m.id, p);
        if (a.confidence > 68 && a.direction !== 'NEUTRAL') {
          const strat = strategies[Math.floor(Math.random() * strategies.length)];
          this._addSignal(m.id, m.name, a.direction, a.confidence, strat, a);
        }
      });
    }, ms));
  }

  // ── Price alert watcher ──────────────────────────────────
  _startAlerts() {
    this.ivs.push(setInterval(() => {
      this.alerts = this.alerts.filter(al => {
        const cur = (this.prices[al.symbol] || []).slice(-1)[0];
        if (!cur) return true;
        const hit = (al.dir === 'above' && cur > al.price) || (al.dir === 'below' && cur < al.price);
        if (hit) {
          const msg = `${al.symbol} crossed ${al.dir.toUpperCase()} $${al.price}`;
          logger.info('Alert:', msg);
          this.emit('signal', { type:'PRICE_ALERT', symbol:al.symbol, message:msg, timestamp:Date.now() });
          return false;
        }
        return true;
      });
    }, 1000));
  }

  // ── Auto-trade logic ─────────────────────────────────────
  _autoCheck(sym) {
    if (!this.cfg.autoMarkets.includes(sym)) return;
    const now = Date.now();
    if (now - (this.lastAT[sym] || 0) < 10000) return;

    // Session limits
    if (this.stats.pnl >= this.cfg.targetProfit) {
      this.setAutoTrade(false); this.emit('limit', { type:'TARGET', pnl:this.stats.pnl }); return;
    }
    if (this.stats.pnl <= -this.cfg.stopLoss) {
      this.setAutoTrade(false); this.emit('limit', { type:'STOP_LOSS', pnl:this.stats.pnl }); return;
    }
    if (this.stats.consL >= this.cfg.maxConsL) {
      this.setAutoTrade(false); this.emit('limit', { type:'CONSEC_LOSS', count:this.stats.consL }); return;
    }

    const p = this.prices[sym];
    if (!p || p.length < 40) return;
    const a = analyzeMarket(sym, p);
    if (a.confidence < this.cfg.minConf || a.direction === 'NEUTRAL') return;

    this.lastAT[sym] = now;
    const mkt = MARKETS.find(m => m.id === sym);
    const stake = this._calcStake();
    const ct = a.direction === 'BUY' ? 'CALL' : 'PUT';

    this._addSignal(sym, mkt?.name || sym, a.direction, a.confidence, 'AUTO:' + (this.autoConfig.strategy || 'NEXUS'), a);
    this.placeTrade({ symbol:sym, contract_type:ct, amount:stake, duration:5, duration_unit:'t', label:'Auto Trade', analysis:a });
  }

  _calcStake() {
    const base = this.autoConfig.stake || this.cfg.stake;
    if (this.cfg.martEnabled && this.cfg.martStep > 0) {
      const m = Math.pow(this.cfg.martMult, Math.min(this.cfg.martStep, this.cfg.martMaxSteps));
      return +(base * m).toFixed(2);
    }
    return base;
  }

  // ── Place trade ──────────────────────────────────────────
  async placeTrade(params) {
    const barrier = ['DIGITOVER','DIGITUNDER','DIGITMATCH','DIGITDIFF'].includes(params.contract_type) ? (params.barrier || '5') : undefined;
    const trade = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      symbol: params.symbol, contract_type: params.contract_type,
      amount: params.amount, duration: params.duration,
      duration_unit: params.duration_unit, label: params.label || 'Manual',
      confidence: params.analysis?.confidence || 0,
      timestamp: Date.now(), status: 'open', pnl: null, contract_id: null,
      market_name: MARKETS.find(m => m.id === params.symbol)?.name || params.symbol
    };

    logger.info(`Trade: ${trade.contract_type} on ${trade.symbol} | $${trade.amount} | ${trade.duration}${trade.duration_unit}`);

    try {
      const result = await this.client.buy({
        symbol: trade.symbol, contract_type: trade.contract_type,
        amount: trade.amount, duration: trade.duration,
        duration_unit: trade.duration_unit, barrier
      });
      trade.contract_id = result?.contract_id;
      this.trades.unshift(trade);
      this.emit('trade_placed', trade);
      return trade;
    } catch(e) {
      logger.error('Trade failed:', e.message);
      throw e;
    }
  }

  _onResult(r) {
    const profit = parseFloat(r.profit) || 0;
    const win = profit > 0;
    const trade = this.trades.find(t => t.contract_id === r.contract_id || t.status === 'open');
    if (trade) { trade.status = win ? 'win' : 'loss'; trade.pnl = profit; }

    this.stats.pnl     += profit;
    this.stats.staked  += parseFloat(r.buy_price) || 0;
    if (win) { this.stats.wins++; this.stats.consW++; this.stats.consL = 0; this.cfg.martStep = 0; }
    else     { this.stats.losses++; this.stats.consL++; this.stats.consW = 0; if (this.cfg.martEnabled) this.cfg.martStep++; }
    if (profit > this.stats.bestPnl)  this.stats.bestPnl  = profit;
    if (profit < this.stats.worstPnl) this.stats.worstPnl = profit;

    logger.info(`Result: ${win?'WIN':'LOSS'} $${profit>=0?'+':''}${profit.toFixed(2)} | Session P&L: $${this.stats.pnl.toFixed(2)}`);
    this.emit('analysis', { type:'TRADE_RESULT', ...r, sessionStats: { ...this.stats } });

    // Telegram alert
    this._tgAlert(win, profit, r.underlying_symbol);
  }

  // ── Bots ─────────────────────────────────────────────────
  startBot(botId, config = {}) {
    if (this.runBots.has(botId)) return;
    const def = { ...BOT_DEFS[botId], ...config };
    if (!def) { logger.warn('Unknown bot:', botId); return; }
    this.runBots.add(botId);
    logger.info('Bot started:', def.name);

    const scanMs = parseInt(process.env.BOT_SCAN_INTERVAL_MS) || 15000;

    this.botIvs[botId] = setInterval(async () => {
      if (!this.runBots.has(botId)) return;
      const sym = def.mkts[Math.floor(Math.random() * def.mkts.length)];
      const p   = this.prices[sym];
      if (!p || p.length < 40) return;

      let ct;
      const a = analyzeMarket(sym, p);

      if (def.strat === 'digit_pattern') {
        const df = digitFrequency(p);
        ct = df.evenPct > 55 ? 'DIGITEVEN' : df.over5Pct > 55 ? 'DIGITOVER' : 'DIGITODD';
      } else {
        if (a.confidence < def.minC || a.direction === 'NEUTRAL') return;
        ct = a.direction === 'BUY' ? 'CALL' : 'PUT';
      }

      const stake = this.autoConfig.stake || this.cfg.stake;
      const mkt = MARKETS.find(m => m.id === sym);
      this._addSignal(sym, mkt?.name || sym, a.direction, a.confidence, def.name, a);
      try {
        await this.placeTrade({ symbol:sym, contract_type:ct, amount:stake, duration:def.dur, duration_unit:def.unit, label:def.name, analysis:a });
      } catch(e) { logger.error(`Bot ${botId}:`, e.message); }
    }, scanMs + Math.random() * 8000);

    this.emit('bot_update', { botId, status:'running', name:def.name });
  }

  stopBot(botId) {
    this.runBots.delete(botId);
    if (this.botIvs[botId]) { clearInterval(this.botIvs[botId]); delete this.botIvs[botId]; }
    logger.info('Bot stopped:', botId);
    this.emit('bot_update', { botId, status:'stopped' });
  }

  emergencyStop() {
    this.autoOn = false;
    [...this.runBots].forEach(id => this.stopBot(id));
    this.runBots.clear();
    this.ivs.forEach(iv => clearInterval(iv));
    this.ivs = [];
    logger.warn('EMERGENCY STOP — all trading halted');
    this.emit('bot_update', { type:'EMERGENCY_STOP', timestamp:Date.now() });
  }

  // ── Signals ──────────────────────────────────────────────
  _addSignal(mktId, mktName, dir, conf, strat, analysis) {
    const sig = {
      id: `s_${Date.now()}`, market:mktId, marketName:mktName,
      direction:dir, confidence:+conf.toFixed(2), strategy:strat,
      timestamp:Date.now(), time:new Date().toLocaleTimeString(),
      indicators: analysis?.indicators, summary: analysis?.summary
    };
    this.signals.unshift(sig);
    if (this.signals.length > 100) this.signals.pop();
    this.emit('signal', sig);
    return sig;
  }

  getSignals(limit = 20) { return this.signals.slice(0, limit); }
  getHistory(limit = 50) {
    const tot = this.stats.wins + this.stats.losses;
    return {
      trades: this.trades.slice(0, limit),
      stats: { ...this.stats },
      summary: {
        totalTrades: this.trades.length,
        winRate: tot ? ((this.stats.wins / tot) * 100).toFixed(1) + '%' : '0%',
        netPnl: this.stats.pnl.toFixed(2),
        roi: this.stats.staked > 0 ? ((this.stats.pnl / this.stats.staked) * 100).toFixed(2) + '%' : '0%',
      }
    };
  }

  // ── Config ───────────────────────────────────────────────
  setAutoTrade(on, cfg = {}) {
    this.autoOn = on;
    this.autoConfig = { ...this.cfg, ...cfg };
    if (cfg.minConf)      this.cfg.minConf      = cfg.minConf;
    if (cfg.stake)        this.cfg.stake        = cfg.stake;
    if (cfg.targetProfit) this.cfg.targetProfit = cfg.targetProfit;
    if (cfg.stopLoss)     this.cfg.stopLoss     = cfg.stopLoss;
    if (cfg.markets)      this.cfg.autoMarkets  = cfg.markets;
    if (cfg.martingale !== undefined) this.cfg.martEnabled = cfg.martingale;
    logger.info(`Auto-trade ${on ? 'ON' : 'OFF'}`);
  }

  addAlert(symbol, price, dir) {
    this.alerts.push({ symbol, price: parseFloat(price), dir, ts: Date.now() });
    logger.info(`Alert: ${symbol} ${dir} $${price}`);
  }

  _checkAlerts(sym, cur) { /* handled by _startAlerts interval */ }

  // ── NLP Command Parser ───────────────────────────────────
  parseCommand(cmd) {
    const c = cmd.toLowerCase();
    const r = { symbol:'R_75', contract_type:'CALL', amount:10, duration:5, duration_unit:'t', target_profit:50, stop_loss:20, condition:'now', martingale:false, max_trades:10 };

    const mktMap = [
      {k:['v10','volatility 10'],v:'R_10'},{k:['v25','volatility 25'],v:'R_25'},
      {k:['v50','volatility 50'],v:'R_50'},{k:['v75','volatility 75'],v:'R_75'},
      {k:['v100','volatility 100'],v:'R_100'},{k:['crash 500'],v:'CRASH500'},
      {k:['crash 1000'],v:'CRASH1000'},{k:['boom 500'],v:'BOOM500'},
      {k:['boom 1000'],v:'BOOM1000'},{k:['step'],v:'stpRNG'},
      {k:['jump 10'],v:'JD10'},{k:['jump 25'],v:'JD25'},
      {k:['eurusd','eur/usd','euro'],v:'frxEURUSD'},{k:['gbpusd','gbp/usd'],v:'frxGBPUSD'},
      {k:['usdjpy','usd/jpy'],v:'frxUSDJPY'},{k:['gold','xau'],v:'frxXAUUSD'},
      {k:['silver','xag'],v:'frxXAGUSD'},
    ];
    for (const m of mktMap) { if (m.k.some(k => c.includes(k))) { r.symbol = m.v; break; } }

    if (c.includes('sell')||c.includes('fall')||c.includes('put')) r.contract_type='PUT';
    if (c.includes('odd'))    r.contract_type='DIGITODD';
    if (c.includes('even'))   r.contract_type='DIGITEVEN';
    if (c.includes('over'))   r.contract_type='DIGITOVER';
    if (c.includes('under'))  r.contract_type='DIGITUNDER';
    if (c.includes('match'))  r.contract_type='DIGITMATCH';
    if (c.includes('differ')) r.contract_type='DIGITDIFF';

    const am = c.match(/\$\s*(\d+(?:\.\d+)?)/);         if (am) r.amount = parseFloat(am[1]);
    const tm = c.match(/target\s*\$?\s*(\d+)/);          if (tm) r.target_profit = parseFloat(tm[1]);
    const sm = c.match(/stop\s*loss\s*\$?\s*(\d+)/);     if (sm) r.stop_loss = parseFloat(sm[1]);
    const mm = c.match(/max\s*(\d+)\s*trades?/);         if (mm) r.max_trades = parseInt(mm[1]);

    if (c.includes('1 tick'))  { r.duration=1; r.duration_unit='t'; }
    if (c.includes('5 tick'))  { r.duration=5; r.duration_unit='t'; }
    if (c.includes('1 min'))   { r.duration=60; r.duration_unit='s'; }
    if (c.includes('5 min'))   { r.duration=300; r.duration_unit='s'; }
    if (c.includes('15 min'))  { r.duration=900; r.duration_unit='s'; }

    if (c.includes('rsi') && (c.includes('30')||c.includes('oversold')))   r.condition='rsi_os';
    else if (c.includes('rsi') && (c.includes('70')||c.includes('overbought'))) r.condition='rsi_ob';
    else if (c.includes('macd') && c.includes('cross')) r.condition='macd_bull';
    else if (c.includes('bollinger')||c.includes('lower band')) r.condition='bb_low';

    if (c.includes('martingale')) r.martingale = true;

    r.market_name = MARKETS.find(m => m.id === r.symbol)?.name || r.symbol;
    r.parsed_summary = `${r.contract_type} on ${r.market_name} | $${r.amount} | cond:${r.condition}`;
    return r;
  }

  // ── Telegram notifications (optional) ───────────────────
  async _tgAlert(win, profit, symbol) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const axios = require('axios');
      const emoji = win ? '✅' : '❌';
      const text = `${emoji} NEXUS TRADER\n${win?'WIN':'LOSS'}: ${profit>=0?'+':''}$${profit.toFixed(2)}\nMarket: ${symbol}\nSession P&L: $${this.stats.pnl.toFixed(2)}`;
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id:chatId, text, parse_mode:'Markdown' });
    } catch(e) { logger.debug('TG alert failed:', e.message); }
  }
}

module.exports = AgentEngine;
