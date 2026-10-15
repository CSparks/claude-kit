// runtime-swap.mjs — should an idle daemon move onto a newly published runtime? (KIT-T500)
// A daemon runs from `<runtime>/<sha>/`; `npm run publish:runtime` repoints `<runtime>/current`.
//
// `publishedSwap({ own, current })` → the new sha when `current` resolves to a sha dir other than
//   `own` (this daemon's runtime tag), else null. A daemon running from a checkout (`own` 'repo')
//   never swaps. The daemon calls it between drains, so a running job always finishes on its runtime.

import { realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { runtimeCurrent } from '../runtime-path.mjs';
import { runtimeTag } from '../runtime-pin.mjs';

const SHA_DIR = /^[0-9a-f]{7,40}$/;

export function publishedSwap({ own = runtimeTag(), current = runtimeCurrent() } = {}) {
  if (!current || !SHA_DIR.test(own)) return null;
  let sha;
  try { sha = basename(realpathSync(current)); } catch { return null; }
  return SHA_DIR.test(sha) && sha !== own ? sha : null;
}
