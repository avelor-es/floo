'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const CONFIG_DIR = process.env.FLOO_CONFIG_DIR
  || path.join(os.homedir(), '.config', 'floo');

const TOKENS_FILE        = path.join(CONFIG_DIR, 'tokens.json');
const PROJECTS_FILE      = process.env.FLOO_PROJECTS_FILE
  || path.join(CONFIG_DIR, 'projects.yml');
const CLIENT_CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PID_FILE           = path.join(CONFIG_DIR, 'floo.pid');
const LOG_FILE           = path.join(CONFIG_DIR, 'floo.log');

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

module.exports = {
  CONFIG_DIR,
  TOKENS_FILE,
  PROJECTS_FILE,
  CLIENT_CONFIG_FILE,
  PID_FILE,
  LOG_FILE,
  ensureDir,
};
