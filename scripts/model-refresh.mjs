#!/usr/bin/env node
// model-refresh.mjs — the scheduled research refresh behind the capability-table gate (KIT-T339).
// Fetches the current lineup (Anthropic models API when ANTHROPIC_API_KEY is set, else the docs
// page) and the per-family price, then writes:
//   .ai/model-lineup.json            machine record the dispatch gate and orient read
//   research/models-<date>.md        the dated research note
//   .ai/decisions/<KEY>-D###-…md     a PROPOSED superseding decision, only when a family has a newer model
// It never edits the table: accepting the proposal (aliases + rows) is a human decision.
//   CLI: node scripts/model-refresh.mjs        refresh now
// A successful run stamps `refreshed`, which clears the age half of the gate; a newer model
// stays blocking until the aliases move.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladderRoot, readLadder } from './dispatch-ladder.mjs';
import { capabilityStatus, modelVersion, LINEUP_REL } from './model-lineup.mjs';
import { nextId } from './id-utils.mjs';
import { jobCapabilityTable } from './job-capability.mjs';
import { readOutcomes } from '../hooks/lib/dispatch-ledger.mjs';

const MODELS_API = 'https://api.anthropic.com/v1/models?limit=1000';
const DOCS_MODELS = 'https://docs.claude.com/en/docs/about-claude/models/overview';
const DOCS_PRICING = 'https://docs.claude.com/en/docs/about-claude/pricing';
const ID_RE = /claude-[a-z]+-\d+(?:-\d{1,2})?(?!\d)/gi;
const PRICE_RE = /Claude (Opus|Sonnet|Haiku|Fable) (\d+(?:\.\d+)?)[^$]{0,120}?\$(\d+(?:\.\d+)?)\s*\/\s*MTok[^$]{0,80}?\$(\d+(?:\.\d+)?)\s*\/\s*MTok/gi;

async function fetchText(fetchImpl, url, init) {
  const res = await fetchImpl(url, init);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

export async function fetchLineup({ fetchImpl = fetch, env = process.env } = {}) {
  if (env.ANTHROPIC_API_KEY) {
    const body = JSON.parse(await fetchText(fetchImpl, MODELS_API, { headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }));
    return { source: 'api.anthropic.com/v1/models', models: [...new Set((body.data || []).map((m) => m.id))] };
  }
  const html = await fetchText(fetchImpl, DOCS_MODELS);
  return { source: DOCS_MODELS, models: [...new Set((html.match(ID_RE) || []).map((id) => id.toLowerCase()))] };
}

export async function fetchCosts({ fetchImpl = fetch } = {}) {
  const costs = {};
  try {
    const text = (await fetchText(fetchImpl, DOCS_PRICING)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const m of text.matchAll(PRICE_RE)) {
      const family = m[1].toLowerCase();
      const version = Number(m[2]);
      if (!costs[family] || version > costs[family].version) costs[family] = { version, model: `${family} ${m[2]}`, inputPerMTok: Number(m[3]), outputPerMTok: Number(m[4]) };
    }
  } catch {
    /* price page unavailable — costs stay empty and the note says so */
  }
  return costs;
}

function note(date, lineup, costs, status, capability) {
  const rows = Object.entries(costs).map(([f, c]) => `| ${f} | ${c.model} | $${c.inputPerMTok} | $${c.outputPerMTok} |`);
  return [
    `# Model lineup refresh ${date}`, '',
    `Source: ${lineup.source}`, '',
    '## Known models', '', ...lineup.models.sort().map((id) => `- ${id}`), '',
    '## Cost per family (per MTok)', '',
    rows.length ? ['| family | model | input | output |', '|---|---|---|---|', ...rows].join('\n') : 'Prices not parsed from the pricing page; check it by hand.', '',
    '## Capability per job', '',
    'Each dispatch.jobs row against its family cost and the outcome ledger. Routing sets how fast the weekly usage limit is hit, so cost per landing is the ranking metric.', '',
    capability, '',
    '## Documented strengths', '',
    'The reassessment agent adds the documented strengths of each family from the docs page here and re-dates every row it confirmed (node scripts/job-capability.mjs redate <date> <job,job|all>).', '',
    '## Gate status after refresh', '',
    status.stale ? status.reasons.map((r) => `- ${r}`).join('\n') : '- table is current for this lineup', '',
  ].join('\n');
}

function proposal(kitRoot, date, status, ladder) {
  const id = nextId(kitRoot, 'decisions');
  const lines = status.newerThanAliases.map((m) => `- ${modelVersion(m).family}: alias ${ladder.aliases[modelVersion(m).family]} -> ${m}`);
  mkdirSync(join(kitRoot, '.ai', 'decisions'), { recursive: true });
  const file = join(kitRoot, '.ai', 'decisions', `${id}-model-table-refresh-${date}.md`);
  writeFileSync(file, [
    '---', `id: ${id}`, `title: Model table refresh ${date}: newer models than the dispatch aliases`, 'status: proposed', `date: ${date}`, 'supersedes: KIT-D080',
    `source: research/models-${date}.md`, '---', '',
    `**Decision:** (proposed) Move these aliases in .ai/config.yml dispatch.aliases and re-evaluate the job rows against the new cost and capability:`, '', ...lines, '',
    `**Why:** scripts/model-refresh.mjs found a model newer than the alias for its family. The dispatch gate blocks until the aliases move. See research/models-${date}.md. Accepting this sets status to accepted and updates the aliases and row evidence dates.`, '',
  ].join('\n'));
  return file;
}

export async function refresh({ kitRoot = ladderRoot(), now = new Date(), fetchImpl = fetch, env = process.env, outcomeRoots = [] } = {}) {
  const date = now.toISOString().slice(0, 10);
  const lineup = await fetchLineup({ fetchImpl, env });
  if (!lineup.models.length) throw new Error(`no model ids found at ${lineup.source}; the gate stays blocked`);
  const costs = await fetchCosts({ fetchImpl });
  mkdirSync(join(kitRoot, '.ai'), { recursive: true });
  writeFileSync(join(kitRoot, ...LINEUP_REL), JSON.stringify({ refreshed: date, source: lineup.source, models: lineup.models, costs }, null, 2) + '\n');
  const status = capabilityStatus(kitRoot, now.getTime());
  mkdirSync(join(kitRoot, 'research'), { recursive: true });
  const research = join(kitRoot, 'research', `models-${date}.md`);
  const outcomes = [kitRoot, ...outcomeRoots].flatMap((r) => readOutcomes(r));
  writeFileSync(research, note(date, lineup, costs, status, jobCapabilityTable({ jobs: readLadder(kitRoot).jobs, costs, outcomes })));
  const decision = status.newerThanAliases.length ? proposal(kitRoot, date, status, readLadder(kitRoot)) : null;
  return { date, research, decision, status };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = [];
  process.argv.forEach((a, i) => { if (a === '--root') roots.push(resolve(process.argv[i + 1])); });
  refresh({ outcomeRoots: roots }).then((r) => {
    console.log(`refreshed ${r.date}: ${r.research}${r.decision ? `\nproposed: ${r.decision}` : ''}`);
    if (r.status.stale) console.log(`gate still blocking: ${r.status.reasons.join('; ')}`);
  }).catch((e) => { console.error(`model-refresh failed: ${e.message}`); process.exit(1); });
}
