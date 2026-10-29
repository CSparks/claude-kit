// task-kill.mjs — end the Bash-tool shell tree behind a background task whose owner is gone (KIT-T699).
// A subagent has no TaskStop once it stops, so SubagentStop finds the task's shell by its command text in
// the shell's command line (under a claude ancestor) and ends that tree. Broker commands and commands too
// short to match safely are reported, not killed.
//
//   killOrphanTasks(orphans, { table?, kill? }) -> [{ id, command, killed: [pid] }]   orphans: [{ id, command }]

import { hasClaudeAncestor, killTree, processTable, toolShells } from './process-tree.mjs';

const SNIPPET_CHARS = 60;
const MIN_SNIPPET_CHARS = 12;
const BROKER_COMMAND = /broker\.mjs|scripts[\\/]broker[\\/]|target[\\/]broker/;
const squash = (text) => String(text).replace(/["'\\\s]+/g, '');

export function killOrphanTasks(orphans, { table, kill } = {}) {
  const out = [];
  if (!orphans.length) return out;
  const procs = table || processTable();
  for (const { id, command } of orphans) {
    const snippet = squash(command).slice(0, SNIPPET_CHARS);
    if (snippet.length < MIN_SNIPPET_CHARS || BROKER_COMMAND.test(command)) continue;
    const shells = toolShells(procs).filter((s) => hasClaudeAncestor(procs, s.pid) && squash(s.command).includes(snippet));
    const killed = shells.flatMap((s) => killTree(procs, s.pid, kill));
    if (killed.length) out.push({ id, command, killed });
  }
  return out;
}
