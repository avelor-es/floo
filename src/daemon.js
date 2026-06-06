'use strict';

const fs   = require('fs');
const { spawn } = require('child_process');
const { PID_FILE, LOG_FILE, ensureDir } = require('./paths');
const { ok, info, G, W, GR, R, Z } = require('./fmt');

function readPid() {
  try {
    return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function start(argv, port) {
  ensureDir();
  const pid = readPid();
  if (pid && isAlive(pid)) {
    process.stdout.write(G + '→ ' + Z + 'already running ' + G + '(PID ' + pid + ')\n' + Z);
    process.exit(0);
  }

  const args = argv.filter(a => a !== '--daemon');
  const log  = fs.openSync(LOG_FILE, 'a');

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio:    ['ignore', log, log],
    env:      { ...process.env, FLOO_DAEMON: '1' },
  });

  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
  ok('agent started ' + G + '(PID ' + child.pid + ')' + Z);
  process.stdout.write(G + '  port: ' + Z + (port || 4001) + '\n');
  process.stdout.write(G + '  logs: ' + Z + LOG_FILE + '\n');
  process.exit(0);
}

function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    process.stdout.write(G + '→ ' + Z + 'no agent running\n');
    process.exit(0);
  }
  process.kill(pid, 'SIGTERM');
  try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
  ok('agent stopped ' + G + '(PID ' + pid + ')' + Z);
}

function status() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    process.stdout.write(R + '●' + Z + ' floo   ' + G + 'stopped\n' + Z);
  } else {
    process.stdout.write(GR + '●' + Z + ' floo   ' + W + 'running' + Z + G + ' (PID ' + pid + ')\n' + Z);
    process.stdout.write(G + '  logs: ' + Z + LOG_FILE + '\n');
  }
}

module.exports = { start, stop, status };
