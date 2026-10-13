#!/usr/bin/env node
// PreToolUse(Bash|PowerShell|Monitor) — put the OWNING agent's model on every task row the call
// creates (KIT-T461). A background shell (run_in_background) or a Monitor lists beside the agents
// in the maintainer's panel with only its description, so the description is rewritten to
// `[Opus 5.5] <description>`; a call with no description gets its command as the label.
//
// The owner is whoever's transcript the payload carries: the main thread, or a subagent's own
// sidechain (`.../subagents/agent-<id>.jsonl`), whose sibling `.meta.json` names the model when no
// assistant turn exists yet. An owner whose model cannot be resolved is tagged `[model?]`: a row is
// never untagged. Emits updatedInput only (no permissionDecision), so no gate is weakened.
// Fail-open: a throw exits 0 untouched.

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { payload } from './lib.mjs';
import { latestAssistantModel, modelDisplay, stripModelTag } from './model-tag.mjs';
import { MODEL_UNKNOWN } from './lib/agent-format.mjs';

const ROW_TOOLS = new Set(['Bash', 'PowerShell', 'Monitor']);
const LABEL_MAX = 60;
const SIDECHAIN = /^agent-(.+)\.jsonl$/i;

main().catch(() => process.exit(0));

async function main() {
  const p = await payload();
  const input = p.tool_input || {};
  if (!ROW_TOOLS.has(p.tool_name) || !makesRow(p.tool_name, input)) process.exit(0);
  const description = firstText(input.description) || clip(firstText(input.command));
  if (!description) process.exit(0);
  const display = modelDisplay(ownerModel(p));
  const tag = display ? `[${display}]` : MODEL_UNKNOWN;
  const label = `${tag} ${stripModelTag(description)}`;
  if (label === input.description) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, description: label } },
  }));
  process.exit(0);
}

// A foreground shell is one tool call in a transcript; only a background shell or a monitor is a row.
function makesRow(tool, input) {
  return tool === 'Monitor' || input.run_in_background === true || input.run_in_background === 'true';
}

function ownerModel(p) {
  const fromTurn = latestAssistantModel(p.transcript_path);
  return fromTurn || sidechainMeta(p.transcript_path).model || '';
}

function sidechainMeta(transcriptPath) {
  try {
    const name = basename(String(transcriptPath || ''));
    if (!SIDECHAIN.test(name)) return {};
    const meta = join(dirname(transcriptPath), name.replace(/\.jsonl$/i, '.meta.json'));
    return existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : {};
  } catch {
    return {};
  }
}

function firstText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function clip(s) {
  const one = s.replace(/\s+/g, ' ');
  return one.length > LABEL_MAX ? `${one.slice(0, LABEL_MAX - 1)}…` : one;
}
