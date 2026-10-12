// code-graph-families.mjs — code-graph's per-language extraction table (KIT-T012): each family
// names its extensions, `imports` patterns (group 1 = module/path string) and `defs` patterns
// (group 1 = symbol name, with a kind). code-graph.mjs applies it; the query-gate reads it to
// state which languages the graph covers (KIT-T424).
//
// Import EDGES resolve only for relative specifiers (`./x`, `../y`), which in practice is the
// js family; every other family contributes definitions and external import nodes.

export const FAMILIES = [
  {
    name: 'js',
    exts: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],
    imports: [
      /^\s*import\b[^'"]*['"]([^'"]+)['"]/,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/,
      /^\s*export\b[^'"]*\bfrom\s+['"]([^'"]+)['"]/,
    ],
    defs: [
      [/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, 'function'],
      [/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
      [/^\s*(?:export\s+)?(?:abstract\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/, 'type'],
      [/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/, 'const'],
    ],
  },
  {
    name: 'python',
    exts: ['.py'],
    imports: [/^\s*import\s+([\w.]+)/, /^\s*from\s+([\w.]+)\s+import\b/],
    defs: [
      [/^\s*def\s+([A-Za-z_]\w*)/, 'function'],
      [/^\s*class\s+([A-Za-z_]\w*)/, 'class'],
    ],
  },
  {
    name: 'rust',
    exts: ['.rs'],
    imports: [/^\s*use\s+([\w:]+)/, /^\s*(?:pub\s+)?mod\s+(\w+)/],
    defs: [
      [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/, 'function'],
      [/^\s*(?:pub\s+)?(?:struct|enum|trait|type)\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
  {
    name: 'go',
    exts: ['.go'],
    imports: [/^\s*import\s+(?:[\w.]+\s+)?["`]([^"`]+)["`]/],
    defs: [
      [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, 'function'],
      [/^\s*type\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
  {
    name: 'c-family',
    exts: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.java', '.cs'],
    imports: [/^\s*#\s*include\s+[<"]([^>"]+)[>"]/, /^\s*import\s+([\w.]+);/],
    defs: [
      [/^\s*(?:public|private|protected|static|final|\s)*\bclass\s+([A-Za-z_]\w*)/, 'class'],
      [/^\s*(?:struct|enum|interface)\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
];
