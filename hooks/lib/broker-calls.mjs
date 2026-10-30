// broker-calls.mjs — which broker scripts a shell command runs (KIT-D115).
//
//   brokerCalls(command) -> [{ script: 'submit'|'wait'|'watch'|'broker', words: [...], sub }]
//   usesCargo(command)   -> does any segment run `cargo`
//
// A call is a segment whose command word is `node`/a path to one of the broker scripts (after env
// assignments and loop keywords such as `do`); `sub` is the first positional word after `broker.mjs`. A shell wrapper
// (`bash -c`, `sh -c`, `pwsh -Command`, `cmd /c`, `eval`) is unwrapped to a depth of WRAP_DEPTH.
// Mentions inside a quoted argument of another command (`q code "wait.mjs"`) are not calls.

import { segments } from './shell-segments.mjs';

const WRAP_DEPTH = 4;
const SCRIPT = /^(submit|wait|watch|broker)\.mjs$/i;
const WRAPPER = /^(?:bash|sh|zsh|dash|cmd|cmd\.exe|pwsh|powershell|powershell\.exe|eval)$/i;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const LOOP_KEYWORD = /^(?:do|then|else|elif|while|until|if|!|\{)$/;
const base = (w) => w.replace(/^["']|["']$/g, '').replace(/\\/g, '/').split('/').pop();
const unquote = (s) => s.replace(/^(["'])([\s\S]*)\1$/, '$2');
const words = (text) => text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];

function callOf(ws) {
  const at = ws.findIndex((w) => !ENV_ASSIGN.test(w) && !LOOP_KEYWORD.test(w));
  if (at < 0) return null;
  const head = base(ws[at]).toLowerCase();
  const scriptWord = /^node(?:\.exe)?$/.test(head) ? ws.slice(at + 1).find((w) => !w.startsWith('-')) : ws[at];
  const m = scriptWord && SCRIPT.exec(base(scriptWord));
  if (!m) return null;
  const rest = ws.slice(ws.indexOf(scriptWord) + 1);
  return { script: m[1].toLowerCase(), words: rest, sub: rest.find((w) => !w.startsWith('-')) || '' };
}

// A line whose quoting cannot be paired is read word by word: each broker script word starts a call.
function wordCalls(command) {
  const ws = words(String(command || ''));
  return ws.flatMap((w, i) => (SCRIPT.test(base(w)) && i > 0 ? [callOf(ws.slice(i - 1))].filter(Boolean) : []));
}

export function brokerCalls(command, depth = 0) {
  const segs = segments(String(command || ''));
  const out = segs.ambiguous ? wordCalls(command) : [];
  for (const { text } of segs) {
    const ws = words(text);
    const call = callOf(ws);
    if (call) { out.push(call); continue; }
    const lead = ws.find((w) => !ENV_ASSIGN.test(w));
    if (depth < WRAP_DEPTH && lead && WRAPPER.test(base(lead))) {
      for (const w of ws) if (/^["']/.test(w) && w.length > 2) out.push(...brokerCalls(unquote(w), depth + 1));
    }
  }
  return out;
}

export function usesCargo(command, depth = 0) {
  for (const { text } of segments(String(command || ''))) {
    const ws = words(text);
    const lead = ws.find((w) => !ENV_ASSIGN.test(w));
    if (!lead) continue;
    if (/^cargo(?:\.exe)?$/i.test(base(lead))) return true;
    if (depth < WRAP_DEPTH && WRAPPER.test(base(lead)) && ws.some((w) => /^["']/.test(w) && w.length > 2 && usesCargo(unquote(w), depth + 1))) return true;
  }
  return false;
}
