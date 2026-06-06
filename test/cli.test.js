'use strict';

const { test, after } = require('node:test');
const assert   = require('node:assert/strict');
const { execFileSync } = require('child_process');
const os   = require('node:os');
const fs   = require('node:fs');
const path = require('node:path');

const BIN = path.resolve(__dirname, '../bin/floo.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'floo-cli-'));

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function floo(...args) {
  return execFileSync(process.execPath, [BIN, ...args], {
    env:      { ...process.env, FLOO_CONFIG_DIR: tmp },
    encoding: 'utf8',
  });
}

function flooErr(...args) {
  try {
    floo(...args);
    return null;
  } catch (e) {
    return e.stderr;
  }
}

test('--version prints version', () => {
  const out = floo('--version');
  const pkg = require('../package.json');
  assert.ok(out.trim() === pkg.version);
});

test('help prints usage without error', () => {
  const out = floo('help');
  assert.ok(out.includes('floo'));
  assert.ok(out.includes('agent'));
  assert.ok(out.includes('token'));
});

test('token issue --project creates a token', () => {
  const out = floo('token', 'issue', '--project', 'myapp');
  assert.ok(out.includes('fl_'));
  assert.ok(out.includes('myapp'));
});

test('token issue without --project prints error', () => {
  const err = flooErr('token', 'issue');
  assert.ok(err.includes('error'));
});

test('token list shows issued tokens', () => {
  floo('token', 'issue', '--project', 'listed');
  const out = floo('token', 'list');
  assert.ok(out.includes('listed'));
});

test('token revoke removes a token', () => {
  const issueOut = floo('token', 'issue', '--project', 'todel');
  const idLine   = issueOut.split('\n').find(l => l.includes('id:'));
  const id       = idLine.replace(/\x1b\[[0-9;]*m/g, '').split(':')[1].trim();

  const revokeOut = floo('token', 'revoke', id);
  assert.ok(revokeOut.includes('revoked'));
});

test('use saves project config', () => {
  const out = floo('use', 'myapp', 'http://server:4001', 'fl_abc123');
  assert.ok(out.includes('myapp'));
  assert.ok(out.includes('http://server:4001'));
  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, 'config.json'), 'utf8'));
  assert.equal(cfg.myapp.url,   'http://server:4001');
  assert.equal(cfg.myapp.token, 'fl_abc123');
});

test('use with missing args prints error', () => {
  const err = flooErr('use', 'myapp');
  assert.ok(err.includes('error'));
});

test('init creates projects.yml', () => {
  const projFile = path.join(tmp, 'projects.yml');
  try { fs.unlinkSync(projFile); } catch { /* ok */ }
  const out = floo('init');
  assert.ok(out.includes('projects.yml') || out.includes('created'));
  assert.ok(fs.existsSync(projFile));
});
