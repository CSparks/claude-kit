// q-open-args.mjs — arguments of `q open [scope] [--status todo,doing,review] [--limit N]` (KIT-T398, KIT-T904),
// shared by the cache query and the markdown-scan fallback so both filter identically.

import { OPEN } from './q-model.mjs';

/** The first `limit` rows; a limit of 0 (or none) keeps every row. */
export const withLimit = (rows, limit) => (limit > 0 ? rows.slice(0, limit) : rows);

/** { scopeTok, statuses, limit } from open's args; throws on a status outside todo|doing|review or a limit that is no count. */
export function parseOpenArgs(args) {
  let scopeTok;
  let limit = 0;
  let statuses = [...OPEN];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '--limit' || a.startsWith('--limit=')) {
      const raw = a === '--limit' ? args[++i] : a.slice('--limit='.length);
      limit = Number(raw);
      if (!Number.isInteger(limit) || limit < 0) throw new Error(`--limit takes a count (0 = all); got '${raw}'`);
    } else if (a === '--status' || a.startsWith('--status=')) {
      const raw = a === '--status' ? args[++i] : a.slice('--status='.length);
      statuses = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const bad = statuses.filter((s) => !OPEN.includes(s));
      if (!statuses.length || bad.length) throw new Error(`--status takes ${OPEN.join('|')} (comma list); got '${bad.join(',') || raw}'`);
    } else if (scopeTok === undefined) scopeTok = a;
  }
  return { scopeTok, statuses, limit };
}
