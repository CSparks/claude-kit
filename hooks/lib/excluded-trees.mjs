// EXCLUDED TREES: directory roots under which the kit is inert (KIT-T447). A tree governed
// by its own workflow (the IFD fleet under CDX) must never see a kit hook fire, a capture
// land in a kit store, or a kit CLI answer. Roots are machine-specific paths, so they live in
// the registry (`excluded: [<absolute root>, ...]`), never in a repo and never as a marker
// file inside the excluded tree itself.
//
// Two chokepoints consult this module: compat-run.mjs (every hook) and resolveStoreRoot /
// refuseIfExcluded (every CLI). Fail-open: an unreadable registry excludes nothing.

import { resolve } from 'node:path';
import { readRegistry } from './registry.mjs';

const CASE_INSENSITIVE = process.platform === 'win32';

function canon(p) {
  const s = resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return CASE_INSENSITIVE ? s.toLowerCase() : s;
}

export function excludedRoots() {
  try {
    return (readRegistry().excluded || []).filter((r) => typeof r === 'string' && r.trim());
  } catch {
    return [];
  }
}

// The configured root that contains `path` (or IS it), else null.
export function excludedRoot(path) {
  if (!path || typeof path !== 'string') return null;
  try {
    const target = canon(path);
    for (const root of excludedRoots()) {
      const r = canon(root);
      if (target === r || target.startsWith(r + '/')) return root;
    }
  } catch {
    /* fail-open */
  }
  return null;
}

// The first excluded root among several candidate paths (a payload cwd, the process cwd, the
// file a tool is about to touch), else null.
export function excludedAmong(...paths) {
  for (const p of paths) {
    const hit = excludedRoot(p);
    if (hit) return hit;
  }
  return null;
}

export function excludedMessage(root) {
  return `claude-kit is off under ${root} (registry \`excluded\`, KIT-T447) — this tree runs its own workflow`;
}

// CLI guard: a kit command run from inside an excluded tree says so once and exits.
export function refuseIfExcluded(tool, cwd = process.cwd()) {
  const hit = excludedRoot(cwd);
  if (!hit) return;
  process.stderr.write(`${tool}: ${excludedMessage(hit)}.\n`);
  process.exit(2);
}
