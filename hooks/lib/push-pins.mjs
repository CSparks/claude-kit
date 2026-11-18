// push-pins.mjs — a superproject push publishes no pointer to a submodule commit its remote lacks (KIT-T1363): a clone
// would then fail to check the submodule out. A pointer is pushed when a remote-tracking branch of the checked-out
// submodule contains the commit HEAD records.
//
//   unpushedPins(top) -> [{ path, sha }] gitlinks of HEAD whose commit no remote-tracking branch of the submodule contains;
//                        a submodule that is not checked out, or has no remote, cannot be judged and is skipped
//   unpushedPinMessage(top, pins, footer) -> the block message, naming the submodule push to do first

import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { gitlinkPaths, treePin, worktreePin } from './gitlinks.mjs';

const SHORT = 8;

export function unpushedPins(top) {
  return gitlinkPaths(top).flatMap((path) => {
    const sha = treePin(top, 'HEAD', path);
    const dir = join(top, path);
    if (!sha || !worktreePin(top, path) || !gitTry(['remote'], dir).out.trim()) return [];
    const found = gitTry(['branch', '-r', '--contains', sha], dir);
    return found.ok && found.out.trim() ? [] : [{ path, sha }];
  });
}

export function unpushedPinMessage(top, pins, footer) {
  return [
    '',
    `BLOCKED: this push publishes ${pins.length} submodule pointer(s) to a commit the submodule's remote does not have (KIT-T1363).`,
    '',
    ...pins.map((p) => `  ${p.path} -> ${p.sha.slice(0, SHORT)} (${p.sha}): on no remote-tracking branch of ${p.path}`),
    '',
    'A clone of this push could not check the submodule out. Push the submodule first, then this:',
    ...pins.map((p) => `  git -C "${join(top, p.path).replace(/\\/g, '/')}" push origin <the branch that holds ${p.sha.slice(0, SHORT)}>`),
    'If it was pushed from another checkout, fetch in the submodule so its remote-tracking branches show it.',
    '',
    footer,
  ].join('\n');
}
