// The block-triage rule every gate block carries (KIT-T920, GG-D053): on ANY hook block the agent answers
// "process failure, kit bug, or known kit bug with the fix in progress?" in its next reply, before anything else.
// One definition, appended by excludeFooter (most gates) and by triageFooter (gates that print no exclusion footer).

export const TRIAGE_ANSWERS = ['PROCESS FAILURE', 'KIT BUG', 'KNOWN KIT BUG, FIX IN PROGRESS'];

export const TRIAGE_LINE = 'BLOCK TRIAGE (KIT-D154): in your next reply say which of three this is. PROCESS FAILURE (you broke a rule the gate enforces): ticket the root cause and a prevention that stops the recurrence. KIT BUG (the gate misfired, missed or printed too little): ticket it and dispatch the fix agent this turn (KIT-D145). KNOWN KIT BUG, FIX IN PROGRESS: name the open ticket id and the agent working it; no new ticket, no new dispatch.';

export const triageFooter = () => `\n${TRIAGE_LINE}\n`;
