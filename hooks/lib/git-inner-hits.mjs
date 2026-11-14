// git-inner-hits.mjs — the hits of a command a git call runs (git-run-commands.mjs: `rebase -x|--exec`, `bisect run`), judged
// by the rules of a command typed alone (KIT-T1172). Git runs it from the top of the work tree, so its hits carry `from`, that
// directory, for the gate to resolve a relative path against.
//
//   gitInnerHits(text, ctx, judge) -> [hit]
//     text:  one segment's text; ctx: the scan context of that segment (shell-write-scan.mjs judgeSegment's);
//     judge(segmentText, ctx) -> [hit]: the scan's judgement of one segment, passed in so this module needs no scan import
//   a command nested past MAX_NESTING levels, or one whose quoting cannot be split, is a sweep: refused while another writer is live

import { resolve } from 'node:path';
import { gitRoot } from './paths.mjs';
import { gitRunCommands, rawGitCall } from './git-run-commands.mjs';
import { MAX_NESTING, leadCommandHits } from './lead-command-walk.mjs';
import { segments } from './shell-segments.mjs';
import { assignedValues } from './shell-variables.mjs';

const INNER_SHELL = 'bash';

const sweepOf = (ctx, what) => ctx.removals.sweep({ verb: 'a command run by git', path: './*', what });

function innerHits(text, call, ctx, judge) {
  const depth = (ctx.depth || 0) + 1;
  if (depth > MAX_NESTING) return [sweepOf(ctx, 'git calls nested past the depth limit')];
  const parts = segments(text, { shell: INNER_SHELL });
  if (parts.ambiguous) return [sweepOf(ctx, 'a command run by git whose quoting cannot be split')];
  const from = gitRoot(resolve(ctx.cwd, call.dir || '.')) || ctx.cwd;
  const values = assignedValues(parts, INNER_SHELL);
  const scope = { ...ctx, shell: INNER_SHELL, parts, depth, cwd: from, touchPlaceKnown: false };
  return [...parts].flatMap((seg, at) => judge(seg.text, { ...scope, at, vars: values.get(seg) }))
    .map((found) => ({ ...found, from: found.from || from }));
}

const hitsOfCall = (judge) => (words, ctx) => {
  const call = rawGitCall(ctx.text);
  return call ? gitRunCommands(call).texts.flatMap((text) => innerHits(text, call, ctx, judge)) : [];
};

export const gitInnerHits = (text, ctx, judge) => leadCommandHits(text, ctx, { isLead: (name) => /^git$/i.test(name), hitsOf: hitsOfCall(judge) });
