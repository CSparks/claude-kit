// push-drift.mjs — a superproject push is refused while a checked-out submodule is not at the commit HEAD records (KIT-T1447).
// The pushed commit then carries code written against a submodule state its pointer does not name (or names without the
// submodule's unpushed work), so a clean clone cannot build it. Order to follow: submodule first, then the pin commit, then this push.
//
//   submoduleDrift(top) -> [{ path, recorded, current, branch, onRemote, behind }] one per checked-out submodule with a remote whose
//                          HEAD differs from the commit HEAD of `top` records (a staged but uncommitted pin counts); a submodule that
//                          is not checked out, has no remote, or is new in the index cannot be judged and is skipped
//   driftMessage(top, drifts, footer) -> the block message, naming the exact steps in order

import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { gitlinkPaths, treePin, worktreePin } from './gitlinks.mjs';

const SHORT = 8;
const fwd = (p) => p.replace(/\\/g, '/');

export function submoduleDrift(top) {
  return gitlinkPaths(top).flatMap((path) => {
    const recorded = treePin(top, 'HEAD', path);
    const current = worktreePin(top, path);
    const dir = join(top, path);
    if (!recorded || !current || recorded === current || !gitTry(['remote'], dir).out.trim()) return [];
    const found = gitTry(['branch', '-r', '--contains', current], dir);
    const behind = gitTry(['merge-base', '--is-ancestor', current, recorded], dir).ok;
    const branch = gitTry(['branch', '--show-current'], dir).out.trim();
    return [{ path, recorded, current, branch, onRemote: found.ok && !!found.out.trim(), behind }];
  });
}

const state = (d) => (d.behind
  ? 'checked out BEHIND the recorded commit'
  : d.onRemote ? 'checked out at a pushed commit the pointer does not name' : 'checked out at a commit on no remote-tracking branch (unpushed work)');

function steps(top, d) {
  const sub = fwd(join(top, d.path));
  const short = d.current.slice(0, SHORT);
  if (d.behind) {
    return [`  - restore the recorded state: git -C "${fwd(top)}" submodule update -- ${d.path}`, `    (or, if the older checkout is intended, commit the pin to ${short} as in step 2 below)`];
  }
  return [
    ...(d.onRemote ? [] : [`  1. push the submodule first, the exact commit: git -C "${sub}" push origin ${d.current}:${d.branch || '<branch>'}   (${short})`]),
    `  ${d.onRemote ? '1' : '2'}. commit the pin: git -C "${fwd(top)}" add -- ${d.path} && git -C "${fwd(top)}" commit -m "Pin ${d.path} to ${short}: <ticket>" -- ${d.path}`,
  ];
}

export function driftMessage(top, drifts, footer) {
  return [
    '',
    `BLOCKED: this push leaves ${drifts.length} submodule pointer(s) out of step with their checkouts (KIT-T1447).`,
    '',
    ...drifts.flatMap((d) => [`  ${d.path}: HEAD records ${d.recorded.slice(0, SHORT)} (${d.recorded}), ${state(d)} ${d.current.slice(0, SHORT)} (${d.current})`]),
    '',
    'Code pushed now was written against the checkout, not the recorded pointer; a clean clone cannot build it. In this order:',
    ...drifts.flatMap((d) => steps(top, d)),
    '  then push this repo again.',
    '',
    footer,
  ].join('\n');
}
