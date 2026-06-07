'use strict';

const fs     = require('fs');
const crypto = require('crypto');
const { DEPLOYS_FILE, ensureDir } = require('./paths');

const MAX_ENTRIES = 200;

function read() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOYS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function append(entry) {
  ensureDir();
  const entries = read();
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  fs.writeFileSync(DEPLOYS_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function get(project) {
  const entries = read();
  return project ? entries.filter(e => e.project === project) : entries;
}

function makeId() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { append, get, makeId };
