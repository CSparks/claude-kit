// Untriaged captures that are newer than SESSION.md: the active workstream the resume anchor does not
// describe. orient lists them under the anchor so a session reads the live work before it trusts the
// anchor (a model imported from SESSION.md while the day's notes named another).
//
//   activeInboxNotes(root, { limit, lineMax }) -> { total, lines: ['<age> <first line>', ...] } (newest first)
//   Fails open: any read error is "no notes".

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_LIMIT = 5;
const DEFAULT_LINE_MAX = 140;
const MS_PER_HOUR = 3600000;
const HOURS_PER_DAY = 24;

function ageLabel(ms) {
  const h = Math.max(0, Math.round(ms / MS_PER_HOUR));
  return h < HOURS_PER_DAY ? `${h}h` : `${Math.round(h / HOURS_PER_DAY)}d`;
}

export function activeInboxNotes(root, { limit = DEFAULT_LIMIT, lineMax = DEFAULT_LINE_MAX, now = Date.now() } = {}) {
  try {
    const anchor = statSync(join(root, '.ai', 'SESSION.md')).mtimeMs;
    const dir = join(root, '.ai', 'inbox');
    const newer = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
      .filter((e) => e.m > anchor)
      .sort((a, b) => b.m - a.m);
    const lines = newer.slice(0, limit).map(({ f, m }) => {
      const first = readFileSync(join(dir, f), 'utf8').split('\n').find((l) => l.trim()) || f;
      return `${ageLabel(now - m)} ago  ${first.trim().slice(0, lineMax)}`;
    });
    return { total: newer.length, lines };
  } catch {
    return { total: 0, lines: [] };
  }
}
