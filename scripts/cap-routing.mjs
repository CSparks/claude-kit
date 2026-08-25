// cap's ROUTING TABLE: which project a capture belongs to, and the taxonomy of the store it
// lands in. Split out of cap.mjs so the CLI file holds the capture flow and this holds the
// question "whose store is this?" (KIT-T067 is the rule these functions implement).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectAiDirs } from '../hooks/lib.mjs';

// Minimal extraction of classification keys from config.yml (no yaml dep).
export function classificationKeys(configPath) {
  try {
    const lines = readFileSync(configPath, 'utf8').split('\n');
    const keys = [];
    let inBlock = false;
    for (const line of lines) {
      if (/^classifications:\s*$/.test(line)) {
        inBlock = true;
        continue;
      }
      if (inBlock) {
        if (/^\S/.test(line)) break; // next top-level key ends the block
        const m = line.match(/^\s{2}([A-Za-z][\w-]*):/);
        if (m) keys.push(m[1]);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

// A project's id key (ids.key in config.yml) — the short alias (HOD/KIT) a capture is likely to
// name. Tolerant subset scan, mirroring classificationKeys; '' when absent/unreadable.
function idKey(aiDir) {
  try {
    const m = readFileSync(join(aiDir, 'config.yml'), 'utf8').match(/^ids:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+key:[ \t]*["']?([A-Za-z0-9_-]+)/m);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

// Every registered project as { name, aiDir, key, aliases } — the routing table. `aliases` is
// the set of lowercased tokens that name the project (its registry name + id key), against which
// an explicit/proposed target is matched. Best-effort: built from projectAiDirs (which is itself
// fail-open), so a broken registry yields an empty table and routing degrades to cwd-only.
export function projectTable() {
  return projectAiDirs().map(({ name, aiDir }) => {
    const key = idKey(aiDir);
    const aliases = new Set([name.toLowerCase()]);
    if (key) aliases.add(key.toLowerCase());
    return { name, aiDir, key, aliases };
  });
}

// Resolve a target NAME (from --project or a `name:` prefix) to a project, forgiving of case and
// accepting either the registry name or the id key. Returns the project record or null (caller
// then errors out — an explicit target that names nothing real must not silently fall through to
// cwd, or the misroute the explicit form exists to prevent would recur).
export function matchProject(table, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  return table.find((p) => p.aliases.has(n)) || null;
}

// Does the capture text OBVIOUSLY name a project OTHER than the cwd one? Two honest signals, no
// NLP: (a) a `Project: X` / `Project X` marker whose X resolves to a registered project; (b) the
// project's id key or registry name appearing as a standalone word. Returns the named project (or
// null). Used only to PROPOSE — never to route — so a false hit costs a one-line hint, not a
// misfile.
export function namedInText(table, text, exclude) {
  const candidates = table.filter((p) => p.name !== exclude);
  const marker = text.match(/\bproject[:\s]+([A-Za-z0-9_-]+)/i);
  if (marker) {
    const hit = matchProject(candidates, marker[1]);
    if (hit) return hit;
  }
  for (const p of candidates) {
    for (const alias of p.aliases) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return p;
    }
  }
  return null;
}
