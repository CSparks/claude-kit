// model-lineup.mjs — the capability table's freshness gate (KIT-T339). The table (kit
// .ai/config.yml dispatch.jobs) is only as good as its last research: this module reads the
// lineup that scripts/model-refresh.mjs records (.ai/model-lineup.json) and answers
//   capabilityStatus() -> { stale, reasons[], ageDays, asOf, refreshDays, newestKnown, newerThanAliases[] }
//   modelsLine(status) -> the one SessionStart line orient prints (`!!`-prefixed when stale)
// Stale = no dated evidence, the newest of (row evidence, last refresh) older than the refresh
// period, or a known model newer than the alias for its family.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder, capabilityFreshness, ladderRoot } from './dispatch-ladder.mjs';

export const LINEUP_REL = ['.ai', 'model-lineup.json'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MODEL_ID = /claude-([a-z]+)-(\d+)(?:-(\d{1,2})(?!\d))?/i;

export function modelVersion(id) {
  const m = String(id).match(MODEL_ID);
  return m ? { family: m[1].toLowerCase(), version: Number(m[2]) + (m[3] ? Number(m[3]) / 100 : 0), label: m[3] ? `${m[2]}.${m[3]}` : m[2] } : null;
}

const pretty = (id) => {
  const v = modelVersion(id);
  return v ? `${v.family[0].toUpperCase()}${v.family.slice(1)} ${v.label}` : String(id);
};

export function readLineup(kitRoot = ladderRoot()) {
  try {
    const data = JSON.parse(readFileSync(join(kitRoot, ...LINEUP_REL), 'utf8'));
    return Array.isArray(data.models) ? data : null;
  } catch {
    return null;
  }
}

export function capabilityStatus(kitRoot = ladderRoot(), nowMs = Date.now()) {
  const ladder = readLadder(kitRoot);
  const evidence = capabilityFreshness(kitRoot, nowMs);
  const lineup = readLineup(kitRoot);
  const dates = [evidence && evidence.newest, lineup && lineup.refreshed].filter((d) => Number.isFinite(Date.parse(d))).sort();
  const asOf = dates.length ? dates[dates.length - 1] : '';
  const ageDays = asOf ? Math.floor((nowMs - Date.parse(asOf)) / MS_PER_DAY) : null;

  const aliasIds = Object.values(ladder.aliases);
  const known = [...(lineup ? lineup.models : []), ...aliasIds].filter((id) => modelVersion(id));
  const newestKnown = known.reduce((best, id) => (!best || modelVersion(id).version > modelVersion(best).version ? id : best), '');
  const newerThanAliases = [];
  for (const [family, aliasId] of Object.entries(ladder.aliases)) {
    const have = modelVersion(aliasId);
    for (const id of lineup ? lineup.models : []) {
      const v = modelVersion(id);
      if (have && v && v.family === family && v.version > have.version && !newerThanAliases.includes(id)) newerThanAliases.push(id);
    }
  }

  const reasons = [];
  if (!asOf) reasons.push('the capability table carries no evidence dates');
  else if (ageDays > ladder.refreshDays) reasons.push(`table evidence/refresh ${asOf} is ${ageDays} days old (period ${ladder.refreshDays})`);
  for (const id of newerThanAliases) reasons.push(`${id} is newer than the ${modelVersion(id).family} alias (${ladder.aliases[modelVersion(id).family]})`);
  return { stale: reasons.length > 0, reasons, ageDays, asOf, refreshDays: ladder.refreshDays, newestKnown, newerThanAliases, hasLineup: !!lineup };
}

export function modelsLine(status) {
  const body = `models: table evidence ${status.asOf || 'none'} (${status.ageDays === null ? '?' : `${status.ageDays} d`}), newest known ${status.newestKnown ? pretty(status.newestKnown) : 'none'}`;
  return status.stale ? `!! ${body} — STALE: ${status.reasons.join('; ')}. Run node ${join(ladderRoot(), 'scripts', 'model-refresh.mjs')}` : body;
}
