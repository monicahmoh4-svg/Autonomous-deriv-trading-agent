'use strict';
const express = require('express');
const router  = express.Router();

// ── Health ───────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status:'ok', version:'2.1.0', uptime: process.uptime(), ts: Date.now() });
});

// ── Markets ──────────────────────────────────────────────────
router.get('/markets', (req, res) => {
  res.json({ markets:[
    {id:'R_10',     name:'Volatility 10',   type:'synthetic'},
    {id:'R_25',     name:'Volatility 25',   type:'synthetic'},
    {id:'R_50',     name:'Volatility 50',   type:'synthetic'},
    {id:'R_75',     name:'Volatility 75',   type:'synthetic'},
    {id:'R_100',    name:'Volatility 100',  type:'synthetic'},
    {id:'CRASH500', name:'Crash 500',       type:'synthetic'},
    {id:'BOOM500',  name:'Boom 500',        type:'synthetic'},
    {id:'CRASH1000',name:'Crash 1000',      type:'synthetic'},
    {id:'BOOM1000', name:'Boom 1000',       type:'synthetic'},
    {id:'stpRNG',   name:'Step Index',      type:'synthetic'},
    {id:'JD10',     name:'Jump 10',         type:'synthetic'},
    {id:'JD25',     name:'Jump 25',         type:'synthetic'},
    {id:'frxEURUSD',name:'EUR/USD',         type:'forex'},
    {id:'frxGBPUSD',name:'GBP/USD',         type:'forex'},
    {id:'frxUSDJPY',name:'USD/JPY',         type:'forex'},
    {id:'frxAUDUSD',name:'AUD/USD',         type:'forex'},
    {id:'frxUSDCAD',name:'USD/CAD',         type:'forex'},
    {id:'frxEURGBP',name:'EUR/GBP',         type:'forex'},
    {id:'frxXAUUSD',name:'Gold/USD',        type:'commodity'},
    {id:'frxXAGUSD',name:'Silver/USD',      type:'commodity'},
  ]});
});

// ── Bots ─────────────────────────────────────────────────────
router.get('/bots', (req, res) => {
  res.json({ bots:[
    {id:'nexus-prime',  name:'NEXUS PRIME',    strategy:'multi_indicator', markets:['R_10','R_25','R_75'],             minConf:75, winRate:'72%', avgReturn:'$8.40'},
    {id:'volt-scalper', name:'VOLT SCALPER',   strategy:'price_action',    markets:['R_10','R_50'],                    minConf:65, winRate:'68%', avgReturn:'$4.20'},
    {id:'digit-oracle', name:'DIGIT ORACLE',   strategy:'digit_pattern',   markets:['R_10','R_25','R_100'],            minConf:60, winRate:'65%', avgReturn:'$9.00'},
    {id:'trend-titan',  name:'TREND TITAN',    strategy:'trend_follow',    markets:['CRASH500','BOOM500','frxEURUSD'], minConf:68, winRate:'70%', avgReturn:'$12.50'},
    {id:'bb-bouncer',   name:'BB BOUNCER',     strategy:'bb_reversion',    markets:['R_50','R_100','frxGBPUSD'],       minConf:70, winRate:'71%', avgReturn:'$7.80'},
    {id:'crash-hunter', name:'CRASH HUNTER',   strategy:'spike_detect',    markets:['CRASH500','CRASH1000'],           minConf:65, winRate:'66%', avgReturn:'$15.00'},
    {id:'accum-ai',     name:'ACCUMULATOR AI', strategy:'accumulator',     markets:['R_10','R_25','R_50'],             minConf:72, winRate:'74%', avgReturn:'$6.50'},
    {id:'forex-hawk',   name:'FOREX HAWK',     strategy:'mtf_ema',         markets:['frxEURUSD','frxGBPUSD','frxXAUUSD'], minConf:67, winRate:'69%', avgReturn:'$10.20'},
  ]});
});

// ── Config ───────────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    defaultStake:     parseFloat(process.env.DEFAULT_STAKE)            || 10,
    minConfidence:    parseInt(process.env.DEFAULT_MIN_CONFIDENCE)     || 70,
    targetProfit:     parseFloat(process.env.DEFAULT_TARGET_PROFIT)    || 100,
    stopLoss:         parseFloat(process.env.DEFAULT_STOP_LOSS)        || 50,
    maxDailyLoss:     parseFloat(process.env.MAX_DAILY_LOSS)           || 200,
    maxStakeReal:     parseFloat(process.env.MAX_STAKE_REAL)           || 50,
    maxStakeDemo:     parseFloat(process.env.MAX_STAKE_DEMO)           || 500,
    maxConsecLosses:  parseInt(process.env.MAX_CONSECUTIVE_LOSSES)     || 5,
    autoTradeEnabled: process.env.AUTO_TRADE_ENABLED === 'true',
    accountMode:      process.env.DEFAULT_ACCOUNT_MODE                 || 'demo',
    autoMarkets:      (process.env.AUTO_TRADE_MARKETS || '').split(',').filter(Boolean),
    martMultiplier:   parseFloat(process.env.MARTINGALE_MULTIPLIER)    || 2.0,
    martMaxSteps:     parseInt(process.env.MARTINGALE_MAX_STEPS)       || 4,
  });
});

// ── 404 ──────────────────────────────────────────────────────
router.use((req, res) => res.status(404).json({ error:'Not found' }));

module.exports = router;
