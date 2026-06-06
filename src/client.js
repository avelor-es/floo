'use strict';

const { getProject } = require('./config');
const { fatal, ok, info, G, W, Y, GR, R, Z } = require('./fmt');

async function deploy(project) {
  const { url, token } = getProject(project);
  const endpoint = url.replace(/\/$/, '') + '/deploy/' + project;

  let res;
  try {
    res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'accept':        'text/event-stream',
      },
    });
  } catch (e) {
    fatal('cannot connect to agent: ' + e.message);
  }

  if (res.status === 401) fatal('unauthorized — check your token');
  if (res.status === 403) fatal('forbidden — token does not have access to "' + project + '"');
  if (res.status === 404) fatal('project "' + project + '" not found on agent');
  if (res.status === 409) fatal('a deploy for "' + project + '" is already in progress');
  if (!res.ok)            fatal('agent error: HTTP ' + res.status);

  return streamEvents(res.body);
}

async function streamEvents(body) {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';
  let success   = true;
  let gotDone   = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();

    for (const block of blocks) {
      const event = parseEvent(block);
      if (!event) continue;

      if (event.name === 'start') {
        info(
          'deploying ' + W + event.data.project + Z +
          G + '  ' + event.data.steps + ' steps' + Z,
        );

      } else if (event.name === 'step') {
        process.stdout.write(
          '\n' + G + '[' + (event.data.index + 1) + '/' + event.data.total + ']' + Z +
          '  ' + W + event.data.cmd + Z + '\n',
        );

      } else if (event.name === 'line') {
        const prefix = event.data.stderr ? Y : G;
        process.stdout.write('    ' + prefix + event.data.text + Z + '\n');

      } else if (event.name === 'done') {
        gotDone = true;
        process.stdout.write('\n');
        if (event.data.ok) {
          ok('deploy complete');
        } else {
          success = false;
          process.stderr.write(
            R + 'error: ' + Z + 'step failed: ' + event.data.cmd +
            G + '  (exit ' + event.data.code + ')' + Z + '\n',
          );
        }

      } else if (event.name === 'error') {
        success = false;
        fatal(event.data.message);
      }
    }
  }

  if (!gotDone) {
    process.stderr.write(R + 'error: ' + Z + 'connection lost — deploy may be incomplete\n');
    return false;
  }

  return success;
}

function parseEvent(block) {
  const lines = block.trim().split('\n');
  let name = 'message';
  let data = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) name = line.slice(7).trim();
    if (line.startsWith('data: ')) {
      try { data = JSON.parse(line.slice(6)); } catch { data = line.slice(6); }
    }
  }

  return data !== null ? { name, data } : null;
}

module.exports = { deploy };
