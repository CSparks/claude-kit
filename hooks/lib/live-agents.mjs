// Every LIVE agent on this machine, across all sessions and projects, with its model, its job and
// the capability-table row that job maps to (KIT-T461). The harness writes one
// `<claudeHome>/projects/<project>/<session>/subagents/agent-<id>.{jsonl,meta.json}` pair per agent;
// the meta names the type, the description and the model it was started with, so this view does
// not depend on any dispatch hook having fired.
//
//   liveAgents({ claudeHome?, nowMs?, terminalIds? }) -> [{ id, project, session, type, model, job, row, idleMin, description, flags }]
//   liveAgentLines(list, { nowMs? })                  -> printable lines, one per agent plus a summary
//   terminalAgentIds(aiDirs)                          -> Set of ids a roster already marks finished
//
// An agent is live when its transcript was written within LIVE_IDLE_MIN and no roster marks it
// finished. `flags` holds the `!!` findings: no model, no job, a job outside the table, or a
// model outside the job's table row (unless the brief carries `[model-override: reason]`).

import { existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readLadder } from '../../scripts/dispatch-ladder.mjs';
import { familyOf } from '../../scripts/dispatch-outcomes.mjs';
import { jobFamilies, modelOverride } from '../dispatch-job.mjs';
import { declaredJob } from '../agent-outcome.mjs';
import { modelDisplay } from '../model-tag.mjs';
import { MODEL_UNKNOWN } from './agent-format.mjs';

export const LIVE_IDLE_MIN = 90;
const PROMPT_BYTES = 4096;
const TASK_CLIP = 40;
const MAX_LINES = 8;
const ROSTER_TAIL_LINES = 4000;
const TERMINAL = new Set(['done', 'error', 'collected', 'merged', 'killed', 'stale']);
const MS_PER_MIN = 60000;
const META = /^agent-(.+)\.meta\.json$/;

const claudeHomeDir = () => process.env.CLAUDE_HOME || join(homedir(), '.claude');

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

// The first user turn of the transcript: where the brief's `[job: x]` and override tokens live.
function briefOf(transcript) {
  try {
    const fd = openSync(transcript, 'r');
    try {
      const buf = Buffer.alloc(PROMPT_BYTES);
      const len = readSync(fd, buf, 0, PROMPT_BYTES, 0);
      return buf.toString('utf8', 0, len);
    } finally {
      closeSync(fd);
    }
  } catch {
    return '';
  }
}

/** Ids a project's roster already marks finished (latest row per id decides). */
export function terminalAgentIds(aiDirs) {
  const done = new Set();
  for (const dir of aiDirs) {
    let lines;
    try { lines = readFileSync(join(dir, 'agents.jsonl'), 'utf8').split('\n').filter(Boolean); } catch { continue; }
    const latest = new Map();
    for (const ln of lines.slice(-ROSTER_TAIL_LINES)) {
      try {
        const row = JSON.parse(ln);
        if (row && row.id) latest.set(row.id, row.status);
      } catch { /* skip a torn line */ }
    }
    for (const [id, status] of latest) if (TERMINAL.has(status)) done.add(id);
  }
  return done;
}

function flagsFor({ model, job, brief, jobs }) {
  const flags = [];
  if (!model) flags.push('no model');
  if (!job) flags.push('no job');
  else if (!jobs[job]) flags.push(`job '${job}' is not in the capability table`);
  else if (model && !modelOverride(brief)) {
    const allowed = jobFamilies(jobs[job]);
    if (!allowed.includes(familyOf(model))) flags.push(`model ${familyOf(model)} is not in the table row for ${job} (${allowed.join('|')})`);
  }
  return flags;
}

function* metaFiles(projectsDir) {
  let projects;
  try { projects = readdirSync(projectsDir); } catch { return; }
  for (const project of projects) {
    let sessions;
    try { sessions = readdirSync(join(projectsDir, project)); } catch { continue; }
    for (const session of sessions) {
      const dir = join(projectsDir, project, session, 'subagents');
      let names;
      try { names = readdirSync(dir); } catch { continue; }
      for (const name of names) if (META.test(name)) yield { project, session, dir, name };
    }
  }
}

export function liveAgents({ claudeHome = claudeHomeDir(), nowMs = Date.now(), terminalIds = new Set() } = {}) {
  const jobs = readLadder().jobs;
  const out = [];
  for (const { project, session, dir, name } of metaFiles(join(claudeHome, 'projects'))) {
    const id = META.exec(name)[1];
    if (terminalIds.has(id)) continue;
    const transcript = join(dir, `agent-${id}.jsonl`);
    if (!existsSync(transcript)) continue;
    const idleMin = Math.floor((nowMs - statSync(transcript).mtimeMs) / MS_PER_MIN);
    if (idleMin > LIVE_IDLE_MIN) continue;
    const meta = readJson(join(dir, name)) || {};
    const brief = briefOf(transcript);
    const job = declaredJob(brief);
    const model = String(meta.model || '').trim();
    out.push({
      id, project, session, type: meta.agentType || '?', model, job, idleMin,
      row: jobs[job] ? jobFamilies(jobs[job]).join('|') : '',
      description: String(meta.description || ''),
      flags: flagsFor({ model, job, brief, jobs }),
    });
  }
  return out.sort((a, b) => a.idleMin - b.idleMin);
}

export function liveAgentLines(list) {
  if (!list.length) return [];
  const lines = list.map((a) => {
    const tag = a.model ? `[${modelDisplay(a.model)}]` : MODEL_UNKNOWN;
    const job = a.job ? `job=${a.job}${a.row ? ` (table: ${a.row})` : ''}` : 'job=?';
    const desc = a.description.length > TASK_CLIP ? `${a.description.slice(0, TASK_CLIP - 1)}…` : a.description;
    const flag = a.flags.length ? `  !! ${a.flags.join('; ')}` : '';
    return `  ${tag} ${a.type}  ${a.id.slice(0, 8)}  ${a.project.replace(/^C--Users-[^-]+-[^-]+-/, '')}  idle ${a.idleMin}m  ${job}  ${desc}${flag}`;
  });
  const bad = list.filter((a) => a.flags.length).length;
  const header = `--- LIVE agents on this machine, all sessions (${list.length}${bad ? `, ${bad} flagged !!` : ', all match the capability table'}) ---`;
  const shown = [...lines.filter((l) => l.includes('!!')), ...lines.filter((l) => !l.includes('!!'))].slice(0, MAX_LINES);
  return [header, ...shown, ...(lines.length > MAX_LINES ? [`  ... ${lines.length - MAX_LINES} more`] : [])];
}
