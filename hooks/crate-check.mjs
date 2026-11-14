#!/usr/bin/env node
// PostToolUse (Bash|PowerShell) + SubagentStop — the crate-check watch (KIT-T1211). A finished `cargo check|build|clippy` is
// recorded with the files it compiled; when it failed in a file another live writer holds uncommitted edits in, the call hears
// which writer and file (exit 2 shows it). A subagent that ends holding an edited crate its own last check did not cover, or
// covered and failed, is blocked once (SubagentStop exit 2) and told which crates to check. Check-id crate-check.
// No-ops on unadopted repos; fails open.

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
  recordCheck(root, { writer, ok: !failed, scope: scopeOf(args, cwd) });
  if (!failed) return;
  const files = errorFiles(output, cwd);
  const claimants = files.flatMap((f) => liveClaimants(gitRootOfFile(f)).map((c) => ({ ...c, tree: gitRootOfFile(f) })));
  const found = culprits({ files, writer, claimants, relOf: repoRelative });
  if (!found.length) return;
  const lines = found.map(({ file, claimant }) => `  ${file.replace(/\\/g, '/')}: uncommitted edits of ${claimant.label || 'a live writer'} (agent ${claimant.agent || 'main thread'}, session ${claimant.session})`);
  process.stderr.write(`\nYour cargo check failed in files another live writer has changed and not committed (check-id ${CHECK}, KIT-T1211):\n${lines.join('\n')}\nTell that writer (or your coordinator) now; the failure may not be yours.\n${excludeFooter(CHECK)}`);
  process.exit(2);
}

function atStop(p, root, writer) {
  if (p.stop_hook_active || !subagentId(p)) return;
  const unverified = unverifiedCrates({ trees: [root, ...submodulePaths(root)], writer, checks: readChecks(root) });
  if (!unverified.length) return;
  process.stderr.write(`\n${nudgeText(unverified)}\n${excludeFooter(CHECK)}`);
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
