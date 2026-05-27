'use strict';
const fs = require('fs');
const path = require('path');

const LEVEL = process.env.LOG_LEVEL || 'info';
const TO_FILE = process.env.LOG_TO_FILE === 'true';
const DIR = process.env.LOG_DIR || './logs';
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const cur = LEVELS[LEVEL] ?? 2;
const C = { error:'\x1b[31m', warn:'\x1b[33m', info:'\x1b[36m', debug:'\x1b[90m', reset:'\x1b[0m' };

if (TO_FILE) try { fs.mkdirSync(DIR, { recursive: true }); } catch(_){}

function log(level, ...args) {
  if ((LEVELS[level] ?? 0) > cur) return;
  const ts = new Date().toISOString();
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  console.log(`${C[level]}${line}${C.reset}`);
  if (TO_FILE) {
    const f = path.join(DIR, `nexus-${ts.slice(0,10)}.log`);
    fs.appendFile(f, line + '\n', () => {});
  }
}

module.exports = {
  error: (...a) => log('error',...a),
  warn:  (...a) => log('warn', ...a),
  info:  (...a) => log('info', ...a),
  debug: (...a) => log('debug',...a),
};
