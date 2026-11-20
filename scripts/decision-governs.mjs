// decision-governs.mjs — which standing decisions already answer a question about to be put to the maintainer (KIT-T744).
//
//   readDecisions(root)                  -> [{ id, file, title, summary, hit }] the in-force decisions of `<root>/.ai/decisions/`
//   governingDecisions(text, decisions)  -> the decisions whose title shares MIN_TITLE_SHARED distinctive words with
//                                           `text`, or whose title, summary and Decision paragraph share MIN_BODY_SHARED
//                                           (best first, at most MAX_SHOWN): candidates to show, never proof
//   restatedDecisions(text, decisions)   -> the decisions whose entire title `text` repeats: the question is already decided

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock } from './frontmatter.mjs';
import { words } from './question-asks.mjs';
import { decisionHit } from './q-decision-hit.mjs';
import { retiredStatus, supersededIds } from '../hooks/lib/superseded-decisions.mjs';
import { longestSharedRun } from '../hooks/lib/shared-run.mjs';

const MIN_TITLE_SHARED = 2;
const MIN_BODY_SHARED = 4;
const MAX_SHOWN = 3;
const MIN_RESTATED_WORDS = 3;
const TAGGED_RUN = 4;

export function readDecisions(root) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir)) return [];
  const read = readdirSync(dir).filter((f) => /-D\d+.*\.md$/.test(f)).flatMap((file) => {
    try {
      const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const fm = frontmatterBlock(text);
      if (!fm || retiredStatus(field(fm, 'status')) || field(fm, 'superseded_by')) return [];
      const title = field(fm, 'title');
      const hit = decisionHit(text);
      return [{ id: field(fm, 'id'), file: join(dir, file), title, hit, summary: field(fm, 'summary'), text }];
    } catch { return []; }
  });
  const replaced = supersededIds(read.map((d) => d.text));
  return read.filter((d) => !replaced.has(d.id));
}

const shared = (mine, theirs) => [...mine].filter((w) => theirs.has(w)).length;

// The decisions whose whole title (MIN_RESTATED_WORDS or more distinctive words) the asked text repeats: the
// questionnaire restates what is already decided. `text` is the question and header words, never the options.
// `text` is one text or a list of units (a long question judged sentence by sentence: pooled, it holds the words of most
// titles). With `tagged` (the questionnaire asserts the ids that govern it, KIT-T1451) a unit must also repeat a run of
// TAGGED_RUN consecutive words of the title: only a near-verbatim restatement then counts.
export function restatedDecisions(text, decisions, { tagged = false } = {}) {
  const units = [].concat(text).map((u) => ({ text: u, mine: words(u) }));
  return decisions.filter((d) => {
    const title = words(d.title);
    if (title.size < MIN_RESTATED_WORDS) return false;
    return units.some((u) => shared(u.mine, title) === title.size && (!tagged || longestSharedRun(u.text, d.title) >= TAGGED_RUN));
  });
}

export function governingDecisions(text, decisions) {
  const mine = words(text);
  return decisions
    .map((d) => ({ d, title: shared(mine, words(d.title)), body: shared(mine, words(`${d.title} ${d.summary} ${d.hit}`)) }))
    .filter((r) => r.title >= MIN_TITLE_SHARED || r.body >= MIN_BODY_SHARED)
    .sort((a, b) => b.title - a.title || b.body - a.body)
    .slice(0, MAX_SHOWN)
    .map((r) => r.d);
}
