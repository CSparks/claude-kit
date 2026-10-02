// Comment-prose scanner behind the pre-write comment gate and scripts/comment-sweep.mjs
// (KIT-T283, folding in the backstory check KIT-T207). Comments say what the code is and how to
// use it — never the conversation that produced it.
//
//   commentRuns(src, ext)            -> [{ start, length, text }]   consecutive comment lines
//   narrationHits(src, ext)          -> [{ line, why, text }]       backstory / discussion comments
//   commentStats(src, ext)           -> { comment, code, ratio, longest }
//
// Line numbers are 1-based. Supported: // families, # families, -- families and /* */ blocks.

import { extOf } from '../../scripts/tree-walk.mjs';

export const RUN_WARN = 6;
export const RUN_BLOCK = 20;
export const RATIO_WARN = 0.4;
export const RATIO_MIN_LINES = 40;

const SLASH = new Set('js jsx mjs cjs ts tsx rs go java c cc cpp cxx h hpp cs swift kt php css scss less vue svelte wgsl glsl rhai'.split(' '));
const HASH = new Set('py rb sh bash zsh yaml yml toml pl r'.split(' '));
const DASH = new Set('sql lua hs'.split(' '));
const BLOCK = new Set('js jsx mjs cjs ts tsx rs go java c cc cpp cxx h hpp cs swift kt php css scss less vue svelte sql'.split(' '));
const LICENSE = /copyright|licen[sc]e|spdx/i;

const NARRATION = [
  [/\b20\d\d-\d\d-\d\d\b/, 'dated stamp (history belongs in git)'],
  [/\b(?:chris|the maintainer|the user)\b[’']?s?\s+(?:said|says|asked|wants?|wanted|told|decided|noted|reported|prefers?|rule)\b/i, 'attributes the code to a conversation'],
  [/\((?:chris|maintainer)\b|\b(?:chris|maintainer)\s+20\d\d|\bper (?:chris|the maintainer)\b/i, 'maintainer attribution'],
  [/\b(?:said|says|asked|told|wrote)\s*[:,]?\s*["“]/i, 'quoted discussion'],
  [/\b(?:we|i)\s+(?:discussed|decided|agreed|talked|used to|previously|originally)\b/i, 'narrates a decision process'],
  [/\bas (?:discussed|agreed)\b|\bin this (?:session|conversation|chat|thread)\b|\bearlier (?:today|this session)\b/i, 'refers to the conversation'],
  [/\b(?:damn|shit|fuck\w*|crap|wtf)\b/i, 'profanity'],
];

function prefixesFor(ext) {
  return { slash: SLASH.has(ext), hash: HASH.has(ext), dash: DASH.has(ext), block: BLOCK.has(ext) };
}

/** [{ line, text, isComment }] per source line; text has comment markers stripped. */
function classify(src, ext) {
  const p = prefixesFor(ext);
  const rows = [];
  let inBlock = false;
  src.split('\n').forEach((raw, i) => {
    const t = raw.trim();
    const line = i + 1;
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      rows.push({ line, isComment: true, text: t.replace(/^\*+\s?|\*\/\s*$/g, '').trim() });
      return;
    }
    if (p.block && t.startsWith('/*')) {
      inBlock = !t.includes('*/');
      rows.push({ line, isComment: true, text: t.replace(/^\/\*+!?\s?|\*\/\s*$/g, '').trim() });
      return;
    }
    const marked = (p.slash && t.startsWith('//')) || (p.hash && t.startsWith('#') && !t.startsWith('#!') && !(ext === 'rs')) || (p.dash && t.startsWith('--'));
    rows.push({ line, isComment: !!marked, text: marked ? t.replace(/^(?:\/\/[/!]?|#+|--)\s?/, '') : t });
  });
  return rows;
}

export function commentRuns(src, ext) {
  const runs = [];
  let cur = null;
  for (const r of classify(src, ext)) {
    if (r.isComment) {
      if (!cur) cur = { start: r.line, length: 0, text: [] };
      cur.length++;
      cur.text.push(r.text);
    } else if (cur) { runs.push({ start: cur.start, length: cur.length, text: cur.text.join('\n') }); cur = null; }
  }
  if (cur) runs.push({ start: cur.start, length: cur.length, text: cur.text.join('\n') });
  return runs.filter((r) => !(r.start === 1 && LICENSE.test(r.text)));
}

export function narrationHits(src, ext) {
  const out = [];
  for (const r of classify(src, ext)) {
    if (!r.isComment || !r.text) continue;
    for (const [re, why] of NARRATION) {
      if (re.test(r.text)) { out.push({ line: r.line, why, text: r.text.slice(0, 100) }); break; }
    }
  }
  return out;
}

export function commentStats(src, ext) {
  const rows = classify(src, ext).filter((r) => r.text || r.isComment);
  const comment = rows.filter((r) => r.isComment).length;
  const code = rows.length - comment;
  const longest = commentRuns(src, ext).reduce((m, r) => Math.max(m, r.length), 0);
  return { comment, code, ratio: rows.length ? comment / rows.length : 0, longest };
}
