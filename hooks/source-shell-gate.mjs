#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — source code changes through the Edit and Write tools, never a shell
// write. Blocks a redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlet, `node -e` or scratch script
// that writes a source file, because only Edit and Write run pre-write's length, comment and literal
// checks (check-id source-shell-write, KIT-T648). The store's twin is store-shell-gate.
// Every hit of the command is judged on its own: a source operand of a proven cp or mv is lifted only when
// its destination provably lands outside the hit's repo (lands-outside-repo.mjs), never the rest of the command.
// A rm of an untracked file this caller's own Edit or Write left is no source edit and passes (owns-untracked-file.mjs).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fails open on any error.

import { resolve } from 'node:path';
import { payload, gitRootOfFile, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { shellSourceWrites } from './lib/shell-source-write.mjs';
import { AMBIGUOUS_MESSAGE, shellOfTool, toPath } from './lib/shell-segments.mjs';
import { commandCwd } from './lib/shell-cwd.mjs';
import { landsOutsideRepo } from './lib/lands-outside-repo.mjs';
import { ownsUntrackedFile } from './lib/owns-untracked-file.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { repoRelative } from './turn-writes.mjs';

const CHECK = 'source-shell-write';

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const hits = command ? shellSourceWrites(command, { shell: shellOfTool(p.tool_name) }) : [];
  // A hit's own repo (a relative path is relative to where the command `cd`s), not the hook's cwd.
  const cwd = hits.length ? commandCwd(command) : '';
  const caller = writerId(p.session_id, subagentId(p));
  for (const found of hits) {
    const root = gitRootOfFile(resolve(cwd, toPath(found.path)));
    if (!adopted(root) || pathExcluded(root, CHECK, found.path)) continue;
    if (found.outsideTo && landsOutsideRepo(found.outsideTo, root, cwd)) continue;
    if (found.deletes && ownsUntrackedFile(root, repoRelative(root, resolve(cwd, toPath(found.path))), caller)) continue;
    process.stderr.write(`
BLOCKED: ${found.ambiguous ? `a shell command may write a source file by hand. ${AMBIGUOUS_MESSAGE}` : `a shell command writes a source file by hand (${found.path}).`}
  Use the Write tool: create or replace a whole file (a scratch repro or test is a Write too, never a heredoc,
  \`echo >\` or \`node -e\`). Use the Edit tool to change part of an existing file. Only these two run the
  pre-write gate (file length, comment prose, literals, rot markers).
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
