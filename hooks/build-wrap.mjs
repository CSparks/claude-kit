#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — put every Rust build under the machine build budget (KIT-D135). A foreground
// command that runs cargo, cargo-nextest or cargo-ndk gets bin/build-shims first on PATH, so the shim takes cores from the
// one budget all projects share before the real tool starts. Background commands are wrapped by row-tag, which already
// rewrites their input. Emits updatedInput only. Fail-open: a throw exits 0 untouched.

import { payload } from './lib.mjs';
import { shimmedCommand } from './lib/build-wrap.mjs';
import { writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';

try {
  const p = await payload();
  const input = p.tool_input || {};
  const background = input.run_in_background === true || input.run_in_background === 'true';
  const wrapped = background ? null : shimmedCommand(input.command, p.tool_name, undefined, writerId(p.session_id, subagentId(p)));
  if (wrapped) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, command: wrapped } } }));
} catch { /* fail-open: an unwrapped build still runs */ }
process.exit(0);
