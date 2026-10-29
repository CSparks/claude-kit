// lessons-checked — a dispatch check for dispatch-guard (KIT-T690). Where the repo carries a framework lessons
// ledger, a brief that touches rendering, performance, assets or streaming must cite the lessons it applies,
// the way ui-framework-first asks for the framework mechanism: problems solved once are not re-litigated.
//
//   lessonsBlock({ root, input, prompt, footer }) -> block message | null (check `lessons-checked`)
//   lessonsWork(prompt)                           -> does the brief touch rendering, perf, assets or streaming
//
// Escape: `[lessons-checked: L-R01, L-S02]` naming ledger ids, or `[lessons-checked: none apply: <why>]`.
// Read-only agents other than the patch-worker are never asked.

import { frameworksFor } from './lib/frameworks.mjs';
import { ledgerFiles, lessonIds } from './lib/lessons.mjs';
import { readOnlyDispatch } from './dispatch-readonly.mjs';

export const LESSONS_CHECK = 'lessons-checked';
const TOKEN = /\[lessons-checked:\s*([^\]]*)\]/i;
const NONE_APPLY = /^none apply\b[:\s-]*\S/i;
const ID = /\bL-[A-Z]\d+\b/g;
const WORK = /\b(?:render(?:ing|er)?|shaders?|wgsl|meshes|mesh|instanc(?:e|es|ing)|draw calls?|shadows?|lighting|lods?|textures?|materials?|bakes?|baking|assets?|glb|scatter|chunks?|streaming|frame time|fps|profil(?:e|ing)|performance|perf|cpu cost|gpu|culling)\b/i;
const PATCH_WORKER = /(?:^|:)patch-worker$/i;

export function lessonsWork(prompt) {
  return WORK.test(String(prompt || ''));
}

export function lessonsBlock({ root, input, prompt, footer }) {
  const type = String(input.subagent_type || input.agent_type || '').trim();
  if (!PATCH_WORKER.test(type) && readOnlyDispatch(root, type, prompt)) return null;
  if (!lessonsWork(prompt)) return null;
  const ledgers = ledgerFiles(root, frameworksFor(root));
  if (!ledgers.length) return null;
  const known = new Set(ledgers.flatMap((f) => [...lessonIds(f)]));
  const said = TOKEN.exec(String(prompt))?.[1]?.trim() || '';
  if (NONE_APPLY.test(said) || (said.match(ID) || []).some((id) => known.has(id))) return null;
  return [
    'BLOCKED: this brief touches rendering, performance, assets or streaming, and the framework keeps a lessons ledger for that.',
    `  agent: ${type || '(default)'}${said ? `   cited: "${said}" (no id found in the ledger)` : ''}`,
    '',
    'The ledger holds problems already solved (entity count is CPU cost, merge per cell, pooled uploads, by-concern crates…).',
    'Read the headings orient printed, or the ledger itself, and cite the lessons the work applies.',
    '',
    'Fix: add [lessons-checked: L-R01, L-S02] (ids from the ledger) to the prompt, or',
    '[lessons-checked: none apply: <why>] when none does.',
    '',
    footer,
  ].join('\n');
}
