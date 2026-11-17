// variable-leader.mjs — the command a bare `$NAME` leads a segment with, when the command itself assigns NAME once (KIT-T1336).
// `T="node $HOME/.../t.mjs"; $T session "..."` runs the kit's t.mjs; the write scan judges the segment as that call, so its
// quoted arguments are data and a variable holding `cp` is read as a copy. Judged for what the command NAMES, never for what it
// may write: an assignment counts when it is the only write to the name, a bare bash `NAME=value` segment that a `;`, `&&` or
// the start of the command joins to the segment after it, with no substitution in the value. PowerShell is not read.
//
//   leaderValues(parts, shell) -> Map<segment, Map<name, value>>   the leader values each segment of `parts` can name
//   resolveLeader(text, values) -> text   `text` with a leading bare `$NAME` / `${NAME}` replaced by its value; else `text` itself

import { bashAssignments, writesTo } from './shell-variables.mjs';
import { fromCommandWord } from './command-lead.mjs';

const BASH = 'bash';
const SEQUENCE_BEFORE = new Set(['start', ';', '&&']);
const SEQUENCE_AFTER = new Set([';', '&&']);
const SUBSTITUTING_VALUE = /[`\n]|\$\(|\$\{[^}]*=|[<>]\(|\$\[/;
const REBOUND_NAMES = /^(?:IFS|PATH|pwd|oldpwd|random|srandom|seconds|lineno|bashpid|reply|optind|optarg|shlvl|_)$/i;
const LEADING_VARIABLE = /^\$(?:\{(\w+)\}|(\w+))(?=\s|$)/;

export function leaderValues(parts, shell) {
  const reads = new Map();
  if (shell !== BASH || parts.ambiguous) return reads;
  const known = new Map();
  parts.forEach((seg, i) => {
    reads.set(seg, new Map(known));
    const next = parts[i + 1];
    if (!next || !SEQUENCE_BEFORE.has(seg.after) || !SEQUENCE_AFTER.has(next.after)) return;
    for (const [name, value] of bashAssignments(seg.text) || []) {
      if (!SUBSTITUTING_VALUE.test(value) && !REBOUND_NAMES.test(name) && writesTo(parts.text, name, BASH) === 1) known.set(name, value);
    }
  });
  return reads;
}

export function resolveLeader(text, values) {
  if (!values || !values.size) return text;
  const lead = fromCommandWord(text);
  const m = LEADING_VARIABLE.exec(lead);
  const value = m ? values.get(m[1] || m[2]) : undefined;
  return value === undefined ? text : value + lead.slice(m[0].length);
}
