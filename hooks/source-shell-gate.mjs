#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — source code changes through the Edit and Write tools, never a shell
// write. Blocks a redirect, tee, mv/rm/cp, sed/perl -i, PowerShell cmdlet, `node -e` or scratch script
// that writes a source file, because only Edit and Write run pre-write's length, comment and literal
// checks (check-id source-shell-write, KIT-T648). The store's twin is store-shell-gate.
// Every hit of the command is judged on its own: a source operand of a proven cp or mv is lifted only when
// its destination provably lands outside the hit's repo (lands-outside-repo.mjs) or in a build-output directory such as
// target/ (isGeneratedPath), never the rest of the command.
// A rm of an untracked file this caller's own Edit or Write left is no source edit and passes (owns-untracked-file.mjs), and the
// main thread's rm of an untracked file no live writer holds passes too (delete-judge.mjs);
// so do the git calls that delete or hide files (`git clean`, `git rm -f`, `git stash -u`: git-discards.mjs) for files
// that caller wrote, and a sweep of unnamed files while no other writer is live (delete-judge.mjs). A delete operand a
// variable supplies that the command does not resolve is refused. A directory operand of a delete is judged file by file for
// the source beneath it (directory-delete.mjs). A refused delete says why and names the way out
// (delete-guidance.mjs); a cp or mv whose operand holds a variable the command does not resolve names it, why and the way out
// (copy-variable.mjs); a command a git call runs (`rebase -x`, `bisect run`) is judged like one typed alone, from the top of
// the work tree (git-inner-hits.mjs). A relative path resolves against the `cd` segments before its own segment (shell-cwd.mjs).
// A write that lands in build output (gitignored, or below a verified CMake/Ninja build tree: build-output.mjs) is a tool's,
// not a hand write, unless the command itself names a marker or an ignore file (it may be making the directory look like output).
// A touch that only stamps the mtime of an existing file authors no content and passes (touch-target.mjs).
// A path listed in the repo's .claude-kit-ignore.yaml passes, judged by its repo-relative path whatever the call's directory;
// the block names that listing as the route for vendoring a third-party tree (vendor-route.mjs).
// A hit the gate could not judge (git cannot run, the registry of live writers cannot be read, an error while judging) is
// refused with a block that says the check could not complete: only "no repository here" lets a path pass (KIT-T1271).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. An error before any hit exists (scanning the command) fails open.

import { resolve } from 'node:path';
import { payload, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { gitRootOfFileChecked } from './lib/paths.mjs';
import { isGeneratedPath, shellSourceWrites } from './lib/shell-source-write.mjs';
import { buildOutputJudge, ignoreEditMentioned, markerMentioned } from './lib/build-output.mjs';
import { AMBIGUOUS_MESSAGE, shellOfTool, toPath } from './lib/shell-segments.mjs';
import { commandCwd } from './lib/shell-cwd.mjs';
import { landsOutsideRepo } from './lib/lands-outside-repo.mjs';
import { deleteJudgement } from './lib/delete-judge.mjs';
import { directoryDeleteHits } from './lib/directory-delete.mjs';
import { deleteGuidance } from './lib/delete-guidance.mjs';
import { copyVariableAdvice } from './lib/copy-variable.mjs';
import { touchLifted } from './lib/touch-target.mjs';
import { VENDOR_ROUTE } from './lib/vendor-route.mjs';
import { DELETE_REFUSALS } from './lib/owns-untracked-file.mjs';
import { liveWriterNames } from './lib/live-writers.mjs';
import { isMainThread, writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { repoRelative } from './turn-writes.mjs';

const CHECK = 'source-shell-write';

try {
  const p = await payload();
  const command = String((p.tool_input && p.tool_input.command) || '');
  const shell = shellOfTool(p.tool_name);
  const hits = command ? [...shellSourceWrites(command, { shell }), ...directoryDeleteHits(command, process.cwd())] : [];
  const caller = writerId(p.session_id, subagentId(p));
  for (const found of hits) {
    // The hit's own directory: the `cd` segments before its segment, not where the whole command ends.
    const cwd = found.from || commandCwd(command, process.cwd(), { upto: found.segment, shell });
    const file = resolve(cwd, toPath(found.path));
    let root = '';
    let rel = '';
    let refusal = '';
    let incomplete = found.incomplete || '';
    try {
      if (!incomplete) {
        root = gitRootOfFileChecked(file);
        if (!adopted(root)) continue;
        rel = repoRelative(root, file);
        if (pathExcluded(root, CHECK, rel)) continue;
        if (found.outsideTo && (landsOutsideRepo(found.outsideTo, root, cwd) || isGeneratedPath(found.outsideTo))) continue;
        if (!found.ambiguous && !found.moveLinesProblem && buildOutputJudge(root, { markerStands: () => !markerMentioned(command), ignoredStands: !ignoreEditMentioned(command) })(file)) continue;
        if (touchLifted(found, cwd)) continue;
        refusal = deleteJudgement(found, root, rel, caller);
        if (found.deletes && !refusal) continue;
      }
    } catch (e) {
      incomplete = String((e && e.message) || e);
    }
    const what = found.moveLinesProblem
      ? `a move-lines call the guard refuses writes a source file by hand: ${found.moveLinesProblem}`
      : `a shell command ${found.deletes ? 'deletes' : 'writes'} a source file by hand (${found.path}).`;
    const couldNot = incomplete ? `  The check could not complete (${incomplete}), and a check that cannot complete refuses. Retry once git runs and the registry of live writers reads.\n` : '';
    process.stderr.write(`
BLOCKED: ${found.ambiguous ? `a shell command may write a source file by hand. ${AMBIGUOUS_MESSAGE}` : what}
${couldNot}${copyVariableAdvice(found.copyVariable, shell)}${deleteGuidance(refusal, { path: found.path, cwd, operand: found.unresolved, verb: found.discard, what: found.sweep, mainThread: isMainThread(caller), holders: refusal === DELETE_REFUSALS.liveWriter ? liveWriterNames(root, rel, caller) : [] })}  Use the Write tool: create or replace a whole file (a scratch repro or test is a Write too, never a heredoc,
  \`echo >\` or \`node -e\`). Use the Edit tool to change part of an existing file. Only these two run the
  pre-write gate (file length, comment prose, literals, rot markers).
  A change too large for one Edit is a Write of the new file or several Edits, never a script.
  Moving EXISTING lines into other files (a file split) is the kit verb: move-lines <source> <ranges>=<dest> ... (q gates source).
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${VENDOR_ROUTE.map((line) => `  ${line}`).join('\n')}
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
