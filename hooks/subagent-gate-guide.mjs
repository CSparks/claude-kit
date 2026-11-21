#!/usr/bin/env node
// SubagentStart — hand every subagent of an adopted repo the standing rules block (lib/rule-block.mjs, KIT-T1463) and the
// shell forms two gates refuse and the tool to call instead (agent-gate-guide.mjs, KIT-T1439). The context rides the start event, so it reaches a `general-purpose` writer that has no
// kit agent definition and a brief that never mentioned it. Not a gate: always exit 0, fail-open, prints nothing in an
// unadopted repo.

import { payload, gitRoot, adopted } from './lib.mjs';
import { GATE_GUIDE } from './lib/agent-gate-guide.mjs';
import { ruleBlockLines } from './lib/rule-block.mjs';

try {
  const p = await payload();
  const root = gitRoot(p && p.cwd ? p.cwd : undefined);
  if (adopted(root)) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: [...ruleBlockLines(), ...GATE_GUIDE].join('\n') } }));
  }
} catch { /* fail-open: the agent starts without the guide */ }
process.exit(0);
