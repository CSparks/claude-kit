// Framework-scoped context (KIT): rules that bind every consumer of a framework,
// surfaced ONLY in the repos that actually use it.
//
// A global contract loads everywhere, so a game-asset rule would sit in a web repo
// burning context; a project CLAUDE.md would need hand-copying into every consumer,
// which is the same drift the rules themselves forbid. This layer is the third home:
// one file per framework in `frameworks/`, emitted when the repo is detected as a user.
//
// Add a framework: drop `frameworks/<name>.md` with a `detect:` block. FAIL-OPEN —
// a broken or missing frameworks/ tree costs the section, never the session.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// …/hooks/lib/frameworks.mjs → the kit root, which is where `frameworks/` lives.
const KIT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Split a framework doc into its `detect` rules and its contract body. */
export function parseFramework(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) return null;
  const [, frontmatter, body] = match;
  const scalar = (key) => {
    const hit = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(frontmatter);
    return hit ? hit[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  const list = (key) => {
    const at = frontmatter.indexOf(`${key}:`);
    if (at < 0) return [];
    const rest = frontmatter.slice(at).split('\n').slice(1);
    const items = [];
    for (const line of rest) {
      const hit = /^\s+-\s+(.+)$/.exec(line);
      if (!hit) break;
      items.push(hit[1].trim().replace(/^["']|["']$/g, ''));
    }
    return items;
  };
  return {
    name: scalar('name'),
    title: scalar('title') || scalar('name'),
    submodule: scalar('submodule'),
    cargo: scalar('cargo'),
    paths: list('paths'),
    body: body.trim(),
  };
}

/**
 * Does `root` use this framework? Any one signal is enough — a repo may carry the
 * framework as a submodule, a vendored tree, or a plain dependency.
 */
export function usedBy(root, framework) {
  for (const rel of framework.paths || []) {
    if (existsSync(join(root, rel))) return true;
  }
  if (framework.submodule) {
    const modules = join(root, '.gitmodules');
    try {
      if (existsSync(modules) && readFileSync(modules, 'utf8').includes(framework.submodule)) {
        return true;
      }
    } catch {
      /* unreadable .gitmodules — fall through to the remaining signals */
    }
  }
  if (framework.cargo) {
    const manifest = join(root, 'Cargo.toml');
    try {
      if (existsSync(manifest) && readFileSync(manifest, 'utf8').includes(framework.cargo)) {
        return true;
      }
    } catch {
      /* unreadable manifest — not a user by this signal */
    }
  }
  return false;
}

/** Every framework contract binding in `root`, in name order. */
export function frameworksFor(root, dir = join(KIT, 'frameworks')) {
  if (!root || !existsSync(dir)) return [];
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
  const found = [];
  for (const file of files) {
    try {
      const framework = parseFramework(readFileSync(join(dir, file), 'utf8'));
      if (framework && usedBy(root, framework)) found.push(framework);
    } catch {
      /* one malformed framework doc must not cost the others */
    }
  }
  return found;
}

/** The orientation section, or '' when this repo uses no known framework. */
export function frameworkSection(root) {
  const found = frameworksFor(root);
  if (!found.length) return '';
  const out = [];
  for (const framework of found) {
    out.push(`--- FRAMEWORK CONTRACT: ${framework.title} (BINDING here — this repo uses it) ---`);
    out.push(framework.body);
    out.push('');
  }
  return out.join('\n');
}
