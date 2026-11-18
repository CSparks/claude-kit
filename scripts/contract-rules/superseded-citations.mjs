// superseded-citations.mjs — find rules the contract still cites as authority after a later decision retired them (KIT-T1185).
//
//   retiredDecisions(root)                          -> Map<id, [superseding ids]> from the `supersedes:` links of `<root>/.ai/decisions/`
//   retiredFrom(entries)                            -> the same map from [{ id, supersedes, status }] already read
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

/** The same map from decisions already read: [{ id, supersedes, status }] (orient's cached front-matter, KIT-T1374). */
export function retiredFrom(entries) {
  const retired = new Map();
  for (const { id: by, supersedes, status } of entries) {
    if (!by || VOID_STATUS.has(String(status || '').trim())) continue;
    for (const [, id, scope] of String(supersedes || '').matchAll(ENTRY)) {
      if (scope.includes('(')) continue;
      retired.set(id, [...(retired.get(id) || []), by]);
    }
  }
  return retired;
}

export function retiredDecisions(root) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir)) return new Map();
  const entries = readdirSync(dir).filter((f) => /-D\d+.*\.md$/.test(f)).flatMap((file) => {
    const fm = frontmatterBlock(readFileSync(join(dir, file), 'utf8'));
    return fm ? [{ id: field(fm, 'id'), supersedes: field(fm, 'supersedes'), status: field(fm, 'status') }] : [];
  });
  return retiredFrom(entries);
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
