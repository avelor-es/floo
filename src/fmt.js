'use strict';

const G  = '\x1b[90m';
const W  = '\x1b[97m';
const Y  = '\x1b[33m';
const GR = '\x1b[32m';
const R  = '\x1b[31m';
const Z  = '\x1b[0m';

function col(str, width, right = false) {
  str = String(str ?? '');
  if (str.length > width) str = str.slice(0, width - 1) + '…';
  const pad = ' '.repeat(Math.max(0, width - str.length));
  return right ? pad + str : str + pad;
}

function fatal(msg) {
  process.stderr.write(R + 'error: ' + Z + msg + '\n');
  process.exit(1);
}

function ok(msg) {
  process.stdout.write(GR + '✓ ' + Z + msg + '\n');
}

function info(msg) {
  process.stdout.write(G + '→ ' + Z + msg + '\n');
}

module.exports = { G, W, Y, GR, R, Z, col, fatal, ok, info };
