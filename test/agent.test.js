'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os     = require('node:os');
const fs     = require('node:fs');
const path   = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'floo-agent-'));
process.env.FLOO_CONFIG_DIR    = tmp;
process.env.FLOO_PROJECTS_FILE = path.join(tmp, 'projects.yml');

const tokens = require('../src/tokens');
const { serve } = require('../src/agent');

const PROJECTS_YML = `
projects:
  greet:
    cwd: /tmp
    steps:
      - echo hello
      - echo world
  fail:
    cwd: /tmp
    steps:
      - echo before
      - exit 1
      - echo after
`;

let server;
let port;
let token;

before(async () => {
  fs.writeFileSync(process.env.FLOO_PROJECTS_FILE, PROJECTS_YML, 'utf8');
  const result = tokens.issue('greet');
  token = result.raw;
  tokens.issue('fail');

  server = serve(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  port = server.address().port;
});

after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function post(project, tok) {
  const url = 'http://127.0.0.1:' + port + '/deploy/' + project;
  return fetch(url, {
    method:  'POST',
    headers: {
      'authorization': 'Bearer ' + (tok ?? token),
      'accept':        'text/event-stream',
    },
  });
}

async function collectEvents(body) {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let buf    = '';
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split('\n\n');
    buf = blocks.pop();
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      let name = 'message';
      let data = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) name = line.slice(7).trim();
        if (line.startsWith('data: '))  data = JSON.parse(line.slice(6));
      }
      if (data !== null) events.push({ name, data });
    }
  }

  return events;
}

test('GET /ping returns pong', async () => {
  const res = await fetch('http://127.0.0.1:' + port + '/ping');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'pong');
});

test('POST /deploy/:project without token returns 401', async () => {
  const res = await fetch('http://127.0.0.1:' + port + '/deploy/greet', { method: 'POST' });
  assert.equal(res.status, 401);
});

test('POST /deploy/:project with wrong token returns 403', async () => {
  const res = await post('greet', 'fl_wrongtoken');
  assert.equal(res.status, 403);
});

test('POST /deploy/:project with mismatched project returns 403', async () => {
  const other = tokens.issue('other').raw;
  const res   = await post('greet', other);
  assert.equal(res.status, 403);
});

test('successful deploy streams start, steps, lines, and done:ok', async () => {
  const res    = await post('greet');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/event-stream'));

  const events = await collectEvents(res.body);
  const names  = events.map(e => e.name);

  assert.ok(names.includes('start'));
  assert.ok(names.includes('step'));
  assert.ok(names.includes('line'));
  assert.ok(names.includes('done'));

  const done = events.find(e => e.name === 'done');
  assert.equal(done.data.ok, true);
});

test('start event carries project name and step count', async () => {
  const res    = await post('greet');
  const events = await collectEvents(res.body);
  const start  = events.find(e => e.name === 'start');
  assert.equal(start.data.project, 'greet');
  assert.equal(start.data.steps, 2);
});

test('output lines are streamed as line events', async () => {
  const res    = await post('greet');
  const events = await collectEvents(res.body);
  const lines  = events.filter(e => e.name === 'line').map(e => e.data.text);
  assert.ok(lines.includes('hello'));
  assert.ok(lines.includes('world'));
});

test('failed step emits done:ok=false and stops execution', async () => {
  const failToken = tokens.issue('fail').raw;
  const res       = await post('fail', failToken);
  const events    = await collectEvents(res.body);

  const done = events.find(e => e.name === 'done');
  assert.equal(done.data.ok, false);

  const lines = events.filter(e => e.name === 'line').map(e => e.data.text);
  assert.ok(lines.includes('before'));
  assert.ok(!lines.includes('after'));
});

test('unknown project returns 404', async () => {
  const orphanToken = tokens.issue('doesnotexist').raw;
  const res = await fetch('http://127.0.0.1:' + port + '/deploy/doesnotexist', {
    method:  'POST',
    headers: { 'authorization': 'Bearer ' + orphanToken },
  });
  assert.equal(res.status, 404);
});
