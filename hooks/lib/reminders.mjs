// User-defined recurring reminders (KIT-T090). Scans `.ai/reminders/*.md` and returns the ones
// DUE today so housekeeping can nag with the resolution command inline (KIT-T074: every nag
// carries its own drain). State is in FRONTMATTER, never mtime — reminders travel in git across
// machines (macOS + Windows), and checkout/clone destroys mtimes, so `last_done` is the only
// cross-machine-correct cadence anchor.
//
// A reminder is DUE when: `enabled !== false` AND `today >= last_done + every_days` AND
// (`snooze_until` empty OR `today >= snooze_until`). All comparisons are DATE-ONLY in UTC
// (calendar days since the epoch), so "weekly" means 7 calendar days. Returns
// { due: [{id, title, overdueDays, file}], total }, sorted most-overdue first. FAIL-OPEN per
// file AND overall: a malformed/odd reminder is SKIPPED silently and a broken dir returns the
// clean empty result — a bad reminder can NEVER throw out of SessionStart.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MS_PER_DAY, utcDay } from './time.mjs';

const REM_DEFAULT_EVERY = 7; // a reminder missing/!integer every_days falls back to weekly rather than nagging daily

export function scanReminders(root) {
  const out = { due: [], total: 0 };
  let entries = [];
  try {
    entries = readdirSync(join(root, '.ai', 'reminders'));
  } catch {
    return out; // no reminders dir — nothing to nag about
  }
  const todayDay = Math.floor(Date.now() / MS_PER_DAY);
  for (const f of entries) {
    if (!f.endsWith('.md') || f.startsWith('_') || f === 'README.md') continue;
    try {
      const text = readFileSync(join(root, '.ai', 'reminders', f), 'utf8');
      const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
      if (!fm) continue; // frontmatter-less file (the malformed case) → skip, never throw
      const pick = (k) => { const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
      const id = pick('id') || (f.match(/^REM-\d+/) || [, ''])[0];
      if (!id) continue;
      out.total++;
      if (/^(false|no|0)$/i.test(pick('enabled'))) continue; // muted
      const lastDay = utcDay(pick('last_done'));
      if (lastDay === null) continue; // no cadence anchor → not actionable, skip silently
      const everyRaw = parseInt(pick('every_days'), 10);
      const every = Number.isInteger(everyRaw) && everyRaw > 0 ? everyRaw : REM_DEFAULT_EVERY;
      const dueDay = lastDay + every;
      if (todayDay < dueDay) continue; // not yet due
      const snoozeDay = utcDay(pick('snooze_until'));
      if (snoozeDay !== null && todayDay < snoozeDay) continue; // snoozed into the future
      out.due.push({ id, title: pick('title') || id, overdueDays: todayDay - dueDay, file: f });
    } catch {
      /* unreadable/odd file — skip it, a broken reminder must never wedge SessionStart */
    }
  }
  out.due.sort((a, b) => b.overdueDays - a.overdueDays);
  return out;
}
