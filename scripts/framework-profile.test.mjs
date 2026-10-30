// framework-profile.test.mjs — the orient flags for a rapid-game project without the dev fast tier or the conformance wiring (KIT-T690).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { conformanceUnwired, fastTierMissing, profileBlock } from './framework-profile.mjs';
import { concernBlock } from './concern-check.mjs';

const STUB = `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const missingFastTier = (root) =>
  ['rg-a', 'rg-b'].filter((n) => !readFileSync(join(root, 'Cargo.toml'), 'utf8').includes('"' + n + '"'));
`;

function project({ cargo = '[workspace]\n', script = STUB, config = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fp-'));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  if (cargo !== null) put('Cargo.toml', cargo);
  if (script !== null) put('fw/scripts/dev-profile.mjs', script);
  if (config !== null) put('.ai/config.yml', config);
  return { root, frameworks: () => [{ name: 'fw', dir: join(root, 'fw') }], done: () => rmSync(root, { recursive: true, force: true }) };
}
const fastTier = (...names) => `[workspace]\n${names.map((n) => `[profile.dev.package."${n}"]\nopt-level = 1\n`).join('')}`;
const named = (conformance) => () => [{ name: 'fw', conformance }];

test('a game whose Cargo.toml lacks the fast tier is flagged with the missing crates and the fix', async () => {
  const p = project();
  try {
    const block = await profileBlock(p.root, { frameworks: p.frameworks, named: () => [] });
    assert.match(block[0], /FRAMEWORK DEV PROFILE/);
    assert.match(block[1], /fw: 2 missing: rg-a rg-b/);
    assert.match(block[2], /dev-profile\.mjs \. --write/);
  } finally { p.done(); }
});

test('negative controls: a covered profile, no Cargo.toml and no framework script flag nothing; a partial profile lists only the gap', async () => {
  const covered = project({ cargo: fastTier('rg-a', 'rg-b') });
  const noCargo = project({ cargo: null });
  const noScript = project({ script: null });
  const partial = project({ cargo: fastTier('rg-a') });
  try {
    assert.deepEqual(await fastTierMissing(covered.root, { frameworks: covered.frameworks }), []);
    assert.deepEqual(await fastTierMissing(noCargo.root, { frameworks: noCargo.frameworks }), []);
    assert.deepEqual(await fastTierMissing(noScript.root, { frameworks: noScript.frameworks }), []);
    assert.deepEqual((await fastTierMissing(partial.root, { frameworks: partial.frameworks }))[0].missing, ['rg-b']);
  } finally { [covered, noCargo, noScript, partial].forEach((p) => p.done()); }
});

test('a framework script that throws is fail-open', async () => {
  const p = project({ script: 'throw new Error("boom");\n' });
  try {
    assert.deepEqual(await fastTierMissing(p.root, { frameworks: p.frameworks }), []);
  } finally { p.done(); }
});

test('the orient concern block carries the dev-profile flag after the other blocks', async () => {
  const p = project();
  try {
    const lines = await concernBlock(p.root, { frameworks: p.frameworks, search: async () => [], tickets: async () => [], named: () => [] });
    assert.match(lines[0], /FRAMEWORK DEV PROFILE/);
  } finally { p.done(); }
  const ok = project({ cargo: fastTier('rg-a', 'rg-b') });
  try {
    assert.deepEqual(await concernBlock(ok.root, { frameworks: ok.frameworks, search: async () => [], tickets: async () => [], named: () => [] }), []);
  } finally { ok.done(); }
});

test('a broker project whose framework names a conformance test but does not run it is flagged', () => {
  const p = project({ config: 'broker:\n  land_gate: affected\n  affected:\n    check: cargo check\n' });
  try {
    assert.deepEqual(conformanceUnwired(p.root, { named: named('framework_conformance') }), [{ framework: 'fw', test: 'framework_conformance' }]);
  } finally { p.done(); }
});

test('negative controls: conformance wired, no broker, no config, or no named test is not flagged', () => {
  const wired = project({ config: 'broker:\n  affected:\n    conformance: cargo t -p g --test framework_conformance\n' });
  const noBroker = project({ config: 'ids:\n  key: X\n' });
  const noConfig = project();
  const unnamed = project({ config: 'broker:\n  land_gate: affected\n' });
  try {
    assert.deepEqual(conformanceUnwired(wired.root, { named: named('framework_conformance') }), []);
    assert.deepEqual(conformanceUnwired(noBroker.root, { named: named('framework_conformance') }), []);
    assert.deepEqual(conformanceUnwired(noConfig.root, { named: named('framework_conformance') }), []);
    assert.deepEqual(conformanceUnwired(unnamed.root, { named: named(null) }), []);
  } finally { [wired, noBroker, noConfig, unnamed].forEach((p) => p.done()); }
});
