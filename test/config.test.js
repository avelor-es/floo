'use strict';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('node:os');
const fs     = require('node:fs');
const path   = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'floo-config-'));
process.env.FLOO_CONFIG_DIR = tmp;

delete process.env.FLOO_TOKEN;
delete process.env.FLOO_URL;

const config = require('../src/config');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

beforeEach(() => {
  try { fs.unlinkSync(path.join(tmp, 'config.json')); } catch { /* ok */ }
  delete process.env.FLOO_TOKEN;
  delete process.env.FLOO_URL;
});

test('setProject writes project entry to config file', () => {
  config.setProject('myapp', 'http://myserver:4001', 'fl_abc');
  const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
  assert.deepEqual(raw.myapp, { url: 'http://myserver:4001', token: 'fl_abc' });
});

test('setProject preserves other projects', () => {
  config.setProject('alpha', 'http://server:4001', 'fl_aaa');
  config.setProject('beta',  'http://server:4001', 'fl_bbb');
  const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
  assert.ok(raw.alpha);
  assert.ok(raw.beta);
});

test('getProject reads from file when no env vars set', () => {
  config.setProject('myapp', 'http://myserver:4001', 'fl_abc');
  const result = config.getProject('myapp');
  assert.equal(result.url,   'http://myserver:4001');
  assert.equal(result.token, 'fl_abc');
});

test('getProject prefers FLOO_TOKEN + FLOO_URL env vars', () => {
  config.setProject('myapp', 'http://myserver:4001', 'fl_local');
  process.env.FLOO_TOKEN = 'fl_ci';
  process.env.FLOO_URL   = 'http://ci-server:4001';
  const result = config.getProject('myapp');
  assert.equal(result.token, 'fl_ci');
  assert.equal(result.url,   'http://ci-server:4001');
});

test('getProject uses file URL when only FLOO_TOKEN is set', () => {
  config.setProject('myapp', 'http://myserver:4001', 'fl_local');
  process.env.FLOO_TOKEN = 'fl_ci';
  const result = config.getProject('myapp');
  assert.equal(result.token, 'fl_ci');
  assert.equal(result.url,   'http://myserver:4001');
});
