// What the retrieval gate's store rule needs to tell a SEARCH of the .ai item store from a plain read
// of one file (KIT-T871, KIT-D134). A glob is never "one named file"; a pattern-searching verb on an
// item file is a search whatever the file count; a bare line-range `sed -n 1,40p` is a read.

import { ID_CITE_SRC } from './ids.mjs';

const GLOB_CHARS = /[*?[\]{}]/;
const ITEM_PATH = /(?:^|[\\/])(?:tickets|decisions|inbox|questions|notes)[\\/]/i;
const ITEM_ID = new RegExp(ID_CITE_SRC.replace(/\\d\{1,4\}/, '\\d+'));
const SED_RANGE_SCRIPT = /^\$?\d*(?:,[+$]?\d+)?[pq]?$/;
const GREP_FAMILY = /^(?:grep|egrep|fgrep|rg|ag|ack|findstr|select-string|sls)$/;
const unquote = (a) => a.replace(/^["']|["']$/g, '');

export const hasGlob = (arg) => GLOB_CHARS.test(arg);
export const isItemPath = (arg) => ITEM_PATH.test(arg);

/** True when the verb searches by pattern: the grep family, awk, and any sed whose script is not a bare line range. */
export function isPatternSearch(tool, args, gitGrep = false) {
  if (gitGrep || GREP_FAMILY.test(tool) || tool === 'awk') return true;
  if (tool !== 'sed') return false;
  const positionals = args.filter((a) => !a.startsWith('-')).map(unquote);
  return !SED_RANGE_SCRIPT.test(positionals[0] || '');
}

/** The exact `q` call that replaces a search of the item at `path`: show by id, the inbox listing, else null. */
export function itemEquivalent(path, qPath) {
  const p = unquote(path);
  if (/(?:^|[\\/])inbox[\\/]/i.test(p)) return `node "${qPath}" inbox`;
  const id = (p.replace(/.*[\\/]/, '').match(ITEM_ID) || [])[0];
  return id ? `node "${qPath}" show ${id}` : null;
}
