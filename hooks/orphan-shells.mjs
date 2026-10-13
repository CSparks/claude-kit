// Background shells that never exited (KIT-T455). A Bash `run_in_background` shell writes its
// output to `<tmp>/claude/<project>/<session>/tasks/<id>.output` and ends the file with
// `[exited with code N]` (or `[killed]` once TaskStop ends it); one with neither marker is still
// running or its owner is gone, and it sits in the maintainer's task list with a dead timer. Pure reads, fail-open.
//
//   orphanShells({ project, session?, ids?, minAgeMin?, commands?, now?, base? }) -> [{ id, ageMin, command }]
//   shellCommands(transcriptPath)  -> Map<taskId, command> of the background shells a transcript started
//   orphanLines(list)              -> ['ORPHAN SHELLS: <id> <age> <first 80 chars of command>', ...]
//   projectSlug(root)              -> the harness's directory name for a project root
//
// CLAUDE_KIT_TASKS_BASE overrides `<tmp>/claude` (tests). Check id: orphan-shells.

import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathExcluded, excludeFooter } from './lib.mjs';

export const CHECK_ID = 'orphan-shells';
export const ORPHAN_AGE_MIN = 30;
const SHELL_OUTPUT = /^(b[a-z0-9]{5,12})\.output$/;
const END_MARKS = ['[exited with code', '[killed]'];
const TAIL_BYTES = 512;
const MAX_AGE_MIN = 2880; // older than two days is a long-dead leftover, not a live problem
const COMMAND_CLIP = 80;
const MS_PER_MIN = 60000;
const TASK_ID = /\bID:\s*([a-z0-9]+)/;

export const projectSlug = (root) => String(root).replace(/[^A-Za-z0-9-]/g, '-');
const baseDir = () => process.env.CLAUDE_KIT_TASKS_BASE || join(tmpdir(), 'claude');

function exited(file) {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  try {
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    const tail = buf.toString('utf8');
    return END_MARKS.some((mark) => tail.includes(mark));
  } finally {
    closeSync(fd);
  }
}

function taskDirs(project, session) {
  const projectDir = join(baseDir(), project);
  try {
    const sessions = session ? [session] : readdirSync(projectDir);
    return sessions.map((s) => join(projectDir, s, 'tasks'));
  } catch {
    return [];
  }
}

/** Never-exited background shells of a project (or one session); `ids` restricts to those task ids. */
export function orphanShells({ project, session, ids, minAgeMin = 0, commands = new Map(), now = Date.now(), skip = () => false }) {
  const out = [];
  for (const dir of taskDirs(project, session)) {
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      const id = SHELL_OUTPUT.exec(name)?.[1];
      if (!id || (ids && !ids.includes(id)) || skip(id)) continue;
      try {
        const file = join(dir, name);
        const st = statSync(file);
        const started = Math.min(st.birthtimeMs || st.mtimeMs, st.mtimeMs);
        const ageMin = Math.floor((now - started) / MS_PER_MIN);
        if (ageMin < minAgeMin || ageMin > MAX_AGE_MIN || exited(file)) continue;
        out.push({ id, ageMin, command: commands.get(id) || '(command unknown)' });
      } catch { /* vanished or unreadable — skip */ }
    }
  }
  return out.sort((a, b) => b.ageMin - a.ageMin);
}

const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join('\n') : '');

/** Task id -> command for every background shell the transcript started. */
export function shellCommands(transcriptPath) {
  const byToolUse = new Map();
  const byTask = new Map();
  let lines;
  try { lines = readFileSync(transcriptPath, 'utf8').split('\n'); } catch { return byTask; }
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === 'tool_use' && block.input?.run_in_background) byToolUse.set(block.id, String(block.input.command || ''));
      if (block?.type === 'tool_result' && byToolUse.has(block.tool_use_id)) {
        const task = TASK_ID.exec(textOf(block.content))?.[1];
        if (task) byTask.set(task, byToolUse.get(block.tool_use_id));
      }
    }
  }
  return byTask;
}

export const orphanLines = (list) => list.map((o) => `ORPHAN SHELLS: ${o.id} ${o.ageMin}m ${o.command.replace(/\s+/g, ' ').trim().slice(0, COMMAND_CLIP)}`);

/** Predicate for orphanShells: a task id the project excluded under the orphan-shells check. */
export const excludedIds = (root) => (id) => pathExcluded(root, CHECK_ID, `${id}.output`);

/** Orphan shells the subagent behind SubagentStop payload `p` started and never closed. */
export function subagentOrphans(p, root) {
  const commands = shellCommands(String(p.agent_transcript_path || p.agentTranscriptPath || ''));
  if (!commands.size) return [];
  return orphanShells({ project: projectSlug(p.cwd || root), session: p.session_id, ids: [...commands.keys()], commands, skip: excludedIds(root) });
}

/** The Stop-nag text for `list`, with the exclusion footer. */
export const nagText = (list) => `⚠ ${list.length} background shell(s) never exited — stop them (TaskStop) so they leave the task list:
${orphanLines(list).map((l) => '  ' + l).join('\n')}
${excludeFooter(CHECK_ID)}`;
