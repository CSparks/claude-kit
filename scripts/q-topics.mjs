// The TOPIC view of a store (KIT-T189): `q topics` (the generated index) and
// `q topic <slug>` / `q --topic <slug>` (one topic's items).
//
// A topic is a per-session label stamped on each captured item, not a directory — so this is
// a VIEW assembled at query time. Nothing on disk is grouped by topic and nothing needs to
// be: an item's home is still its store, and re-labelling never moves a file.
//
// Scan-only, like `governing` / `drift` / `mentions`: the cache schema carries no topic
// column, and the index is cheap enough that adding one would buy nothing.

import { clip, SUMMARY_CLIP } from './q-model.mjs';

const DATE_LEN = 10; // YYYY-MM-DD

// The date an item was captured: the `YYYY-MM-DD` its filename leads with (cap's naming,
// which survives a copy), else its first history event, else ''.
export function itemDate(item) {
  const m = String(item.file || '').match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const first = (item.history || [])[0];
  return first && first.ts ? String(first.ts).slice(0, DATE_LEN) : '';
}

// The one line that stands for an item: its authored summary, else its title, else the first
// body line with cap's `(type)` tag and the trailing identity lines removed.
export function itemGist(item) {
  if (item.summary) return clip(item.summary, SUMMARY_CLIP);
  if (item.title) return clip(item.title, SUMMARY_CLIP);
  const line = String(item.body || '')
    .split(/\r?\n/)
    .find((l) => l.trim() && !/^(topic|session|resolved):/i.test(l.trim())) || '';
  return clip(line.replace(/^\(([a-z][\w-]*)\)\s*/i, '').trim(), SUMMARY_CLIP);
}

// The generated index: one row per topic — slug, first/last capture date, item count, and the
// gist of its FIRST item (what the thread opened with).
export function topicIndex(items) {
  const byTopic = new Map();
  for (const it of items) {
    if (!it.topic) continue;
    if (!byTopic.has(it.topic)) byTopic.set(it.topic, []);
    byTopic.get(it.topic).push(it);
  }
  const rows = [];
  for (const [topic, list] of byTopic) {
    const sorted = list.slice().sort(byDate);
    const dates = sorted.map(itemDate).filter(Boolean);
    rows.push({
      topic,
      first: dates[0] || '',
      last: dates[dates.length - 1] || '',
      items: sorted.length,
      gist: itemGist(sorted[0]),
    });
  }
  return rows.sort((a, b) => String(b.last).localeCompare(String(a.last)) || a.topic.localeCompare(b.topic));
}

// One topic's items, oldest first — the thread as it was captured.
export function topicItems(items, slug) {
  const want = String(slug || '').toLowerCase();
  return items
    .filter((i) => String(i.topic || '').toLowerCase() === want)
    .sort(byDate)
    .map((i) => ({
      id: i.id,
      date: itemDate(i),
      store: i.store,
      type: i.type,
      status: i.status || '',
      title: itemGist(i),
    }));
}

const byDate = (a, b) => itemDate(a).localeCompare(itemDate(b)) || String(a.file).localeCompare(String(b.file));
