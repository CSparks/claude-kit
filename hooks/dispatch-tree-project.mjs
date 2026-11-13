// dispatch-tree-project.mjs — the tree-project-dispatch check of the dispatch gate (KIT-T1114). A writer aimed with
// `[tree: X]` at ANOTHER registered project's checkout must cite a ticket of that project; otherwise the checkout is a
// scratch copy borrowed from the wrong project. A checkout inside the session's own (a submodule) and an unregistered
// path are never judged. Escape: the maintainer's quoted words, `[maintainer-asked-tree: <his words>]`.
//
//   TREE_PROJECT_CHECK                                         -> the check-id (ignore-file key)
//   treeProjectBlock({ root, input, prompt, readOnly, footer }) -> block message | null

import { declaredTreeRoot, sameTree } from './dispatch-target.mjs';
import { citedKeys } from './lib/commit-cite-keys.mjs';
import { readRegistry } from './lib/registry.mjs';
import { storeRoot } from './lib/paths.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { readIdConfig } from '../scripts/id-utils.mjs';

export const TREE_PROJECT_CHECK = 'tree-project-dispatch';

const slash = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const inside = (child, parent) => slash(child).startsWith(`${slash(parent)}/`);

function ownerOf(tree) {
  const projects = readRegistry().projects || {};
  const name = Object.keys(projects).find((n) => sameTree(projects[n], tree));
  if (!name) return null;
  const store = storeRoot(projects[name]);
  const key = store ? readIdConfig(store).key : '';
  return key ? { name, key } : null;
}

export function treeProjectBlock({ root, input, prompt, readOnly = false, footer }) {
  try {
    if (readOnly || TOKENS.maintainerTree.pattern.test(prompt)) return null;
    const tree = declaredTreeRoot(input);
    if (!tree || sameTree(tree, root) || inside(tree, root)) return null;
    const owner = ownerOf(tree);
    if (!owner || citedKeys(prompt).includes(owner.key)) return null;
    return [
      `BLOCKED: [tree: ${tree}] is the checkout of project ${owner.name}, and this brief cites no ${owner.key}- ticket (KIT-T1114).`,
      `  session project: ${root}`,
      '',
      "A writer in another project's checkout works on that project's ticket. Borrowing a game's checkout as a scratch copy of",
      'something else is refused.',
      '',
      `Fix: brief the work from a ticket of ${owner.name} (cite its ${owner.key}-T### id), or write in your own checkout.`,
      `Only on the maintainer's words: include ${TOKENS.maintainerTree.form} in the prompt.`,
      '',
      footer,
    ].join('\n');
  } catch {
    return null;
  }
}
