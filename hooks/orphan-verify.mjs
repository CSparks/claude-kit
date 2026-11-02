// orphan-verify.mjs — keep only the never-exited shells that can still be alive (KIT-T834). A task output file without an
// end marker is a candidate, not proof: the harness leaves the marker off a task that failed, was killed with its agent, or
// was forgotten with its session, and TaskStop then answers "No task found" for a row the warning can never clear.
//
//   verifyOrphans(list, { project, procs? }) -> the rows still worth listing, each with `command` filled from the
//       session transcript and its subagent transcripts. A row is dropped when the session transcript holds a finished
//       <task-notification> for it, or when its command is known, the process list was read, and no process carries it.
//       A live match gains { pid, ppid, cmdline }; a row that cannot be checked (no command, no process list) stays with
//       { unverified: true }, so the check fails open.
//   finishedTasks(transcriptPath)  -> Set of task ids the harness reported completed / failed / killed / stopped
//   osProcesses()                  -> [{ pid, ppid, cmd }] of the machine, or null when it cannot be read
//
// CLAUDE_KIT_TRANSCRIPTS_BASE overrides `~/.claude/projects` (tests).

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { shellCommands } from './orphan-shells.mjs';

const NOTIFICATION = /<task-id>([a-z0-9]+)<\/task-id>[\s\S]{0,600}?<status>(?:completed|failed|killed|stopped)<\/status>/g;
const UNKNOWN_COMMAND = '(command unknown)';
const AGENT_OUTPUT = /^a[a-z0-9]{8,}\.output$/;
const SIGNATURE_TOKENS = 3;
const MIN_TOKEN_CHARS = 8;
const TOKEN_SPLIT = /[\s"'`|&;<>()]+/;
const PROCESS_LIST_TIMEOUT_MS = 15000;
const PS_LIST = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress';

const transcriptBase = () => process.env.CLAUDE_KIT_TRANSCRIPTS_BASE || join(homedir(), '.claude', 'projects');

export function finishedTasks(transcriptPath) {
  try { return new Set([...readFileSync(transcriptPath, 'utf8').matchAll(NOTIFICATION)].map((m) => m[1])); } catch { return new Set(); }
}

export function osProcesses() {
  try {
    if (process.platform === 'win32') {
      const rows = [].concat(JSON.parse(execFileSync('powershell', ['-NoProfile', '-Command', PS_LIST], { encoding: 'utf8', windowsHide: true, timeout: PROCESS_LIST_TIMEOUT_MS, maxBuffer: 1 << 26 })));
      return rows.map((r) => ({ pid: r.ProcessId, ppid: r.ParentProcessId, cmd: String(r.CommandLine || '') }));
    }
    const text = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8', timeout: PROCESS_LIST_TIMEOUT_MS, maxBuffer: 1 << 26 });
    return text.split('\n').map((l) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l)).filter(Boolean).map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), cmd: m[3] }));
  } catch { return null; }
}

// The longest few tokens of a command: quoting differs between the tool call and the process command line, words do not.
const signature = (command) => [...new Set(String(command).split(TOKEN_SPLIT).filter((t) => t.length >= MIN_TOKEN_CHARS))]
  .sort((a, b) => b.length - a.length).slice(0, SIGNATURE_TOKENS);

function commandsOf(transcript, tasksDir) {
  const commands = shellCommands(transcript);
  try {
    for (const name of readdirSync(tasksDir).filter((n) => AGENT_OUTPUT.test(n))) {
      for (const [id, command] of shellCommands(join(tasksDir, name))) if (!commands.has(id)) commands.set(id, command);
    }
  } catch { /* no subagent transcripts */ }
  return commands;
}

export function verifyOrphans(list, { project, procs = osProcesses } = {}) {
  const bySession = new Map();
  for (const row of list) bySession.set(row.session, [...(bySession.get(row.session) || []), row]);
  const kept = [];
  let processes;
  for (const [session, rows] of bySession) {
    const transcript = join(transcriptBase(), project, `${session}.jsonl`);
    const finished = finishedTasks(transcript);
    const commands = commandsOf(transcript, rows[0].tasksDir);
    for (const row of rows) {
      if (finished.has(row.id)) continue;
      const command = row.command !== UNKNOWN_COMMAND ? row.command : commands.get(row.id) || UNKNOWN_COMMAND;
      const tokens = command === UNKNOWN_COMMAND ? [] : signature(command);
      if (!tokens.length) { kept.push({ ...row, command, unverified: true }); continue; }
      if (processes === undefined) processes = procs();
      if (!processes) { kept.push({ ...row, command, unverified: true }); continue; }
      const live = processes.find((p) => p.pid !== process.pid && tokens.every((t) => p.cmd.includes(t)));
      if (live) kept.push({ ...row, command, pid: live.pid, ppid: live.ppid, cmdline: live.cmd });
    }
  }
  return kept.sort((a, b) => b.ageMin - a.ageMin);
}
