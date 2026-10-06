// dispatch-ladder.test.mjs — KIT-T326 / KIT-D079 / KIT-D080: the capability table resolves from the
// kit config only; a project `dispatch:` block changes nothing and is flagged as drift (in orient);
// the table carries evidence dates and goes stale after 14 days.
// Run: node scripts/dispatch-ladder.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder, resolveJob, dispatchDrift, capabilityFreshness, freshnessWarning, FRESHNESS_DAYS, KIT_ROOT } from './dispatch-ladder.mjs';
import { adopted, hook, git, cleanup, reporter, tmpDir } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('dispatch-ladder');
const FORKED = 'dispatch:\n  jobs:\n    fix:\n      family: opus\n      effort: low\n  default_job:\n    "*": fix\n';
const DAY = 24 * 60 * 60 * 1000;

function withDispatch(dir) {
  writeFileSync(join(dir, '.ai', 'config.yml'), `${FORKED}\n`, { flag: 'a' });
  git(['add', '-A'], dir);
}

// A throwaway kit root whose table carries the given evidence dates.
function kitWith(dates) {
  const dir = tmpDir('kit-fresh-');
  mkdirSync(join(dir, '.ai'), { recursive: true });
  const rows = dates.map((d, i) => `    job${i}:\n      family: opus\n      evidence: ${d}\n`).join('');
  writeFileSync(join(dir, '.ai', 'config.yml'), `dispatch:\n  jobs:\n${rows}  default_job:\n    "*": job0\n`);
  return dir;
}

try {
  const before = resolveJob({ type: 'bug' });
  ok('a bug resolves to the sonnet family at high effort', before.family === 'sonnet' && before.effort === 'high');
  ok('a ticket type maps through default_job; `*` is the catch-all',
    resolveJob({ type: 'regression' }).job === 'forensic' && resolveJob({ type: 'unknown-type' }).job === 'fix');
  ok('an explicit job wins over the type', resolveJob({ type: 'bug', job: 'build' }).job === 'build');
  ok('rows name families, never model ids', Object.values(readLadder().jobs).every((j) => !/claude-/.test(`${j.family}${j.fallback || ''}`)));
  ok('the targeted-change row routes to local-qwen and falls back to sonnet',
    resolveJob({ job: 'targeted-change' }).family === 'local-qwen' && resolveJob({ job: 'targeted-change' }).fallback === 'sonnet');
  ok('asset authoring is opus, never fable', resolveJob({ job: 'asset' }).family === 'opus');
  ok('fable rows are explicit-only', Object.values(readLadder().jobs).filter((j) => j.family === 'fable').every((j) => j.explicit_only === true));
  ok('an unknown job throws', (() => { try { resolveJob({ job: 'nope' }); return false; } catch { return true; } })());
  ok('the table has the core job set', ['chore', 'targeted-change', 'fix', 'refactor', 'build', 'asset', 'deep'].every((t) => t in readLadder().jobs));
  ok('every row carries an evidence date and a source', Object.entries(readLadder().jobs).every(([, j]) => Number.isFinite(Date.parse(j.evidence)) && j.source));
  ok('aliases map each family to its newest id; opus is 5.5', readLadder().aliases.opus === 'claude-opus-5-5' && readLadder().aliases.sonnet === 'claude-sonnet-5-5');

  const kit = kitWith(['2026-10-01', '2026-09-01']);
  const day0 = Date.parse('2026-10-01');
  ok('freshness reads the NEWEST evidence date', capabilityFreshness(kit, day0 + 3 * DAY).newest === '2026-10-01');
  ok('a table within 14 days is fresh', freshnessWarning(kit, day0 + FRESHNESS_DAYS * DAY) === null);
  ok('a table 15 days past its newest evidence warns', /stale: newest evidence 2026-10-01 \(15 days old/.test(freshnessWarning(kit, day0 + (FRESHNESS_DAYS + 1) * DAY) || ''));
  ok('a table with no evidence dates warns', /no evidence dates/.test(freshnessWarning(kitWith([]), day0) || ''));
  ok('the shipped table carries evidence dates', capabilityFreshness(KIT_ROOT) !== null);

  const proj = adopted(false);
  ok('a project without a dispatch block has no drift', dispatchDrift(proj) === null);
  withDispatch(proj);
  const after = resolveJob({ type: 'bug' });
  ok('a project dispatch block does not change the resolved job', JSON.stringify(after) === JSON.stringify(before));
  ok('the project dispatch block is flagged as drift', /ignored/.test(dispatchDrift(proj) || ''));
  ok('the kit checkout never flags itself', dispatchDrift(KIT_ROOT) === null);

  const r = hook('orient.mjs', { hook_event_name: 'SessionStart' }, proj);
  ok('orient surfaces the drift warning', r.out.includes('`dispatch:` block — ignored'));
  ok('orient stays quiet about a fresh capability table', !r.out.includes('capability table is stale'));
} finally {
  cleanup();
}
done();
