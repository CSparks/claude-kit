// What a shell command does to a frozen legacy directory (KIT-T989): a write (redirect, rm, plain mv or cp onto it,
// sed -i, a script that writes it), a git command that changes it, or a dependency command that adds a reference to it
// (`cargo add --path legacy/x`, `npm add ./legacy/x`). `git mv <src> legacy/...` passes wherever it sits in the
// command (a loop body, an xargs call): git invocations are judged by gitLegacyWrite, and their `mv` is hidden from
// the generic write scan. A git or dependency segment is judged in the directory the commands before it moved to; the
// generic write scan runs once per directory the command visits, so a `cd` back out does not hide an earlier write.
//
//   legacyShellViolation({ root, dir, command, cwd, excluded, movedIn }) -> null | { headline, lines }
//     excluded(path) -> true when .claude-kit-ignore.yaml lifts the check for that path
//     movedIn(path, base) -> true when nothing under the path changed except by unchanged git renames

import { resolve } from 'node:path';
import { tokenize } from './branch-ops.mjs';
import { gitLegacyWrite } from './legacy-git.mjs';
import { underLegacy } from './legacy-paths.mjs';
import { FS_WRITE, scanAllShellWrites } from './shell-write-scan.mjs';
import { AMBIGUOUS_MESSAGE, cdTarget, segments } from './shell-segments.mjs';

const GIT_FROM = /(?<!["'\w/.-])git(?:\.exe)?\s+([^})]+)/;
const GIT_MV = /(?<!["'\w/.-])(git(?:\.exe)?(?:\s+-[Cc]\s+(?:"[^"]*"|'[^']*'|\S+))*\s+)mv\b/g;
const ADD_DEPENDENCY = /\b(?:cargo\s+add|(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|link))\b/;
const DEPENDENCY_PREFIX = /^(?:--path=|file:|link:)/;
const MOVE_IN_HINT = 'Moving code in is `git mv <src> legacy/<name>`; a plain mv, cp or redirect onto legacy/ is refused.';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function gitViolation(text, cwd, ctx) {
  const git = GIT_FROM.exec(text);
  if (!git) return null;
  const found = gitLegacyWrite(tokenize(git[1]), (path, from) => underLegacy(ctx.root, ctx.dir, path, from), cwd, ctx.movedIn);
  return found && !ctx.excluded(found.path) ? { headline: `${found.op} touches legacy code`, lines: [found.path] } : null;
}

function dependencyViolation(text, cwd, ctx) {
  if (!ADD_DEPENDENCY.test(text)) return null;
  const path = tokenize(text).map((t) => t.replace(DEPENDENCY_PREFIX, '')).find((t) => underLegacy(ctx.root, ctx.dir, t, cwd));
  return path && !ctx.excluded(path) ? { headline: 'this command references legacy code', lines: [text.trim(), `${path} is under the frozen ${ctx.dir}/`] } : null;
}

function writeViolation(command, base, ctx) {
  const { root, dir, excluded } = ctx;
  const mentions = new RegExp(`(?:^|[^\\w-])${escapeRe(dir)}(?:[\\\\/]|$|\\s|["'])`, 'i').test(command);
  const hit = (path) => (underLegacy(root, dir, path, base) && !excluded(path) ? { path } : null);
  const codeHit = (code) => (FS_WRITE.test(code) && new RegExp(`(?:^|[^\\w-])${escapeRe(dir)}[\\\\/]`, 'i').test(code) ? { path: `${dir}/…` } : null);
  const ambiguous = () => (mentions ? { path: `${dir}/…`, ambiguous: true } : null);
  const found = scanAllShellWrites(command.replace(GIT_MV, '$1git-mv'), { hit, codeHit, ambiguous, judgeMoveSources: true }).find(Boolean);
  if (!found) return null;
  const how = found.ambiguous ? ['a shell command may write legacy code and cannot be judged.', AMBIGUOUS_MESSAGE] : ['a shell command writes legacy code:', found.path];
  return { headline: 'legacy/ is frozen', lines: [...how, MOVE_IN_HINT] };
}

export function legacyShellViolation({ root, dir, command, cwd = process.cwd(), excluded, movedIn }) {
  const ctx = { root, dir, excluded, movedIn };
  const parts = segments(command);
  let here = cwd;
  const bases = [cwd];
  if (!parts.ambiguous) {
    for (const seg of parts.map((s) => s.text.trim()).filter(Boolean)) {
      const to = cdTarget(seg);
      if (to) { here = resolve(here, to); bases.push(here); continue; }
      const found = gitViolation(seg, here, ctx) || dependencyViolation(seg, here, ctx);
      if (found) return found;
    }
  }
  return bases.map((base) => writeViolation(command, base, ctx)).find(Boolean) || null;
}
