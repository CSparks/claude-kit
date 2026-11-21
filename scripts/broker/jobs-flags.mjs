// jobs-flags.mjs — the parallelism flags of a cargo / nextest / cargo-ndk command line (KIT-D135).
//
//   requestedJobs(args) -> the largest `-j N`, `--jobs N`, `--build-jobs N` or `--test-threads N` (attached `=N` and `-jN` too), or null
//   clampJobs(args, cores) -> the same tokens with every such value above `cores` replaced by `cores`
// Both take a token array; a command string goes through `.split(/\s+/)`. A project's `-j 15` above the budget is
// lowered here, in the command that runs, never in the project's files. Only the tokens before a bare `--` are read:
// what follows is the test binary's own argument list (`-- --test-threads=1` is a test count, not compile cores) and is left as written.

const SPLIT = /^(-j|--jobs|--build-jobs|--test-threads)$/;
const ATTACHED = /^(--jobs=|--build-jobs=|--test-threads=|-j)(\d+)$/;
const COUNT = /^\d+$/;
const ARGS_END = '--';

function eachValue(args, visit) {
  const end = args.indexOf(ARGS_END);
  return args.map((tok, i) => {
    if (end !== -1 && i >= end) return tok;
    const m = ATTACHED.exec(tok);
    if (m) return `${m[1]}${visit(Number(m[2]))}`;
    if (i > 0 && SPLIT.test(args[i - 1]) && COUNT.test(tok)) return String(visit(Number(tok)));
    return tok;
  });
}

export function requestedJobs(args) {
  let max = null;
  eachValue(args, (n) => { max = Math.max(max ?? 0, n); return n; });
  return max;
}

export const clampJobs = (args, cores) => eachValue(args, (n) => Math.min(n, cores));
