// root-map.mjs — `--root` may name a submodule checkout (KIT-T528). The submodule's jobs, results
// and daemon live in its lane under the PARENT's target/broker (KIT-D096); the submodule's own
// target/broker holds nothing. `mapSubmoduleRoot(root)` → { root, lane } with the parent checkout
// and the submodule repo name when an ancestor's broker config declares `root` a submodule repo,
// else { root, lane: null }.

import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readBrokerConfig } from './config.mjs';

const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

export function mapSubmoduleRoot(root) {
  for (let dir = dirname(resolve(root)); dir !== dirname(dir); dir = dirname(dir)) {
    if (!existsSync(resolve(dir, '.ai', 'config.yml'))) continue;
    const cfg = readBrokerConfig(dir);
    const sub = cfg.repos.find((r) => r.submodule && same(resolve(dir, r.path), root));
    if (sub) return { root: dir, lane: sub.name };
  }
  return { root: resolve(root), lane: null };
}
