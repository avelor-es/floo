'use strict';

const readline = require('readline');

let _rl = null;

function rl() {
  if (!_rl) {
    _rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return _rl;
}

function close() {
  if (_rl) { _rl.close(); _rl = null; }
}

function ask(question) {
  return new Promise(resolve => rl().question(question, a => resolve(a.trim())));
}

async function askRequired(question) {
  while (true) {
    const val = await ask(question);
    if (val) return val;
    process.stdout.write('  (required)\n');
  }
}

async function askList(itemPrompt, hint) {
  process.stdout.write(hint + '\n');
  const items = [];
  while (true) {
    const val = await ask(itemPrompt);
    if (!val) break;
    items.push(val);
  }
  return items;
}

module.exports = { ask, askRequired, askList, close };
