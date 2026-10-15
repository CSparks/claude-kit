// cli.mjs — shared argv parsing + config loading for the broker's three CLIs (broker / submit /
// wait). One parser so the flag grammar never drifts between them.
//
// `parseFlags(argv)` → { _: [positionals], key: value | true | [values…] }. A `--key value`
// pair captures the value; a `--flag` with no following value (next token is `--x` or the end)
// is boolean true; a repeated `--key` collects into an array.

import { resolve } from 'node:path';
import { readBrokerConfig, withLane } from './config.mjs';
import { mapSubmoduleRoot } from './root-map.mjs';

export function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith('--')) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      const val = next != null && !next.startsWith('--') ? (i++, next) : true;
      if (key in out) out[key] = [].concat(out[key], val);
      else out[key] = val;
    } else {
      out._.push(tok);
    }
  }
  return out;
}

// Resolve --root (default cwd) and read its broker config; `--lane <repo>` selects a submodule's queue.
// A --root naming a submodule maps to the parent checkout and that submodule's lane (root-map.mjs);
// a submit without --repo then targets the submodule.
export function loadCfg(flags) {
  const given = resolve(typeof flags.root === 'string' ? flags.root : process.cwd());
  const mapped = mapSubmoduleRoot(given);
  const lane = typeof flags.lane === 'string' ? flags.lane : mapped.lane;
  if (mapped.lane && typeof flags.repo !== 'string') flags.repo = mapped.lane;
  return { root: mapped.root, cfg: withLane(readBrokerConfig(mapped.root), lane) };
}

export function asList(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
