// model-lineup.mjs — the capability table's freshness gate (KIT-T339). The table (kit
// .ai/config.yml dispatch.jobs) is only as good as its last research: this module reads the
// lineup that scripts/model-refresh.mjs records (.ai/model-lineup.json) and answers
//   capabilityStatus() -> { stale, reasons[], ageDays, asOf, refreshDays, newestKnown, newerThanAliases[] }
//   modelsLine(status) -> the one SessionStart line orient prints (`!!`-prefixed when stale)
// Stale = no dated evidence, the OLDEST row's evidence (KIT-T433), or the lineup refresh, older than
// the refresh period, or a known model newer than the alias for its family. A refresh does not
// re-date rows; only capability evidence does (job-capability.mjs redate).

import { join } from 'node:path';
import { readLadder, capabilityFreshness, ladderRoot } from './dispatch-ladder.mjs';
import { kitDataText } from './kit-data.mjs';

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
    const data = JSON.parse(kitDataText(kitRoot, ...LINEUP_REL));
    return Array.isArray(data.models) ? data : null;
  } catch {
    return null;
  }
}

export function capabilityStatus(kitRoot = ladderRoot(), nowMs = Date.now()) {
  const ladder = readLadder(kitRoot);
  const evidence = capabilityFreshness(kitRoot, nowMs);
  const lineup = readLineup(kitRoot);
  const asOf = evidence ? evidence.oldest : '';
  const oldestJob = evidence ? evidence.oldestJob : '';
  const ageDays = evidence ? evidence.ageDays : null;
  const lineupAge = lineup && Number.isFinite(Date.parse(lineup.refreshed)) ? Math.floor((nowMs - Date.parse(lineup.refreshed)) / MS_PER_DAY) : null;

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
  else if (ageDays > ladder.refreshDays) reasons.push(`row "${oldestJob}" evidence ${asOf} is ${ageDays} days old (period ${ladder.refreshDays})`);
  if (lineupAge !== null && lineupAge > ladder.refreshDays) reasons.push(`lineup refresh ${lineup.refreshed} is ${lineupAge} days old (period ${ladder.refreshDays})`);
  for (const id of newerThanAliases) reasons.push(`${id} is newer than the ${modelVersion(id).family} alias (${ladder.aliases[modelVersion(id).family]})`);
  return { stale: reasons.length > 0, reasons, ageDays, asOf, oldestJob, refreshDays: ladder.refreshDays, newestKnown, newerThanAliases, hasLineup: !!lineup };
}

export function modelsLine(status) {
  const body = `models: oldest row evidence ${status.asOf || 'none'}${status.oldestJob ? ` (${status.oldestJob}, ` : ' ('}${status.ageDays === null ? '?' : `${status.ageDays} d`}), newest known ${status.newestKnown ? pretty(status.newestKnown) : 'none'}`;
  return status.stale ? `!! ${body} — STALE: ${status.reasons.join('; ')}. Write research/models-capability-<date>.md (graded per-job table), run node ${join(ladderRoot(), 'scripts', 'model-refresh.mjs')}, then node ${join(ladderRoot(), 'scripts', 'job-capability.mjs')} redate <date> <jobs>` : body;
}
