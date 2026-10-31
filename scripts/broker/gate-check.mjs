// gate-check.mjs — the landing gate's compile check built with the feature set its tests use (KIT-Q005 lever 1).
// A `cargo check` and a `cargo test` with different `--features` compile every crate twice (check emits metadata
// only, and the feature sets key different artifacts). The gate therefore checks with the tests' features; a check
// feature the tests do not use moves to the scheduled run.
//
//   gateChecks(check, testPrefix, expand?) -> { gate, scheduled }
//     check: the configured `affected.check`.  testPrefix: the configured `affected.test`.
//     expand(testPrefix) -> the tokens a cargo alias in the prefix expands to, or null (default: no alias).
//     gate: the check to run in the landing gate.  scheduled: checks that run with the suite, [] when none moved.

const FEATURE_FLAGS = new Set(['--features', '-F']);
const INLINE_FEATURES = /^--features=(.*)$/;
const split = (value) => String(value).split(/[,\s]+/).filter(Boolean);

function featuresOf(tokens) {
  const out = [];
  tokens.forEach((t, i) => {
    if (FEATURE_FLAGS.has(tokens[i - 1])) out.push(...split(t));
    else if (INLINE_FEATURES.test(t)) out.push(...split(INLINE_FEATURES.exec(t)[1]));
  });
  return [...new Set(out)];
}

function withFeatures(tokens, features) {
  const kept = [];
  let at = -1;
  tokens.forEach((t, i) => {
    if (FEATURE_FLAGS.has(t) || INLINE_FEATURES.test(t)) { if (at === -1) at = kept.length; return; }
    if (!FEATURE_FLAGS.has(tokens[i - 1])) kept.push(t);
  });
  if (!features.length) return kept;
  const flag = ['--features', features.join(',')];
  return at === -1 ? [...kept, ...flag] : [...kept.slice(0, at), ...flag, ...kept.slice(at)];
}

export function gateChecks(check, testPrefix, expand = () => null) {
  const checkTokens = String(check).trim().split(/\s+/);
  const testTokens = [...String(testPrefix).trim().split(/\s+/), ...(expand(testPrefix) || [])];
  const checkFeatures = featuresOf(checkTokens);
  const testFeatures = featuresOf(testTokens);
  if (!checkFeatures.length && !testFeatures.length) return { gate: check, scheduled: [] };
  const gate = withFeatures(checkTokens, testFeatures).join(' ');
  const moved = checkFeatures.some((f) => !testFeatures.includes(f));
  return { gate, scheduled: moved ? [check] : [] };
}
