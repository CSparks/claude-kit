// composed-claude (KIT-T1463): the composed global instructions file carries a hash of the sources it was built from;
// orient warns on its first line when the file is older than the sources, so a committed rule cannot silently fail to load.
// Run: node scripts/composed-claude.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adopted, cleanup, hook, reporter, tmpDir } from '../hooks/test-harness.mjs';
import { composedState, orientWarning, sourceHash, stampLine, staleWarning } from './composed-claude.mjs';
import { RULE_BLOCK_TITLE } from '../hooks/lib/rule-block.mjs';

const { ok, done } = reporter('composed-claude');
const KIT = fileURLToPath(new URL('..', import.meta.url));
const WARNING_PREFIX = '!! GLOBAL INSTRUCTIONS OUT OF DATE';

function fixture(baseText, overlayText) {
  const kit = tmpDir('cc-kit-');
  const home = tmpDir('cc-home-');
  mkdirSync(join(kit, 'user-config'), { recursive: true });
  writeFileSync(join(kit, 'user-config', 'CLAUDE.global.md'), baseText);
  const priv = join(home, 'private');
  mkdirSync(priv, { recursive: true });
  if (overlayText !== undefined) writeFileSync(join(priv, 'CLAUDE.md'), overlayText);
  return { kit, home, priv };
}
const compose = (home, base, overlay) => writeFileSync(join(home, 'CLAUDE.md'), `<!-- GENERATED -->\n${stampLine(sourceHash(base, overlay))}\n\n${base}\n${overlay}`);
const state = ({ kit, home, priv }) => composedState({ claudeHome: home, kitRoot: kit, privDir: priv }).state;

try {
  ok('the hash changes with the base and with the overlay', sourceHash('a', 'b') !== sourceHash('a2', 'b') && sourceHash('a', 'b') !== sourceHash('a', 'b2') && sourceHash('ab', '') !== sourceHash('a', 'b'));

  const f = fixture('base v1\n', 'overlay v1\n');
  ok('no composed file is not stale', state(f) === 'missing');
  compose(f.home, 'base v1\n', 'overlay v1\n');
  ok('a file composed from the current sources is fresh', state(f) === 'fresh' && staleWarning({ claudeHome: f.home, kitRoot: f.kit, privDir: f.priv }) === '');
  writeFileSync(join(f.kit, 'user-config', 'CLAUDE.global.md'), 'base v2\n');
  ok('a base edited after composing is stale', state(f) === 'stale');
  const warning = staleWarning({ claudeHome: f.home, kitRoot: f.kit, privDir: f.priv });
  ok('the warning names the file, the bootstrap command and the restart', warning.startsWith(WARNING_PREFIX) && warning.includes('bootstrap.mjs') && warning.includes('restart the session') && !warning.includes('\n'));
  compose(f.home, 'base v2\n', 'overlay v1\n');
  writeFileSync(join(f.priv, 'CLAUDE.md'), 'overlay v2\n');
  ok('an overlay edited after composing is stale', state(f) === 'stale');
  writeFileSync(join(f.home, 'CLAUDE.md'), 'a hand-made file with no stamp\n');
  ok('a composed file with no stamp is flagged', state(f) === 'unstamped');
  ok('a kit with no base source is never judged', composedState({ claudeHome: f.home, kitRoot: tmpDir('cc-empty-'), privDir: f.priv }).state === 'no-source');
  ok('bootstrap writes the stamp of the base and overlay text it composes', /stampLine\(sourceHash\(baseText, privText\)\)/.test(readFileSync(join(KIT, 'bootstrap.mjs'), 'utf8')));

  const repo = adopted(false);
  const emptyPriv = tmpDir('cc-nopriv-');
  const realBase = readFileSync(join(KIT, 'user-config', 'CLAUDE.global.md'), 'utf8');
  const home = tmpDir('cc-orient-home-');
  const env = { CLAUDE_HOME: home, CLAUDE_KIT_PRIVATE: emptyPriv };
  writeFileSync(join(home, 'CLAUDE.md'), `${stampLine(sourceHash('an older base', ''))}\n${realBase}`);
  const stale = hook('orient.mjs', {}, repo, env);
  ok('orient prints the out-of-date warning as its first line, above the rules block', stale.out.startsWith(WARNING_PREFIX) && stale.out.indexOf(RULE_BLOCK_TITLE) > 0);
  writeFileSync(join(home, 'CLAUDE.md'), `${stampLine(sourceHash(realBase, ''))}\n${realBase}`);
  const fresh = hook('orient.mjs', {}, repo, env);
  ok('orient prints no warning when the composed file matches the sources: the rules block is first', fresh.out.startsWith(RULE_BLOCK_TITLE) && !fresh.out.includes(WARNING_PREFIX));
  ok('orientWarning reads this machine without throwing', typeof orientWarning() === 'string');
} finally {
  cleanup();
}
done();
