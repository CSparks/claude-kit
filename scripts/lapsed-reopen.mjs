// lapsed-reopen.mjs — reopen-on-collision (KIT-D107). A capture whose text collides with a ticket
// that lapsed out of review reopens that ticket (todo, `lapsed` label removed) and attaches the
// capture as a maintainer comment, instead of filing a duplicate. Closed tickets never reach
// q's `similar` (archived), so lapsed ones are matched here from the store's own files.
//
// findLapsedMatches(root, text)               -> [{ id, title }] done + `lapsed` tickets whose title the text covers,
//                                                including at least two terms rare among the store's titles
// reopenOnCollision(root, text, { author, skip }) -> ['reopened <id> (KIT-D107)', …]; fail-open (returns [])

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { field, listField, splitFrontmatter } from './frontmatter.mjs';
import { ALNUM_TERM, MIN_TERM_LEN } from './q-model.mjs';
import { LAPSE_LABEL } from './t/lapse-rule.mjs';
import { readConfig } from './t-config.mjs';
import { resolveUser } from './identity.mjs';

const MIN_SHARED_TERMS = 3;
const MIN_TITLE_COVERAGE = 0.75;
const MIN_DISTINCTIVE_TERMS = 2;
const DISTINCTIVE_TITLE_SHARE = 0.02;
const MAX_REOPENED = 3;
const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md']);
const STOPWORDS = new Set('the and for with from that this into over are was not but all any can has have had its our out per via off when then than they them their there these those which while will would should could also only just very more most some such each both been being does done'.split(' '));

const termsOf = (text) => new Set((String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN && !STOPWORDS.has(t)));

// One pass over the store: the lapsed tickets, and in how many ticket titles each term appears.
function scanStore(root) {
  const cfg = readConfig(root);
  const dirs = [join(root, '.ai', 'tickets'), join(root, '.ai', cfg.archiveDir)];
  const lapsed = [];
  const titleCount = new Map();
  let total = 0;
  for (const dir of dirs.filter((d) => existsSync(d))) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.md') && !SKIP.has(n))) {
      const text = readFileSync(join(dir, f), 'utf8');
      const parts = splitFrontmatter(text);
      if (!parts) continue;
      const title = field(parts.fm, 'title');
      total++;
      for (const w of termsOf(title)) titleCount.set(w, (titleCount.get(w) || 0) + 1);
      if (text.includes(LAPSE_LABEL) && field(parts.fm, 'status') === 'done' && listField(parts.fm, 'labels').includes(LAPSE_LABEL)) {
        lapsed.push({ id: field(parts.fm, 'id'), title });
      }
    }
  }
  return { lapsed, titleCount, total };
}

// A term is distinctive when few ticket titles carry it: `gate`, `files`, `write` appear in dozens of
// titles and say nothing about which ticket a capture is about.
const isDistinctive = ({ titleCount, total }, term) => (titleCount.get(term) || 0) <= Math.max(1, Math.floor(total * DISTINCTIVE_TITLE_SHARE));

export function findLapsedMatches(root, text) {
  const mine = termsOf(text);
  const store = scanStore(root);
  return store.lapsed.filter((t) => {
    const title = termsOf(t.title);
    const shared = [...title].filter((w) => mine.has(w));
    const distinctive = shared.filter((w) => isDistinctive(store, w)).length;
    return title.size > 0 && shared.length >= Math.min(MIN_SHARED_TERMS, title.size) && shared.length / title.size >= MIN_TITLE_COVERAGE
      && distinctive >= Math.min(MIN_DISTINCTIVE_TERMS, title.size);
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
