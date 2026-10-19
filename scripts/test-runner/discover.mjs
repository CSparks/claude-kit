// discover.mjs — the manifest of the kit's test files (KIT-T570): every tracked *.test.mjs, found
// by `git ls-files` in a checkout and by a directory walk in a `git archive` export (the publish
// gate), so a new test file is run without anyone listing it.
//
//   discoverTests(root) -> sorted POSIX paths relative to root

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BACKSLASH = String.fromCharCode(92);
const TEST_FILE = /\.test\.mjs$/;
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'target', '.cache', 'frameworks']);

function tracked(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--', '*.test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  return out.split('\0').filter(Boolean);
}

function walk(root, dir = '') {
  const found = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIPPED_DIRS.has(entry.name)) found.push(...walk(root, rel)); } else if (TEST_FILE.test(entry.name)) found.push(rel);
  }
  return found;
}

export function discoverTests(root) {
  const files = existsSync(join(root, '.git')) ? tracked(root) : walk(root);
  return [...new Set(files.map((f) => f.split(BACKSLASH).join('/')))].sort();
}
