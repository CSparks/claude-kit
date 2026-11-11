// t/regression-links.mjs — `t new regression` must name what it regressed and the commit that did it.
// A regression filed without both links is caught only at Stop by the sync-data integrity check; this
// refuses at creation, before an id is minted.
//
//   regressionLinks(type, flags)          -> null (any other type) | { regressedFrom, causingCommit }; throws naming the missing flags
//   applyRegressionLinks(root, id, links) -> writes both links onto the new ticket

import { checkLinkTarget, link } from './link.mjs';

const REGRESSION_TYPE = 'regression';
const FLAGS = [
  { key: 'regressedFrom', flag: '--regressed-from <original ticket id>', rel: 'regressed_from' },
  { key: 'causingCommit', flag: '--causing-commit <sha>', rel: 'causing_commit' },
];

export function regressionLinks(type, flags) {
  if (type !== REGRESSION_TYPE) return null;
  const missing = FLAGS.filter(({ key }) => !flags[key]).map(({ flag }) => flag);
  if (missing.length) throw new Error(`t new ${REGRESSION_TYPE}: requires ${missing.join(' and ')}`);
  for (const { key, rel } of FLAGS) checkLinkTarget(rel, flags[key]);
  return { regressedFrom: flags.regressedFrom, causingCommit: flags.causingCommit };
}

export function applyRegressionLinks(root, id, links) {
  for (const { key, rel } of FLAGS) link(root, id, rel, links[key]);
}
