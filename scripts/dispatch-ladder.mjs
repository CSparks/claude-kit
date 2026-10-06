// dispatch-ladder.mjs — the ONE resolver for model routing (KIT-T326). The ladder lives in the
// kit's own `.ai/config.yml` (`dispatch.tiers` + `dispatch.default_tier`); a project config never
// supplies or overrides it. A project-level `dispatch:` block is ignored and flagged as drift.
//
//   readLadder(kitRoot?)                    -> { tiers: {name: {model, effort, fallback}}, defaultTier: {type: tier}, aliases: {alias: id} }
//   resolveTier({ type, tier }, kitRoot?)   -> { tier, model, effort, fallback } (tier wins over type; `*` is the catch-all)
//   dispatchDrift(projectRoot, kitRoot?)    -> string warning | null (project config carries a `dispatch:` block)
//   CLI: node dispatch-ladder.mjs resolve [--type <ticket type>] [--tier <tier>]   prints JSON

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function dispatchBlock(text) {
  const m = text.match(/^dispatch:[ \t]*\n((?:(?:[ \t]+.*)?\n?)*)/m);
  return m ? m[1] : '';
}

function subBlock(body, key) {
  const m = body.match(new RegExp(`^ {2}${key}:[ \t]*\n((?: {4}.*\n?|[ \t]*#.*\n?|\n)*)`, 'm'));
  return m ? m[1] : '';
}

const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

export function readLadder(kitRoot = KIT_ROOT) {
  const body = dispatchBlock(readFileSync(join(kitRoot, '.ai', 'config.yml'), 'utf8'));
  const tiers = {};
  for (const m of subBlock(body, 'tiers').matchAll(/^ {4}(\w+):\s*\{([^}]*)\}/gm)) {
    const entry = {};
    for (const f of m[2].matchAll(/(model|effort|fallback):\s*([\w.-]+)/g)) entry[f[1]] = f[2];
    tiers[m[1]] = entry;
  }
  const defaultTier = {};
  for (const m of subBlock(body, 'default_tier').matchAll(/^ {4}("[^"]+"|'[^']+'|[\w*-]+):\s*([\w-]+)/gm)) {
    defaultTier[unquote(m[1])] = m[2];
  }
  const aliases = {};
  for (const m of subBlock(body, 'aliases').matchAll(/^ {4}([\w-]+):\s*([\w.-]+)/gm)) aliases[m[1].toLowerCase()] = m[2];
  return { tiers, defaultTier, aliases };
}

export function resolveTier({ type, tier } = {}, kitRoot = KIT_ROOT) {
  const ladder = readLadder(kitRoot);
  const name = tier || ladder.defaultTier[type] || ladder.defaultTier['*'];
  const entry = ladder.tiers[name];
  if (!entry) throw new Error(`dispatch tier \`${name}\` is not on the kit ladder`);
  return { tier: name, model: entry.model, effort: entry.effort, fallback: entry.fallback || null };
}

export function dispatchDrift(projectRoot, kitRoot = KIT_ROOT) {
  if (resolve(projectRoot) === resolve(kitRoot)) return null;
  let text;
  try {
    text = readFileSync(join(projectRoot, '.ai', 'config.yml'), 'utf8');
  } catch {
    return null;
  }
  if (!/^dispatch:/m.test(text)) return null;
  return `.ai/config.yml carries a \`dispatch:\` block — ignored: model routing lives only in the kit ladder (KIT-D079). Delete the block.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'resolve') {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    console.log(JSON.stringify(resolveTier({ type: arg('--type'), tier: arg('--tier') })));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
