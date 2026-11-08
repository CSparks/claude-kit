// brief-grounded — a dispatch check for dispatch-guard (KIT-T703). A brief citing a feature or request ticket carries
// `[maintainer-words: "<his sentence>"]`; when the ticket title names a variant of an existing feature it also carries
// `[reuses: <mechanism>]` (or `[reuses: none: <why>]`). Bug, chore and refactor tickets and read-only agents pass.
//   briefBlock({ root, input, prompt, footer, table? }) -> block message | null (check `brief-grounded`)
//   isVariant(title)                                    -> does the title name a variant of an existing feature

import { readOnlyDispatch } from './dispatch-readonly.mjs';
import { ticketsCited } from './dispatch-context.mjs';
import { ticketMeta } from './lib/ticket-store.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const BRIEF_CHECK = 'brief-grounded';
const CHECKED_TYPES = new Set(['feature', 'request']);
const WORDS = TOKENS.maintainerWords.pattern;
const REUSES = TOKENS.reuses.pattern;
const VARIANT = /\b(?:variants?|class(?:es)?|modes?|kinds?|types?|flavou?rs?|versions?|another|extra|additional|more|higher|lower|bigger|smaller|faster|slower|like|same|similar|also)\b/i;
const TITLE_CHARS = 80;

export const isVariant = (title) => VARIANT.test(String(title || ''));

function ungrounded(root, prompt, table) {
  const hasWords = WORDS.test(prompt);
  const hasReuses = REUSES.test(prompt);
  const out = [];
  for (const id of ticketsCited(prompt)) {
    const meta = ticketMeta(root, id, table);
    if (!meta || !CHECKED_TYPES.has(meta.type)) continue;
    const needs = [];
    if (!hasWords) needs.push('[maintainer-words: "<his sentence>"]');
    if (isVariant(meta.title) && !hasReuses) needs.push('[reuses: <existing mechanism>]');
    if (needs.length) out.push({ id, type: meta.type, title: meta.title, needs });
  }
  return out;
}

export function briefBlock({ root, input, prompt, footer, table }) {
  try {
    const type = String(input.subagent_type || input.agent_type || '').trim();
    if (readOnlyDispatch(root, type, prompt)) return null;
    const found = ungrounded(root, String(prompt || ''), table);
    if (!found.length) return null;
    return [
      "BLOCKED: this brief builds a feature or request without grounding it in the maintainer's words (KIT-T703).",
      ...found.map((f) => `  ${f.id} (${f.type}: ${f.title.slice(0, TITLE_CHARS)}) needs ${f.needs.join(' and ')}`),
      '',
      'A brief that restates the ask in its own words adds scope the maintainer never asked for. DE-T195 asked for an MX track class with',
      'higher hills and jumps; the brief invented a separate MX layout path when the stadium layout generator should have been reused.',
      '',
      "Fix: quote the maintainer's sentence in [maintainer-words: \"...\"]. When the ticket is a variant of an existing feature, name the",
      'mechanism it reuses in [reuses: <mechanism>], or [reuses: none: <why nothing existing fits>].',
      '',
      footer,
    ].join('\n');
  } catch {
    return null;
  }
}
