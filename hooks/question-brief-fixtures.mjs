// Briefs and questionnaires as sessions wrote them, for question-brief-gate.test.mjs (KIT-T881).
//   SIGN_OFF_*        a groovegrid brief, verbatim; its recommendation gives the pick, then the reason as a separate sentence
//   SIGN_OFF_WRAPPED  the same brief with the reason joined by "because" across a soft-wrapped line
//   NEEDS_SIGN_OFF_*  a brief whose decision section reads "Needs your sign-off" (condensed)

export const SIGN_OFF_QUESTIONS = [
  {
    question: 'Do I dispatch slice 1 of the Song mode bill (scene grid second-row bug + DragNumberInput for BPM, repeats, bar count, time signature)?',
    header: 'Bill',
    multiSelect: false,
    options: [
      { label: '(Recommended) Sign: slice 1 now, then continue in order', description: 'dispatch slice 1 now' },
      { label: 'Sign slice 1 only', description: 'stop for a test after slice 1' },
      { label: 'Edit the bill first', description: 'nothing starts until the scope changes' },
    ],
  },
  {
    question: 'How should the implementer treat the uncommitted SettingsModal.{cpp,h} edits?',
    header: 'Foreign edits',
    multiSelect: false,
    options: [
      { label: '(Recommended) Leave them alone', description: 'never touched or staged' },
      { label: 'I\'ll commit them first', description: 'the tree is clean before dispatch' },
    ],
  },
];

const SIGN_OFF_HEAD = [
  'Understood. Both rules are now standing directives: a question always goes in a questionnaire, and the questionnaire always has its full brief above it in the scrollback. I\'m recording them verbatim as a decision now. Then I\'ll post the questionnaire after this brief, which sits in the transcript before the call.',
  '**Decision.** Whether to sign the Song mode bill so work starts now, and how to treat the uncommitted `SettingsModal` files. Nothing is dispatched yet, and the session has idled while I asked in prose.',
  [
    '**Evidence.**',
    '- Your requirements are in GG-D048 and GG-D049, plus four inbox captures (layout feedback, grid-row bug, time-signature entry, repeats).',
    '- `src/ui/transport/BpmInput.{h,cpp}` is the entry component to generalize.',
    '- `SceneControlsSetup.cpp:138-143` is repeats (`playthroughInput`).',
    '- `src/ui/modal/SettingsModal.{cpp,h}` have uncommitted edits from before this session. The dispatch hook (KIT-T407) blocks a writer unless I pass `[foreign-edits-ok]`.',
    '- Hooks also require a handoff from the old implementer `a34496fdbcb978537` (KIT-D116) and your quoted words in the brief (KIT-T703).',
  ].join('\n'),
  [
    '**Bill options.**',
    '- **Sign, slice 1 now, then continue in order.** One sonnet implementer does the scene-grid second-row bug and `DragNumberInput` for BPM, repeats, bar count and time signature. The rest follow in order, and I hand back at each testable landing. The cost is fewer pauses for your tests.',
    '- **Sign slice 1 only.** I dispatch slice 1 and stop for your test. The cost is that everything after it waits on you.',
    '- **Edit the bill first.** Nothing starts until you change scope or order.',
  ].join('\n'),
  [
    '**Foreign edits.**',
    '- **Leave them alone.** The implementer never touches or stages them, and you commit them separately.',
    '- **You commit them first.** The tree is clean, but I wait on you.',
  ].join('\n'),
];
const SIGN_OFF_TAIL = '**Not asked.** The bar-0 bug, the shared baseline, lane reuse, collapse and the scene strip. All are already in GG-D048 and GG-D049.';

export const SIGN_OFF_BRIEF = [
  ...SIGN_OFF_HEAD,
  '**Recommendation.** Sign and continue in order, and leave the foreign edits alone. You dictated the bill, and the commit hooks guard each landing.',
  SIGN_OFF_TAIL,
].join('\n\n');

export const SIGN_OFF_WRAPPED = [
  ...SIGN_OFF_HEAD,
  'Recommendation. I recommend we sign, continue in order and leave the foreign edits alone,\nbecause you dictated the whole bill and the commit hooks already guard each landing.',
  SIGN_OFF_TAIL,
].join('\n\n');

export const NEEDS_SIGN_OFF_QUESTIONS = [{
  question: 'Which scope for the remaining GG-T170 work?',
  header: 'Scope',
  multiSelect: false,
  options: [
    { label: '(Recommended) A: interval selector and emphasis', description: 'remove both' },
    { label: 'B: interval selector only', description: 'keep emphasis' },
    { label: 'C: close GG-T170 as it is', description: 'stop here' },
  ],
}];

export const NEEDS_SIGN_OFF_BRIEF = [
  'The strip landed: it lost the bar buttons, the Bar X/Y label, resolution and Split, and went from 90 to 80 px. It cannot reach one line yet because the chord interval selector still fills the top row, which is in src/ui/main/SceneControls.h and the open criteria of GG-T170.',
  '**Needs your sign-off.** The kit flagged that the writer left GG-T170 open with no handoff, and it will not let me dispatch more GG-T170 work until you sign a bill that includes it.',
  [
    '- A: interval selector and emphasis. Both removals, one writer, small commits. It touches the Main Track row, saved emphasis data is ignored, not deleted, and a collapse rule is needed below 990 px.',
    '- B: interval selector only. It keeps emphasis, leaves the second row in place, and saves the width work for later.',
    '- C: close GG-T170 as it is. It stops the work here and leaves the strip two rows tall.',
  ].join('\n'),
  '**Recommendation.** Take A. It is the only scope that reaches one line, and the saved data stays safe.',
  '**Not asked.** The bar navigator and the bar-0 bug, which stay as they are.',
].join('\n\n');
