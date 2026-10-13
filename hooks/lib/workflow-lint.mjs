// Lint for a Workflow script (KIT-T461): every agent() call must name its model and carry a
// label that starts with a bracketed model tag, because a workflow's agents fire no Agent
// PreToolUse and the harness shows a row per agent with only the label the script gave it.
//
//   lintWorkflowScript(script) -> [{ line, problem }]
//   WORKFLOW_ESCAPE            -> regex matching the inline `[allow-unlabelled-workflow: reason]` token
//
// The scan masks comments and string bodies first, so `agent(` inside a prompt string is not a
// call, then balances the call's parentheses and inspects its argument text.

export const WORKFLOW_ESCAPE = /\[allow-unlabelled-workflow:\s*\S[^\]]*\]/i;

const CALL = /(^|[^\w.$])agent\s*\(/g;
const MODEL_KEY = /(^|[\s{,])model\s*:/;
const LABEL_KEY = /(^|[\s{,])label\s*:\s*$/;
const SPREAD = /\.\.\./;

// Replace comment text and string/template bodies with filler so structure survives, keeping offsets.
function mask(src) {
  const out = src.split('');
  const fill = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = 'x'; };
  const template = (start) => {
    let i = start + 1;
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '`') return i;
      if (src[i] === '$' && src[i + 1] === '{') i = expression(i + 2) + 1;
      else i++;
    }
    return src.length - 1;
  };
  const expression = (start) => {
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '`') i = template(i);
      else if (c === '"' || c === "'") i = quoted(i);
      if (depth > 0) i++;
    }
    return i;
  };
  const quoted = (start) => {
    const q = src[start];
    let i = start + 1;
    while (i < src.length && src[i] !== q && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
    return i;
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      fill(i, stop);
      i = stop;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      fill(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      const end = quoted(i);
      fill(i + 1, end);
      i = end + 1;
    } else if (c === '`') {
      const end = template(i);
      fill(i + 1, end);
      i = end + 1;
    } else i++;
  }
  return out.join('');
}

// The index of the `)` closing the `(` at `open`, or -1.
function closeParen(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '(') depth++;
    else if (masked[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// True when the call's label value starts with `[` (a literal string or template).
function labelStartsWithTag(original, masked, argStart, argEnd) {
  const args = masked.slice(argStart, argEnd);
  const key = /(^|[\s{,])label\s*:\s*/g;
  let m;
  while ((m = key.exec(args))) {
    const valueAt = argStart + m.index + m[0].length;
    const q = original[valueAt];
    if ((q === '"' || q === "'" || q === '`') && original[valueAt + 1] === '[') return true;
  }
  return false;
}

export function lintWorkflowScript(script) {
  const src = String(script || '');
  const masked = mask(src);
  const problems = [];
  CALL.lastIndex = 0;
  let m;
  while ((m = CALL.exec(masked))) {
    const open = m.index + m[0].length - 1;
    const close = closeParen(masked, open);
    const line = lineOf(src, open);
    if (close === -1) { problems.push({ line, problem: 'unbalanced agent( call' }); continue; }
    const args = masked.slice(open + 1, close);
    const missing = [];
    if (!MODEL_KEY.test(args)) missing.push('model');
    if (!labelStartsWithTag(src, masked, open + 1, close)) missing.push("label starting with a bracketed model tag, e.g. label: '[Sonnet 5.5] ...'");
    if (SPREAD.test(args) && missing.length) missing.push('(options are spread: write model and label literally in the call)');
    if (missing.length) problems.push({ line, problem: `agent() needs ${missing.join(' and ')}` });
  }
  return problems;
}
