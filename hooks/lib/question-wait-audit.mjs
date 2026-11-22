// question-wait-audit — the after-the-call check that the summary above a questionnaire offers no wait over 60 seconds to
// accept without a recorded time budget (KIT-T1480). The same-reply summary is unreadable before the call, so the
// question-wait gate cannot judge it live; the audit reads it once the call is on disk (see question-audit.mjs).
//
//   summaryWaitOffers(turn, call) -> offers in the summary prose; [] when the call's questions or the summary carry [wait-checked: ...]
//   waitAuditMessage(audits)      -> the text sent to the model for [{ call, offers }] ('' when none)

import { hasWaitChecked, waitOffers } from './wait-offer.mjs';
import { WAIT_CHECK, WAIT_MAX_SECONDS } from './question-checks.mjs';
import { TOKENS } from './gate-tokens.mjs';
import { excludeFooter } from './exclusions.mjs';

const MAX_QUOTED = 200;

const questionsText = (call) => (call?.input?.questions || []).flatMap((q) => [q?.header, q?.question, ...(q?.options || []).flatMap((o) => [o?.label, o?.description])]).filter(Boolean).join(' ');

export function summaryWaitOffers(turn, call) {
  if (!turn || hasWaitChecked(`${turn.prose} ${questionsText(call)}`)) return [];
  return waitOffers(turn.prose);
}

export function waitAuditMessage(audits) {
  if (!audits.length) return '';
  return [
    `Question-wait audit (KIT-T1480): the summary above a questionnaire offers the maintainer a wait over ${WAIT_MAX_SECONDS} seconds to accept, with no recorded time budget behind it.`,
    ...audits.flatMap(({ offers }) => offers.map((o) => `  "${o.phrase}" (${o.seconds} s) — "${o.unit.slice(0, MAX_QUOTED)}"`)),
    `Say it again without recommending the wait (recommend the option that removes it), or name his recorded time budget (q fts <terms>) in ${TOKENS.waitChecked.form} in the question text, then re-ask.`,
    excludeFooter(WAIT_CHECK),
  ].join('\n');
}
