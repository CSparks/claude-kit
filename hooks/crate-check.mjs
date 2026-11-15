#!/usr/bin/env node
// PostToolUse (Bash|PowerShell) + SubagentStop — the crate-check watch (KIT-T1211). A finished `cargo check|build|clippy` is
// recorded with the files it compiled; when it failed in a file another live writer holds uncommitted edits in, the call hears
// which writer and file (exit 2 shows it). A subagent that ends holding an edited crate its own last check did not cover, or
// covered and failed, is blocked once (SubagentStop exit 2) and told which crates to check. Check-id crate-check.
// A failed check also marks the crates it failed in as broken (lib/broken-crates.mjs, KIT-T1245): the failing writer hears whose
// crate it waits on, a passing check over a marked crate clears it, and a subagent stopping while it is the last writer of a
// broken crate is told. No-ops on unadopted repos; fails open.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { payload, gitRoot, gitRootOfFile, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { repoRelative } from './turn-writes.mjs';
import { liveClaimants } from './lib/checkout-holder.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { commandCwd } from './lib/shell-cwd.mjs';
import { shellOfTool } from './lib/shell-segments.mjs';
import { compiledScope } from '../scripts/broker/cargo-scope-dirs.mjs';
import { findReal } from '../scripts/broker/build-run.mjs';
import { blockedText, brokenFor, brokenIn, clearCovered, culpritText, markBroken, markTold } from './lib/broken-crates.mjs';
import { crateCheckArgs, culprits, errorFiles, nudgeText, outcomeOf, readChecks, recordCheck, unverifiedCrates } from './lib/crate-checks.mjs';

const CHECK = 'crate-check';

const textOf = (value) => (typeof value === 'string' ? value : value && typeof value === 'object' ? Object.values(value).map(textOf).join('\n') : '');

function scopeOf(args, cwd) {
  try {
    return compiledScope(args, cwd, findReal('cargo') || 'cargo').scope.filter((s) => !s.startsWith('!'));
  } catch {
    return [cwd];
  }
}

function submodulePaths(root) {
  try {
    const file = join(root, '.gitmodules');
    return existsSync(file) ? [...readFileSync(file, 'utf8').matchAll(/^\s*path\s*=\s*(\S+)/gm)].map((m) => join(root, m[1])) : [];
  } catch {
    return [];
  }
}

function afterCheck(p, root, writer) {
  const command = String((p.tool_input && p.tool_input.command) || '');
  const args = crateCheckArgs(command);
  if (!args) return;
  const cwd = commandCwd(command, p.cwd || process.cwd(), { shell: shellOfTool(p.tool_name) });
  const output = textOf(p.tool_response);
  const { failed } = outcomeOf(output);
  const scope = scopeOf(args, cwd);
  recordCheck(root, { writer, ok: !failed, scope });
  if (!failed) {
    clearCovered(scope);
    return;
  }
  const files = errorFiles(output, cwd);
  const marked = markBroken({ output, files, checker: writer, trees: [root, ...submodulePaths(root)], treeOf: gitRootOfFile });
  marked.filter((m) => m.writer === writer).forEach((m) => markTold(m, writer));
  const waitsOn = (marked.length || files.length ? marked : brokenIn(scope)).filter((m) => m.writer && m.writer !== writer);
  const claimants = files.flatMap((f) => liveClaimants(gitRootOfFile(f)).map((c) => ({ ...c, tree: gitRootOfFile(f) })));
  const found = culprits({ files, writer, claimants, relOf: repoRelative });
  if (!found.length && !waitsOn.length) return;
  const lines = found.map(({ file, claimant }) => `  ${file.replace(/\\/g, '/')}: uncommitted edits of ${claimant.label || 'a live writer'} (agent ${claimant.agent || 'main thread'}, session ${claimant.session})`);
  const claimed = lines.length ? `Your cargo check failed in files another live writer has changed and not committed (check-id ${CHECK}, KIT-T1211):\n${lines.join('\n')}\nTell that writer (or your coordinator) now; the failure may not be yours.\n` : '';
  const broken = waitsOn.length ? `Crates this failure waits on (KIT-T1245; \`builds\` lists every broken crate):\n${blockedText(waitsOn)}\n` : '';
  process.stderr.write(`\n${broken}${claimed}${excludeFooter(CHECK)}`);
  process.exit(2);
}

function atStop(p, root, writer) {
  if (p.stop_hook_active || !subagentId(p)) return;
  const unverified = unverifiedCrates({ trees: [root, ...submodulePaths(root)], writer, checks: readChecks(root) });
  const left = brokenFor(writer);
  if (!unverified.length && !left.length) return;
  left.forEach((m) => markTold(m, writer));
  process.stderr.write(`\n${[unverified.length && nudgeText(unverified), left.length && culpritText(left)].filter(Boolean).join('\n')}\n${excludeFooter(CHECK)}`);
  process.exit(2);
}

try {
  const p = await payload();
  const root = gitRoot();
  if (p.session_id && adopted(root) && !pathExcluded(root, CHECK, root)) {
    const writer = writerId(p.session_id, subagentId(p));
    if (p.hook_event_name === 'SubagentStop') atStop(p, root, writer);
    else afterCheck(p, root, writer);
  }
} catch {
  /* a watch never wedges a tool call */
}
process.exit(0);
