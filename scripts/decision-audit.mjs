#!/usr/bin/env node
// decision-audit.mjs — list the decisions in a store whose source names the maintainer without a verbatim
// quote (KIT-T722). Read-only. Usage: node scripts/decision-audit.mjs [<repo-root>]; exit 1 when any fail.

import { resolve } from 'node:path';
import { auditDecisions } from './decision-attribution.mjs';

const root = resolve(process.argv[2] || process.cwd());
const flagged = auditDecisions(root);
flagged.forEach((d) => console.log(`${d.id}  ${d.file}\n    ${d.problem}`));
console.log(`${flagged.length} decision(s) attribute content to the maintainer without a verbatim quote`);
process.exit(flagged.length ? 1 : 0);
