// command-leads.mjs — the commands a shell line may run, read from the START of each piece (KIT-T784).
//
//   commandLeads(cmd) -> [{ tool, args }]   tool: lower-case basename of the command word
//   withoutDataArguments(cmd) -> string     the command with quoted arguments emptied when every command takes data
//
// The line is cut on every operator whatever the quoting (`blindSegments`), so a command hidden behind an
// escaped quote still leads its own piece. Words inside a quoted argument (a commit message, a `node -e`
// program) are not leads. Env assignments, loop keywords and `time`/`sudo`/`command`/`exec`/`nohup`/`env`
// are skipped; `xargs` lists every later word as a lead, since its option values are not parsed.

import { isDataCommand } from './data-command.mjs';
import { blindSegments, segments } from './shell-segments.mjs';

const SKIP = /^(?:do|then|else|elif|while|until|if|!|\{|\(|time|sudo|command|exec|nohup|env)$/i;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const name = (word) => word.replace(/^[({`$]+/, '').replace(/^["']|["']$/g, '').replace(/\\/g, '/').split('/').pop().toLowerCase();

const blankQuotes = (text) => {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const end = ch === '"' || ch === "'" ? text.indexOf(ch, i + 1) : -1;
    if (end < 0) { out += ch; continue; }
    const span = text.slice(i, end + 1);
    out += ch === '"' && /\$\(|`/.test(span) ? span : ch + ch;
    i = end;
  }
  return out;
};

/** The command text with its quoted arguments emptied when every command on the line takes text as data (a `git commit -m`, a `t notes`); `$(…)` stays. */
export function withoutDataArguments(cmd) {
  const parts = segments(String(cmd || ''));
  if (parts.ambiguous) return parts.text;
  const allData = parts.every(({ text }) => !text.trim() || isDataCommand(text.trim().split(/\s+/)));
  return allData ? blankQuotes(parts.text) : parts.text;
}

export function commandLeads(cmd) {
  const leads = [];
  for (const { text } of blindSegments(String(cmd || ''))) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    let at = 0;
    while (at < words.length && (ENV_ASSIGN.test(words[at]) || SKIP.test(words[at]))) at++;
    if (at >= words.length) continue;
    const tool = name(words[at]);
    if (tool === 'xargs') {
      for (let k = at + 1; k < words.length; k++) leads.push({ tool: name(words[k]), args: words.slice(k + 1) });
      continue;
    }
    leads.push({ tool, args: words.slice(at + 1) });
  }
  return leads;
}
