// conformance-named — a dispatch check for dispatch-guard (KIT-T690). A framework that ships a conformance test (its front
// matter names it: `conformance: framework_conformance`) tells every game what the framework's tuned defaults are. A brief
// that touches rendering, performance, assets or streaming must make that test part of its acceptance, so a game cannot
// quietly drift off a default (backend pin, pool sizing, pooled uploads, upload cap, stream lead).
//
//   conformanceBlock({ root, input, prompt, footer }) -> block message | null (check `conformance-named`)
//
// Escape: name the test in the brief, or `[conformance: not affected: <why>]`.
// Read-only agents other than the patch-worker are never asked. Same work words as lessons-checked.

import { frameworksFor } from './lib/frameworks.mjs';
import { readOnlyDispatch } from './dispatch-readonly.mjs';
import { lessonsWork } from './dispatch-lessons.mjs';

export const CONFORMANCE_CHECK = 'conformance-named';
const NOT_AFFECTED = /\[conformance:\s*not affected\b[:\s-]*\S[^\]]*\]/i;
const PATCH_WORKER = /(?:^|:)patch-worker$/i;

export function conformanceBlock({ root, input, prompt, footer, frameworks = frameworksFor(root) }) {
  const type = String(input.subagent_type || input.agent_type || '').trim();
  if (!PATCH_WORKER.test(type) && readOnlyDispatch(root, type, prompt)) return null;
  if (!lessonsWork(prompt)) return null;
  const tests = frameworks.map((f) => f.conformance).filter(Boolean);
  if (!tests.length) return null;
  const text = String(prompt || '');
  if (NOT_AFFECTED.test(text) || tests.some((t) => text.includes(t))) return null;
  return [
    'BLOCKED: this brief touches rendering, performance, assets or streaming, and the framework ships a conformance test.',
    `  agent: ${type || '(default)'}   conformance test: ${tests.join(', ')}`,
    '',
    'The test pins the framework defaults every game must keep (backend, pools, pooled uploads, upload cap, stream lead).',
    'Make it part of the acceptance, and run it before reporting done.',
    '',
    `Fix: name ${tests[0]} in the brief, or add [conformance: not affected: <why>] when the work cannot move a default.`,
    '',
    footer,
  ].join('\n');
}
