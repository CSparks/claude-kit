// --- unified exclusion system (KIT-T051) --------------------------------------
// "Halts in anything but exclusions": every gate keeps its hard block by default;
// the ONLY non-halt path is an explicit, documented exclusion. Two surfaces, both
// dependency-free and fail-open (any error → behave as "not excluded", so a malformed
// ignore file can never wedge a write):
//   1. .claude-kit-ignore.yaml at the project root — { checkId: [glob, ...] }, plus a
//      '*' / 'all' key that excludes from EVERY check.
//   2. In-source comment markers (//, #, --) — exclude a whole file, a start..end block,
//      or a single line.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const IGNORE_FILE = '.claude-kit-ignore.yaml';

// Tolerant YAML-subset parse (no dep): a top-level `key:` followed by `  - glob` list
// items. Quotes stripped. {} on missing/bad file.
export function loadIgnoreConfig(root) {
  let text;
  try {
    text = readFileSync(join(root, IGNORE_FILE), 'utf8');
  } catch {
    return {};
  }
  try {
    const out = {};
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\t/g, '  ');
      if (!line.trim() || /^\s*#/.test(line)) continue; // blank / comment
      const key = line.match(/^([^\s#:][^:]*?):\s*(#.*)?$/); // `key:` at column 0-ish (no indent)
      if (key && !/^\s/.test(line)) {
        cur = key[1].trim().replace(/^["']|["']$/g, '');
        out[cur] = out[cur] || [];
        continue;
      }
      const item = line.match(/^\s+-\s*(.+?)\s*(#.*)?$/); // `  - glob`
      if (item && cur) {
        const g = item[1].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
        if (g) out[cur].push(g);
      }
    }
    return out;
  } catch {
    return {}; // fail-open: a parse slip is never an exclusion
  }
}

// Minimal glob → RegExp: `**` = any depth (incl. /), `*` = within a segment, `?` = one char.
// Anchored full-match against a forward-slash path. Leading `./` and `/` are tolerated.
// THE one glob dialect — exclusions AND standing-decision `paths:` share it (KIT-T059).
export function globToRegExp(glob) {
  const g = glob.replace(/^\.?\//, '');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// A repo-root-relative, forward-slash path for glob matching. Absolute paths are made
// relative to root when they live under it; a path already relative is just normalized.
function relForGlob(root, filePath) {
  let f = String(filePath).replace(/\\/g, '/');
  const r = String(root).replace(/\\/g, '/').replace(/\/$/, '');
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + '/')) f = f.slice(r.length + 1);
  return f.replace(/^\.?\//, '');
}

// Does `filePath` (any form) match a glob under `checkId` or the catch-all '*'/'all'?
// fail-open: any error → false (not excluded).
export function pathExcluded(root, checkId, filePath) {
  try {
    const cfg = loadIgnoreConfig(root);
    const rel = relForGlob(root, filePath);
    const globs = [...(cfg[checkId] || []), ...(cfg['*'] || []), ...(cfg.all || [])];
    return globs.some((g) => {
      try { return globToRegExp(g).test(rel); } catch { return false; }
    });
  } catch {
    return false;
  }
}

// In-source markers in any of the //, #, -- comment styles. Returns which lines (1-based)
// a given checkId excludes, and whether the WHOLE file is excluded. A marker takes
// `<check-id>` or `all`/`*` (matches every check). Fail-open: any throw → nothing excluded.
//   claude-kit-ignore-file  <id>            -> whole file
//   claude-kit-ignore-start <id> .. -end    -> the lines BETWEEN (exclusive of the markers)
//   claude-kit-ignore-line  <id>            -> the NEXT non-marker line
//   ... code ...   // claude-kit-ignore <id> -> that same line (trailing)
export function markerExcludedLines(source, checkId) {
  const result = { wholeFile: false, lines: new Set() };
  try {
    const lines = String(source).split('\n');
    const C = '(?://|#|--)';
    // Capture only the id token (word chars + hyphen + glob `*`).  A `\S+` would greedily
    // swallow an em-dash or parenthesis glued to the id (e.g. `magic-numbers—reason`) and
    // produce a token that never matches any check, silently suppressing the exclusion (KIT-T084).
    // A marker may name SEVERAL ids, comma-separated (`magic-numbers, todo-markers`), and
    // may carry free prose after them. Only the comma-joined run is read as ids, so a prose
    // word following them can never become one (KIT-T111).
    const ID = '([\\w*-]+(?:\\s*,\\s*[\\w*-]+)*)';
    const reFile = new RegExp(`${C}\\s*claude-kit-ignore-file\\s+${ID}`);
    const reStart = new RegExp(`${C}\\s*claude-kit-ignore-start\\s+${ID}`);
    const reEnd = new RegExp(`${C}\\s*claude-kit-ignore-end\\b`);
    const reLine = new RegExp(`${C}\\s*claude-kit-ignore-line\\s+${ID}`);
    const reTrail = new RegExp(`${C}\\s*claude-kit-ignore\\s+${ID}\\s*$`);
    const applies = (ids) =>
      String(ids).split(',').map((x) => x.trim()).some((id) => id === checkId || id === 'all' || id === '*');
    let openFrom = -1; // 1-based line where an active start marker (matching this check) sits
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const n = i + 1;
      let m;
      if ((m = ln.match(reFile)) && applies(m[1])) { result.wholeFile = true; continue; }
      if ((m = ln.match(reStart))) { if (applies(m[1])) openFrom = n; continue; }
      if (reEnd.test(ln)) { openFrom = -1; continue; }
      if ((m = ln.match(reLine)) && applies(m[1])) { result.lines.add(n + 1); continue; }
      if ((m = ln.match(reTrail)) && applies(m[1])) { result.lines.add(n); }
      if (openFrom !== -1) result.lines.add(n);
    }
    return result;
  } catch {
    return { wholeFile: false, lines: new Set() };
  }
}

// Uniform "how to exclude" footer appended to every gate's block/warn message, so a false
// positive always has an obvious, documented escape. Names the CHECK-ID and shows BOTH
// surfaces (the YAML snippet and the in-source marker). One definition → every gate is
// consistent.
export function excludeFooter(checkId) {
  return [
    '',
    `To exclude from this check (id: ${checkId}) — add ONE:`,
    `  • path glob in .claude-kit-ignore.yaml:`,
    `      ${checkId}:`,
    `        - path/to/dir/**`,
    `  • in-source marker (// or # or --):`,
    `      // claude-kit-ignore-start ${checkId}`,
    `      ...excluded lines...`,
    `      // claude-kit-ignore-end`,
    `    (or // claude-kit-ignore-file ${checkId} | // claude-kit-ignore-line ${checkId} | trailing // claude-kit-ignore ${checkId})`,
    '',
  ].join('\n');
}
