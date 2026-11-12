// q-gates.mjs — `q gates [<gate>]`: every requirement and exact tag form of a gated tool, read from the gate code
// (hooks/lib/gate-protocol.mjs), so a session reads the protocol before its first call (KIT-T898, KIT-D147).
// The conformance row names the test of the checkout at `root` (the cwd by default). Returns the process exit code.

import { gateNames, gateText } from '../hooks/lib/gate-protocol.mjs';

export function runGates(args, { out = process.stdout, err = process.stderr, root = process.cwd() } = {}) {
  const name = String(args[0] || '').toLowerCase();
  if (!name) {
    out.write(`gates: ${gateNames().join(', ')}\nq gates <gate> prints the requirements and accepted tag forms of one.\n`);
    return 0;
  }
  const text = gateText(name, { root });
  if (!text) {
    err.write(`q gates: unknown gate '${name}'. Gates: ${gateNames().join(', ')}\n`);
    return 1;
  }
  out.write(text);
  return 0;
}
