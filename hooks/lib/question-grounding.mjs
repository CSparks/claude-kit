// question-grounding — does a questionnaire option contradict or repeat something the project already recorded (KIT-T936)?
// Each option label is cut to word stems and compared with every decision and open ticket of the store. A document matches
// when it shares GROUNDED_MIN_SHARED stems with the label, GROUNDED_MIN_TITLE of them in its title. The best
// GROUNDED_PER_OPTION matches per option must be cited by id in the questionnaire text or the readable turn prose.
//
//   optionStems(label)                    -> Set of stems: words of GROUNDED_MIN_WORD letters or more, stopwords dropped, suffixes cut
//   groundingMisses(docs, questions, cited) -> [{ option, id, kind, title }] matches not named in `cited`

import { GROUNDED_MIN_SHARED, GROUNDED_MIN_TITLE, GROUNDED_MIN_WORD, GROUNDED_PER_OPTION, RECOMMENDED_MARKER } from './question-checks.mjs';
import { ID_CITE_SRC } from './ids.mjs';

const STOPWORDS = new Set([
  'about', 'across', 'after', 'again', 'also', 'avoid', 'both', 'build', 'change', 'check', 'create', 'defer', 'does', 'each', 'else', 'every',
  'from', 'have', 'here', 'instead', 'into', 'just', 'keep', 'later', 'leave', 'make', 'more', 'most', 'need', 'none', 'only', 'option', 'other',
  'over', 'proceed', 'rather', 'same', 'skip', 'some', 'than', 'that', 'them', 'then', 'this', 'those', 'until', 'using', 'wait', 'want', 'what',
  'when', 'which', 'while', 'will', 'with', 'without', 'would', 'your',
]);
const WORD = new RegExp(`[a-z]{${GROUNDED_MIN_WORD},}`, 'g');
const SUFFIX = /(?:ing|ed|es|s|e)$/;
const CITE = new RegExp(ID_CITE_SRC, 'g');

export const optionStems = (text) => new Set((String(text).toLowerCase().match(WORD) || []).filter((w) => !STOPWORDS.has(w)).map((w) => w.replace(SUFFIX, '')));

const labelOf = (option) => String(option?.label || '').replace(RECOMMENDED_MARKER, '').trim();
const overlap = (a, b) => [...a].filter((s) => b.has(s)).length;

function matchesFor(indexed, wanted) {
  return indexed
    .map((d) => ({ d, shared: overlap(wanted, d.allStems), inTitle: overlap(wanted, d.titleStems) }))
    .filter((m) => m.shared >= GROUNDED_MIN_SHARED && m.inTitle >= GROUNDED_MIN_TITLE)
    .sort((a, b) => b.inTitle - a.inTitle || b.shared - a.shared || b.d.id.localeCompare(a.d.id))
    .slice(0, GROUNDED_PER_OPTION)
    .map((m) => m.d);
}

export function groundingMisses(docs, questions, cited) {
  const named = new Set(String(cited).match(CITE) || []);
  const indexed = docs.map((d) => ({ ...d, titleStems: optionStems(d.title), allStems: optionStems(`${d.title} ${d.text}`) }));
  const misses = new Map();
  for (const q of Array.isArray(questions) ? questions : []) {
    for (const option of Array.isArray(q?.options) ? q.options : []) {
      const label = labelOf(option);
      const wanted = optionStems(label);
      if (wanted.size < GROUNDED_MIN_SHARED) continue;
      for (const d of matchesFor(indexed, wanted)) {
        if (!named.has(d.id) && !misses.has(d.id)) misses.set(d.id, { option: label, id: d.id, kind: d.kind, title: d.title });
      }
    }
  }
  return [...misses.values()];
}
