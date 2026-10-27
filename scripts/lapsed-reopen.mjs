// lapsed-reopen.mjs — reopen-on-collision (KIT-D107). A capture whose text collides with a ticket
// that lapsed out of review reopens that ticket (todo, `lapsed` label removed) and attaches the
// capture as a maintainer comment, instead of filing a duplicate. Closed tickets never reach
// q's `similar` (archived), so lapsed ones are matched here from the store's own files.
//
// findLapsedMatches(root, text)               -> [{ id, title }] done + `lapsed` tickets sharing the text's terms
// reopenOnCollision(root, text, { author, skip }) -> ['reopened <id> (KIT-D107)', …]; fail-open (returns [])

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { field, listField, splitFrontmatter } from './frontmatter.mjs';
import { ALNUM_TERM, MIN_TERM_LEN } from './q-model.mjs';
import { LAPSE_LABEL } from './t/lapse-rule.mjs';
import { readConfig } from './t-config.mjs';
import { resolveUser } from './identity.mjs';

const MIN_SHARED_TERMS = 3;
const MIN_TITLE_COVERAGE = 0.6;
const MAX_REOPENED = 3;
const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md']);

const termsOf = (text) => new Set((String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN));

function lapsedTickets(root) {
  const cfg = readConfig(root);
  const dirs = [join(root, '.ai', 'tickets'), join(root, '.ai', cfg.archiveDir)];
  return dirs.filter((d) => existsSync(d)).flatMap((dir) => readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .flatMap((f) => {
      const text = readFileSync(join(dir, f), 'utf8');
      if (!text.includes(LAPSE_LABEL)) return [];
      const parts = splitFrontmatter(text);
      if (!parts || field(parts.fm, 'status') !== 'done' || !listField(parts.fm, 'labels').includes(LAPSE_LABEL)) return [];
      return [{ id: field(parts.fm, 'id'), title: field(parts.fm, 'title') }];
    }));
}

export function findLapsedMatches(root, text) {
  const mine = termsOf(text);
  return lapsedTickets(root).filter((t) => {
    const title = termsOf(t.title);
    const shared = [...title].filter((w) => mine.has(w)).length;
    return title.size > 0 && shared >= Math.min(MIN_SHARED_TERMS, title.size) && shared / title.size >= MIN_TITLE_COVERAGE;
  });
}

export async function reopenOnCollision(root, text, { author = resolveUser(), skip = [] } = {}) {
  try {
    const hits = findLapsedMatches(root, text).filter((t) => !skip.includes(t.id)).slice(0, MAX_REOPENED);
    if (!hits.length) return [];
    const { comment, refresh } = await import('./t.mjs');
    const { setStatus } = await import('./t/status.mjs');
    const lines = [];
    for (const t of hits) {
      setStatus(root, t.id, 'todo', { remaining: 'reopened: a new capture collided with this lapsed ticket (KIT-D107)' });
      comment(root, t.id, text, { author });
      lines.push(`reopened ${t.id} (KIT-D107)`);
    }
    await refresh(root);
    return lines;
  } catch {
    return [];
  }
}
