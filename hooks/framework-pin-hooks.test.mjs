// framework-pin-hooks.test.mjs — the pin block says in one line whether the framework submodule's pre-push gate is wired
// (KIT-T1300): a submodule tracking .githooks/pre-push with no core.hooksPath is flagged with the command that wires it, the
// same checkout once wired reports it, and a framework with no tracked hook says so. Report-only: nothing is set.
// Run: node hooks/framework-pin-hooks.test.mjs

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { frameworkPinReport } from './lib/framework-pin.mjs';
import { cleanup, commit, consumer, git, tmp, upstream, write } from './framework-pin-fixture.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('framework-pin-hooks');
const cache = tmp('kit-pin-hooks-cache-');
process.env.CLAUDE_KIT_CACHE_DIR = cache;
process.env.CLAUDE_KIT_REGISTRY = join(cache, 'projects.json');
write(cache, 'projects.json', JSON.stringify({ projects: {} }));

const report = (c) => {
  readdirSync(cache).filter((f) => f.startsWith('fetched-')).forEach((f) => rmSync(join(cache, f)));
  return frameworkPinReport(c.root, { fetch: false });
};
const hookLine = (text) => text.split('\n').find((l) => /pre-push gate/.test(l)) || '';

try {
  const plain = consumer(upstream());
  ok('a framework with no tracked pre-push says so on one line, no !!', hookLine(await report(plain)) === 'pre-push gate: none tracked');

  const up = upstream();
  commit(up, 'gate', { '.githooks/pre-push': '#!/bin/sh\nexit 0\n' });
  const gated = consumer(up);
  const text = await report(gated);
  ok('an unwired submodule is flagged !! with the command that wires it', /^!! pre-push gate NOT wired: \.githooks\/pre-push is tracked/.test(hookLine(text)) && /config core\.hooksPath \.githooks/.test(hookLine(text)), hookLine(text));
  ok('the report is one line for the gate', text.split('\n').filter((l) => /pre-push gate/.test(l)).length === 1);

  git(gated.sub, 'config', 'core.hooksPath', '.githooks');
  ok('the same checkout once wired reports it wired', hookLine(await report(gated)) === 'pre-push gate: wired');

  const outerWired = consumer(up);
  git(outerWired.root, 'config', 'core.hooksPath', '.githooks');
  ok('a wired outer repo does not wire its submodule: the submodule is judged by its own config', /NOT wired/.test(hookLine(await report(outerWired))));
} finally {
  cleanup();
}
done();
