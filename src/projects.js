'use strict';

const fs   = require('fs');
const yaml = require('js-yaml');
const { PROJECTS_FILE } = require('./paths');
const { fatal } = require('./fmt');

const STARTER = `# floo projects — define one project per deploy target
#
# projects:
#   myapp:
#     cwd: /var/www/html/myapp
#     env:
#       NODE_ENV: production
#     steps:
#       - git pull origin main
#       - npm install
#       - npm run build
#       - pm2 restart myapp --update-env
`;

function readProjects() {
  let raw;
  try {
    raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      fatal(`projects file not found: ${PROJECTS_FILE}\n  run: floo init`);
    }
    fatal(`cannot read projects file: ${e.message}`);
  }

  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    fatal(`invalid YAML in projects file: ${e.message}`);
  }

  return parsed?.projects || {};
}

function getProject(name) {
  const projects = readProjects();
  if (!projects[name]) fatal(`project not found: "${name}"`);
  return projects[name];
}

function findProject(name) {
  try {
    const projects = readProjects();
    return projects[name] || null;
  } catch {
    return null;
  }
}

function initFile() {
  try {
    fs.accessSync(PROJECTS_FILE);
    return false;
  } catch {
    fs.mkdirSync(require('./paths').CONFIG_DIR, { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, STARTER, 'utf8');
    return true;
  }
}

function addProject(name, config) {
  let projects = {};
  try { projects = readProjects(); } catch { /* file may not exist yet */ }
  projects[name] = config;
  require('./paths').ensureDir();
  fs.writeFileSync(PROJECTS_FILE, yaml.dump({ projects }, { lineWidth: -1 }), 'utf8');
}

module.exports = { readProjects, getProject, findProject, initFile, addProject, PROJECTS_FILE };
