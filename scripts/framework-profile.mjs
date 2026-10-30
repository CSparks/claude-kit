// framework-profile.mjs — orient flags for a game that skips the framework's build defaults (KIT-T690):
//   FRAMEWORK DEV PROFILE        the root Cargo.toml has no dev fast tier for framework crates the game builds
//   FRAMEWORK CONFORMANCE        the broker never runs the framework conformance test the framework names
// The profile check is the framework's own: `<framework>/scripts/dev-profile.mjs` exports
// `missingFastTier(gameRoot, frameworkRustDir)`; the kit holds no second copy of the crate scan.
// Fails open: no script, no Cargo.toml, a throwing script, or no broker config means no lines.
//
//   fastTierMissing(root, deps?)      -> [{ framework, dir, missing: string[] }]
//   conformanceUnwired(root, deps?)   -> [{ framework, test }]
//   profileBlock(root, deps?)         -> orient lines: two per framework flagged, plus the conformance header and lines
//
// Run: node scripts/framework-profile.mjs [--root <dir>]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameworksFor } from '../hooks/lib/frameworks.mjs';
import { isMain } from './is-main.mjs';
import { frameworkRoots } from './q-framework.mjs';

const SHOWN = 6;
const PROFILE_HEADER = '--- FRAMEWORK DEV PROFILE: the root Cargo.toml lacks the dev fast tier for framework crates (each builds at opt-level 3 on every pin) ---';
const CONFORMANCE_HEADER = '--- FRAMEWORK CONFORMANCE NOT WIRED: broker.affected.conformance is unset, so no landing runs the framework defaults test ---';

async function defaultMissing(root, dir) {
  const script = join(dir, 'scripts', 'dev-profile.mjs');
  if (!existsSync(script) || !existsSync(join(root, 'Cargo.toml'))) return [];
  const mod = await import(pathToFileURL(script).href);
  return mod.missingFastTier(root, join(dir, 'rust'));
}

/** Framework crates the game builds that its root Cargo.toml has no fast-tier section for, per framework. */
export async function fastTierMissing(root, { frameworks = frameworkRoots, missing = defaultMissing } = {}) {
  const out = [];
  for (const fw of frameworks(root)) {
    let names = [];
    try { names = await missing(root, fw.dir); } catch { /* the framework script is best-effort */ }
    if (names.length) out.push({ framework: fw.name, dir: fw.dir, missing: names });
  }
  return out;
}

const brokerConfigured = (text) => /^broker:/m.test(text);
const conformanceSet = (text) => /^\s+conformance:\s*\S/m.test(text);

/** Frameworks that name a conformance test while the game's broker config does not run one. */
export function conformanceUnwired(root, { named = frameworksFor } = {}) {
  const file = join(root, '.ai', 'config.yml');
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  if (!brokerConfigured(text) || conformanceSet(text)) return [];
  try {
    return named(root).filter((f) => f.conformance).map((f) => ({ framework: f.name, test: f.conformance }));
  } catch { return []; }
}

export async function profileBlock(root, deps = {}) {
  const lines = [];
  const found = await fastTierMissing(root, deps);
  if (found.length) lines.push(PROFILE_HEADER);
  for (const f of found) {
    const more = f.missing.length > SHOWN ? ` +${f.missing.length - SHOWN} more` : '';
    lines.push(`  ${f.framework}: ${f.missing.length} missing: ${f.missing.slice(0, SHOWN).join(' ')}${more}`);
    lines.push(`  fix: node ${f.dir.replace(/\\/g, '/')}/scripts/dev-profile.mjs . --write, then hold it with rg_testkit::conformance`);
  }
  const unwired = conformanceUnwired(root, deps);
  if (unwired.length) lines.push(CONFORMANCE_HEADER);
  for (const u of unwired) lines.push(`  ${u.framework}: add broker.affected.conformance: cargo t -p <game> --test ${u.test}`);
  return lines;
}

if (isMain(import.meta.url)) {
  const at = process.argv.indexOf('--root');
  const lines = await profileBlock(at >= 0 ? process.argv[at + 1] : process.cwd());
  console.log(lines.length ? lines.join('\n') : 'framework-profile: the dev fast tier and the conformance wiring are in place.');
}
