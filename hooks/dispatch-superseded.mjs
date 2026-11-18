// dispatch-superseded.mjs — a brief that cites a decision a later one supersedes is told the replacement (KIT-T1374): a
// correction recorded only in prose let an old blanket rule ride on in briefs across a long session. A warning, never a block.
//
//   supersededCitationWarning(root, prompt) -> '' | one line per superseded decision the brief cites, naming its replacement
//   SUPERSEDED_CHECK                        -> the check id, for the ignore file
// The link is the newer decision's `supersedes:` (`t revise <newer> --supersedes <older>`); a citation inside a
// "supersedes <id>" phrase records the replacement and stays quiet (scripts/contract-rules/superseded-citations.mjs).

import { retiredDecisions, staleCitations } from '../scripts/contract-rules/superseded-citations.mjs';

export const SUPERSEDED_CHECK = 'dispatch-superseded';

export function supersededCitationWarning(root, prompt) {
  try {
    const retired = retiredDecisions(root);
    if (!retired.size) return '';
    const cited = [...new Map(staleCitations(String(prompt || ''), retired).map((c) => [c.id, c])).values()];
    return cited.map((c) => `NOTE: this brief cites ${c.id}, which is superseded by ${c.by.join(', ')} (KIT-T1374): cite ${c.by.join(', ')}; ${c.id} no longer stands as written (q show ${c.by[0]}). Check id: ${SUPERSEDED_CHECK}.`).join('\n');
  } catch {
    return '';
  }
}
