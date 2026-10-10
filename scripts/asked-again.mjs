// asked-again.mjs — a repeat ask escalates (KIT-T405). When a capture is CONFIRMED a repeat of an
// existing ticket (an exact kit-bug shape match, or `t asked <id>`), the ticket gets a History line,
// a one-step priority bump toward the top of config.priorities, and an `asked: N` counter
// (the original ask counts as 1). Loose text hits never call this.
//
//   bumpAsked(path, captureRef, priorities?) -> { id, asked, from, to }
//   askedAgainOpen(root, min?)               -> [{ id, title, asked }] open tickets asked >= min

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitFrontmatter, field } from './frontmatter.mjs';
import { appendUnderSection, stamp } from './md-body.mjs';
import { pathKey, statCached, statMarkdownFiles } from '../hooks/lib/stat-cache.mjs';

const DEFAULT_PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const REPEAT_THRESHOLD = 2;
const CLOSED = new Set(['review', 'done', 'superseded']);

const setField = (fm, key, value, after) => {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `$1 ${value}`);
  const anchor = new RegExp(`^${after}:.*$`, 'm');
  return anchor.test(fm) ? fm.replace(anchor, (m) => `${m}\n${key}: ${value}`) : `${fm}\n${key}: ${value}`;
};

/** Stamp one confirmed repeat ask on the ticket at `path`. */
export function bumpAsked(path, captureRef, priorities = DEFAULT_PRIORITIES) {
  const text = readFileSync(path, 'utf8');
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error(`asked-again: no frontmatter in ${path}`);
  const asked = (Number(field(parts.fm, 'asked')) || 1) + 1;
  const from = field(parts.fm, 'priority');
  const at = priorities.indexOf(from);
  const to = at > 0 ? priorities[at - 1] : from;
  let fm = setField(parts.fm, 'asked', asked, 'priority');
  if (to !== from) fm = setField(fm, 'priority', to, 'status');
  const date = stamp().slice(0, 10);
  const body = appendUnderSection(parts.rest, 'History', `- [${stamp()}] (asked again) ${date} — ${captureRef}`);
  writeFileSync(path, `${parts.open}${fm}${parts.close}${body}`);
  return { id: field(parts.fm, 'id'), asked, from, to };
}

const askedRow = (path) => {
  const parts = splitFrontmatter(readFileSync(path, 'utf8'));
  const fm = parts ? parts.fm : '';
  return { id: field(fm, 'id'), title: field(fm, 'title'), status: field(fm, 'status'), asked: Number(field(fm, 'asked')) || 1 };
};

/** Open tickets in `root`'s store asked at least `min` times, most-asked first. */
export function askedAgainOpen(root, min = REPEAT_THRESHOLD) {
  const dir = join(root, '.ai', 'tickets');
  const files = statMarkdownFiles(dir, (n) => n.startsWith('_') || n === 'INDEX.md');
  const rows = statCached(`asked-${pathKey(dir)}`, files, askedRow);
  return rows
    .filter((r) => r.asked >= min && !CLOSED.has(r.status))
    .sort((a, b) => b.asked - a.asked)
    .map(({ id, title, asked }) => ({ id, title, asked }));
}
