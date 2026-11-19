// generic-stems — the engineering verbs and nouns that never count as shared words between a questionnaire and a recorded
// decision or ticket (KIT-T1431). The questionnaire matchers (question-grounding.mjs, question-clause-grounding.mjs) drop
// them from every stem set, so they neither score nor weigh a rarity: a store full of "check", "run" and "time" says nothing
// about which decision a question restates. The entries are stems as optionStems cuts them (time -> tim, usage -> usag).
//
//   GENERIC_STEMS -> Set of stems

export const GENERIC_STEMS = new Set([
  'check', 'run', 'runn', 'work', 'open', 'road', 'agent', 'fix', 'test', 'several', 'parallel', 'point', 'tim', 'usag', 'onc',
  'fram', 'perform', 'performanc', 'file', 'item', 'step', 'case', 'part', 'rule', 'list', 'name', 'tool', 'thing',
  'long', 'full', 'good', 'whole', 'start', 'stop', 'land', 'must', 'never', 'always', 'already',
]);
