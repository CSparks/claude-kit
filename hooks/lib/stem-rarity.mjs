// stem-rarity — how rare each word stem is across the documents of a store, defined once for the questionnaire matchers
// (question-grounding.mjs, question-clause-grounding.mjs). A stem's document frequency counts the stem sets that hold it.
//
//   stemRarity(stemSets, { share, minDf }) -> { weight(stem), isRare(stem) }
//     weight: ln(1 + sets / df) / ln(1 + sets): 1 for a stem in one set, near 0 for one in all, so a score reads the same in a
//             small and a large store.
//     isRare: df <= max(minDf, floor(sets * share)); a stem no set holds counts as rare.

export function stemRarity(stemSets, { share, minDf }) {
  const df = new Map();
  for (const set of stemSets) for (const s of set) df.set(s, (df.get(s) || 0) + 1);
  const rareMaxDf = Math.max(minDf, Math.floor(stemSets.length * share));
  const top = Math.log(1 + stemSets.length);
  return {
    weight: (s) => Math.log(1 + stemSets.length / (df.get(s) || 1)) / top,
    isRare: (s) => (df.get(s) || 0) <= rareMaxDf,
  };
}
