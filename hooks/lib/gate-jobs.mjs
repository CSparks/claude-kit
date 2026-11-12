// gate-jobs — the capability table as `q gates agent` prints it (KIT-T1105): per job its family, fallback and use, and
// per agent type its default job with that job's family, so the family is read before a dispatch, not learned from a block.
// The table is read from the ladder (scripts/dispatch-ladder.mjs) and the default jobs from the agent definitions
// (definitionJob); nothing here carries a copy of either.
//   RESOLVE_COMMAND          -> the one-job lookup, in the form a project session runs
//   jobsSection({ root })    -> printable lines; agent types are the kit's (`claude-kit:<name>`) and <root>/.claude/agents

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLadder } from '../../scripts/dispatch-ladder.mjs';
import { definitionJob } from '../model-tag.mjs';

export const RESOLVE_COMMAND = 'node "$HOME/.claude/claude-kit-runtime/current/scripts/dispatch-ladder.mjs" resolve';
const KIT_AGENTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agents');
const KIT_PREFIX = 'claude-kit:';
const ID_COLUMN = 18;
const FAMILY_COLUMN = 24;
const MAX_USE = 100;
const NOT_AN_AGENT = new Set(['README']);

function namesIn(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).filter((n) => !NOT_AN_AGENT.has(n)) : [];
}

function agentTypes(dirs) {
  return dirs.flatMap(({ dir, prefix }) => namesIn(dir).map((name) => ({ type: `${prefix}${name}`, name }))).sort((a, b) => a.type.localeCompare(b.type));
}

const useText = (row) => (row.use || '').split(/;\s|\.\s/)[0].slice(0, MAX_USE);
const familyText =(row) => (row ? `${row.family}${row.fallback ? ` (fallback ${row.fallback})` : ''}${row.explicit_only ? ' explicit only' : ''}` : 'not in the table');

export function jobsSection({ root } = {}) {
  const ladder = readLadder();
  const dirs = [{ dir: KIT_AGENTS, prefix: KIT_PREFIX }, ...(root ? [{ dir: join(root, '.claude', 'agents'), prefix: '' }] : [])];
  const defaults = agentTypes(dirs).map(({ type, name }) => ({ type, job: definitionJob(root, name) })).filter((a) => a.job);
  return [
    "JOBS (the capability table, kit .ai/config.yml dispatch.jobs: dispatch the job's family, or omit model; a family outside it is blocked)",
    ...Object.entries(ladder.jobs).map(([id, row]) => `  ${id}`.padEnd(ID_COLUMN) + familyText(row).padEnd(FAMILY_COLUMN) + useText(row)),
    "AGENT TYPE DEFAULT JOBS (a dispatch without [job: <id>] takes the type's own)",
    ...defaults.map(({ type, job }) => `  ${type}`.padEnd(ID_COLUMN + FAMILY_COLUMN) + `${job} -> ${familyText(ladder.jobs[job])}`),
    `Resolve one: ${RESOLVE_COMMAND} --job <job>   (or --type <ticket type>)`,
  ];
}
