// Shared by the questionnaire gate tests: is a gate script wired for AskUserQuestion in hooks.json, directly or through the one
// orchestrator that runs every questionnaire gate (question-gates.mjs, KIT-T1451).
//   questionGateWired(script) -> boolean   script: 'decision-gate' or 'decision-gate.mjs'

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_GATES } from './lib/question-gates-run.mjs';

const HOOKS_JSON = join(dirname(fileURLToPath(import.meta.url)), 'hooks.json');

export function questionGateWired(script) {
  const name = script.endsWith('.mjs') ? script : `${script}.mjs`;
  const wiring = JSON.parse(readFileSync(HOOKS_JSON, 'utf8'));
  return wiring.hooks.PreToolUse.some((e) => /AskUserQuestion/.test(e.matcher)
    && e.hooks.some((h) => h.command.includes(name) || (h.command.includes('question-gates.mjs') && QUESTION_GATES.includes(name))));
}
