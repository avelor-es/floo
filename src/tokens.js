'use strict';

const fs     = require('fs');
const crypto = require('crypto');
const { TOKENS_FILE, ensureDir } = require('./paths');

function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeTokens(tokens) {
  ensureDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function issue(project) {
  const raw = 'fl_' + crypto.randomBytes(24).toString('hex');
  const id  = crypto.randomBytes(4).toString('hex');
  const tokens = readTokens();
  tokens.push({
    id,
    project,
    hash:    hashToken(raw),
    created: new Date().toISOString(),
  });
  writeTokens(tokens);
  return { id, raw, project };
}

function list() {
  return readTokens().map(({ id, project, created }) => ({ id, project, created }));
}

function revoke(id) {
  const tokens   = readTokens();
  const filtered = tokens.filter(t => t.id !== id);
  if (filtered.length === tokens.length) return false;
  writeTokens(filtered);
  return true;
}

function validate(raw, project) {
  const hash   = hashToken(raw);
  const tokens = readTokens();
  return tokens.find(t => t.hash === hash && t.project === project) || null;
}

module.exports = { issue, list, revoke, validate, hashToken };
