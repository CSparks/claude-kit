// model-refresh.test.mjs — KIT-T339: the capability-table gate. A stale table or a model newer
// than its alias is `stale`; the refresh writes the lineup record, the research note and a
// proposed decision (never the table); a successful refresh clears the age half; orient prints
// the one `models:` line, `!!` when stale.
// Run: node scripts/model-refresh.test.mjs

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { capabilityStatus, modelsLine, modelVersion } from './model-lineup.mjs';
import { refresh } from './model-refresh.mjs';
import { adopted, hook, cleanup, reporter, fixtureKit, isoDaysAgo } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('model-refresh');
const NOW = new Date();

const docsFetch = (ids) => async (url) => ({
  ok: true,
  text: async () => (/pricing/.test(url)
    ? '<td>Claude Opus 5.5</td><td>$5 / MTok</td><td>$25 / MTok</td>'
    : ids.map((id) => `<code>${id}</code>`).join(' ')),
});

try {
  ok('model ids parse to family and version', modelVersion('claude-opus-5-5').version > modelVersion('claude-opus-4-8').version);

  const fresh = fixtureKit(isoDaysAgo(1));
  ok('a fresh table is not stale', capabilityStatus(fresh).stale === false);
  const old = fixtureKit(isoDaysAgo(30));
  const oldStatus = capabilityStatus(old);
  ok('a table past the refresh period is stale', oldStatus.stale && /30 days old/.test(oldStatus.reasons[0]));

  mkdirSync(join(fresh, 'research'), { recursive: true });
  writeFileSync(join(fresh, '.ai', 'model-lineup.json'), JSON.stringify({ refreshed: isoDaysAgo(1), models: ['claude-opus-5-5', 'claude-opus-5-7'] }));
  const drift = capabilityStatus(fresh);
  ok('a known model newer than its alias makes the table stale', drift.stale && drift.newerThanAliases.includes('claude-opus-5-7'));
  ok('newest known reports the newer model', drift.newestKnown === 'claude-opus-5-7');

  const r = await refresh({ kitRoot: old, now: NOW, fetchImpl: docsFetch(['claude-opus-5-5', 'claude-sonnet-5-5']), env: {} });
  ok('a refresh with no newer model clears the stale gate', capabilityStatus(old).stale === false && r.decision === null);
  ok('the refresh writes the dated research note with costs', existsSync(r.research) && /\| opus \| opus 5\.5 \| \$5 \| \$25 \|/.test(readFileSync(r.research, 'utf8')));
  ok('the lineup record is written', JSON.parse(readFileSync(join(old, '.ai', 'model-lineup.json'), 'utf8')).refreshed === NOW.toISOString().slice(0, 10));
  ok('the refresh never rewrites the table', !/claude-opus-5-7/.test(readFileSync(join(old, '.ai', 'config.yml'), 'utf8')));

  const kit2 = fixtureKit(isoDaysAgo(30));
  const r2 = await refresh({ kitRoot: kit2, now: NOW, fetchImpl: docsFetch(['claude-opus-5-5', 'claude-opus-5-7']), env: {} });
  ok('a newer model yields a proposed superseding decision', !!r2.decision && /status: proposed/.test(readFileSync(r2.decision, 'utf8')) && /claude-opus-5-7/.test(readFileSync(r2.decision, 'utf8')));
  ok('a newer model keeps the gate blocking until the aliases move', capabilityStatus(kit2).stale === true);
  ok('exactly one decision file was proposed', readdirSync(join(kit2, '.ai', 'decisions')).length === 1);

  const apiCalls = [];
  const kit3 = fixtureKit(isoDaysAgo(30));
  await refresh({ kitRoot: kit3, now: NOW, env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: async (url, init) => { apiCalls.push([url, init && init.headers]); return { ok: true, text: async () => JSON.stringify({ data: [{ id: 'claude-opus-5-5' }] }) }; } });
  ok('with an API key the models endpoint is used', /v1\/models/.test(apiCalls[0][0]) && apiCalls[0][1]['x-api-key'] === 'k');
  let failed = false;
  await refresh({ kitRoot: fixtureKit(isoDaysAgo(30)), now: NOW, fetchImpl: docsFetch([]), env: {} }).catch(() => { failed = true; });
  ok('a refresh that finds no models fails instead of clearing the gate', failed);

  const repo = adopted();
  const staleOut = hook('orient.mjs', { hook_event_name: 'SessionStart' }, repo, { CLAUDE_KIT_LADDER_ROOT: fixtureKit(isoDaysAgo(30)) }).out;
  ok('orient prints a !! models line when the table is stale', /!! models: table evidence \d{4}-\d{2}-\d{2} \(30 d\), newest known Opus 5\.5 — STALE/.test(staleOut) && /model-refresh\.mjs/.test(staleOut));
  const freshOut = hook('orient.mjs', { hook_event_name: 'SessionStart' }, repo, { CLAUDE_KIT_LADDER_ROOT: fixtureKit(isoDaysAgo(2)) }).out;
  ok('orient prints the plain models line when fresh', /^models: table evidence .* \(2 d\), newest known Opus 5\.5$/m.test(freshOut) && !/!! models/.test(freshOut));
  ok('modelsLine is stable for a fresh status', modelsLine(capabilityStatus(fixtureKit(isoDaysAgo(0)))).startsWith('models:'));
} finally {
  cleanup();
}
done();
