#!/usr/bin/env node
// PreToolUse + PostToolUse (Bash|PowerShell) — catches a hand write of source by its EFFECT (KIT-T706,
// KIT-D117). Pre snapshots the repo's dirty files, ignore state and HEAD (a HEAD move, as a broker landing makes, is no write of the call); Post diffs the snapshot. A hand-authored source file the
// call created, changed or deleted joins the session's hand-write ledger, and commit-gate refuses it until
// Edit or Write re-saves it (pre-write judges length, comments and literals there). The call's command is
// never parsed to find the write, only to rule it out: a command that cannot write source (a generator, a build or
// test runner, a kit verb, a reader, no redirect into a source file; lib/inert-command.mjs, KIT-T1001) owns no changed
// file, and so is a file whose content an Edit or Write of any session left during the call (the accepted-writes
// ledger, tool-write-record.mjs): another writer's concurrent edit, judged by pre-write, never the call's (KIT-T888).
// A file holding another writer's predicted content whose confirmation has not landed yet waits for it (lib/settle-writes.mjs, KIT-T1010).
// A file git put back (content equal to HEAD, a blob a reachable commit holds for that path or an earlier Edit's content, in a call that runs git) is no write either
// (lib/restored-content.mjs, KIT-T982), and so is a byte-identical git rename (lib/identical-renames.mjs, KIT-T991).
// A snapshot that cannot be taken (git status fails in an adopted repo) is a check that could not complete: Post exits 2 and says so
// (KIT-T1271). Check-id source-shell-write. Post exits 2 to show the message. No-ops on unadopted repos; any other error fails open.

import { payload, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { clearTurnState, readTurnState, writeTurnState } from './lib/turn-state.mjs';
import { snapshotDirty, handWrittenSources, headOf, contentHashOf } from './lib/shell-snapshot.mjs';
import { ignoreSnapshot } from './lib/ignore-state.mjs';
import { addHandWrites } from './lib/hand-writes.mjs';
import { toolWriteProves, writerId } from './lib/tool-writes.mjs';
import { restoredSources } from './lib/restored-content.mjs';
import { hasPendingPrediction, settleOwned, settleMsFromEnv } from './lib/settle-writes.mjs';
import { unmovedHandWrites } from './lib/identical-renames.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { isInertCommand } from './lib/inert-command.mjs';
import { shellOfTool } from './lib/shell-segments.mjs';

const CHECK = 'source-shell-write';
const SHOWN_MAX = 10;
// A snapshot git could not take names no file: the check refuses what it cannot judge (KIT-T1271).
function couldNotComplete(reason) {
  process.stderr.write(`
HAND WRITE CHECK: this shell call could not be checked for hand-written source (check-id ${CHECK}): ${reason}
  The check could not complete, and a check that cannot complete refuses. Look at the working tree (git status), then re-run the
  call; a source file it changed by hand must be re-saved through Edit or Write.
${excludeFooter(CHECK)}`);
  process.exit(2);
}

const slotOf = (sid, id) => `hwsnap-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}-${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;

try {
  const p = await payload();
  const sid = p.session_id;
  const root = gitRoot();
  if (!sid || !adopted(root)) process.exit(0);
  const slot = slotOf(sid, p.tool_use_id || 'call');
  const isPost = p.hook_event_name === 'PostToolUse' || (p.hook_event_name === undefined && p.tool_response !== undefined);

  if (!isPost) {
    let snapshot;
    try {
      snapshot = { files: snapshotDirty(root), ignore: ignoreSnapshot(root), head: headOf(root), ts: Date.now() };
    } catch (e) {
      snapshot = { failed: String((e && e.message) || e), ts: Date.now() };
    }
    writeTurnState(root, snapshot, slot);
    process.exit(0);
  }

  const before = readTurnState(root, slot);
  clearTurnState(root, slot);
  if (!before) process.exit(0);
  const command = String((p.tool_input && p.tool_input.command) || '');
  if (before.failed) {
    if (isInertCommand(command, { root, shell: shellOfTool(p.tool_name) })) process.exit(0);
    couldNotComplete(before.failed);
  }
  const since = before.ts || Date.now();
  const caller = writerId(sid, subagentId(p));
  const toolWrote = (rel) => toolWriteProves(root, rel, since, contentHashOf(root, rel), caller, { ownConfirmed: true });
  const awaitsConfirmation = (rel) => hasPendingPrediction(root, rel, contentHashOf(root, rel), since);
  let candidates;
  try {
    candidates = handWrittenSources(root, before.files || {}, command, before.head || '', { shell: shellOfTool(p.tool_name), ignoreBefore: before.ignore })
      .filter((rel) => !pathExcluded(root, CHECK, rel));
  } catch (e) {
    couldNotComplete(String((e && e.message) || e));
  }
  const changed = await settleOwned(candidates, { pending: awaitsConfirmation, proven: toolWrote, maxMs: settleMsFromEnv() });
  const restored = restoredSources(root, changed, command, { session: sid });
  const written = unmovedHandWrites(root, changed.filter((rel) => !restored.has(rel)));
  if (written.length) {
    addHandWrites(root, sid, written);
    const shown = written.slice(0, SHOWN_MAX);
    process.stderr.write(`
HAND WRITE: this shell call changed source by hand (check-id ${CHECK}, KIT-T706):
${shown.map((f) => `  ${f}`).join('\n')}${written.length > shown.length ? `\n  +${written.length - shown.length} more` : ''}
  Source changes through Edit and Write, where the pre-write gate checks file length, comment prose and literals.
  Re-save each file through Edit or Write: a commit holding it is refused until you do.
  Generated output a tool writes (cargo, a formatter, a codegen) is not a hand write: run the tool.
${excludeFooter(CHECK)}`);
    process.exit(2);
  }
} catch {
  /* a gate never wedges a tool call on its own error */
}
process.exit(0);
