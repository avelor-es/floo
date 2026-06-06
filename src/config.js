'use strict';

const fs = require('fs');
const { CLIENT_CONFIG_FILE, ensureDir } = require('./paths');
const { fatal } = require('./fmt');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CLIENT_CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(data) {
  ensureDir();
  fs.writeFileSync(CLIENT_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function setProject(project, url, token) {
  const config = readConfig();
  config[project] = { url, token };
  writeConfig(config);
}

function getProject(project) {
  const envToken = process.env.FLOO_TOKEN;
  const envUrl   = process.env.FLOO_URL;

  if (envToken && envUrl) return { url: envUrl, token: envToken };

  const config = readConfig();
  const entry  = config[project];

  if (envToken) {
    if (entry?.url) return { url: entry.url, token: envToken };
    fatal(
      `FLOO_TOKEN is set but no URL configured for "${project}"\n` +
      `  set FLOO_URL or run: floo use ${project} <url> <token>`,
    );
  }

  if (!entry) {
    fatal(`project "${project}" is not configured\n  run: floo use ${project} <url> <token>`);
  }
  if (!entry.url || !entry.token) {
    fatal(`incomplete config for "${project}"\n  run: floo use ${project} <url> <token>`);
  }

  return { url: entry.url, token: entry.token };
}

module.exports = { readConfig, writeConfig, setProject, getProject };
