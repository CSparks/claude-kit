// decision-attribution.mjs — a decision never puts the assistant's words in the maintainer's mouth (KIT-T722).
// A decision whose `source:` names the maintainer must carry a `**Maintainer:**` paragraph holding their
// verbatim words (a `>` blockquote or a double-quoted span); scope or rationale the assistant added goes in a
// separate `**Assistant-added:**` paragraph.
//
//   attributionProblem(source, body) -> a refusal sentence, or '' when the record is attributed honestly
//   auditDecisions(root)             -> [{ id, file, problem }] existing decisions that fail the same rule

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock } from './frontmatter.mjs';
import { resolveUser } from './identity.mjs';

const MIN_QUOTE_CHARS = 8;
const MAINTAINER_PARAGRAPH = /\*\*Maintainer:\*\*([\s\S]*?)(?=\n\s*\n\*\*|\s*$)/;
const QUOTED_SPAN = new RegExp(`["“][^"”]{${MIN_QUOTE_CHARS},}["”]`);
const BLOCKQUOTE_LINE = new RegExp(`^\\s*>\\s*\\S.{${MIN_QUOTE_CHARS - 1},}`, 'm');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const namesMaintainer = (source) => new RegExp(`\\b(?:maintainer|user|${escapeRe(resolveUser())})\\b`, 'i').test(String(source || ''));

export function attributionProblem(source, body) {
  if (!namesMaintainer(source)) return '';
  const paragraph = (String(body || '').match(MAINTAINER_PARAGRAPH) || [])[1] || '';
  if (QUOTED_SPAN.test(paragraph) || BLOCKQUOTE_LINE.test(paragraph)) return '';
  return `source '${String(source).trim()}' names the maintainer, so the body needs a **Maintainer:** paragraph with their verbatim words (a > quote or "double quotes"); put anything you added in an **Assistant-added:** paragraph`;
}

export function auditDecisions(root) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /-D\d+.*\.md$/.test(f))
    .flatMap((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      const fm = frontmatterBlock(text);
      if (!fm) return [];
      const problem = attributionProblem(field(fm, 'source'), text.slice(text.indexOf('---', 3) + 3));
      return problem ? [{ id: field(fm, 'id'), file, problem }] : [];
    });
}
