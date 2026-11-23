#!/usr/bin/env node
// dispatch-compile-state.test.mjs — the dispatch-compile-state warning (KIT-T1510): a writer brief into a Cargo checkout with
// another live writer that names no compile state draws a NOTE; naming cargo check or compiling, a lone writer, a read-only
// agent, a repo with no Cargo.toml and the ignore file draw none. A warning only, never a block of its own.
// Run: node hooks/dispatch-compile-state.test.mjs

import { execFileSync } from 'node:child_process';
import { COMPILE_STATE_CHECK, compileStateWarning } from './dispatch-compile-state.mjs';
import { expect, finish, ignoreFile, inFlightRow, makeRepo, roster, run } from './dispatch-guard-harness.mjs';

const cargoRepo = ({ live = true, ignore = false } = {}) => {
  const dir = makeRepo({ cargo: true });
  execFileSync('git', ['add', 'Cargo.toml'], { cwd: dir });
  if (live) roster(dir, [inFlightRow()]);
  return ignore ? ignoreFile(dir, COMPILE_STATE_CHECK) : dir;
};
const send = (dir, prompt, type = 'general-purpose') => run(dir, { subagent_type: type, model: 'opus', prompt: `${prompt} [paths: crates/a]` });
const noted = (dir, prompt, type) => (send(dir, prompt, type).err.includes('KIT-T1510') ? 1 : 0);

const BRIEF = 'Rename the menu enum variant and update the callers.';
expect('a writer brief with another live writer and no compile state draws the note', noted(cargoRepo(), BRIEF), 1);
expect('the note alone does not block: its brief exits 0', send(cargoRepo(), BRIEF).code, 0);
expect('a brief naming cargo check carries the rule', noted(cargoRepo(), `${BRIEF} Verify with cargo check -p rg-menu.`), 0);
expect('a brief naming compiling carries the rule', noted(cargoRepo(), `${BRIEF} End with the crates compiling.`), 0);
expect('a lone writer is not judged', noted(cargoRepo({ live: false }), BRIEF), 0);
expect('a read-only agent is not judged', noted(cargoRepo(), BRIEF, 'claude-kit:analyst'), 0);
expect('a repo with no Cargo.toml is not judged', noted((() => { const d = makeRepo(); roster(d, [inFlightRow()]); return d; })(), BRIEF), 0);
expect('the ignore file lifts the note', noted(cargoRepo({ ignore: true }), BRIEF), 0);
expect('the unit check: no live writers means no note', compileStateWarning({ root: cargoRepo(), input: {}, prompt: BRIEF, liveWriters: 0 }) === '' ? 1 : 0, 1);

finish();
