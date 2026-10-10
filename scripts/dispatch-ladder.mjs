// dispatch-ladder.mjs — the ONE resolver for model routing (KIT-T326, KIT-D080). The capability
// table lives in the kit's own `.ai/config.yml` (`dispatch.jobs` + `dispatch.default_job` +
// `dispatch.aliases`); a project config never supplies or overrides it. A project-level
// `dispatch:` block is ignored and flagged as drift.
//
//   readLadder(kitRoot?)                    -> { jobs: {name: {family, effort, fallback, cost, evidence, source, use, explicit_only}},
//                                               defaultJob: {type: job}, aliases: {family: id} }
//   resolveJob({ type, job }, kitRoot?)     -> { job, family, effort, fallback, explicitOnly } (job wins over type; `*` is the catch-all)
//   capabilityFreshness(kitRoot?, nowMs?)   -> { newest: 'YYYY-MM-DD', ageDays } | null (no dated row)
//   freshnessWarning(kitRoot?, nowMs?)      -> string | null (newest evidence older than FRESHNESS_DAYS)
//   readLadder(...).refreshDays             -> the refresh period in days (config dispatch.refresh_days, default FRESHNESS_DAYS)
//   dispatchDrift(projectRoot, kitRoot?)    -> string warning | null (project config carries a `dispatch:` block)
//   CLI: node dispatch-ladder.mjs resolve [--type <ticket type>] [--job <job>]   prints JSON
//        node dispatch-ladder.mjs freshness                                      prints the warning or `fresh`

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FRESHNESS_DAYS = 14;
// Tests point the resolver at a fixture kit; production always reads the kit checkout.
export const ladderRoot = () => process.env.CLAUDE_KIT_LADDER_ROOT || KIT_ROOT;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dispatchBlock(text) {
  const m = text.match(/^dispatch:[ \t]*\n((?:(?:[ \t]+.*)?\n?)*)/m);
  return m ? m[1] : '';
}

function subBlock(body, key) {
  const m = body.match(new RegExp(`^ {2}${key}:[ \t]*\n((?: {4}.*\n?|[ \t]*#.*\n?|\n)*)`, 'm'));
  return m ? m[1] : '';
}

const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

// Job rows: `    name:` then `      key: value` lines. Values keep their colons and commas.
function parseJobs(block) {
  const jobs = {};
  let current = null;
  for (const line of block.split('\n')) {
    const row = line.match(/^ {4}([\w-]+):[ \t]*$/);
    if (row) {
      current = jobs[row[1]] = {};
      continue;
    }
    const field = line.match(/^ {6}(\w+):[ \t]*(.*)$/);
    if (field && current) {
      const value = unquote(field[2].replace(/[ \t]+#.*$/, ''));
      current[field[1]] = value === 'true' ? true : value === 'false' ? false : value;
    }
  }
  return jobs;
}

export function readLadder(kitRoot = ladderRoot()) {
  const body = dispatchBlock(readFileSync(join(kitRoot, '.ai', 'config.yml'), 'utf8'));
  const jobs = parseJobs(subBlock(body, 'jobs'));
  const defaultJob = {};
  for (const m of subBlock(body, 'default_job').matchAll(/^ {4}("[^"]+"|'[^']+'|[\w*-]+):\s*([\w-]+)/gm)) {
    defaultJob[unquote(m[1])] = m[2];
  }
  const aliases = {};
  for (const m of subBlock(body, 'aliases').matchAll(/^ {4}([\w-]+):\s*([\w.-]+)/gm)) aliases[m[1].toLowerCase()] = m[2];
  const refresh = body.match(/^ {2}refresh_days:[ \t]*(\d+)/m);
  return { jobs, defaultJob, aliases, refreshDays: refresh ? Number(refresh[1]) : FRESHNESS_DAYS };
}

export function resolveJob({ type, job } = {}, kitRoot = ladderRoot()) {
  const ladder = readLadder(kitRoot);
  const name = job || ladder.defaultJob[type] || ladder.defaultJob['*'];
  const entry = ladder.jobs[name];
  if (!entry) throw new Error(`dispatch job \`${name}\` is not in the kit capability table`);
  return { job: name, family: entry.family, effort: entry.effort, fallback: entry.fallback || null, explicitOnly: entry.explicit_only === true };
}

// The newest `evidence:` date across the table's rows.
export function capabilityFreshness(kitRoot = ladderRoot(), nowMs = Date.now()) {
  const dates = Object.values(readLadder(kitRoot).jobs)
    .map((j) => String(j.evidence || ''))
    .filter((d) => Number.isFinite(Date.parse(d)))
    .sort();
  if (!dates.length) return null;
  const newest = dates[dates.length - 1];
  return { newest, ageDays: Math.floor((nowMs - Date.parse(newest)) / MS_PER_DAY) };
}

export function freshnessWarning(kitRoot = ladderRoot(), nowMs = Date.now()) {
  let fresh;
  try {
    fresh = capabilityFreshness(kitRoot, nowMs);
  } catch {
    return null;
  }
  if (!fresh) return 'model capability table (kit .ai/config.yml dispatch.jobs) carries no evidence dates — route from fresh research (KIT-T339).';
  const limit = readLadder(kitRoot).refreshDays;
  if (fresh.ageDays <= limit) return null;
  return `model capability table is stale: newest evidence ${fresh.newest} (${fresh.ageDays} days old, limit ${limit}) — refresh from current model research and dispatch outcomes before routing (KIT-T339).`;
}

export function dispatchDrift(projectRoot, kitRoot = ladderRoot()) {
  if (resolve(projectRoot) === resolve(kitRoot)) return null;
  let text;
  try {
    text = readFileSync(join(projectRoot, '.ai', 'config.yml'), 'utf8');
  } catch {
    return null;
  }
  if (!/^dispatch:/m.test(text)) return null;
  return `.ai/config.yml carries a \`dispatch:\` block — ignored: model routing lives only in the kit capability table (KIT-D079, KIT-D080). Delete the block.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv[2] === 'resolve') {
    try {
      console.log(JSON.stringify(resolveJob({ type: arg('--type'), job: arg('--job') || arg('--tier') })));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  } else if (process.argv[2] === 'freshness') {
    console.log(freshnessWarning() || 'fresh');
  }
}
