// named-tests.mjs — which failures a job's own command names (KIT-T913). A job that selects a test binary
// (`--test <name>`) or a test filter (`-- <name>`) asked for exactly those tests: when one is red the job is not
// green, even when it is also red at HEAD.
//
//   namedFailure(cmd, failure) -> true when `cmd` names the failed test { binary, test }: it selects a test binary, or
//                                 a filter word equals the test, is the last `::` segment of it, or is part of it

const TEST_FLAG = /^--test(?:=(.+))?$/;
const END_OF_OPTIONS = '--';

function selection(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  const binaries = [];
  toks.forEach((t, i) => {
    const m = TEST_FLAG.exec(t);
    if (m) binaries.push(m[1] || toks[i + 1]);
  });
  const dashes = toks.indexOf(END_OF_OPTIONS);
  const filters = dashes < 0 ? [] : toks.slice(dashes + 1).filter((t) => !t.startsWith('-'));
  return { binaries: binaries.filter(Boolean), filters };
}

export function namedFailure(cmd, failure) {
  const { binaries, filters } = selection(cmd);
  if (binaries.length) return true;
  return filters.some((w) => failure.test === w || failure.test.endsWith(`::${w}`) || failure.test.includes(w));
}
