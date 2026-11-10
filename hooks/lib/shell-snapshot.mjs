// The effect of one shell call on a repo's working tree (KIT-D117): every dirty path with its mtime and size (and a content hash for source),
// taken before the call and compared after it. Nothing is parsed to find a write, so every sink and path
// form is seen alike.
//   snapshotDirty(root) -> { [relPath]: signature }          capped at ENTRIES_MAX paths
//   headOf(root) -> the commit HEAD names, '' outside a repo
//   changedSince(root, before, headBefore) -> paths the call created, modified, deleted or reverted; a path a
//     HEAD move since headBefore committed (a broker landing) and that is clean now is the landing's, not the call's
//   handWrittenSources(root, before, command, headBefore) -> created or changed hand-authored source paths still on disk;
//     a deleted path is no write (nothing is left to re-save), and [] when every segment of the command is a
//     generator (git, a build tool, a formatter, a kit verb, a broker client script) or a reader with no file
//     redirect (cat, grep, head): its output is no hand write, and a change that landed meanwhile (a broker
//     landing included) is another writer's

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './exec.mjs';
import { isSourcePath } from './shell-source-write.mjs';
import { nodeScriptName } from './node-args.mjs';
import { KIT_TOOL, shellArgs } from './shell-write-scan.mjs';
import { segments } from './shell-segments.mjs';

const ENTRIES_MAX = 5000;
const MIN_ENTRY_LENGTH = 4;
const GONE = 'gone';
const GENERATORS = /^(?:git|cargo|rustc|rustfmt|clippy-driver|npm|npx|pnpm|yarn|bun|make|cmake|ninja|dotnet|go|gofmt|prettier|eslint|black|ruff|isort|tsc|vite|esbuild|wasm-pack|cd|true|false|:)$/i;
// Commands that only read or print: with no redirect into a file they cannot write source, so a change
// that lands during the call is another writer's.
const READERS = /^(?:cat|head|tail|less|more|wc|ls|stat|file|diff|cmp|grep|egrep|fgrep|rg|ag|ack|sort|uniq|cut|tr|echo|printf|pwd|date|sleep|which|whoami|tasklist)$/i;
const SED_IN_PLACE = /\s(?:--in-place\b|-[A-Za-z]*i)/;
const isReader = (leader, text) => READERS.test(leader) || (/^sed$/i.test(leader) && !SED_IN_PLACE.test(text));
const BROKER_CLIENT = /^(?:submit|wait|watch|broker)\.mjs$/i;
const BENIGN_REDIRECT = /\d?>&\d|&?\d?>>?\s*\/dev\/null/g;
const QUOTED = /"[^"]*"|'[^']*'/g;
const hasFileRedirect = (command) => String(command || '').replace(QUOTED, '""').replace(BENIGN_REDIRECT, '').includes('>');
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;

const HASH_MAX_BYTES = 1 << 20;

// Source files carry a content hash beside mtime and size: a same-size rewrite inside one coarse timestamp tick
// leaves the other two unchanged (KIT-T710).
const contentHash = (path, size) => {
  try { return size <= HASH_MAX_BYTES ? createHash('sha1').update(readFileSync(path)).digest('hex') : ''; } catch { return ''; }
};

/** The content hash of `rel` as it sits on disk now, '' when it is missing or too large to hash. */
export const contentHashOf = (root, rel) => {
  try {
    const path = join(root, rel);
    return contentHash(path, statSync(path).size);
  } catch {
    return '';
  }
};

const signature = (root, rel) => {
  try {
    const path = join(root, rel);
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}${isSourcePath(rel) ? `:${contentHash(path, s.size)}` : ''}`;
  } catch {
    return GONE;
  }
};

export function snapshotDirty(root) {
  const snap = {};
  const parts = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root).split('\0');
  let count = 0;
  for (let i = 0; i < parts.length && count < ENTRIES_MAX; i++) {
    const entry = parts[i];
    if (entry.length < MIN_ENTRY_LENGTH) continue;
    if (/[RC]/.test(entry.slice(0, 2))) i++;
    const rel = entry.slice(3);
    snap[rel] = signature(root, rel);
    count++;
  }
  return snap;
}

export const headOf = (root) => git(['rev-parse', '--verify', '-q', 'HEAD'], root).trim();

const landedSince = (root, headBefore) => {
  const now = headOf(root);
  if (!headBefore || !now || now === headBefore) return new Set();
  return new Set(git(['diff', '--name-only', '-z', headBefore, now], root).split('\0').filter(Boolean));
};

export function changedSince(root, before, headBefore = '') {
  const after = snapshotDirty(root);
  const landed = landedSince(root, headBefore);
  const rels = new Set([...Object.keys(after), ...Object.keys(before)]);
  return [...rels].filter((rel) => !(landed.has(rel) && !(rel in after))
    && (after[rel] ?? signature(root, rel)) !== (before[rel] ?? null));
}

const leaderOf = (text) => {
  const words = text.trim().split(/\s+/).filter((w) => w && !ENV_ASSIGN.test(w));
  return (words[0] || '').replace(/.*[\\/]/, '').replace(/\.exe$/i, '');
};

function isGeneratorCommand(command) {
  const segs = segments(String(command || ''));
  if (segs.some((s) => s.ambiguous)) return false;
  const redirects = hasFileRedirect(command);
  return segs.every(({ text }) => {
    if (!text.trim()) return true;
    const leader = leaderOf(text);
    if (GENERATORS.test(leader) || KIT_TOOL.test(leader) || (!redirects && isReader(leader, text))) return true;
    if (!/^node$/i.test(leader)) return false;
    const script = nodeScriptName(shellArgs(text).filter((w) => !ENV_ASSIGN.test(w)).slice(1));
    return KIT_TOOL.test(script) || (!redirects && BROKER_CLIENT.test(script));
  });
}

export function handWrittenSources(root, before, command, headBefore = '') {
  if (isGeneratorCommand(command)) return [];
  return changedSince(root, before, headBefore).filter((rel) => isSourcePath(rel) && signature(root, rel) !== GONE);
}
