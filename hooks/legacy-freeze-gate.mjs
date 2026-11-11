#!/usr/bin/env node
// PreToolUse (Write|Edit|NotebookEdit and Bash|PowerShell) — a repo whose .ai/config.yml sets `legacy_dir: legacy` keeps
// retired code there for reference only (KIT-T989). BLOCKS an Edit, Write or NotebookEdit of a path under that
// directory; a shell write of it (redirect, rm, mv/cp onto it, sed -i, a script that writes it); `git add`, `checkout`,
// `restore`, `rm`, `reset`, `commit` of changed legacy paths and a `git mv` OUT of it; and a write or dependency
// command that ADDS a reference to it (a Cargo member or path dependency, an npm script, workspace or file:
// dependency, a JS/TS import, a Rust #[path] or include!), reporting file and line. ALLOWS reads, `git mv <src>
// legacy/...` (moving IN) and staging or committing such a move by path.
// Check-id legacy-freeze. exit 2 = block, 0 = allow. No-ops without the config key; fails open on any error.

import { readFileSync } from 'node:fs';
import { payload, gitRoot, gitRootOfFile, adopted, legacyDir, excludeFooter, pathExcluded } from './lib.mjs';
import { onlyIdenticalRenames } from './lib/identical-renames.mjs';
import { relativeTo, underLegacy } from './lib/legacy-paths.mjs';
import { legacyReferences } from './lib/legacy-refs.mjs';
import { legacyShellViolation } from './lib/legacy-shell.mjs';

const CHECK = 'legacy-freeze';

const refusal = (headline, lines) => `
BLOCKED: ${headline} (${CHECK}, KIT-T989).
${lines.map((l) => `  ${l}`).join('\n')}

Retired code stays for reference: read it, never edit, stage or reference it. Move more code in with
\`git mv <src> legacy/<name>\`. A change to behaviour is written OUTSIDE legacy/, in the replacement module.
${excludeFooter(CHECK)}`;

function writtenText(input) {
  if (typeof input.content === 'string') return input.content;
  if (typeof input.new_string === 'string') return input.new_string;
  return typeof input.new_source === 'string' ? input.new_source : '';
}

// The 1-based line an Edit's replacement starts at in the file as it stands; 1 for a whole-file write.
function firstLineOf(file, input) {
  if (typeof input.old_string !== 'string') return 1;
  try {
    const current = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const at = current.indexOf(input.old_string.replace(/\r\n/g, '\n'));
    return at < 0 ? 1 : current.slice(0, at).split('\n').length;
  } catch {
    return 1;
  }
}

function fileViolation(root, dir, file, input) {
  if (pathExcluded(root, CHECK, file)) return '';
  if (underLegacy(root, dir, file)) return refusal('legacy/ is frozen: this file must not be written', [`${dir}/ is the legacy_dir of this repo`, file]);
  const kept = String(input.old_string || '').split(/\r?\n/).map((l) => l.trim());
  const refs = legacyReferences({ root, dir, file, text: writtenText(input), firstLine: firstLineOf(file, input) })
    .filter((r) => !kept.includes(r.text));
  return refs.length ? refusal('this write references legacy code', refs.map((r) => `${file}:${r.line}  ${r.text}  (${r.what})`)) : '';
}

function shellViolation(root, dir, command) {
  const found = legacyShellViolation({
    root,
    dir,
    command,
    excluded: (path) => pathExcluded(root, CHECK, path),
    movedIn: (path, base) => onlyIdenticalRenames(root, relativeTo(root, path, base)),
  });
  return found ? refusal(found.headline, found.lines) : '';
}

try {
  const p = await payload();
  const input = p.tool_input || {};
  const file = input.file_path || input.notebook_path || input.path || '';
  const command = String(input.command || '');
  const root = file ? gitRootOfFile(file) : gitRoot();
  const dir = adopted(root) ? legacyDir(root) : '';
  const verdict = dir ? (file ? fileViolation(root, dir, file, input) : command && shellViolation(root, dir, command)) : '';
  if (verdict) {
    process.stderr.write(verdict);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
