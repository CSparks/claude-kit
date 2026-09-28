// Classifies one git command segment as a branch/checkout-multiplying operation (KIT-D039).
// Pure over tokens: callers supply `isBranch(name)` and `isDefault(name)` lookups; a clone is
// returned as { clone: { src, dest } } for the caller to resolve against the filesystem.
//
// classifyGitSegment(tokens, lookups) → '' (allowed) | { flip: '<git …>' } | { clone: {src, dest} }

const GLOBAL_VALUE_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const BRANCH_DELETE = new Set(['-d', '-D', '--delete']);
const BRANCH_RENAME_COPY = new Set(['-m', '-M', '-c', '-C', '--move', '--copy']);
const BRANCH_READONLY = new Set([
  '-l', '--list', '-a', '--all', '-r', '--remotes', '-v', '-vv', '--verbose', '--show-current',
  '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format',
  '-u', '--set-upstream-to', '--unset-upstream', '--edit-description',
]);
const CLONE_VALUE_OPTS = new Set([
  '-o', '--origin', '-b', '--branch', '-u', '--upload-pack', '--reference', '--reference-if-able',
  '--separate-git-dir', '--depth', '--shallow-since', '--shallow-exclude', '-c', '--config',
  '-j', '--jobs', '--filter', '--template', '--server-option', '--bundle-uri',
]);

export const tokenize = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);

// Tokens after `git`, with git's global options skipped → { sub, rest }.
export function subcommand(toks) {
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (GLOBAL_VALUE_OPTS.has(t)) { i += 2; continue; }
    if (t.startsWith('-')) { i++; continue; }
    break;
  }
  return { sub: toks[i], rest: toks.slice(i + 1) };
}

const optName = (t) => t.split('=')[0];
const show = (sub, rest) => ({ flip: `git ${sub} ${rest.join(' ')}`.trim() });

function classifySwitch(rest, { isDefault }) {
  const args = rest.filter((t) => !/^(-h|--help)$/.test(t));
  if (!args.length) return '';
  const creates = args.some((t) => /^(-c|-C|--create|--force-create|--orphan)$/.test(optName(t)));
  const target = args.find((t) => !t.startsWith('-'));
  if (!creates && target && isDefault(target)) return '';
  return show('switch', rest);
}

function classifyCheckout(rest, { isBranch, isDefault }) {
  if (rest.includes('--')) return '';
  if (rest.some((t) => /^(-b|-B|--orphan)$/.test(t))) return show('checkout', rest);
  const operand = rest.find((t) => !t.startsWith('-'));
  if (operand && isBranch(operand) && !isDefault(operand)) return { flip: `git checkout ${operand}` };
  return '';
}

function classifyBranch(rest) {
  const opts = rest.filter((t) => t.startsWith('-')).map(optName);
  if (opts.some((o) => BRANCH_DELETE.has(o))) return '';
  if (opts.some((o) => BRANCH_RENAME_COPY.has(o))) return show('branch', rest);
  if (opts.some((o) => BRANCH_READONLY.has(o))) return '';
  return rest.some((t) => !t.startsWith('-')) ? show('branch', rest) : '';
}

function classifyClone(rest) {
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === '--') { positional.push(...rest.slice(i + 1)); break; }
    if (t.startsWith('-')) { if (CLONE_VALUE_OPTS.has(t)) i++; continue; }
    positional.push(t);
  }
  return positional.length ? { clone: { src: positional[0], dest: positional[1] || '' } } : '';
}

export function classifyGitSegment(toks, lookups) {
  const { sub, rest } = subcommand(toks);
  switch (sub) {
    case 'switch': return classifySwitch(rest, lookups);
    case 'checkout': return classifyCheckout(rest, lookups);
    case 'branch': return classifyBranch(rest);
    case 'worktree': return rest[0] === 'add' ? show('worktree', rest) : '';
    case 'clone': return classifyClone(rest);
    default: return '';
  }
}
