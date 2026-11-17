// one-file-search.mjs — a pattern search of ONE named file with a text tool (KIT-D134, KIT-T1342). `q code <text> --dir <file>`
// answers it for any file (indexed, gitignored, outside the repo) and the Read tool shows the file, so the retrieval gate
// blocks the shell form. Reading is not searching: cat, head, tail and a bare `sed -n 1,40p` stay allowed.
//
//   oneFileSearch(tool, argv, { git }) -> { files, pattern } | null   grep/rg/ag/ack, git grep, `sed -n '/x/p'`, `awk '/x/'`, Select-String
//   fedFile(tool, argv) -> path | null                                  the one named file a cat/head/tail/type/sed-range reads (it feeds `| grep`)
//   fedSearch(tool, argv, file) -> { files, pattern } | null            the grep that filters that file
//   exemptFiles(files, { root, cwd }) -> boolean                        session scratch and files outside every adopted repo, never a dependency file
//   oneFileMsg({ command, files, pattern, q, root, cwd }) -> string    the block text with the exact q equivalent

import { searchPaths, targetsOnlyFiles, isConcreteFile } from './search-targets.mjs';
import { fileOperands } from './store-search.mjs';
import { quote, indexEquivalent } from './index-answerable.mjs';
import { registryFileTarget, registryLine } from './registry-target.mjs';
import { targetsOnlyScratch } from './pipe-tree-search.mjs';
import { targetsOutsideRepos } from './search-outside.mjs';

const GREP = /^(?:grep|egrep|fgrep|rg|ag|ack)$/;
const SED_QUIET = /^-[A-Za-z]*n[A-Za-z]*$|^--(?:quiet|silent)$/;
const SED_IN_PLACE = /^-[A-Za-z]*i|^--in-place/;
const SED_SCRIPT_FLAG = /^-[A-Za-z]*[ef]$|^--(?:expression|file)\b/;
const ADDRESS_PATTERN = /^\s*\/((?:[^/\\]|\\.)+)\//;
const PS_PATH = /^-(?:literal)?path$/i;
const PS_PATTERN = /^-pattern$/i;
const COUNT_ARG = /^\d+$/;
const unquote = (a) => a.replace(/^["']|["']$/g, '');
const flagValue = (argv, name) => unquote(argv[argv.findIndex((a) => name.test(a)) + 1] || '');

function addressSearch(tool, argv) {
  const flags = argv.filter((a) => a.startsWith('-'));
  if (tool === 'sed' && (!flags.some((a) => SED_QUIET.test(a)) || flags.some((a) => SED_IN_PLACE.test(a) || SED_SCRIPT_FLAG.test(a)))) return null;
  const [script = '', ...files] = argv.filter((a) => !a.startsWith('-')).map(unquote);
  const address = ADDRESS_PATTERN.exec(script);
  return address && targetsOnlyFiles(files) ? { files, pattern: address[1], regex: true } : null;
}

function powershellSearch(argv) {
  const named = flagValue(argv, PS_PATH).split(',').map(unquote).filter(Boolean);
  const positionals = argv.filter((a) => !a.startsWith('-')).map(unquote);
  const byFlag = flagValue(argv, PS_PATTERN);
  const files = named.length ? named : positionals.slice(byFlag ? 0 : 1);
  const pattern = byFlag || positionals[0] || null;
  return targetsOnlyFiles(files) ? { files, pattern, regex: true } : null;
}

export function oneFileSearch(tool, argv, { git = false } = {}) {
  if (GREP.test(tool) || git) {
    const files = searchPaths(argv, { git });
    return targetsOnlyFiles(files) ? { files, pattern: null, regex: false } : null;
  }
  if (tool === 'sed' || tool === 'awk') return addressSearch(tool, argv);
  return tool === 'select-string' || tool === 'sls' ? powershellSearch(argv) : null;
}

export function fedFile(tool, argv) {
  const readers = /^(?:cat|head|tail|type|get-content|gc)$/.test(tool);
  if (!readers && tool !== 'sed') return null;
  const operands = fileOperands(tool, argv).filter((a) => !COUNT_ARG.test(a));
  return operands.length === 1 && isConcreteFile(operands[0]) ? operands[0] : null;
}

/** A grep-family or Select-String search with no file operand, fed `file` by the previous segment, searches that file. */
export function fedSearch(tool, argv, file) {
  if (GREP.test(tool)) return searchPaths(argv).length === 0 ? { files: [file], pattern: null, regex: false } : null;
  const positionals = argv.filter((a) => !a.startsWith('-'));
  const pathless = !argv.some((a) => PS_PATH.test(a)) && positionals.length <= 1;
  return (tool === 'select-string' || tool === 'sls') && pathless ? { files: [file], pattern: flagValue(argv, PS_PATTERN) || unquote(positionals[0] || '') || null, regex: true } : null;
}

export function exemptFiles(files, { root, cwd }) {
  if (registryFileTarget(files.join(' '))) return false;
  return targetsOnlyScratch(files) || targetsOutsideRepos(files, root, cwd);
}

function equivalentLine({ command, files, pattern, regex, q, root, cwd }) {
  const dependency = registryFileTarget(files.join(' '));
  if (dependency) return registryLine(dependency.spec, pattern, q);
  const exact = indexEquivalent(command, { qPath: q, root, cwd, file: true });
  if (exact) return exact.q;
  const text = pattern ? quote(pattern) : '<text>';
  return `node "${q}" code ${text}${regex ? ' --regex' : ''} --dir ${files.length === 1 ? quote(files[0]) : '<file>'}`;
}

const MSG_WIDTH = 120;
const trunc = (s) => (s.length > MSG_WIDTH ? `${s.slice(0, MSG_WIDTH - 3)}...` : s);

export function oneFileMsg(call) {
  const { command, files, q } = call;
  return [
    '',
    'BLOCKED: a pattern search of a named file with a text tool (q code searches any file; Read shows it).',
    `  ${trunc(command)}`,
    '',
    `Exact equivalent:  ${equivalentLine(call)}`,
    ...(files.length > 1 ? ['  --dir takes one path: run it once per file, or scope with --path <dir> when they share one.'] : []),
    '',
    'Read a file or a line range with the Read tool (offset, limit): no search, no grep.',
    `Logs, build output, gitignored or sibling-checkout files: node "${q}" code <text> --dir <path> [-c|-l] [-i] [--regex] [-C 2].`,
    "Still allowed: filtering a command's own output (cargo test 2>&1 | grep -E 'test result|FAILED' | tail -20),",
    'files in a session scratchpad or outside every adopted repo, and the Grep tool on ONE file.',
    'If q ERRORS or answers wrongly: HARD STOP — `cap bug <what failed>`, then fix it (KIT-T236).',
    '',
  ].join('\n');
}
