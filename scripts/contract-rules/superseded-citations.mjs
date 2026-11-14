// superseded-citations.mjs — find rules the contract still cites as authority after a later decision retired them (KIT-T1185).
//
//   retiredDecisions(root)                          -> Map<id, [superseding ids]> from the `supersedes:` links of `<root>/.ai/decisions/`
//   staleCitations(text, retired, exempt = {})      -> [{ id, by, line }] one per citation of a retired decision in `text`
//
// A superseder retires the cited decision only when it names it without a scope: `supersedes: KIT-D116` retires,
// `supersedes: KIT-D061 (the ui row)` does not. A rejected or withdrawn superseder retires nothing. A citation inside a
// "supersedes <id>" clause is the contract recording the replacement, not leaning on the old rule. `exempt` maps an id to
// the stated reason its citation stands.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { field, frontmatterBlock } from '../frontmatter.mjs';

const VOID_STATUS = new Set(['rejected', 'withdrawn', 'retired']);
const ID = /[A-Z]+-D\d+/g;
const ENTRY = /([A-Z]+-D\d+)((?:(?![A-Z]+-D\d+)[^;])*)/g;
const RECORDING_WINDOW = 80;
const RECORDING_WORD = /supersede[sd]\b/i;

export function retiredDecisions(root) {
  const dir = join(root, '.ai', 'decisions');
  const retired = new Map();
  if (!existsSync(dir)) return retired;
  for (const file of readdirSync(dir).filter((f) => /-D\d+.*\.md$/.test(f))) {
    const fm = frontmatterBlock(readFileSync(join(dir, file), 'utf8'));
    if (!fm || VOID_STATUS.has(field(fm, 'status'))) continue;
    for (const [, id, scope] of field(fm, 'supersedes').matchAll(ENTRY)) {
      if (scope.includes('(')) continue;
      retired.set(id, [...(retired.get(id) || []), field(fm, 'id')]);
    }
  }
  return retired;
}

export function staleCitations(text, retired, exempt = {}) {
  const found = [];
  for (const m of text.matchAll(ID)) {
    const id = m[0];
    if (!retired.has(id) || id in exempt) continue;
    const before = text.slice(Math.max(0, m.index - RECORDING_WINDOW), m.index);
    if (RECORDING_WORD.test(before)) continue;
    found.push({ id, by: retired.get(id), line: text.slice(0, m.index).split('\n').length });
  }
  return found;
}
