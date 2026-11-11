// q-show.mjs — `q show <id>`: print one ticket/decision/note/question in full (KIT-T287), found
// in the project store, its adopted framework stores, then every registered project, so reading
// an item never needs a text tool on .ai files.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hydrationSources } from './hydrate-db.mjs';
import { synthId } from './db-parse.mjs';
import { readIdConfig } from './id-utils.mjs';
import { frameworkStores } from './q-framework.mjs';
import { landedLine } from './landed.mjs';
import { askedLabel } from './question-asks.mjs';
import { projectStore } from './q-project.mjs';

const STORES = ['tickets', 'tickets/archive', 'decisions', 'notes', 'questions', 'inbox', 'epics'];

// The id `q fts` lists for an id-less file (an inbox capture, a questions file): the cache's synthetic id.
// `id` names it whole or as a prefix ending at a `-` boundary.
const isSyntheticMatch = (key, store, name, id) => {
  const synth = synthId(key || 'X', store.split('/')[0], name);
  return synth === id || synth.startsWith(`${id}-`);
};

function findIn(aiDir, id) {
  const { key } = readIdConfig(null, aiDir);
  for (const store of STORES) {
    let names;
    try { names = readdirSync(join(aiDir, store)); } catch { continue; }
    const hit = names.find((n) => n.endsWith('.md') && (n === `${id}.md` || n.startsWith(`${id}-`) || isSyntheticMatch(key, store, n, id)));
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

/** Splits `q show` arguments into { id, project }: `--project <name|key>` (or `--scope`, `--flag=value`) may sit anywhere. */
export function showArgs(args) {
  const rest = [];
  let project;
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    const inline = /^--(project|scope)=(.*)$/.exec(a);
    if (!inline && a !== '--project' && a !== '--scope') { rest.push(a); continue; }
    const value = inline ? inline[2] : args[++i];
    if (value === undefined || value === '') throw new Error(`${inline ? `--${inline[1]}` : a} takes a value`);
    project = value;
  }
  return { id: rest[0], project };
}

/** Where `id` is looked up under `--project`: that project's store alone. Throws on an unknown project. */
function pinnedFile(id, project) {
  const { name, aiDir } = projectStore(project);
  return { file: existsSync(aiDir) ? findIn(aiDir, id) : null, name };
}

/** Lines to print for `id`, or a one-line miss message. A ticket with landed commits gets a LANDED COMMITS line. */
export function showRows(id, root, { project } = {}) {
  const want = String(id || '').trim();
  if (!want) return ['usage: q show <id> [--project <name>]   (e.g. q show KIT-T287)'];
  const pinned = project ? pinnedFile(want, project) : null;
  const file = pinned ? pinned.file : findItemFile(want, root);
  if (!file) return [`q show: no item '${want}' in ${pinned ? `project ${pinned.name}` : 'the project, framework or registered stores'}`];
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd();
  const landed = landedLine(text);
  const asked = askedLabel(text);
  return [`# ${file}`, ...(landed ? [landed] : []), ...(asked ? [asked] : []), ...text.split('\n')];
}

/** `q open` rows with the ASKED label appended to each asked question's title (KIT-T448). */
export function withAsked(rows, root) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (!row || row.type !== 'Q') return row;
    const file = findItemFile(row.id, root);
    const asked = file ? askedLabel(readFileSync(file, 'utf8')) : '';
    return asked ? { ...row, title: [row.title, asked].filter(Boolean).join('  ') } : row;
  });
}
