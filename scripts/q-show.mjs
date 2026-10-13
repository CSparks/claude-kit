// q-show.mjs — `q show <id>`: print one ticket/decision/note/question in full (KIT-T287), found
// in the project store, its adopted framework stores, then every registered project, so reading
// an item never needs a text tool on .ai files.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hydrationSources } from './hydrate-db.mjs';
import { frameworkStores } from './q-framework.mjs';
import { landedLine } from './landed.mjs';

const STORES = ['tickets', 'tickets/archive', 'decisions', 'notes', 'questions', 'inbox', 'epics'];

function findIn(aiDir, id) {
  for (const store of STORES) {
    let names;
    try { names = readdirSync(join(aiDir, store)); } catch { continue; }
    const hit = names.find((n) => n.endsWith('.md') && (n === `${id}.md` || n.startsWith(`${id}-`)));
    if (hit) return join(aiDir, store, hit);
  }
  return null;
}

/** The file holding `id`: the project store, its framework stores, then every registered project. Null on a miss. */
export function findItemFile(id, root) {
  const dirs = [join(root, '.ai'), ...frameworkStores(root).map((f) => f.aiDir)];
  try { for (const s of hydrationSources(undefined)) dirs.push(s.aiDir); } catch { /* no registry — local stores only */ }
  for (const dir of new Set(dirs)) {
    const file = existsSync(dir) ? findIn(dir, id) : null;
    if (file) return file;
  }
  return null;
}

/** Lines to print for `id`, or a one-line miss message. A ticket with landed commits gets a LANDED COMMITS line. */
export function showRows(id, root) {
  const want = String(id || '').trim();
  if (!want) return ['usage: q show <id>   (e.g. q show KIT-T287)'];
  const file = findItemFile(want, root);
  if (!file) return [`q show: no item '${want}' in the project, framework or registered stores`];
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const landed = landedLine(text);
  return [`# ${file}`, ...(landed ? [landed] : []), ...text.split('\n')];
}
