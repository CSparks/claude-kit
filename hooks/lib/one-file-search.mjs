// one-file-search.mjs — a pattern search of ONE named file with a text tool (KIT-D134, KIT-T1342). `q code <text> --dir <file>`
// answers it for any file (indexed, gitignored, outside the repo) and the Read tool shows the file, so the retrieval gate
// blocks the shell form. A line-range read of one named file (head, a non-following tail, `sed -n 1,40p`) is Read's, and is
// blocked the same way (KIT-T1551); cat of a whole file and any command's own output filtered through head or tail stay allowed.
//
//   oneFileSearch(tool, argv, { git }) -> { files, pattern } | null   grep/rg/ag/ack, git grep, `sed -n '/x/p'`, `awk '/x/'`, Select-String
//   readsOneFile(tool, argv) -> { files } | null                        head, tail (not -f/-F) or `sed -n` of one named file
//   readFileMsg({ command, files, q }) -> string                        the block text for that read
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
import { grepToolCall } from './agent-gate-guide.mjs';

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

const FOLLOW_FLAG = /^-[A-Za-z]*[fF]|^--follow\b/;
const FINISHED_LOG_FILE = /(?:^|[\\/])target[\\/]broker[\\/]finished\.log$/;

// The broker's end-of-run stream: a Monitor follows it with `tail -F target/broker/finished.log | grep --line-buffered <id>`
// (KIT-D115). A stream has no past to search, so q cannot stand in for it.
const followsFinishedLog = (tool, argv, file) => tool === 'tail' && argv.some((a) => FOLLOW_FLAG.test(a)) && FINISHED_LOG_FILE.test(file);

export function fedFile(tool, argv) {
  const readers = /^(?:cat|head|tail|type|get-content|gc)$/.test(tool);
  if (!readers && tool !== 'sed') return null;
  const operands = fileOperands(tool, argv).filter((a) => !COUNT_ARG.test(a));
  const file = operands.length === 1 && isConcreteFile(operands[0]) ? operands[0] : null;
  return file && !followsFinishedLog(tool, argv, file) ? file : null;
}

const LINE_READERS = /^(?:head|tail)$/;

/**
 * A line-range read of ONE named file with a shell text tool: `head`, a `tail` that does not follow, or a quiet `sed -n` range or
 * line. The Read tool (offset, limit) does it. A read of a command's own output has no file operand and is no match.
 */
export function readsOneFile(tool, argv) {
  const flags = argv.filter((a) => a.startsWith('-'));
  if (tool === 'sed' && (!flags.some((a) => SED_QUIET.test(a)) || flags.some((a) => SED_IN_PLACE.test(a) || SED_SCRIPT_FLAG.test(a)))) return null;
  if (tool !== 'sed' && !LINE_READERS.test(tool)) return null;
  if (tool === 'tail' && flags.some((a) => FOLLOW_FLAG.test(a))) return null;
  const file = fedFile(tool, argv);
  return file ? { files: [file], pattern: null, regex: false } : null;
}

export function readFileMsg({ command, files, q }) {
  return [
    '',
    'BLOCKED: a line-range read of a named file with a shell text tool (Read shows any line range of it).',
    `  ${trunc(command)}`,
    '',
    ...logLeadLines(files),
    'Instead, call a tool, not Bash:',
    `  Read tool: file_path ${JSON.stringify(files[0])}, offset and limit for the lines wanted (the end of a file: its last lines by offset).`,
    `  ${grepToolCall(files, null)}`,
    `  ${CHAINED_LINE}`,
    `To search it: node "${q}" code <text> --dir ${quote(files[0])}.`,
    '',
    "Still allowed: filtering a command's own output (cargo test 2>&1 | tail -20), tail -f / -F following a running log,",
    'files in a session scratchpad or outside every adopted repo.',
    '',
  ].join('\n');
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

const LOG_FILE = /\.(?:log|txt|out|err)$|(?:^|[\\/])target[\\/]/i;

// A build log or other output file is read, or its producing command is filtered inline: the Read tool comes first.
const logLeadLines = (files) => (files.some((f) => LOG_FILE.test(f))
  ? ['This is a log or build output. FIRST: read it with the Read tool (offset, limit), or next time filter the producing command inline', "(cargo build 2>&1 | grep -E 'error|warning' | head -40). To search it, the q form below.", '']
  : []);

const searchedPattern = ({ pattern, command, q, root, cwd }) => pattern || indexEquivalent(command, { qPath: q, root, cwd, file: true })?.pattern || null;

// The gate judges one segment of a chain: the other segments are not refused.
const CHAINED_LINE = 'In a chained command (&&, ;, |) keep the other segments in Bash as written; only the search segment becomes the call above.';

export function oneFileMsg(call) {
  const { command, files, q } = call;
  return [
    '',
    'BLOCKED: a pattern search of a named file with a text tool (q code searches any file; Read shows it).',
    `  ${trunc(command)}`,
    '',
    ...logLeadLines(files),
    'Instead, call a tool, not Bash:',
    `  ${grepToolCall(files, searchedPattern(call))}`,
    `  Read tool: file_path ${JSON.stringify(files.length === 1 ? files[0] : '<file>')}, offset and limit for a line range.`,
    `  ${CHAINED_LINE}`,
    `Exact equivalent:  ${equivalentLine(call)}`,
    ...(files.length > 1 ? ['  --dir takes one path: run it once per file, or scope with --path <dir> when they share one.'] : []),
    '',
    'Reading a file or a line range is the Read tool (offset, limit); searching one file is the Grep tool.',
    `Logs, build output, gitignored or sibling-checkout files: node "${q}" code <text> --dir <path> [-c|-l] [-i] [--regex] [-C 2].`,
    "Still allowed: filtering a command's own output (cargo test 2>&1 | grep -E 'test result|FAILED' | tail -20),",
    'files in a session scratchpad or outside every adopted repo, and the Grep tool on ONE file.',
    'The end of a broker run: `tail -n 0 -F target/broker/finished.log | grep --line-buffered -E "<run ids>"` in one Monitor (docs/wait-rule.md).',
    'If q ERRORS or answers wrongly: HARD STOP — `cap bug <what failed>`, then fix it (KIT-T236).',
    '',
  ].join('\n');
}
