#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — source code changes through the Edit and Write tools, never a shell
// write. Blocks a redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlet, `node -e` or scratch script
// that writes a source file, because only Edit and Write run pre-write's length, comment and literal
// checks (check-id source-shell-write, KIT-T648). The store's twin is store-shell-gate.
// Every hit of the command is judged on its own: a source operand of a proven cp or mv is lifted only when
// its destination provably lands outside the hit's repo (lands-outside-repo.mjs) or in a build-output directory such as
// target/ (isGeneratedPath), never the rest of the command.
// A rm of an untracked file this caller's own Edit or Write left is no source edit and passes (owns-untracked-file.mjs);
// so do the git calls that delete or hide files (`git clean`, `git rm -f`, `git stash -u`: git-discards.mjs) for files
// that caller wrote, and a sweep of unnamed files while no other writer is live (delete-judge.mjs). A delete operand a
// variable supplies that the command does not resolve is refused. A refused delete says why and names the way out
// (delete-guidance.mjs). A relative path resolves against the `cd` segments before its own segment (shell-cwd.mjs).
// A touch that only stamps the mtime of an existing file authors no content and passes (touch-target.mjs).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fails open on any error.

import { resolve } from 'node:path';
import { payload, gitRootOfFile, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { isGeneratedPath, shellSourceWrites } from './lib/shell-source-write.mjs';
import { AMBIGUOUS_MESSAGE, shellOfTool, toPath } from './lib/shell-segments.mjs';
import { commandCwd } from './lib/shell-cwd.mjs';
import { landsOutsideRepo } from './lib/lands-outside-repo.mjs';
import { deleteJudgement } from './lib/delete-judge.mjs';
import { deleteGuidance } from './lib/delete-guidance.mjs';
import { touchLifted } from './lib/touch-target.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { repoRelative } from './turn-writes.mjs';

const CHECK = 'source-shell-write';

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const shell = shellOfTool(p.tool_name);
  const hits = command ? shellSourceWrites(command, { shell }) : [];
  const caller = writerId(p.session_id, subagentId(p));
  for (const found of hits) {
    // The hit's own directory: the `cd` segments before its segment, not where the whole command ends.
    const cwd = commandCwd(command, process.cwd(), { upto: found.segment, shell });
    const file = resolve(cwd, toPath(found.path));
    const root = gitRootOfFile(file);
    if (!adopted(root) || pathExcluded(root, CHECK, found.path)) continue;
    if (found.outsideTo && (landsOutsideRepo(found.outsideTo, root, cwd) || isGeneratedPath(found.outsideTo))) continue;
    if (touchLifted(found, cwd)) continue;
    const refusal = deleteJudgement(found, root, repoRelative(root, file), caller);
    if (found.deletes && !refusal) continue;
    const what = found.moveLinesProblem
      ? `a move-lines call the guard refuses writes a source file by hand: ${found.moveLinesProblem}`
      : `a shell command ${found.deletes ? 'deletes' : 'writes'} a source file by hand (${found.path}).`;
    process.stderr.write(`
BLOCKED: ${found.ambiguous ? `a shell command may write a source file by hand. ${AMBIGUOUS_MESSAGE}` : what}
${deleteGuidance(refusal, { path: found.path, cwd, operand: found.unresolved, verb: found.discard })}  Use the Write tool: create or replace a whole file (a scratch repro or test is a Write too, never a heredoc,
  \`echo >\` or \`node -e\`). Use the Edit tool to change part of an existing file. Only these two run the
  pre-write gate (file length, comment prose, literals, rot markers).
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Moving EXISTING lines into other files (a file split) is the kit verb: move-lines <source> <ranges>=<dest> ... (q gates source).
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
