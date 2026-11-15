// init-project-plan — what `init-project.mjs --dry-run` would write, as lines; reads the filesystem, writes nothing.
//
//   planAdoption({ target, name, data, marker })  -> string[]  for a repo adoption
//   planLab({ name, data })                       -> string[]  for a --lab scope

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTRACT_FILES = ['CLAUDE.md', 'AGENTS.md'];

function contractLine(target, fileName, marker) {
  const path = join(target, fileName);
  if (!existsSync(path)) return `would create ${path} with the workflow contract`;
  return readFileSync(path, 'utf8').includes(marker)
    ? `would skip ${path} (already has the workflow contract)`
    : `would append the workflow contract to ${path}`;
}

export function planAdoption({ target, name, data, marker }) {
  const lines = [];
  const aiDir = join(target, '.ai');
  if (data) {
    const dataDir = join(data, 'projects', name);
    lines.push(existsSync(dataDir) ? `would keep the existing data dir ${dataDir}` : `would seed ${dataDir} from the template`);
    lines.push(`would write ${join(target, '.claude-project')} -> ${name}`);
    lines.push(existsSync(aiDir) ? `would leave ${aiDir} as-is` : `would link ${aiDir} -> ${dataDir}`);
  } else {
    lines.push(existsSync(aiDir) ? `would leave ${aiDir} untouched` : `would scaffold ${aiDir} from the template (local)`);
  }
  for (const fileName of CONTRACT_FILES) lines.push(contractLine(target, fileName, marker));
  lines.push(`would update ${join(target, '.gitignore')}`);
  lines.push(`would install the git hooks in ${target}${data ? ' and the data repo' : ''}`);
  return lines;
}

export function planLab({ name, data }) {
  const dataDir = join(data, 'projects', name);
  return [existsSync(dataDir) ? `would keep the existing data dir ${dataDir}` : `would seed ${dataDir} from the template`, `would stamp lab: true into ${join(dataDir, 'config.yml')}`];
}
