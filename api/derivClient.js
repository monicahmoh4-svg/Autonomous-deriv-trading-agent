'use strict';
const WebSocket = require('ws');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class DerivClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.ready = false;
    this.token = null;
    this.mode = 'demo';
    this.account = null;
    this.rid = 1;
    this.pending = new Map();
    this.subs = new Set();
    this.reconnects = 0;
    this.maxReconnects = 15;
    this.pingIv = null;
    this.appId = process.env.DERIV_APP_ID || '1089';
    this.url = `${process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3'}?app_id=${this.appId}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ready) return resolve();
      logger.info('Connecting to Deriv WebSocket...');
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.ready = true; this.reconnects = 0;
        logger.info('Deriv WS connected');
        this._ping(); resolve();
      });
      this.ws.on('message', d => {
        try { this._onMsg(JSON.parse(d)); } catch(e) { logger.error('Parse error:', e.message); }
      });
      this.ws.on('close', () => {
        this.ready = false; this._stopPing();
        logger.warn('Deriv WS closed — reconnecting...');
        this._reconnect();
      });
      this.ws.on('error', e => {
        logger.error('Deriv WS error:', e.message);
        if (!this.ready) reject(e);
      });
      setTimeout(() => { if (!this.ready) reject(new Error('WS connect timeout')); }, 15000);
    });
  }

  async authorize(token, mode = 'demo') {
    this.token = token; this.mode = mode;
    if (!this.ready) await this.connect();
    return new Promise((resolve, reject) => {
      this._req({ authorize: token }, res => {
        if (res.error) return reject(new Error(res.error.message));
        this.account = res.authorize;
        logger.info(`Authorized: ${res.authorize.loginid} (${mode})`);
        this.emit('account', res.authorize);
        this.subs.forEach(s => this._raw({ ticks: s, subscribe: 1 }));
        resolve(res.authorize);
      });
    });
  }

  subscribe(symbol) {
    if (!this.subs.has(symbol)) {
      this.subs.add(symbol);
      if (this.ready) this._raw({ ticks: symbol, subscribe: 1 });
    }
  }

  getHistory(symbol, granularity = 300, count = 300) {
    return new Promise((resolve, reject) => {
      this._req({ ticks_history: symbol, adjust_start_time: 1, count, end: 'latest', granularity, style: 'candles' }, res => {
        if (res.error) return reject(new Error(res.error.message));
        resolve(res.candles || res.history || []);
      });
    });
  }

  async buy(params) {
    if (!this.account) throw new Error('Not authorized');
    const maxStake = parseFloat(this.mode === 'real' ? process.env.MAX_STAKE_REAL || 50 : process.env.MAX_STAKE_DEMO || 500);
    if (params.amount > maxStake) throw new Error(`Stake $${params.amount} exceeds max $${maxStake}`);
    return new Promise((resolve, reject) => {
      this._req({
        buy: 1, subscribe: 1, price: params.amount,
        parameters: {
          amount: params.amount, basis: 'stake',
          contract_type: params.contract_type,
          currency: this.account?.currency || 'USD',
          symbol: params.symbol,
          duration: params.duration,
          duration_unit: params.duration_unit,
          ...(params.barrier ? { barrier: params.barrier } : {})
        }
      }, res => {
        if (res.error) return reject(new Error(res.error.message));
        resolve(res.buy);
      });
    });
  }

  getBalance() {
    return new Promise((resolve, reject) => {
      this._req({ balance: 1, subscribe: 1 }, res => {
        if (res.error) return reject(new Error(res.error.message));
        resolve(res.balance);
      });
    });
  }

  getStatement(limit = 25) {
    return new Promise((resolve, reject) => {
      this._req({ statement: 1, limit }, res => {
        if (res.error) return reject(new Error(res.error.message));
        resolve(res.statement);
      });
    });
  }

  _onMsg(msg) {
    if (msg.req_id && this.pending.has(msg.req_id)) {
      const cb = this.pending.get(msg.req_id);
      this.pending.delete(msg.req_id);
      cb(msg);
    }
    if (msg.tick) this.emit('tick', msg.tick);
    if (msg.ohlc) this.emit('candle', msg.ohlc);
    if (msg.balance) this.emit('balance', msg.balance);
    if (msg.proposal_open_contract) {
      const c = msg.proposal_open_contract;
      if (c.is_sold) this.emit('trade_result', {
        contract_id: c.contract_id, symbol: c.underlying_symbol,
        contract_type: c.contract_type, buy_price: c.buy_price,
        sell_price: c.sell_price, profit: c.profit,
        is_win: parseFloat(c.profit) > 0,
        entry_spot: c.entry_spot, exit_spot: c.exit_spot,
        duration: c.duration, timestamp: Date.now()
      });
      else this.emit('contract_update', c);
    }
    if (msg.buy) this.emit('buy', msg.buy);
    if (msg.error && !msg.req_id && msg.error.code !== 'MarketIsClosed') {
      logger.warn('Deriv API:', msg.error.message);
    }
  }

  _req(payload, cb) {
    const id = this.rid++;
    if (cb) this.pending.set(id, cb);
    this._raw({ ...payload, req_id: id });
    return id;
  }

  _raw(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      setTimeout(() => this._raw(payload), 1500);
    }
  }

  _ping() {
    this.pingIv = setInterval(() => { if (this.ready) this._raw({ ping: 1 }); }, 30000);
  }
  _stopPing() { if (this.pingIv) clearInterval(this.pingIv); }

  async _reconnect() {
    if (this.reconnects >= this.maxReconnects) { logger.error('Max reconnects reached'); return; }
    this.reconnects++;
    const delay = Math.min(30000, 3000 * this.reconnects);
    logger.info(`Reconnect in ${delay}ms (attempt ${this.reconnects})`);
    await new Promise(r => setTimeout(r, delay));
    try {
      await this.connect();
      if (this.token) await this.authorize(this.token, this.mode);
    } catch(e) { logger.error('Reconnect failed:', e.message); this._reconnect(); }
  }

  disconnect() { this._stopPing(); this.ready = false; if (this.ws) this.ws.close(); }
}

module.exports = DerivClient;
