#!/usr/bin/env node
// PreToolUse(Workflow) — every agent() in a workflow script names its model and labels its row
// with a model tag (KIT-T461). A workflow's agents fire no Agent PreToolUse, so the script is the
// only place the label can be enforced. Blocks (exit 2) with the offending lines; escape:
// `[allow-unlabelled-workflow: reason]` in the script. A workflow run by name has no script text
// here and passes with a notice. Fail-open on an unreadable script file.

import { readFileSync } from 'node:fs';
import { payload } from './lib.mjs';
import { lintWorkflowScript, WORKFLOW_ESCAPE } from './lib/workflow-lint.mjs';

const SHOWN = 8;

main().catch(() => process.exit(0));

async function main() {
  const p = await payload();
  const script = scriptText(p.tool_input || {});
  if (script === null) {
    process.stderr.write('workflow-gate: workflow run by name, script not linted (KIT-T461) - every agent() in it must still pass model and a [Model] label.\n');
    process.exit(0);
  }
  if (WORKFLOW_ESCAPE.test(script)) process.exit(0);
  const problems = lintWorkflowScript(script);
  if (!problems.length) process.exit(0);
  const lines = problems.slice(0, SHOWN).map((x) => `  line ${x.line}: ${x.problem}`);
  process.stderr.write([
    'BLOCKED: Workflow script has unlabelled agent() calls (KIT-T461). Every row the maintainer sees must show its model.',
    ...lines,
    problems.length > SHOWN ? `  ... and ${problems.length - SHOWN} more` : '',
    "Pass model: 'sonnet'|'opus'|'haiku'|'fable' (the capability table's family for the job) and label: '[Sonnet 5.5] what it does' on each call.",
    'Deliberate exception: put [allow-unlabelled-workflow: <reason>] in the script.',
  ].filter(Boolean).join('\n') + '\n');
  process.exit(2);
}

// The script source: inline `script`, else the file at `scriptPath`; null when neither is present.
function scriptText(input) {
  if (typeof input.script === 'string') return input.script;
  if (typeof input.scriptPath === 'string') {
    try { return readFileSync(input.scriptPath, 'utf8'); } catch { process.exit(0); }
  }
  return null;
}
