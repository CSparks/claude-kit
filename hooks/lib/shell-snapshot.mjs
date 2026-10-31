// The effect of one shell call on a repo's working tree (KIT-D117): every dirty path with its mtime and size,
// taken before the call and compared after it. Nothing is parsed to find a write, so every sink and path
// form is seen alike.
//   snapshotDirty(root) -> { [relPath]: signature }          capped at ENTRIES_MAX paths
//   changedSince(root, before) -> paths the call created, modified, deleted or reverted
//   handWrittenSources(root, before, command) -> created or changed hand-authored source paths still on disk;
//     a deleted path is no write (nothing is left to re-save), and [] when every segment of the command is a
//     generator (git, a build tool, a formatter, a kit verb, a broker client script) or a reader with no file
//     redirect (cat, grep, head): its output is no hand write, and a change that landed meanwhile (a broker
//     landing included) is another writer's

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './exec.mjs';
import { isSourcePath } from './shell-source-write.mjs';
import { KIT_TOOL } from './shell-write-scan.mjs';
import { segments } from './shell-segments.mjs';

const ENTRIES_MAX = 5000;
const MIN_ENTRY_LENGTH = 4;
const GONE = 'gone';
const GENERATORS = /^(?:git|cargo|rustc|rustfmt|clippy-driver|npm|npx|pnpm|yarn|bun|make|cmake|ninja|dotnet|go|gofmt|prettier|eslint|black|ruff|isort|tsc|vite|esbuild|wasm-pack|cd|true|false|:)$/i;
// Commands that only read or print: with no redirect into a file they cannot write source, so a change
// that lands during the call is another writer's.
const READERS = /^(?:cat|head|tail|less|more|wc|ls|stat|file|diff|cmp|grep|egrep|fgrep|rg|ag|ack|sort|uniq|cut|tr|echo|printf|pwd|date|sleep|which|whoami|tasklist)$/i;
const BROKER_CLIENT = /^(?:submit|wait|watch|broker)\.mjs$/i;
const BENIGN_REDIRECT = /\d?>&\d|&?\d?>>?\s*\/dev\/null/g;
const hasFileRedirect = (command) => String(command || '').replace(BENIGN_REDIRECT, '').includes('>');
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;

const signature = (root, rel) => {
  try {
    const s = statSync(join(root, rel));
    return `${s.mtimeMs}:${s.size}`;
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

export function changedSince(root, before) {
  const after = snapshotDirty(root);
  const rels = new Set([...Object.keys(after), ...Object.keys(before)]);
  return [...rels].filter((rel) => (after[rel] ?? signature(root, rel)) !== (before[rel] ?? null));
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
    if (GENERATORS.test(leader) || KIT_TOOL.test(leader) || (!redirects && READERS.test(leader))) return true;
    if (!/^node$/i.test(leader)) return false;
    return text.split(/\s+/).some((w) => {
      const name = w.replace(/^["']|["']$/g, '').replace(/.*[\\/]/, '');
      return KIT_TOOL.test(name) || (!redirects && BROKER_CLIENT.test(name));
    });
  });
}

export function handWrittenSources(root, before, command) {
  if (isGeneratorCommand(command)) return [];
  return changedSince(root, before).filter((rel) => isSourcePath(rel) && signature(root, rel) !== GONE);
}
