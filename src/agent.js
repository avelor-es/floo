'use strict';

const http   = require('http');
const { spawn } = require('child_process');
const tokens   = require('./tokens');
const { findProject } = require('./projects');
const history  = require('./history');
const { info, G, W, GR, R, Z } = require('./fmt');

const DEFAULT_PORT = 4001;
const DEFAULT_HOST = '0.0.0.0';

const { version } = require('../package.json');
const locks = new Set();

function splashPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>floo</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #111;
      border-top: 3px solid #111;
    }
    h1 { font-size: clamp(3rem, 10vw, 5rem); font-weight: 400; letter-spacing: -0.03em; line-height: 1; }
    .meta {
      margin-top: 1.25rem;
      font-size: 0.875rem;
      color: #aaa;
      letter-spacing: 0.01em;
    }
    .ping {
      margin-top: 0.6rem;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      color: #bbb;
    }
    footer {
      position: fixed;
      bottom: 1.75rem;
      left: 0; right: 0;
      text-align: center;
      font-size: 0.7rem;
      color: #999;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body>
  <h1>floo</h1>
  <p class="meta">agent running &middot; v${version}</p>
  <p class="ping"><a href="/ping" style="color:inherit;text-decoration:none;">/ping</a></p>
  <footer>Avelor &middot; floo</footer>
</body>
</html>`;
}

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function sse(res, event, data) {
  res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
}

function projectFromPath(pathname) {
  const match = pathname.match(/^\/deploy\/(.+)$/);
  return match ? match[1] : null;
}

function serve(port, host) {
  port = port || DEFAULT_PORT;
  host = host || DEFAULT_HOST;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(splashPage());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/ping') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('pong');
      return;
    }

    const project = projectFromPath(url.pathname);

    if (req.method === 'POST' && project) {
      const token = extractToken(req);

      if (!token) {
        res.writeHead(401, { 'content-type': 'text/plain' });
        res.end('unauthorized');
        return;
      }

      if (!tokens.validate(token, project)) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('forbidden');
        return;
      }

      if (locks.has(project)) {
        res.writeHead(409, {
          'content-type':  'text/event-stream',
          'cache-control': 'no-cache',
          'connection':    'keep-alive',
        });
        sse(res, 'error', { message: 'deploy of "' + project + '" is already in progress' });
        res.end();
        return;
      }

      const projectConfig = findProject(project);
      if (!projectConfig) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('project not found');
        return;
      }

      res.writeHead(200, {
        'content-type':  'text/event-stream',
        'cache-control': 'no-cache',
        'connection':    'keep-alive',
      });

      let aborted = false;
      req.on('close', () => { aborted = true; });

      locks.add(project);
      runDeploy(project, projectConfig, res, () => aborted)
        .finally(() => locks.delete(project));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });

  server.listen(port, host, () => {
    if (!process.env.FLOO_DAEMON) {
      info('agent listening on ' + host + ':' + port);
    }
  });

  process.on('SIGTERM', () => {
    server.close();
    const interval = setInterval(() => {
      if (locks.size === 0) {
        clearInterval(interval);
        process.exit(0);
      }
    }, 200);
  });

  return server;
}

async function runDeploy(project, config, res, isAborted) {
  const { cwd, steps = [], env: extraEnv = {} } = config;
  const env     = Object.assign({}, process.env, extraEnv);
  const id      = history.makeId();
  const started = new Date().toISOString();

  sse(res, 'start', { project, steps: steps.length });

  for (let i = 0; i < steps.length; i++) {
    if (isAborted()) break;

    const cmd = steps[i];
    sse(res, 'step', { index: i, total: steps.length, cmd });

    const exitCode = await runStep(cmd, cwd, env, (line, isStderr) => {
      if (!isAborted()) sse(res, 'line', { text: line, stderr: isStderr });
    });

    if (exitCode !== 0) {
      sse(res, 'done', { ok: false, step: i, cmd, code: exitCode });
      res.end();
      history.append({ id, project, started, finished: new Date().toISOString(), ok: false, steps: steps.length, failed_step: { index: i, cmd, code: exitCode } });
      return;
    }
  }

  if (!isAborted()) {
    sse(res, 'done', { ok: true });
    history.append({ id, project, started, finished: new Date().toISOString(), ok: true, steps: steps.length });
  }
  res.end();
}

function runStep(cmd, cwd, env, onLine) {
  return new Promise(resolve => {
    const child = spawn('sh', ['-c', cmd], {
      cwd,
      env,
      stdio: 'pipe',
    });

    function handleChunk(data, isStderr) {
      data.toString().split('\n').forEach(line => {
        if (line) onLine(line, isStderr);
      });
    }

    child.stdout.on('data', d => handleChunk(d, false));
    child.stderr.on('data', d => handleChunk(d, true));
    child.on('close', code => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

module.exports = { serve };
