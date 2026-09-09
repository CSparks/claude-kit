// write_policy — a project's declaration of files that must NEVER be written by an agent.
//
// Read from `.ai/config.yml`, line-wise (no yaml dependency, like the other config readers):
//
//   write_policy:
//     forbidden:
//       - glob: "**/*.ts"
//         reason: "RG-D022: the editor is native Rust; TypeScript is a port reference only."
//       - glob: "**/*.tsx"
//         reason: "RG-D022"
//
// The pre-write gate turns a match into a hard block (check-id `forbidden-path`). A project
// carves a legitimate exception per path in .claude-kit-ignore.yaml under that check-id;
// there is no in-source marker escape, because the file itself is the thing not to touch.
// Fail-open: an unreadable or malformed block yields an empty policy.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadWritePolicy(root) {
  let text;
  try {
    text = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
  } catch {
    return [];
  }
  const block = text.match(/^write_policy:[ \t]*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (!block) return [];
  const list = block[1].match(/^\s*forbidden:[ \t]*\r?\n((?:\s+.*\r?\n?)*)/m);
  if (!list) return [];
  const entries = [];
  let current = null;
  for (const raw of list[1].split(/\r?\n/)) {
    const item = raw.match(/^\s*-\s*glob:\s*["']?(.+?)["']?\s*$/);
    if (item) {
      current = { glob: item[1], reason: '' };
      entries.push(current);
      continue;
    }
    const reason = raw.match(/^\s*reason:\s*["']?(.+?)["']?\s*$/);
    if (reason && current) current.reason = reason[1];
  }
  return entries.filter((e) => e.glob);
}

// The first forbidden entry whose glob matches the repo-relative path, or null.
export function forbiddenBy(entries, rel, globToRegExp) {
  for (const e of entries) {
    try {
      if (globToRegExp(e.glob).test(rel)) return e;
    } catch {
      /* a bad glob never blocks and never bypasses; it is simply not a rule */
    }
  }
  return null;
}
