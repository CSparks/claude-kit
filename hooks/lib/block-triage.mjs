// The block-triage rule every gate block carries (KIT-T920, GG-D053): on ANY hook block the agent answers
// "process failure or kit bug?" in its next reply, before anything else. One definition, appended by
// excludeFooter (most gates) and by triageFooter (gates that print no exclusion footer).

export const TRIAGE_LINE = 'BLOCK TRIAGE (KIT-D154): in your next reply say which this is. PROCESS FAILURE (you broke a rule the gate enforces): ticket the root cause and a prevention that stops the recurrence. KIT BUG (the gate misfired, missed or printed too little): ticket it and dispatch the fix agent this turn (KIT-D145).';

export const triageFooter = () => `\n${TRIAGE_LINE}\n`;
