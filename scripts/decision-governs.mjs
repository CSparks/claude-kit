// decision-governs.mjs — which standing decisions already answer a question about to be put to the maintainer (KIT-T744).
//
//   readDecisions(root)                  -> [{ id, file, title, summary, hit }] the in-force decisions of `<root>/.ai/decisions/`
//   governingDecisions(text, decisions)  -> the decisions whose title shares MIN_TITLE_SHARED distinctive words with
//                                           `text`, or whose title, summary and Decision paragraph share MIN_BODY_SHARED
//                                           (best first, at most MAX_SHOWN)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock } from './frontmatter.mjs';
import { words } from './question-asks.mjs';
import { decisionHit } from './q-decision-hit.mjs';

const MIN_TITLE_SHARED = 2;
const MIN_BODY_SHARED = 4;
const MAX_SHOWN = 3;
const RETIRED = new Set(['superseded', 'rejected', 'retired', 'reversed', 'withdrawn']);

export function readDecisions(root) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /-D\d+.*\.md$/.test(f)).flatMap((file) => {
    try {
      const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const fm = frontmatterBlock(text);
      if (!fm || RETIRED.has(field(fm, 'status')) || field(fm, 'superseded_by')) return [];
      const title = field(fm, 'title');
      const hit = decisionHit(text);
      return [{ id: field(fm, 'id'), file: join(dir, file), title, hit, summary: field(fm, 'summary') }];
    } catch { return []; }
  });
}

const shared = (mine, theirs) => [...mine].filter((w) => theirs.has(w)).length;

export function governingDecisions(text, decisions) {
  const mine = words(text);
  return decisions
    .map((d) => ({ d, title: shared(mine, words(d.title)), body: shared(mine, words(`${d.title} ${d.summary} ${d.hit}`)) }))
    .filter((r) => r.title >= MIN_TITLE_SHARED || r.body >= MIN_BODY_SHARED)
    .sort((a, b) => b.title - a.title || b.body - a.body)
    .slice(0, MAX_SHOWN)
    .map((r) => r.d);
}
