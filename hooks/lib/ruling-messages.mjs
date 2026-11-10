// ruling-messages — the text each consumer of inbox-rulings prints (KIT-T938), so the demand reads the same at
// capture, at Stop, at orient and at a planner dispatch.
//   rulingDemand(id)                 the cap receipt line for a note that quotes the maintainer
//   stopBlock(fresh)                 the Stop block for rulings captured this turn (caller appends the triage footer)
//   overdueBlock(overdue, days)      the Stop block for directives resting in the framework inbox past `days` (KIT-T943)
//   staleWarning(old)               the Stop/PreCompact warning for rulings older than this turn
//   orientBlock(rulings)             the SessionStart lines, [] when nothing waits
//   planBlock(rulings, { agent })    the dispatch block for a planner that cites no inbox search (caller appends the footer)

import { PROMOTE_COMMAND, rulingLines } from './inbox-rulings.mjs';
import { TOKENS } from './gate-tokens.mjs';

const ORIENT_SHOWN = 8;
const DRAFT_SHAPE = 'a draft with a **Maintainer:** paragraph quoting him verbatim, a **Decision:** and a **Why:**';
const CLEAR_FALSE_MATCH = 't triage <id> --skip';

export const RULINGS_HEADER = '--- UN-PROMOTED MAINTAINER RULINGS (inbox notes quoting him; promote before designing) ---';
const RULINGS_CHECKED_FORM = `${TOKENS.rulingsChecked.form}, or [rulings-checked: none apply: <why>]`;

export const rulingDemand = (id) =>
  `RULING CAPTURED: ${id} quotes the maintainer. A ruling resting in the inbox is not the record (KIT-T938). Promote it THIS turn, before other work: write ${DRAFT_SHAPE}, then ${PROMOTE_COMMAND.replace('<inbox id>', id)}. The Stop hook blocks until the note leaves the inbox. Not a ruling: ${CLEAR_FALSE_MATCH.replace('<id>', id)}.`;

export const stopBlock = (fresh) => [
  `BLOCKED: ${fresh.length} maintainer ruling(s) captured this turn still rest in the inbox (KIT-T938). The record is a decision, not a note:`,
  ...rulingLines(fresh),
  `Promote each now: write ${DRAFT_SHAPE}, then ${PROMOTE_COMMAND}. A note that is not a ruling clears with ${CLEAR_FALSE_MATCH}.`,
].join('\n');

export const overdueBlock = (overdue, days) => [
  `BLOCKED: ${overdue.length} maintainer directive(s) have rested in the framework inbox for ${days}+ days without triage (KIT-T943). A framework directive left in the inbox is never built:`,
  ...rulingLines(overdue, { limit: ORIENT_SHOWN }),
  `Triage each now: promote with ${PROMOTE_COMMAND} and file the framework ticket it implies, or clear a note that is no directive with ${CLEAR_FALSE_MATCH}.`,
].join('\n');

export const staleWarning = (old) => [
  `WARNING: ${old.length} maintainer ruling(s) from earlier still rest in the inbox, un-promoted (KIT-T938). Later sessions design against the record, not these notes:`,
  ...rulingLines(old, { limit: ORIENT_SHOWN }),
  `Promote with ${PROMOTE_COMMAND}; a note that is not a ruling clears with ${CLEAR_FALSE_MATCH}.`,
].join('\n');

export function orientBlock(rulings) {
  if (!rulings.length) return [];
  return [
    RULINGS_HEADER,
    ...rulingLines(rulings, { limit: ORIENT_SHOWN }),
    `  Read them with q show <id> before you design: they bind. Promote: ${PROMOTE_COMMAND}. Not a ruling: ${CLEAR_FALSE_MATCH}.`,
    '',
  ];
}

export const planBlock = (rulings, { agent, pending }) => [
  `BLOCKED: a design or plan brief goes out with ${pending} un-triaged inbox note(s), ${rulings.length} of them quoting the maintainer, and cites no search of them (KIT-T938).`,
  `  agent: ${agent || '(default)'}`,
  ...rulingLines(rulings, { limit: ORIENT_SHOWN }),
  ...(pending > rulings.length ? [`  +${pending - rulings.length} other un-triaged note(s): q inbox`] : []),
  '',
  'A ruling captured as a note and never promoted was designed against the opposite once, and the maintainer had to repeat it in capitals.',
  'Read the notes (q inbox, q show <id>), build the plan on them, and promote each with ' + PROMOTE_COMMAND + '.',
  '',
  `Fix: add ${RULINGS_CHECKED_FORM} to the prompt.`,
].join('\n');
