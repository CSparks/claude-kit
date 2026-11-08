// question-checks — the check ids and thresholds of the questionnaire gates, defined once. The gates
// (question-gate, reask-gate, ids-described-gate, question-brief-gate) import them and `q gates question` prints them
// (hooks/lib/gate-protocol.mjs), so the printout cannot drift from what a gate enforces (KIT-T898).

export const BRIEF_CHECK = 'question-brief';
export const READY_CHECK = 'question-ready';
export const REASK_CHECK = 'reask-gate';
export const IDS_CHECK = 'ids-described';
export const RECOMMENDED_MARKER = '(Recommended)';
export const IDS_MIN_HITS = 2;
export const REASK_WINDOW_DAYS = 7;
