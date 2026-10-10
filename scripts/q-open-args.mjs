// q-open-args.mjs — arguments of `q open [scope] [--status todo,doing,review]` (KIT-T398),
// shared by the cache query and the markdown-scan fallback so both filter identically.

import { OPEN } from './q-model.mjs';

/** { scopeTok, statuses } from open's args; throws on a status outside todo|doing|review. */
export function parseOpenArgs(args) {
  let scopeTok;
  let statuses = [...OPEN];
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '--status' || a.startsWith('--status=')) {
      const raw = a === '--status' ? args[++i] : a.slice('--status='.length);
      statuses = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const bad = statuses.filter((s) => !OPEN.includes(s));
      if (!statuses.length || bad.length) throw new Error(`--status takes ${OPEN.join('|')} (comma list); got '${bad.join(',') || raw}'`);
    } else if (scopeTok === undefined) scopeTok = a;
  }
  return { scopeTok, statuses };
}
