// cli.mjs — shared argv parsing + config loading for the broker's three CLIs (broker / submit /
// wait). One parser so the flag grammar never drifts between them.
//
// `parseFlags(argv)` → { _: [positionals], key: value | true | [values…] }. A `--key value`
// pair captures the value; a `--flag` with no following value (next token is `--x` or the end)
// is boolean true; a repeated `--key` collects into an array.

import { resolve } from 'node:path';
import { readBrokerConfig } from './config.mjs';

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

// Resolve --root (default cwd) and read its broker config.
export function loadCfg(flags) {
  const root = resolve(typeof flags.root === 'string' ? flags.root : process.cwd());
  return { root, cfg: readBrokerConfig(root) };
}

export function asList(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}
