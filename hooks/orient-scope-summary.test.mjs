// orient-scope-summary: the "by scope" line of orient's Open work section holds a fixed length as the registered projects
// (and so the scopes) grow: the largest scopes are listed, the rest fold into one "+N more scopes" tail.
// Run: node hooks/orient-scope-summary.test.mjs

import { SCOPES_SHOWN, scopeSummary } from './lib/orient/scope-summary.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('orient-scope-summary');
const scopes = (n) => new Map(Array.from({ length: n }, (_, i) => [`S${String(i).padStart(3, '0')}`, n - i]));
const LINE_MAX_CHARS = 120;

ok('a few scopes are all listed, largest first', scopeSummary(new Map([['T', 2], ['KIT', 837]])) === 'KIT:837  T:2');
ok('ties list by name', scopeSummary(new Map([['B', 3], ['A', 3]])) === 'A:3  B:3');
ok('exactly the cap lists every scope with no tail', !scopeSummary(scopes(SCOPES_SHOWN)).includes('more'));
ok('one past the cap folds into a tail naming the count and the open total', scopeSummary(scopes(SCOPES_SHOWN + 1)).endsWith('+1 more scopes (1 open)'));
ok('an empty registry lists nothing', scopeSummary(new Map()) === '');

const lengths = [10, 50, 200, 1000].map((n) => scopeSummary(scopes(n)).length);
ok(`the line holds as scopes grow: ${lengths.join(', ')} chars`, Math.max(...lengths) <= LINE_MAX_CHARS);
ok('the folded total counts every hidden scope', scopeSummary(scopes(50)).includes(`+${50 - SCOPES_SHOWN} more scopes (`));

done();
