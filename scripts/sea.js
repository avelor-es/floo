#!/usr/bin/env node
'use strict';

// Assembles the Node SEA binary for the current platform.
// Expects dist/floo.blob to already exist (built by sea-config.json).

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.platform;
const arch     = process.arch;
const isMac    = platform === 'darwin';
const isWin    = platform === 'win32';

const blobPath = path.resolve(__dirname, '..', 'dist', 'floo.blob');
const outDir   = path.resolve(__dirname, '..', 'dist', 'bin');
const outName  = `floo-${isMac ? 'darwin' : platform}-${arch}${isWin ? '.exe' : ''}`;
const outPath  = path.join(outDir, outName);

if (!fs.existsSync(blobPath)) {
  process.stderr.write('error: dist/floo.blob not found — run: node --experimental-sea-config sea-config.json\n');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(process.execPath, outPath);
fs.chmodSync(outPath, 0o755);

if (isMac) {
  execSync(`codesign --remove-signature "${outPath}"`);
}

const machoFlag = isMac ? ' --macho-segment-name NODE_SEA' : '';
execSync(
  `npx --yes postject "${outPath}" NODE_SEA_BLOB "${blobPath}"` +
  ` --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2${machoFlag}`,
  { stdio: 'inherit' },
);

if (isMac) {
  execSync(`codesign --sign - "${outPath}"`);
}

process.stdout.write('built: ' + outPath + '\n');
