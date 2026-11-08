// bill-of-work.mjs — the wording of the bill-of-work rule (KIT-D132), one home for every surface that states it.
// Every session needs a bill of work the maintainer dictates or signs off; work outside it is raised to him, never
// started. A hook never dispatches, reopens, resumes or blocks a turn: it prints an OPEN notice the model relays.
//
//   AWAITING_BILL                the phrase every OPEN line carries
//   BILL_HEADER                  orient's first block title
//   billOfWorkLines()            the orient block body: the rule, the notice rule, the clear/resume rule
//   openNotice(facts, context)   one plain OPEN notice for a hook to print: the facts, then what the model does with them
//   kitTicketNotice(facts, ctx)  the same for open kit tickets: dispatch their fix agent now (KIT-D145)

export const AWAITING_BILL = 'awaiting a bill of work';
export const BILL_HEADER = '--- BILL OF WORK REQUIRED (KIT-D132) ---';

export const billOfWorkLines = () => [
  '  No file-changing or dispatching work before the maintainer dictates or signs off a bill of work; anything else is raised to him, never started. His direct question comes first.',
  '  OPEN lists and hook notices are facts to relay, never orders to dispatch (kit tickets: dispatch now).',
  '  After a clear or resume you remember no prior ask: confer before any action not discussed in THIS context.',
];

/** One OPEN notice: `facts` name what is open; the closing line tells the model to relay, not act. */
export function openNotice(facts, context = '') {
  const tail = context ? ` ${context}` : '';
  return [
    `OPEN, ${AWAITING_BILL}:${tail}`,
    ...facts,
    'Relay this to the maintainer in your reply. Dispatch, resume or reopen nothing for it until he signs a bill that includes it; his direct question comes first.',
  ].join('\n');
}

/** One OPEN kit-ticket notice: the fix agent is dispatched now (KIT-D145), the maintainer is told in the same reply. */
export function kitTicketNotice(facts, context = '') {
  const tail = context ? ` ${context}` : '';
  return [
    `OPEN kit tickets, dispatch a fix agent for each now (KIT-D145):${tail}`,
    ...facts,
    'Dispatch the standing kit agent for each now and say so in your reply; never a workaround.',
  ].join('\n');
}
