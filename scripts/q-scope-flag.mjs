// q-scope-flag.mjs — `--scope <key|all>` and `--project <name>` on the verbs that take a positional
// [scope] (open, inbox, rundown, ...). fts already spells it that way; the other verbs accept the
// same spelling and read it as the positional, so one habit works on every verb.
//
//   scopeFlagToPositional(cmd, args) -> args with the flag replaced by the positional scope

import { projectScope } from './q-project.mjs';

export const SCOPED_VERBS = new Set(['open', 'inbox', 'confirmations', 'orphans', 'rundown', 'recent', 'regressions', 'supersedes', 'verify']);

export function scopeFlagToPositional(cmd, args) {
  if (!SCOPED_VERBS.has(cmd)) return args;
  const kept = [];
  let scope;
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    const inline = /^--(scope|project)=(.*)$/.exec(a);
    if (inline || a === '--scope' || a === '--project') {
      const flag = inline ? inline[1] : a.slice(2);
      const value = inline ? inline[2] : args[++i];
      if (value === undefined || value === '') throw new Error(`--${flag} takes a value`);
      scope = flag === 'project' ? projectScope(value) : value;
    } else kept.push(args[i]);
  }
  return scope === undefined ? kept : [...kept, scope];
}
