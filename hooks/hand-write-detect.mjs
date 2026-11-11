#!/usr/bin/env node
// PreToolUse + PostToolUse (Bash|PowerShell) — catches a hand write of source by its EFFECT (KIT-T706,
// KIT-D117). Pre snapshots the repo's dirty files and HEAD (a HEAD move, as a broker landing makes, is no write of the call); Post diffs the snapshot. A hand-authored source file the
// call created, changed or deleted joins the session's hand-write ledger, and commit-gate refuses it until
// Edit or Write re-saves it (pre-write judges length, comments and literals there). The call's command is
// never parsed to find the write; only a generator command (git, a build tool, a formatter, a kit verb) is
// exempt, and so is a file whose content an Edit or Write of any session left during the call (the accepted-writes
// ledger, tool-write-record.mjs): another writer's concurrent edit, judged by pre-write, never the call's (KIT-T888).
// A file git put back (content equal to HEAD, or an earlier Edit's content in a call that runs git) is no write either
// (lib/restored-content.mjs, KIT-T982).
// Check-id source-shell-write. Post exits 2 to show the message. No-ops on unadopted repos; fails open.

import { payload, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';
import { clearTurnState, readTurnState, writeTurnState } from './lib/turn-state.mjs';
import { snapshotDirty, handWrittenSources, headOf, contentHashOf } from './lib/shell-snapshot.mjs';
import { addHandWrites } from './lib/hand-writes.mjs';
import { toolWriteProves, writerId } from './lib/tool-writes.mjs';
import { restoredSources } from './lib/restored-content.mjs';
import { subagentId } from './lib/subagent-id.mjs';

const CHECK = 'source-shell-write';
const SHOWN_MAX = 10;
const slotOf = (sid, id) => `hwsnap-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}-${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;

try {
  const p = await payload();
  const sid = p.session_id;
  const root = gitRoot();
  if (!sid || !adopted(root)) process.exit(0);
  const slot = slotOf(sid, p.tool_use_id || 'call');
  const isPost = p.hook_event_name === 'PostToolUse' || (p.hook_event_name === undefined && p.tool_response !== undefined);

  if (!isPost) {
    writeTurnState(root, { files: snapshotDirty(root), head: headOf(root), ts: Date.now() }, slot);
    process.exit(0);
  }

  const before = readTurnState(root, slot);
  clearTurnState(root, slot);
  if (!before) process.exit(0);
  const command = String((p.tool_input && p.tool_input.command) || '');
  const since = before.ts || Date.now();
  const caller = writerId(sid, subagentId(p));
  const toolWrote = (rel) => toolWriteProves(root, rel, since, contentHashOf(root, rel), caller);
  const changed = handWrittenSources(root, before.files || {}, command, before.head || '')
    .filter((rel) => !pathExcluded(root, CHECK, rel) && !toolWrote(rel));
  const restored = restoredSources(root, changed, command, { session: sid });
  const written = changed.filter((rel) => !restored.has(rel));
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
