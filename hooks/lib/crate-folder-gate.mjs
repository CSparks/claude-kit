// crate-folder-gate.mjs — a Write that creates a file in a folder a Cargo workspace takes as a member must create that crate's
// Cargo.toml first (KIT-T1275). A workspace whose `members` is a glob (`world/*`) loads every matching folder as a crate: one with
// no manifest makes every cargo command in the workspace fail ("failed to load manifest for workspace member") for every writer
// until the folder is removed. Fail-open: a workspace or glob this cannot read judges nothing.
//
//   crateFolderViolation(file) -> null | { dir, rel, member, workspace }
//     `file` is the absolute path a Write is about to create; `dir` is the member folder without a Cargo.toml (an ancestor of
//     `file` or its own folder), `member` the workspace pattern that matches it, `workspace` the workspace manifest

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const MANIFEST = 'Cargo.toml';
const WORKSPACE_TABLE = /^\s*\[workspace\]/m;
const slash = (p) => String(p).replace(/\\/g, '/');
const quoted = (text) => [...text.replace(/#.*$/gm, '').matchAll(/(["'])([^"']*)\1/g)].map((m) => m[2]);

function listOf(text, key) {
  const section = text.slice(text.search(WORKSPACE_TABLE));
  const found = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'm').exec(section);
  return found ? quoted(found[1]).map((p) => slash(p).replace(/^\.\//, '').replace(/\/+$/, '')) : [];
}

// A cargo member pattern: `*` and `?` stay inside one path segment; `**` crosses segments; a character class is not read.
function patternToRegExp(pattern) {
  if (/[[\]{}]/.test(pattern)) return null;
  const source = pattern.split('**').map((part) => part.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('.*');
  return new RegExp(`^${source}$`);
}

function matching(patterns, rel) {
  return patterns.find((pattern) => { const re = patternToRegExp(pattern); return re ? re.test(rel) : false; });
}

export function crateFolderViolation(file) {
  try {
    const target = resolve(file);
    if (existsSync(target)) return null;
    const bare = [];
    for (let dir = dirname(target); ; dir = dirname(dir)) {
      const manifest = join(dir, MANIFEST);
      if (existsSync(manifest)) {
        const text = readFileSync(manifest, 'utf8');
        if (!WORKSPACE_TABLE.test(text)) return null;
        const members = listOf(text, 'members');
        const excluded = listOf(text, 'exclude');
        for (const candidate of bare) {
          const rel = slash(relative(dir, candidate));
          const member = matching(members, rel);
          const isItsManifest = slash(target) === slash(join(candidate, MANIFEST));
          if (member && !matching(excluded, rel) && !isItsManifest) return { dir: candidate, rel, member, workspace: manifest };
        }
        return null;
      }
      if (dirname(dir) === dir) return null;
      bare.push(dir);
    }
  } catch {
    return null;
  }
}
