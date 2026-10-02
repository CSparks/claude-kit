// code-index-extract.mjs — what the code index knows about a file (KIT-T101): its kind/language
// from the extension, and its symbols from zero-dependency line patterns (KIT-D014: regex
// extraction by default; a tree-sitter cascade may refine accuracy later, never required).
//
//   classify(path)               -> { kind: code|doc|config, lang } | null (not indexed)
//   extractSymbols(lang, text)   -> [{ name, type, line, scope }]
//
// Symbol types: fn struct enum trait type mod const macro impl use class var section heading.

const LANG = {
  rs: 'rust', wgsl: 'wgsl', glsl: 'glsl', rhai: 'rhai', py: 'py', go: 'go', java: 'java', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
  js: 'js/ts', mjs: 'js/ts', cjs: 'js/ts', jsx: 'js/ts', ts: 'js/ts', tsx: 'js/ts', vue: 'js/ts', svelte: 'js/ts',
  cs: 'cs', kt: 'kt', swift: 'swift', rb: 'rb', php: 'php', sql: 'sql', sh: 'sh', ps1: 'ps1', css: 'css', scss: 'css', html: 'html',
  md: 'md', txt: 'txt', rst: 'rst', toml: 'toml', json: 'json', yaml: 'yaml', yml: 'yaml', ron: 'ron', ini: 'ini', cfg: 'ini',
};
const DOC = new Set(['md', 'txt', 'rst']);
const CONFIG = new Set(['toml', 'json', 'yaml', 'yml', 'ron', 'ini', 'cfg']);
const SKIP_NAMES = /(?:^|\/)(?:Cargo\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;

export function classify(path) {
  if (SKIP_NAMES.test(path)) return null;
  const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
  const lang = LANG[ext];
  if (!lang) return null;
  return { kind: DOC.has(ext) ? 'doc' : CONFIG.has(ext) ? 'config' : 'code', lang };
}

const VIS = String.raw`(?:pub(?:\([^)]*\))?\s+)?`;
const RUST = [
  [new RegExp(String.raw`^\s*${VIS}(?:default\s+)?(?:async\s+|const\s+|unsafe\s+|extern\s+"[^"]*"\s+)*fn\s+(\w+)`), 'fn'],
  [new RegExp(String.raw`^\s*${VIS}(struct|enum|trait|union|type|mod)\s+(\w+)`), null],
  [new RegExp(String.raw`^\s*${VIS}(const|static)\s+(?:mut\s+)?(\w+)\s*:`), 'const'],
  [/^\s*macro_rules!\s+(\w+)/, 'macro'],
];
const WGSL = [
  [/^\s*fn\s+(\w+)/, 'fn'],
  [/^\s*struct\s+(\w+)/, 'struct'],
  [/^\s*(?:const|override|let)\s+(\w+)/, 'const'],
  [/^\s*(?:@[^\n]*?\s)?var(?:<[^>]*>)?\s+(\w+)/, 'var'],
];
const JS = [
  [/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/, 'fn'],
  [/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/, 'class'],
  [/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\(|function|[\w$]+\s*=>)/, 'fn'],
  [/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\b/, 'const'],
  [/^\s*(?:export\s+)?(?:interface|type|enum)\s+(\w+)/, 'type'],
];
const PY = [[/^\s*(?:async\s+)?def\s+(\w+)/, 'fn'], [/^\s*class\s+(\w+)/, 'class']];
const BY_LANG = { rust: RUST, wgsl: WGSL, glsl: WGSL, rhai: WGSL, 'js/ts': JS, py: PY };

const IMPL = /^\s*(?:unsafe\s+)?impl(?:<[^>]*>)?\s+(?:([\w:<>, &']+?)\s+for\s+)?([\w:]+)/;
const USE = /^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/;

function useLeaves(spec) {
  const out = [];
  const walk = (prefix, s) => {
    const brace = s.indexOf('{');
    if (brace < 0) {
      const leaf = s.trim().split(/\s+as\s+/).pop().split('::').pop();
      if (leaf && leaf !== '*' && leaf !== 'self') out.push({ name: leaf, scope: prefix + s.trim().replace(/\s+as\s+.*/, '') });
      return;
    }
    const head = prefix + s.slice(0, brace).trim();
    const inner = s.slice(brace + 1, s.lastIndexOf('}'));
    let depth = 0;
    let cur = '';
    for (const ch of inner) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (ch === ',' && !depth) { walk(head, cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) walk(head, cur);
  };
  walk('', spec.replace(/\s+/g, ' '));
  return out;
}

export function extractSymbols(lang, text) {
  const out = [];
  const lines = text.split('\n');
  const rules = BY_LANG[lang] || [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    if (lang === 'md') {
      const h = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
      if (h) out.push({ name: h[1], type: 'heading', line: n, scope: '' });
      continue;
    }
    if (lang === 'toml') {
      const sec = /^\s*\[\[?([^\]]+)\]\]?\s*$/.exec(line);
      if (sec) out.push({ name: sec[1], type: 'section', line: n, scope: '' });
      continue;
    }
    if (lang === 'rust') {
      const imp = IMPL.exec(line);
      if (imp) { out.push({ name: imp[2].split('::').pop(), type: 'impl', line: n, scope: imp[1] || '' }); continue; }
      const use = USE.exec(line);
      if (use) { for (const u of useLeaves(use[1])) out.push({ name: u.name, type: 'use', line: n, scope: u.scope }); continue; }
    }
    for (const [re, type] of rules) {
      const m = re.exec(line);
      if (!m) continue;
      const name = m[m.length - 1]; // the last group is the identifier; a leading group is the keyword
      out.push({ name, type: type || m[1], line: n, scope: '' });
      break;
    }
  }
  return out;
}
