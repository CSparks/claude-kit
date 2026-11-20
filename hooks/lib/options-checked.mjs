// options-checked.mjs — the author's assertion about the recorded decisions behind a questionnaire (KIT-T1451).
//   [options-checked: none apply: <why>]                                    no recorded decision touches the options
//   [options-checked: <ids> govern this; no other recorded decision applies] the listed ids govern them; the other matches are loose words
// The tag text is the author's own claim: it never counts as questionnaire text (a quoted loose match must not re-trigger the
// decision it quotes), and its ids are neither "cited as governing" nor in need of a plain-words description.
//
//   stripOptionsChecked(text)   -> the text with every [options-checked: ...] tag cut
//   taggedIds(text)             -> the decision, ticket and question ids named inside the tags
//   assertedGoverning(text, liveIds) -> the tagged ids the store holds in force, [] when the tag names none (the tag then clears nothing)

import { ID_CITE_SRC } from './ids.mjs';

const TAG = /\[options-checked:[^\]]*\]/gi;
const ID = new RegExp(ID_CITE_SRC, 'g');

export const stripOptionsChecked = (text) => String(text ?? '').replace(TAG, ' ');

export const taggedIds = (text) => [...new Set((String(text ?? '').match(TAG) || []).flatMap((tag) => tag.match(ID) || []))];

export const assertedGoverning = (text, liveIds) => taggedIds(text).filter((id) => liveIds.has(id));
