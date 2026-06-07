'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { ok, info, fatal, G, W, Z } = require('./fmt');

function systemdAvailable() {
  try {
    execSync('systemctl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function install(port) {
  if (process.platform !== 'linux') {
    fatal('floo agent install only supports Linux with systemd');
  }
  if (!systemdAvailable()) {
    fatal('systemd not found — set up the agent manually with your init system');
  }

  const isRoot    = process.getuid() === 0;
  const nodeBin   = process.execPath;
  const flooBin   = fs.realpathSync(process.argv[1]);
  const configDir = process.env.FLOO_CONFIG_DIR || path.join(os.homedir(), '.config', 'floo');

  const unit = [
    '[Unit]',
    'Description=floo deploy agent',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=${nodeBin} ${flooBin} agent --port ${port}`,
    'Restart=on-failure',
    'RestartSec=5',
    `Environment=FLOO_CONFIG_DIR=${configDir}`,
    '',
    '[Install]',
    `WantedBy=${isRoot ? 'multi-user.target' : 'default.target'}`,
    '',
  ].join('\n');

  if (isRoot) {
    const unitFile = '/etc/systemd/system/floo.service';
    fs.writeFileSync(unitFile, unit, 'utf8');
    run('systemctl daemon-reload');
    run('systemctl enable floo');
    run('systemctl start floo');
    ok('floo service installed and started');
    info('manage with: ' + W + 'systemctl {status,stop,restart} floo' + Z);
  } else {
    const dir = path.join(os.homedir(), '.config', 'systemd', 'user');
    fs.mkdirSync(dir, { recursive: true });
    const unitFile = path.join(dir, 'floo.service');
    fs.writeFileSync(unitFile, unit, 'utf8');
    run('systemctl --user daemon-reload');
    run('systemctl --user enable floo');
    run('systemctl --user start floo');
    ok('floo user service installed and started');
    info('to start on boot without login: ' + W + 'loginctl enable-linger ' + os.userInfo().username + Z);
    info('manage with: ' + W + 'systemctl --user {status,stop,restart} floo' + Z);
  }
}

module.exports = { install };
