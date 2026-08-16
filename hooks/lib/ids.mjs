// The id-citation atom (<KEY>-<T|D|N|Q|R|E><num>). commit-gate and request-gate previously
// disagreed ([TDNQ]\d+ vs [A-Z]\d{1,4}) so a cite could satisfy one gate and not the
// other; both now build their regexes from this source (KIT-T059). R(equest)/E(pic) added
// with the domain model (KIT-T092) so commits/lints/land-alert recognize HOD-R###/E### ids.
// The KEY accepts digits after its first letter (S2-T001), matching the key grammar in
// scripts/id-utils.mjs.
export const ID_CITE_SRC = String.raw`[A-Z][A-Z0-9]+-[TDNQRE]\d{1,4}`;
