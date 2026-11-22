// question-gates-run.mjs — every PreToolUse gate of a questionnaire run together, so ONE refusal lists every failing check
// with its fix (KIT-T1451). The harness stops at the first refusing hook of a matcher, so a questionnaire that failed four
// checks cost four attempts; the orchestrator (question-gates.mjs, wired in hooks.json) and the dry run
// (`q gates question --draft <file>`) both go through runQuestionGates.
//
//   QUESTION_GATES                          the gate scripts judged, in the order their blocks are printed
//   runQuestionGates(payload, { cwd, env }) -> Promise<{ blocks: [{ gate, text }], context: [string] }>
//       each gate runs as its own process with the payload on stdin (what the harness would have done); a block is an exit 2
//       and its stderr, `context` the advisory text a gate prints on stdout; a gate that crashes or exits otherwise passes
//   consolidatedBlock(blocks)               -> the one refusal text, the triage line once at the end

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIAGE_LINE } from './block-triage.mjs';
import { BRIEF_MIN_WORDS } from './question-brief.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..');

export const QUESTION_GATES = [
  'question-gate.mjs', 'reask-gate.mjs', 'ids-described-gate.mjs', 'question-grounded-gate.mjs', 'question-brief-gate.mjs',
  'decision-gate.mjs', 'question-wait-gate.mjs',
];

function runGate(script, input, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HOOKS, script)], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => resolve({ script, code: 0, out: '', err: '' }));
    child.on('close', (code) => resolve({ script, code, out, err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const advisoryOf = (out) => {
  try { return JSON.parse(out)?.hookSpecificOutput?.additionalContext || ''; } catch { return ''; }
};

export async function runQuestionGates(payload, { cwd = process.cwd(), env = process.env } = {}) {
  const input = JSON.stringify(payload);
  const results = await Promise.all(QUESTION_GATES.map((script) => runGate(script, input, { cwd, env })));
  return {
    blocks: results.filter((r) => r.code === 2).map((r) => ({ gate: r.script.replace(/\.mjs$/, ''), text: r.err.trim() })),
    context: results.map((r) => advisoryOf(r.out)).filter(Boolean),
  };
}

export function consolidatedBlock(blocks) {
  const body = blocks.map((b) => `== ${b.gate} ==\n${b.text.replace(TRIAGE_LINE, '').trim()}`);
  return [
    '',
    `BLOCKED: this questionnaire fails ${blocks.length} check${blocks.length === 1 ? '' : 's'}; every one is listed so a single rewrite passes them all.`,
    'Dry run before resending: q gates question --draft <file.json> (the same checks, every failure and fix at once).',
    `Resending: repeat the WHOLE plain summary (at least ${BRIEF_MIN_WORDS} words: what is decided, what each option does and costs, your recommendation) in the same message, directly above the call. A one-line note does not count, and the summary above the blocked call is not read for the resend (KIT-T1465).`,
    '',
    body.join('\n\n'),
    '',
    TRIAGE_LINE,
    '',
  ].join('\n');
}
