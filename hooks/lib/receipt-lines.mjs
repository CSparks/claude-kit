// The landing receipt's lines, shared by `t receipt` (scripts/t-receipt.mjs) and the landing-alert Stop block
// (hooks/land-alert.mjs), so the block text carries the same skeleton the command prints (KIT-T1144).
//
//   commitLine(root, commit) -> `  <sha> <subject> | <ticket ids or "no ticket cited"> | <push state>`
//   FILL_LINE                -> the one line the reply fills: a UAT step or `[no-test: <reason>]`

import { commitState } from './landed-commits.mjs';

const SUBJECT_MAX = 100;

export const FILL_LINE = 'UAT / no-test (fill one): <what the maintainer can try as a user, or [no-test: <reason>]>';

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function commitLine(root, c) {
  const tickets = c.ids.length ? c.ids.join(', ') : 'no ticket cited';
  return `  ${c.shortSha} ${clip(c.subject, SUBJECT_MAX)} | ${tickets} | ${commitState(root, c.sha)}`;
}
