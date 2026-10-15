// pin-stale.mjs — a landing `--pin` only moves a gitlink forward (KIT-T515). A pin that is not a
// descendant of (or equal to) the gitlink the superproject's HEAD records would commit the pointer
// backwards, erasing a newer pin; it is refused with both shas named.
//
//   stalePin(cfg, cwd, pin)   -> message | null    one pin ({ repo, path, sha }) against HEAD of `cwd`
//   stalePins(cfg, cwd, pins) -> message | null    the first stale pin of the list

import { join } from 'node:path';
import { git } from './git.mjs';

const short = (sha) => String(sha).slice(0, 10);
const posix = (p) => String(p).replace(/\\/g, '/');

export function stalePin(cfg, cwd, pin) {
  const recorded = git(['rev-parse', `HEAD:${posix(pin.path)}`], cwd).out;
  if (!recorded || recorded === pin.sha) return null;
  const subCwd = join(cfg.root, pin.path);
  const known = git(['cat-file', '-e', `${recorded}^{commit}`], subCwd).code === 0;
  if (!known) return `pin ${pin.repo}=${short(pin.sha)}: the recorded pin ${short(recorded)} is not a commit in ${pin.path}, so the pin cannot be shown to move forward; fetch it and resubmit`;
  if (git(['merge-base', '--is-ancestor', recorded, pin.sha], subCwd).code === 0) return null;
  return `stale pin ${pin.repo}=${short(pin.sha)}: HEAD already records ${short(recorded)} and ${short(pin.sha)} does not descend from it; a pin never moves ${pin.path} backwards or sideways. Resubmit with a pin that descends from ${short(recorded)}`;
}

export function stalePins(cfg, cwd, pins) {
  for (const pin of pins) {
    const stale = stalePin(cfg, cwd, pin);
    if (stale) return stale;
  }
  return null;
}
