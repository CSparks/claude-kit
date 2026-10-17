// written.mjs — which files a broker job has written (the ledger) and the self-caused dirt the
// broker may put back itself. A tracked file whose content differs from HEAD only in line endings
// (`git diff --ignore-cr-at-eol` empty) AND that a broker job last wrote is such dirt, typically a
// killed job's leftover on an autocrlf checkout. Anything else, a hand edit above all, stays dirt
// and pauses the queue untouched.
//
//   recordWritten(cfg, cwd, paths, id)   note that job `id` journals (so writes) `paths`
//   healOwnDirt(cfg, cwd)                -> the paths restored from HEAD, none unless the rule above holds

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brokerPaths } from './config.mjs';
import { git, trackedModifications } from './git.mjs';

const MAX_ENTRIES = 5000;
const ledgerPath = (cfg) => join(brokerPaths(cfg).home, 'written.json');
const keyOf = (cwd, path) => resolve(cwd, path).split(String.fromCharCode(92)).join('/').toLowerCase();

function readLedger(cfg) {
  try { return JSON.parse(readFileSync(ledgerPath(cfg), 'utf8')); } catch { return {}; }
}

export function recordWritten(cfg, cwd, paths, id) {
  try {
    mkdirSync(brokerPaths(cfg).home, { recursive: true });
    const ledger = readLedger(cfg);
    for (const p of paths) { delete ledger[keyOf(cwd, p)]; ledger[keyOf(cwd, p)] = id; }
    const keys = Object.keys(ledger);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete ledger[k];
    writeFileSync(ledgerPath(cfg), JSON.stringify(ledger));
  } catch { /* the ledger only widens what may be healed; without it nothing is */ }
}

export function healOwnDirt(cfg, cwd) {
  const ledger = readLedger(cfg);
  const healed = [];
  for (const { xy, path } of trackedModifications(cwd).records) {
    if (xy !== ' M' || !ledger[keyOf(cwd, path)]) continue;
    if (git(['diff', '--quiet', '--ignore-cr-at-eol', '--', path], cwd).code !== 0) continue;
    if (git(['checkout', '-q', 'HEAD', '--', path], cwd).code === 0) healed.push(path);
  }
  return healed;
}
