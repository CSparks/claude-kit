// config-schema.mjs — the keys of `.ai/config.yml`'s `broker:` section that `t config set` may write,
// each with the value shape the reader (config.mjs, pipeline-config.mjs) accepts.
//
//   BROKER_KEYS -> every settable path (without the `broker.` prefix)
//   coerceBrokerValue(path, words) -> the typed value for the command-line words, or throws
//
// `repos` is a list of maps and is edited by hand; every other reader key is a scalar or a flat list.

const POSITIVE = 'positive';
const COUNT = 'count';
const NUMBER = 'number';
const BOOL = 'bool';
const STRING = 'string';
const LIST = 'list';

const KEY_TYPES = {
  target_dir: STRING,
  'parallelism.jobs': 'jobs',
  'parallelism.test_threads': POSITIVE,
  verify_default: LIST,
  poll_ms: NUMBER,
  coalesce_ms: NUMBER,
  stall_kill_s: NUMBER,
  writer_cap: POSITIVE,
  command_timeout_multiple: NUMBER,
  command_timeout_floor_s: NUMBER,
  untracked_blocks: LIST,
  dirty_blocks: LIST,
  land_gate: ['affected', 'full'],
  'affected.check': STRING,
  'affected.test': STRING,
  'affected.match': ['word', 'module'],
  'affected.mandatory': BOOL,
  'affected.dependents': BOOL,
  'affected.conformance': STRING,
  pin_test_args: LIST,
  suite: LIST,
  suite_every: POSITIVE,
  nightly_at: 'clock',
  nightly: LIST,
  suite_max_landings: POSITIVE,
  suite_max_hours: NUMBER,
  suite_partitions: POSITIVE,
  runner: ['cargo', 'nextest'],
  incremental_keep_hours: 'keep',
  batch_window_s: NUMBER,
  check_tree: BOOL,
  precheck: BOOL,
  precheck_timeout_s: POSITIVE,
  batch: POSITIVE,
};

const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const BROKER_KEYS = Object.keys(KEY_TYPES);

function one(path, words) {
  if (words.length !== 1) throw new Error(`broker.${path} takes one value (got ${words.length})`);
  return words[0];
}

function number(path, words) {
  const n = Number(one(path, words));
  if (!Number.isFinite(n) || n < 0) throw new Error(`broker.${path} must be a number >= 0 (got '${words[0]}')`);
  return n;
}

const CODERS = {
  [STRING]: (path, words) => {
    const v = one(path, words);
    if (!v.trim()) throw new Error(`broker.${path} must not be empty`);
    return v;
  },
  [NUMBER]: number,
  [COUNT]: (path, words) => {
    const n = number(path, words);
    if (!Number.isInteger(n)) throw new Error(`broker.${path} must be an integer (got '${words[0]}')`);
    return n;
  },
  [POSITIVE]: (path, words) => {
    const n = CODERS[COUNT](path, words);
    if (n < 1) throw new Error(`broker.${path} must be >= 1 (got '${words[0]}')`);
    return n;
  },
  [BOOL]: (path, words) => {
    const v = one(path, words);
    if (v !== 'true' && v !== 'false') throw new Error(`broker.${path} must be true or false (got '${v}')`);
    return v === 'true';
  },
  [LIST]: (path, words) => {
    if (!words.length || words.some((w) => !w.trim())) throw new Error(`broker.${path} takes one or more non-empty values`);
    return words.slice();
  },
  jobs: (path, words) => (one(path, words) === 'auto' ? 'auto' : CODERS[POSITIVE](path, words)),
  clock: (path, words) => {
    const v = one(path, words);
    if (!CLOCK.test(v)) throw new Error(`broker.${path} must be a local time HH:MM (got '${v}')`);
    return v;
  },
  keep: (path, words) => (one(path, words) === 'off' ? 'off' : number(path, words)),
};

export function coerceBrokerValue(path, words) {
  const type = KEY_TYPES[path];
  if (!type) throw new Error(`broker.${path} is not a key the broker reads; known: ${BROKER_KEYS.join(', ')}`);
  if (Array.isArray(type)) {
    const v = one(path, words);
    if (!type.includes(v)) throw new Error(`broker.${path} must be one of ${type.join(' | ')} (got '${v}')`);
    return v;
  }
  return CODERS[type](path, words);
}
