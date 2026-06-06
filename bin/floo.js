#!/usr/bin/env node
'use strict';

const { fatal, ok, info, G, W, GR, Y, Z } = require('../src/fmt');
const { setProject }   = require('../src/config');
const tokens           = require('../src/tokens');
const daemon           = require('../src/daemon');
const { serve }        = require('../src/agent');
const { deploy }       = require('../src/client');
const { initFile, PROJECTS_FILE } = require('../src/projects');
const { ensureDir }    = require('../src/paths');

const USAGE = `
${G}floo${Z} — deploy from anywhere

${G}agent${Z}  (run on the server)
  ${W}agent${Z} [--port 4001] [--host 0.0.0.0] [--daemon]   start the agent
  ${W}stop${Z}                                               stop the daemon
  ${W}status${Z}                                             daemon status
  ${W}init${Z}                                               create projects.yml
  ${W}token issue${Z} --project <name>                       issue a project token
  ${W}token list${Z}                                         list tokens
  ${W}token revoke${Z} <id>                                  revoke a token

${G}client${Z}  (run on your machine or CI)
  ${W}use${Z} <project> <url> <token>                        configure a project
  ${W}<project>${Z}                                          deploy a project

${G}ci/cd${Z}
  set ${W}FLOO_TOKEN${Z} and ${W}FLOO_URL${Z}, then run: floo <project>

${G}config:${Z} ~/.config/floo/
`;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key  = args[i].slice(2);
      const next = args[i + 1];
      flags[key] = (next && !next.startsWith('--')) ? (i++, next) : true;
    }
  }
  return flags;
}

(async () => {
  ensureDir();

  const [,, cmd, sub, ...rest] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE + '\n');
    process.exit(0);
  }

  if (cmd === '--version' || cmd === '-v') {
    process.stdout.write(require('../package.json').version + '\n');
    process.exit(0);
  }

  switch (cmd) {

    case 'agent': {
      const flags = parseFlags([sub, ...rest].filter(Boolean));
      const port  = parseInt(flags.port || process.env.PORT || '4001', 10);
      const host  = flags.host || process.env.HOST || '0.0.0.0';

      if (flags.daemon && !process.env.FLOO_DAEMON) {
        daemon.start(process.argv.slice(1), port);
        break;
      }

      serve(port, host);
      break;
    }

    case 'stop':   daemon.stop();   break;
    case 'status': daemon.status(); break;

    case 'init': {
      const created = initFile();
      if (created) {
        ok('created ' + PROJECTS_FILE);
        info('edit the file to define your projects, then run: floo agent');
      } else {
        info('projects file already exists: ' + PROJECTS_FILE);
      }
      break;
    }

    case 'token': {
      switch (sub) {

        case 'issue': {
          const flags   = parseFlags(rest);
          const project = flags.project;
          if (!project) fatal('usage: floo token issue --project <name>');

          const result = tokens.issue(project);
          ok('token issued');
          process.stdout.write('\n');
          process.stdout.write(G + '  project: ' + Z + result.project + '\n');
          process.stdout.write(G + '  id:      ' + Z + result.id + '\n');
          process.stdout.write(G + '  token:   ' + Z + W + result.raw + Z + '\n');
          process.stdout.write('\n');
          process.stdout.write(
            G + '  → run on your machine:\n' + Z +
            '  ' + W + 'floo use ' + result.project + ' <url> ' + result.raw + Z + '\n\n',
          );
          break;
        }

        case 'list': {
          const list = tokens.list();
          if (!list.length) {
            info('no tokens issued');
            break;
          }
          process.stdout.write('\n');
          process.stdout.write(
            G + 'id        project              created\n' +
                '────────  ───────────────────  ────────────────────\n' + Z,
          );
          for (const t of list) {
            process.stdout.write(
              W + t.id.padEnd(10) + Z +
              t.project.padEnd(21) +
              G + t.created + Z + '\n',
            );
          }
          process.stdout.write('\n');
          break;
        }

        case 'revoke': {
          const id = rest[0];
          if (!id) fatal('usage: floo token revoke <id>');
          if (tokens.revoke(id)) ok('token ' + id + ' revoked');
          else fatal('token not found: ' + id);
          break;
        }

        default:
          fatal('unknown subcommand: token ' + (sub || '') + '\n  run: floo help');
      }
      break;
    }

    case 'use': {
      const project = sub;
      const url     = rest[0];
      const token   = rest[1];
      if (!project || !url || !token) {
        fatal('usage: floo use <project> <url> <token>');
      }
      setProject(project, url, token);
      ok('configured  ' + W + project + Z + G + '  →  ' + Z + url);
      break;
    }

    default: {
      if (cmd && !cmd.startsWith('-')) {
        const success = await deploy(cmd);
        process.exit(success ? 0 : 1);
      } else {
        fatal('unknown command: ' + cmd + '\n  run: floo help');
      }
    }
  }
})();
