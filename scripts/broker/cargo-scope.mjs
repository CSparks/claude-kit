// cargo-scope.mjs — a broker serves a Cargo workspace only (KIT-D097). A checkout with a `broker:`
// block but no tracked Cargo.toml is refused: nothing there shares a long compiled build dir.
//
// `cargoScopeRefusal(root, env)` → null when `root` tracks a Cargo.toml, else the one-line refusal.
//   BROKER_ALLOW_NON_CARGO=1 in `env` lifts it (the cargo-free test fixtures).

import { git } from './git.mjs';

export const hasTrackedCargo = (root) => {
  const listed = git(['ls-files', '-z', '--', 'Cargo.toml', '**/Cargo.toml'], root);
  return listed.code === 0 && listed.out.length > 0;
};

export function cargoScopeRefusal(root, env = process.env) {
  if (env.BROKER_ALLOW_NON_CARGO || hasTrackedCargo(root)) return null;
  return `no tracked Cargo.toml in ${root}: the broker serves Cargo workspaces only (KIT-D097)`;
}
