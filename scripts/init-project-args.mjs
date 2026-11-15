// init-project-args — argument parsing and target guards for init-project.mjs (KIT-T1239).
//
//   parseInitArgs(argv)                          -> { help, dryRun, force, here, lab, key, target, error }
//   guardTarget({ target, kit, projects, force }) -> an error string, or '' when the target may be adopted
//   USAGE                                        the text `--help` prints
//
// Nothing here touches the filesystem except realpath lookups in guardTarget; init-project.mjs acts on the result.

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const USAGE = `usage: init-project.mjs <target-dir> [--key=ABC] [--dry-run] [--force]
       init-project.mjs --here [--key=ABC] [--dry-run] [--force]     adopt the current directory
       init-project.mjs --lab <name> [--key=ABC] [--dry-run]         repo-less scope in the central store
       init-project.mjs --help | -h

  <target-dir>  the repo to adopt; required, or pass --here to mean the current directory
  --key=ABC     override the derived ticket id key
  --dry-run     list what would be written and change nothing
  --force       adopt a target that is already registered
  Refused always: the claude-kit checkout itself.`;

const KEY_PREFIX = '--key=';
const BOOLEAN_FLAGS = new Map([
  ['--help', 'help'], ['-h', 'help'], ['--dry-run', 'dryRun'], ['--force', 'force'], ['--here', 'here'], ['--lab', 'lab'],
]);

export function parseInitArgs(argv) {
  const out = { help: false, dryRun: false, force: false, here: false, lab: false, key: '', target: '', error: '' };
  const positional = [];
  for (const arg of argv) {
    if (BOOLEAN_FLAGS.has(arg)) out[BOOLEAN_FLAGS.get(arg)] = true;
    else if (arg.startsWith(KEY_PREFIX)) out.key = arg.slice(KEY_PREFIX.length).trim().toUpperCase();
    else if (arg.startsWith('-')) out.error = `unknown flag ${arg}`;
    else positional.push(arg);
  }
  if (out.help) return out;
  if (positional.length > 1) out.error = out.error || `expected one target, got ${positional.length}: ${positional.join(' ')}`;
  out.target = positional[0] || '';
  if (!out.error && out.lab && !out.target) out.error = '--lab needs a <name>';
  if (!out.error && out.lab && out.here) out.error = '--lab and --here are exclusive';
  if (!out.error && !out.lab && out.here && out.target) out.error = '--here and a target path are exclusive';
  if (!out.error && !out.lab && !out.here && !out.target) out.error = 'no target: pass a target path or --here';
  return out;
}

const real = (path) => {
  try { return realpathSync.native(path); } catch { return resolve(path); }
};
const same = (a, b) => {
  const x = real(a);
  const y = real(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};

export function guardTarget({ target, kit, projects, force }) {
  if (same(target, kit)) return `${target} is the claude-kit checkout; the kit is never adopted as a project`;
  if (force) return '';
  const hit = Object.entries(projects || {}).find(([, repo]) => typeof repo === 'string' && same(repo, target));
  return hit ? `${target} is already registered as project "${hit[0]}"; pass --force to adopt it again` : '';
}
