// Two questionnaires and the summaries written above them, verbatim from a real groovegrid session, for
// question-brief-audit.test.mjs (KIT-T881). Both summaries are labelled briefs that the audit must accept.
//   SHIFT_BRIEF / SHIFT_QUESTIONS    a three-question questionnaire (Shift+click, audit, slice B)
//   GATE_BRIEF / GATE_QUESTIONS      a one-question questionnaire with four options (the gate-fix choice)

export const SHIFT_BRIEF = [
  'Yes. Those questions at the end of my last two replies should have been a questionnaire, and that\'s the rule (KIT-D136). Here is the brief for all three, then the questionnaire.',
  '**Decision:** how Shift+click should behave on the sequencer, whether to audit the other surfaces for the same rule, and whether to dispatch slice B now, needed now because the writer is done and slice B is the last item of the signed bill.',
  '**Evidence:** commit `5953e05f` makes Shift add the block to the held selection, while `SceneGrid.cpp:524` and `TrackSelectionManager.cpp:27` replace it. GG-D051 says Shift is a range select everywhere, and `SelectionMode.h` still maps Shift to Add.',
  [
    '**Options:**',
    '- "Replace the selection with the range" makes Shift behave like every other surface, and a smaller second range shrinks it.',
    '- "Add the block to the selection" keeps today\'s build and never clears, but it differs from the rest of the app.',
    '- "Audit and converge the other surfaces" has one writer move about six surfaces onto the shared primitive, with some regression risk.',
    '- "Leave the other surfaces alone for now" keeps them as they are, which contradicts GG-D051.',
    '- "Dispatch slice B now" starts a fresh writer on baseline, full-width lanes, lane reuse, collapse and the scene strip. It rebuilds the exe, so a running app blocks the link step.',
    '- "Hold until I have tested" waits for your UAT of the taper, stripes and range select.',
  ].join('\n'),
  '**Recommendation:** "Replace the selection with the range", because GG-D051 makes Shift a range everywhere. Also "Audit and converge the other surfaces", because the rule is universal, and "Dispatch slice B now", because the bill is signed.',
  '**Not asked:** the unconfirmed assumptions (bar count, denominator, anchor rule, children replacing the roll-up).',
].join('\n\n');

const option = (label, description) => ({ label, description });
const question = (text, header, ...options) => ({ question: text, header, multiSelect: false, options });

export const SHIFT_QUESTIONS = [
  question('Should Shift+click replace the selection with the range, or add the block to it?', 'Shift mode',
    option('(Recommended) Replace the selection with the range', 'Shift behaves like every other surface and a smaller second range shrinks the selection. Costs a small change to the sequencer code.'),
    option('Add the block to the selection', 'Keeps today\'s build, where Shift never clears. Differs from the rest of the app and from GG-D051.')),
  question('Do you want the other surfaces audited and moved onto the shared range primitive?', 'Audit',
    option('(Recommended) Audit and converge the other surfaces', 'One writer moves scene grid, track list, module strip, mod matrix, slot panel and the selection-mode mapping onto the primitive. Some regression risk.'),
    option('Leave the other surfaces alone for now', 'No change to them. They stay as they are, which does not match GG-D051 everywhere.')),
  question('Do I dispatch slice B (GG-T190) now?', 'Slice B',
    option('(Recommended) Dispatch slice B now', 'A fresh writer starts baseline, full-width lanes, lane reuse, collapse and the scene strip. It rebuilds the exe, so close the app before a landing or the link step fails.'),
    option('Hold until I have tested', 'Nothing starts until you report on the taper, stripes and range select.')),
];

export const GATE_BRIEF = [
  'The kit agent reported on KIT-T881. The fix is partly in, and one decision is yours. Everything below is the agent\'s report.',
  '**Decision:** which way to handle the unreadable same-reply brief, needed now because every questionnaire\'s first call is blocked once and you called this your biggest problem.',
  '**Evidence:** KIT-T881 Notes and the agent\'s report (commits `5dc5ef8`, `7210d3a`). Also the kit session\'s finding that seven earlier commits since Nov 3 (8325569 through 470b6b8) all patched the transcript read and still failed.',
  [
    '**Options:**',
    '- "Keep the block with an accurate message" blocks the first call, and the one resend then works. It costs one wasted call per questionnaire.',
    '- "Warn instead of block" lets the questionnaire through and audits afterwards. It loosens a gate, so it needs your word.',
    '- "Judge only the questionnaire input" would pass thin briefs, because the brief you require sits above the questionnaire. At best it complements the block.',
    '- "Brief, one cheap call, then questionnaire" means I write the brief, make one cheap tool call, then send the questionnaire in a new reply. It needs no gate change and no block.',
  ].join('\n'),
  '**Recommendation:** "Brief, one cheap call, then questionnaire", because it needs no gate change and the brief is on disk before the call. Fall back to keeping the block if it fails in practice.',
  '**Not asked:** the `RECOMMEND` matcher in `lib/question-brief.mjs`, which passes any brief containing "recommend" near "which" or "because". Also slice A, which is still running.',
].join('\n\n');

export const GATE_QUESTIONS = [
  question('How do we handle the same-reply brief the gate cannot read on the first call (KIT-T881)?', 'Gate fix',
    option('(Recommended) Brief, one cheap call, then questionnaire', 'I write the brief, make one cheap tool call, then send the questionnaire in a new reply. No gate change and no block. Falls back to keeping the block if it fails in practice.'),
    option('Keep the block with an accurate message', 'Every questionnaire\'s first call is blocked once and the resend works. Costs one wasted call per questionnaire.'),
    option('Warn instead of block', 'The questionnaire goes through and the brief is audited afterwards. Loosens the gate, so it needs your explicit word.'),
    option('Judge only the questionnaire input', 'Check only the AskUserQuestion input itself. Does not satisfy KIT-D136 (brief above the questionnaire), so at best a complement to the block.')),
];
