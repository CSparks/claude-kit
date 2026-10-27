// kit-data.mjs — read the kit's DATA (the capability table in .ai/config.yml, .ai/model-lineup.json) from
// the kit checkout's committed HEAD while the CODE stays sealed in the published runtime. A weekly
// re-date is a data commit; it takes effect when committed, not after a 20-minute publish. Only a
// committed state is read, so a writer's half-edited file never reaches a session (KIT-T460's rule).
//
//   kitDataText(kitRoot, ...rel)              -> file text. Reads `git show HEAD:<rel>` of the registered claude-kit
//                                                checkout when `kitRoot` is the sealed runtime this code runs from;
//                                                any other root (a fixture, the checkout itself) is read as a file.
//                                                Falls back to the runtime's own copy when the checkout is unknown or git fails.
//   readCommitted(codeRoot, kitRoot, rel, checkout) -> the same decision with its inputs named (tests)
//   kitDataWriteRoot(kitRoot)                 -> where a data writer (refresh, re-date) writes: the registered checkout
//                                                when `kitRoot` is the sealed runtime, else `kitRoot`. The write takes
//                                                effect once committed there.
//   writeRootFor(codeRoot, kitRoot, checkout) -> the same decision with its inputs named (tests)

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegistry } from '../hooks/lib/registry.mjs';

const CODE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEALED_NAME = /^[0-9a-f]{7,40}$/;
const KIT_PROJECT = 'claude-kit';
const GIT_MAX_BYTES = 1 << 24;

const cache = new Map();

function committed(checkout, rel) {
  const r = spawnSync('git', ['-C', checkout, 'show', `HEAD:${rel.join('/')}`], { encoding: 'utf8', windowsHide: true, maxBuffer: GIT_MAX_BYTES });
  return r.status === 0 ? r.stdout : null;
}

export function readCommitted(codeRoot, kitRoot, rel, checkout) {
  const sealed = SEALED_NAME.test(basename(codeRoot));
  if (sealed && resolve(kitRoot) === resolve(codeRoot) && checkout && existsSync(join(checkout, '.git'))) {
    const text = committed(checkout, rel);
    if (text !== null) return text;
  }
  return readFileSync(join(kitRoot, ...rel), 'utf8');
}

export function writeRootFor(codeRoot, kitRoot, checkout) {
  const sealed = SEALED_NAME.test(basename(codeRoot)) && resolve(kitRoot) === resolve(codeRoot);
  return sealed && checkout && existsSync(join(checkout, '.git')) ? checkout : kitRoot;
}

export function kitDataWriteRoot(kitRoot) {
  return writeRootFor(CODE_ROOT, kitRoot, process.env.CLAUDE_KIT_LADDER_ROOT ? null : readRegistry().projects[KIT_PROJECT]);
}

const sealedHere = (kitRoot) => SEALED_NAME.test(basename(CODE_ROOT)) && resolve(kitRoot) === CODE_ROOT;

// Only the sealed-runtime read is cached for the process: a hook lives for one call, and any other root
// (a fixture a test rewrites) must be re-read every time.
export function kitDataText(kitRoot, ...rel) {
  if (!sealedHere(kitRoot)) return readFileSync(join(kitRoot, ...rel), 'utf8');
  const key = rel.join('/');
  if (!cache.has(key)) cache.set(key, readCommitted(CODE_ROOT, kitRoot, rel, process.env.CLAUDE_KIT_LADDER_ROOT ? null : readRegistry().projects[KIT_PROJECT]));
  return cache.get(key);
}
