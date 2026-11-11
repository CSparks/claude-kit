// Can this shell call write a hand-authored source file at all? (hand-write-detect, KIT-T888, KIT-T1001)
// A call that cannot is never blamed for a source file that changed while it ran: another agent's Edit, a Codex
// patch or a broker landing in the same checkout is that writer's, not the call's.
//
//   isInertCommand(command, { root, shell }) -> true when every command the line runs is a generator, a reader, a kit
//     verb, a build or test runner, a shell keyword or an assignment, and no redirect aims at a source file inside `root`
//   leaderOf(text) -> the program a segment runs: its first word past leading assignments, path and .exe/.bat/.cmd dropped
//
// Anything else (an unknown program, a script, `node -e`, `bash`) stays attributable: the changed files then decide
// (KIT-D117). Command substitutions are classified as the commands they run; a quoting that cannot be trusted is
// judged piece by piece with every operator splitting (shell-segments.mjs blindSegments).

import { KIT_TOOL, redirectTargets, shellArgs } from './shell-write-scan.mjs';
import { blindSegments, segments } from './shell-segments.mjs';
import { nodeScriptName, nodeTestFiles } from './node-args.mjs';
import { isSourcePath } from './shell-source-write.mjs';
import { landsOutsideRepo } from './lands-outside-repo.mjs';
import { commandCwd } from './shell-cwd.mjs';

const GENERATORS = /^(?:git|cargo|rustc|rustfmt|clippy-driver|npm|npx|pnpm|yarn|bun|make|cmake|ninja|dotnet|go|gofmt|prettier|eslint|black|ruff|isort|tsc|vite|esbuild|wasm-pack|gradle|gradlew|mvn|mvnw|bazel|adb|pytest|jest|vitest|mocha|cd|true|false|:)$/i;
// Commands that only read or print: with no redirect into a source file they cannot write one.
const READERS = /^(?:cat|head|tail|less|more|wc|ls|stat|file|diff|cmp|grep|egrep|fgrep|rg|ag|ack|sort|uniq|cut|tr|echo|printf|pwd|date|sleep|which|whoami|tasklist|read|test|\[|\[\[|export|unset|local|declare)$/i;
const SED_IN_PLACE = /\s(?:--in-place\b|-[A-Za-z]*i)/;
const BROKER_CLIENT = /^(?:submit|wait|watch|broker)\.mjs$/i;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const KEYWORD_ONLY = /^(?:for|select|case|in|esac|done|fi|function|\{|\}|\(|\))$/;
const KEYWORD_THEN_COMMAND = /^(?:do|then|else|elif|if|while|until|time|!)$/;
const UNRESOLVED_TARGET = /[$`*?]/;
const NULL_DEVICE = /^\/dev\/null$/;
const SUBSTITUTION_OPEN = '$(';

const nameOf = (word) => String(word).replace(/.*[\\/]/, '').replace(/\.(?:exe|bat|cmd)$/i, '');

const leadingWords = (text) => {
  const words = shellArgs(text);
  while (words.length && ENV_ASSIGN.test(words[0])) words.shift();
  while (words.length && KEYWORD_THEN_COMMAND.test(words[0])) words.shift();
  return words;
};

export const leaderOf = (text) => nameOf(leadingWords(text)[0] || '');

// The text with each `$(...)` and `` `...` `` cut out, and the commands those held.
function splitSubstitutions(text) {
  let outer = '';
  const inner = [];
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith(SUBSTITUTION_OPEN, i)) {
      let depth = 1;
      let j = i + SUBSTITUTION_OPEN.length;
      for (; j < text.length && depth; j++) depth += text[j] === '(' ? 1 : text[j] === ')' ? -1 : 0;
      inner.push(text.slice(i + SUBSTITUTION_OPEN.length, depth ? j : j - 1));
      i = j - 1;
    } else if (text[i] === '`' && text.indexOf('`', i + 1) > i) {
      const end = text.indexOf('`', i + 1);
      inner.push(text.slice(i + 1, end));
      i = end;
    } else {
      outer += text[i];
    }
  }
  return { outer, inner };
}

// A redirect that could write a source file of `root`: its target is unresolved, or a source path inside the repo.
// A line whose quoting cannot be trusted fails closed: any `>` in it may be a redirect.
function redirectsIntoSource(command, { root, shell, cwd }) {
  const parts = segments(command, { shell });
  if (parts.ambiguous) return parts.text.includes('>');
  return redirectTargets(parts.text, true, shell === 'bash').some((raw) => {
    const target = raw.replace(/^["']|["']$/g, '');
    if (NULL_DEVICE.test(target)) return false;
    if (UNRESOLVED_TARGET.test(target)) return true;
    return isSourcePath(target) && !landsOutsideRepo(target, root, cwd);
  });
}

// A node test run whose every file sits inside the repo: a scratchpad or unresolved path is a script of unknown origin.
function isTestRun(args, ctx) {
  const files = nodeTestFiles(args);
  return files !== null && files.every((f) => !UNRESOLVED_TARGET.test(f) && !landsOutsideRepo(f, ctx.root, ctx.cwd));
}

function inertSegment(text, ctx) {
  const { outer, inner } = splitSubstitutions(text);
  if (!inner.every((c) => isInert(c, ctx))) return false;
  const words = leadingWords(outer);
  if (!words.length || KEYWORD_ONLY.test(words[0])) return true;
  const leader = nameOf(words[0]);
  if (GENERATORS.test(leader) || KIT_TOOL.test(leader)) return true;
  if (READERS.test(leader) || (/^sed$/i.test(leader) && !SED_IN_PLACE.test(outer))) return !ctx.intoSource;
  if (!/^node$/i.test(leader)) return false;
  const args = words.slice(1);
  const script = nodeScriptName(args);
  return KIT_TOOL.test(script) || isTestRun(args, ctx) || (!ctx.intoSource && BROKER_CLIENT.test(script));
}

function isInert(command, ctx) {
  const parts = segments(command, { shell: ctx.shell });
  const pieces = parts.ambiguous ? blindSegments(command) : parts;
  return [...pieces].every(({ text }) => !text.trim() || inertSegment(text, ctx));
}

export function isInertCommand(command, { root, shell = '' } = {}) {
  const text = String(command || '');
  const cwd = commandCwd(text, root);
  return isInert(text, { shell, root, cwd, intoSource: redirectsIntoSource(text, { root, shell, cwd }) });
}
