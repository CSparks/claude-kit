// superseded-decisions.mjs — which decisions another decision replaced (KIT-T1451). A decision names what it replaces in its
// `supersedes:` field or, as the store's decisions often do, in its title or summary ("... (supersedes RDG-D071)"). The
// questionnaire gates never match a replaced decision: citing it would send the maintainer back to a ruling he overturned.
//
//   supersededIds(texts)     -> Set of decision ids that some decision of `texts` (whole decision files) supersedes
//   retiredStatus(status)    -> true for a decision status that takes it out of force

import { field, frontmatterBlock } from '../../scripts/frontmatter.mjs';
import { ID_CITE_SRC } from './ids.mjs';

const RETIRED = new Set(['superseded', 'rejected', 'retired', 'reversed', 'withdrawn']);
const ID = new RegExp(ID_CITE_SRC, 'g');
const SUPERSEDES_PHRASE = new RegExp(`\\bsupersed(?:es|ing)\\s+((?:${ID_CITE_SRC})(?:\\s*(?:,|/|and|&)\\s*(?:${ID_CITE_SRC}))*)`, 'gi');

export const retiredStatus = (status) => RETIRED.has(String(status || '').trim().toLowerCase());

export function supersededIds(texts) {
  const out = new Set();
  for (const text of texts) {
    const meta = frontmatterBlock(String(text).replace(/\r\n/g, '\n'));
    for (const id of String(field(meta, 'supersedes') || '').match(ID) || []) out.add(id);
    for (const key of ['title', 'summary']) {
      for (const phrase of String(field(meta, key) || '').matchAll(SUPERSEDES_PHRASE)) for (const id of phrase[1].match(ID) || []) out.add(id);
    }
  }
  return out;
}
