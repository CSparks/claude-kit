// A real groovegrid brief and questionnaire, verbatim, for question-brief-turn.test.mjs (KIT-T881).
//   REAL_BRIEF        a status report: no Decision statement, and none of the five option labels described
//   REAL_FIXED_BRIEF  the same report with the Decision, Options and Recommendation sections added

export const REAL_QUESTIONS = [
  {
    question: 'Do you sign the Song-mode bill (scene-grid second-row bug, bar-0 test, shared baseline, full-width lanes, lane reuse, persisted collapse, scrolling scene strip, DragNumberInput extraction)?',
    header: 'Bill',
    multiSelect: false,
    options: [
      { label: '(Recommended) Sign all, in order', description: 'One sonnet implementer works the bill in order and hands back at each testable landing.' },
      { label: 'Sign slice 1 only', description: 'Scene-grid second-row bug plus DragNumberInput extraction, then stop for your test.' },
      { label: 'Edit the bill first', description: 'You change scope before anything is dispatched.' },
    ],
  },
  {
    question: 'What do I do about the uncommitted SettingsModal.cpp/.h edits that trip the foreign-edits guard?',
    header: 'Foreign edits',
    multiSelect: false,
    options: [
      { label: '(Recommended) Leave them, pass the token', description: 'I dispatch with [foreign-edits-ok] and the agent stages only its own paths.' },
      { label: 'You commit them first', description: 'You commit or stash them, then I dispatch with no token.' },
    ],
  },
];

export const REAL_BRIEF = [
  '**Answer first:** the bill was never signed, so none of it was built or dispatched. Three separate things stopped it, and one of them was my fault.',
  [
    '**The unsigned bill** (from the Nov 7 16:24–17:24 CST session; nothing is dispatched or built):',
    '- **Scene-grid bug:** populating the last scene slot doesn\'t add a second row. I proposed it as step 0. Inbox capture 1626.',
    '- **Bar-0 offset bug:** reproduce it with a numeric test.',
    '- **Shared x-baseline:** chord row, scene buttons, transport and lanes line up (GG-D048).',
    '- **Full-width lanes** under the transport.',
    '- **Lane reuse:** Song-mode lanes reuse the automation-lane components, with horizontal zoom.',
    '- **Collapse state:** persisted in project state.',
    '- **Collapsed center:** becomes a horizontally scrolling scene list in Song and Scene mode (GG-D049).',
    '- **Generic drag-number entry:** extract it from `src/ui/transport/BpmInput`, with a generic name (I\'d use `DragNumberInput`). Consumers: BPM, repeats (`playthroughInput`, `SceneControlsSetup.cpp:138-143`) and the time signature in place of its dropdown. Extraction goes first and preserves behavior.',
    '- **Two assumptions of mine:** I added bar count, and I assumed the time signature becomes two fields. You haven\'t confirmed either.',
    '- **Not on this bill:** Song writer slices 1–5 landed earlier (afb73cb6) and wait in review. Operators retrograde, augment, diminish, velocityAccent and ornament, JSON form templates, and Song-mode manual docs are unbuilt (GG-T158).',
  ].join('\n'),
  [
    '**What blocked it:**',
    '1. **Questionnaire hook (KIT-T846/KIT-T881).** It rejected my sign-off questionnaire about 12 times as "brief too thin". The cause was a matcher that wanted "because/since/which" on the same line as "recommend". The fix is committed (8a794b6, before runtime be7d13d). A regression comment at 18:20 says the hook still failed after the fix and printed `could not find /tmp`. I haven\'t verified which hook code runs now.',
    '2. **Foreign-edits guard (KIT-T407).** It blocks any writer dispatch here because `src/ui/modal/SettingsModal.{cpp,h}` are uncommitted. They\'re left over from the Settings audio-tab work and still dirty today. It will block the next dispatch too.',
    '3. **Me.** I asked for sign-off in prose three times (KIT-T880). I also told you the kit checkout had no writer. That was wrong: the guard caught a real stiletto-2349 writer, so KIT-T882 wasn\'t a scoping bug.',
  ].join('\n'),
  '**Not asked:** the zombie `doing` tickets (GG-T144/T147/T159), the review queue and the other kit tickets.',
].join('\n\n');

export const REAL_FIXED_BRIEF = [
  REAL_BRIEF,
  '**Decision:** whether you sign the Song-mode bill so one implementer starts now, and what to do with the uncommitted SettingsModal files, needed now because nothing has been built since Nov 7.',
  '**Options.** Sign all, in order: one implementer works the whole bill and hands back at each testable landing, which costs fewer pauses for your tests. Sign slice 1 only: it dispatches the grid bug and DragNumberInput, then stops, which leaves everything after it waiting on you. Edit the bill first: nothing starts until you change scope. Leave them, pass the token: I dispatch with the foreign-edits token and the agent stages only its own paths, which means those edits stay uncommitted. You commit them first: the tree is clean, but dispatch waits on you.',
  '**Recommendation:** Sign all, in order, and leave them, pass the token, because you dictated the bill and the commit hooks guard each landing.',
].join('\n\n');
