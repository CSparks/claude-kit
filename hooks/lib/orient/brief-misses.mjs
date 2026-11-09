// brief-misses.mjs — orientation's repeat-offender line for the after-the-call summary audit (KIT-D153, KIT-D152): how many
// questionnaires of this project the audit found thin in the last week, split by session. One line, best-effort.
//
//   briefMissesSection(ctx)

import { projectName } from '../../lib.mjs';
import { missesSince } from '../question-audits.mjs';

const WINDOW_DAYS = 7;
const SESSIONS_SHOWN = 3;
const SESSION_ID_CHARS = 8;

export function briefMissesSection({ out, root }) {
  try {
    const misses = missesSince({ project: projectName(root), days: WINDOW_DAYS });
    if (!misses.length) return;
    const total = misses.reduce((sum, m) => sum + m.count, 0);
    const bySession = misses.slice(0, SESSIONS_SHOWN).map((m) => `${m.session.slice(0, SESSION_ID_CHARS) || 'unknown'} x${m.count}`).join(', ');
    out.push('');
    out.push(`!! THIN QUESTIONNAIRE SUMMARIES (${total} in ${WINDOW_DAYS} days): ${bySession}. Write a plain summary before every questionnaire (KIT-D153).`);
  } catch {
    /* the audit record is best-effort */
  }
}
