// t/id-store.mjs — the store a `t` verb acts in when its id belongs to the framework (KIT-T1443).
//
// A game session carries framework tickets (RG-T390) as work it must annotate, yet its own store has no such item. A verb
// that names an id of the framework store, run from a game that consumes the framework, acts in the framework store.
// Every other id keeps the resolved store, so an unknown id still fails there and no game writes into another game's store.
//
//   ID_VERBS                       the verbs whose first argument is an existing item id
//   idKey(token) -> string         the project key of an id (`RG-T390`, `RG-T390#2` -> `RG`), '' when it is no id
//   storeRootForId(root, id) -> root   the framework store root when `id` carries the framework's key and `root` does not

import { readIdConfig } from '../id-utils.mjs';
import { projectStoreRoot } from '../../hooks/lib/framework-store.mjs';
import { consumesFramework, FRAMEWORK_PROJECT } from '../../hooks/lib/framework-scope.mjs';

export const ID_VERBS = new Set(['notes', 'edit', 'status', 'tick', 'untick', 'criterion', 'link', 'unlink', 'comment', 'ack', 'asked', 'ask', 'resolve', 'revise']);

const KEYED_ID = /^([A-Za-z][A-Za-z0-9]*)-[A-Za-z]?\d+/;

export const idKey = (token) => String(token ?? '').match(KEYED_ID)?.[1] ?? '';

export function storeRootForId(root, id) {
  const key = idKey(id);
  if (!key || readIdConfig(root).key === key || !consumesFramework(root)) return root;
  const framework = projectStoreRoot(FRAMEWORK_PROJECT);
  return framework && readIdConfig(framework).key === key ? framework : root;
}
