// broker-dir.mjs — the absolute scripts/broker directory of the kit these hooks run from, forward slashes. A block message
// that names a broker script prints this path, so it always names the file the running hook's own tree holds.

import { fileURLToPath } from 'node:url';

export const BROKER_DIR = fileURLToPath(new URL('../../scripts/broker', import.meta.url)).replace(/\\/g, '/');
