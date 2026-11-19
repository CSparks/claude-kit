// difficulty.mjs — the dispatch difficulty rubric (KIT-T1414, KIT-D170) and the KIT-D169 ladder it maps to. A dispatch
// brief carries `[difficulty: <tier>; systems=N root=… proof=… ref=… coupling=… context=…]`; each field scores 0, 1 or
// 2, the sum names the tier and the tier names the family.
//
//   parseDifficulty(text)  -> null when the text carries no tag, else { tier, fields, scores, sum, impliedTier, family,
//                             problems: [why the tag does not hold together] }
//   assessedFamily(text)   -> the family a well-formed tag implies, or ''
//   splitReason(assessment, prompt) -> '' or why the brief must be split into one dispatch per concern
//   tierOfSum(sum)         -> automation | medium | very-hard | extreme
//   FAMILY_OF_TIER, DEFAULT_EFFORT, RUBRIC_LINES, EXAMPLE_TAG

export const TIERS = ['automation', 'medium', 'very-hard', 'extreme'];
export const FAMILY_OF_TIER = { automation: 'haiku', medium: 'sonnet', 'very-hard': 'opus', extreme: 'fable' };
// Each family's default effort per Anthropic's models overview, used when the job row names another family.
export const DEFAULT_EFFORT = { haiku: 'low', sonnet: 'high', opus: 'medium', fable: 'high' };
// Upper bound of each tier's sum (0 to 12): 0-1 automation, 2-5 medium, 6-8 very hard, 9-12 extreme.
const TIER_TOPS = [['automation', 1], ['medium', 5], ['very-hard', 8], ['extreme', 12]];

// field -> { value -> score }; `systems` takes a count.
const FIELDS = {
  root: { known: 0, area: 1, unknown: 2 },
  proof: { numeric: 0, mixed: 1, judgement: 2 },
  ref: { yes: 0, partial: 1, no: 2 },
  coupling: { own: 0, shared: 1, global: 2 },
  context: { s: 0, m: 1, l: 2 },
};
const FIELD_NAMES = ['systems', ...Object.keys(FIELDS)];
const SYSTEMS_SCORE = (n) => (n <= 1 ? 0 : n <= 3 ? 1 : 2);
const MAX_SCORE = 2;
const TAG = /\[difficulty:\s*([^\]]*)\]/i;
const CONCERNS_LINE = /^\s*(?:concerns?|parts?)\s*:/im;
const MANY_CONCERNS = 2;

export const RUBRIC_LINES = [
  'Difficulty rubric (KIT-T1414): score each field 0, 1 or 2 and add them up.',
  '  systems=N        crates or systems touched: 1 = 0, 2-3 = 1, 4 or more or cross-repo = 2',
  '  root=known|area|unknown          cause known and named = 0, to find in a known area = 1, unknown or global = 2',
  '  proof=numeric|mixed|judgement    a number or a test proves it = 0, mixed = 1, judgement only (visual, design) = 2',
  '  ref=yes|partial|no               a reference or spec exists = 0, partial = 1, none (novel) = 2',
  '  coupling=own|shared|global       own files only = 0, files shared with live writers = 1, global or cross-session = 2',
  '  context=s|m|l                    under 50k tokens = 0, 50k-200k = 1, over 200k = 2',
  'Sum 0-1 automation (haiku, non-judgement work only), 2-5 medium (sonnet), 6-8 very-hard (opus), 9-12 extreme (fable) (KIT-D169).',
  'Split first: systems scoring 2 together with context=l, or a brief with two or more independent concerns, is one dispatch per concern.',
];
export const EXAMPLE_TAG = '[difficulty: medium; systems=2 root=area proof=numeric ref=yes coupling=own context=m]';

export function tierOfSum(sum) {
  return (TIER_TOPS.find(([, top]) => sum <= top) || TIER_TOPS[TIER_TOPS.length - 1])[0];
}

export function parseDifficulty(text) {
  const m = TAG.exec(String(text || ''));
  if (!m) return null;
  const [tierPart, scorePart = ''] = m[1].split(';');
  const tier = tierPart.trim().toLowerCase();
  const fields = Object.fromEntries([...scorePart.matchAll(/([a-z]+)\s*=\s*([\w-]+)/gi)].map(([, k, v]) => [k.toLowerCase(), v.toLowerCase()]));
  const problems = [];
  if (!TIERS.includes(tier)) problems.push(`tier "${tier || '(none)'}" is not one of ${TIERS.join(', ')}`);
  const scores = {};
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (value === undefined) { problems.push(`${name}= is missing`); continue; }
    if (name === 'systems') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) problems.push(`systems=${value} is not a count of 1 or more`); else scores.systems = SYSTEMS_SCORE(n);
      continue;
    }
    if (!(value in FIELDS[name])) problems.push(`${name}=${value} is not one of ${Object.keys(FIELDS[name]).join('|')}`); else scores[name] = FIELDS[name][value];
  }
  const sum = Object.values(scores).reduce((a, b) => a + b, 0);
  const complete = Object.keys(scores).length === FIELD_NAMES.length;
  const impliedTier = complete ? tierOfSum(sum) : '';
  if (complete && TIERS.includes(tier) && impliedTier !== tier) problems.push(`the scores sum to ${sum}, which is ${impliedTier}, not ${tier}`);
  return { tier, fields, scores, sum, impliedTier, family: FAMILY_OF_TIER[impliedTier] || '', problems };
}

export function assessedFamily(text) {
  const a = parseDifficulty(text);
  return a && !a.problems.length ? a.family : '';
}

export function splitReason(assessment, prompt = '') {
  if (!assessment) return '';
  if (assessment.scores.systems === MAX_SCORE && assessment.scores.context === MAX_SCORE) return 'it touches four or more systems with an over-200k context';
  const listed = CONCERNS_LINE.exec(String(prompt));
  if (!listed) return '';
  const tail = String(prompt).slice(listed.index).split('\n').slice(1).filter((l) => /^\s*(?:[-*]|\d+[.)])\s+\S/.test(l));
  return tail.length >= MANY_CONCERNS ? `it lists ${tail.length} independent concerns` : '';
}
