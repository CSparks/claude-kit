// framework-pin/consumers.mjs — the pins the OTHER registered consumers of a framework record, from a local
// rev-parse only (no fetch). One compact line tells a session whether its neighbours moved ahead.
//
//   otherConsumerPins(root, framework) -> [{ name, sha }]   registry order; a project without the submodule checked out is skipped

import { resolve } from 'node:path';
import { frameworksFor } from '../frameworks.mjs';
import { readRegistry } from '../registry.mjs';
import { gitlinkOf, submodulePath } from './submodule.mjs';

const SAME = (a, b) => resolve(a).replace(/\\/g, '/').toLowerCase() === resolve(b).replace(/\\/g, '/').toLowerCase();

export function otherConsumerPins(root, framework) {
  const out = [];
  for (const [name, path] of Object.entries(readRegistry().projects)) {
    if (!path || SAME(path, root)) continue;
    const uses = frameworksFor(path).find((f) => f.name === framework.name);
    const sub = uses && submodulePath(path, uses);
    const sha = sub && gitlinkOf(path, sub);
    if (sha) out.push({ name, sha });
  }
  return out;
}
