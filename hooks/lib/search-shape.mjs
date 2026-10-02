// What kind of search is this tool call? (KIT-T285.) One classifier shared by the live
// PostToolUse hook and the transcript scan in scripts/search-report.mjs, so the measured
// baseline and the tracked log use the same definition.
//
//   classifyCalls(toolName, input) -> [{ tool, kind, verb?, lang, target, pattern, shape }]
//
// kind: 'q' | 'code-graph' | 'grep' | 'rg' | 'find' | 'Grep' | 'Glob'
// target: 'store' (the .ai work store) | 'code'
// shape (grep-likes only): identifier | definition | path-ish | phrase | regex

import { segments } from './shell-segments.mjs';

const LANG_BY_EXT = {
  rs: 'rust', wgsl: 'wgsl', glsl: 'glsl', toml: 'toml', md: 'md', py: 'py', json: 'json',
  js: 'js/ts', mjs: 'js/ts', cjs: 'js/ts', ts: 'js/ts', tsx: 'js/ts', jsx: 'js/ts',
};
const RG_TYPES = { rust: 'rust', py: 'py', python: 'py', js: 'js/ts', ts: 'js/ts', md: 'md', toml: 'toml', json: 'json' };
const GREP_TOOLS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack']);
const STORE = /\.ai[\\/]|[\\/]projects[\\/][^\\/\s"']+[\\/](?:tickets|decisions|inbox|questions|notes)[\\/]/i;
const PATTERN_MAX = 120;
const Q_VERB = /q\.mjs["']?\s+(?:--\S+\s+)*([a-z-]+)/i;

function langOf(text) {
  for (const m of text.matchAll(/(?:--include|--glob|-g)\s*[=\s]?["']?\*?\.?([A-Za-z0-9]+)["']?/g)) {
    const l = LANG_BY_EXT[m[1].toLowerCase()];
    if (l) return l;
  }
  for (const m of text.matchAll(/(?:-t|--type)\s+([A-Za-z0-9]+)/g)) if (RG_TYPES[m[1].toLowerCase()]) return RG_TYPES[m[1].toLowerCase()];
  for (const m of text.matchAll(/\.([A-Za-z0-9]{1,5})(?=["'\s*]|$)/g)) {
    const l = LANG_BY_EXT[m[1].toLowerCase()];
    if (l) return l;
  }
  return '';
}

export function shapeOf(pattern) {
  const p = String(pattern || '').trim();
  if (!p) return 'regex';
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(p)) return 'identifier';
  if (/^(?:pub\s+)?(?:fn|struct|enum|trait|impl|type|const|static|mod|class|function|def)\b/.test(p.replace(/^\\b/, ''))) return 'definition';
  if (/^[\w./\\-]+$/.test(p) && /[./\\]/.test(p)) return 'path-ish';
  if (/[\\^$[\]()|+?{}]/.test(p)) return 'regex';
  return 'phrase';
}

function positionals(toks, skip) {
  const out = [];
  for (let i = skip; i < toks.length; i++) {
    const t = toks[i];
    if (t.startsWith('-')) {
      if (/^(?:-[ABCmgtjd]|--(?:include|glob|type|max-count|context|exclude|regexp))$/.test(t)) i++;
      continue;
    }
    out.push(t.replace(/^["']|["']$/g, ''));
  }
  return out;
}

function fromSegment(text, piped) {
  const toks = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (!toks.length) return null;
  let tool = toks[0].replace(/.*[\\/]/, '').toLowerCase();
  let skip = 1;
  if (tool === 'xargs') { toks.shift(); while (toks[0] && toks[0].startsWith('-')) toks.shift(); tool = (toks[0] || '').replace(/.*[\\/]/, '').toLowerCase(); }
  if (tool === 'node' && /q\.mjs/.test(text)) {
    const m = text.match(Q_VERB);
    return { tool: 'Bash', kind: 'q', verb: m ? m[1] : '', lang: '', target: 'code', pattern: '', shape: '' };
  }
  if (tool === 'node' && /code-graph\.mjs/.test(text)) {
    const m = text.match(/--query\s+([a-z-]+)/);
    return { tool: 'Bash', kind: 'code-graph', verb: m ? m[1] : '', lang: '', target: 'code', pattern: '', shape: '' };
  }
  const git = tool === 'git' && (toks[1] || '').toLowerCase() === 'grep';
  if (git) skip = 2;
  if (GREP_TOOLS.has(tool) || git) {
    const pos = positionals(toks, skip);
    if (piped && pos.length <= 1) return null; // filtering another command's output, not searching files
    const pattern = (pos[0] || '').slice(0, PATTERN_MAX);
    return {
      tool: 'Bash', kind: tool === 'rg' ? 'rg' : 'grep', lang: langOf(text), target: STORE.test(text) ? 'store' : 'code',
      pattern, shape: shapeOf(pattern),
    };
  }
  if (tool === 'find' || tool === 'get-childitem' || tool === 'gci') {
    return { tool: 'Bash', kind: 'find', lang: langOf(text), target: STORE.test(text) ? 'store' : 'code', pattern: '', shape: '' };
  }
  return null;
}

export function classifyCalls(toolName, input) {
  const i = input || {};
  if (toolName === 'Grep') {
    const pattern = String(i.pattern || '').slice(0, PATTERN_MAX);
    const lang = RG_TYPES[String(i.type || '').toLowerCase()] || langOf(`${i.glob || ''} ${i.path || ''}`);
    return [{ tool: 'Grep', kind: 'Grep', lang, target: STORE.test(String(i.path || '')) ? 'store' : 'code', pattern, shape: shapeOf(pattern) }];
  }
  if (toolName === 'Glob') {
    return [{ tool: 'Glob', kind: 'Glob', lang: langOf(String(i.pattern || '')), target: STORE.test(String(i.path || '')) ? 'store' : 'code', pattern: String(i.pattern || '').slice(0, PATTERN_MAX), shape: '' }];
  }
  if (toolName === 'Bash' || toolName === 'PowerShell') {
    return segments(String(i.command || '')).map((s) => fromSegment(s.text, s.after === '|')).filter(Boolean);
  }
  return [];
}
