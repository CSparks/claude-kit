// train-commands.mjs — the one command list a train runs (KIT-T482 item 1): each member's own
// commands (its affected land gate when it lands or gave none, else its commands or
// verify_default), merged in member order with duplicates run once, then coalesced into one
// nextest run under `runner: nextest`. Every command keeps the ids of the members that asked
// for it, so a failure can be traced back (train-blame.mjs).
//
// Call it with every member's files written: the land gate reads test targets from the tree.
// `trainCommands(cfg, cwd, members)` → { commands: [{ cmd, owners, from }], perMember: Map<id, { commands, selection }> }.

import { coalesce } from './coalesce.mjs';
import { jobCommands } from './job-commands.mjs';
import { landGate } from './landgate.mjs';

function memberCommands(cfg, cwd, m) {
  const job = m.job;
  const wantsGate = job.land || ((job.ops || []).length && !(job.commands || []).length);
  const gated = wantsGate ? landGate(cfg, cwd, job, m.plan.files) : null;
  return gated ? { commands: gated.commands, selection: gated.selection } : { commands: jobCommands(cfg, job), selection: null };
}

export function trainCommands(cfg, cwd, members) {
  const perMember = new Map();
  const owners = new Map();
  for (const m of members) {
    const own = memberCommands(cfg, cwd, m);
    perMember.set(m.job.id, own);
    for (const c of own.commands) {
      const cmd = String(c).trim();
      if (!owners.has(cmd)) owners.set(cmd, new Set());
      owners.get(cmd).add(m.job.id);
    }
  }
  const list = [...owners.keys()];
  const slots = cfg.runner === 'nextest' ? coalesce(list) : list.map((cmd) => ({ cmd, from: null }));
  const commands = slots.map((s) => {
    const ids = new Set((s.from || [s.cmd]).flatMap((c) => [...(owners.get(String(c).trim()) || [])]));
    return { cmd: s.cmd, from: s.from, owners: members.map((m) => m.job.id).filter((id) => ids.has(id)) };
  });
  return { commands, perMember };
}
