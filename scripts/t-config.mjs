// The taxonomy knobs the ticket mutations enforce (KIT-T075), read line-wise from .ai/config.yml.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read just the knobs the mutations need, line-wise (no yaml dep), mirroring the other tooling.
// `aiDir` is separable from `root` (the readIdConfig precedent) so a CENTRAL notebook — whose store
// is not `<root>/.ai` — can be read for its taxonomy too.
export function readConfig(root, aiDir = join(root, '.ai')) {
  const out = {
    flow: ['todo', 'doing', 'review', 'done'],
    humanOnly: [],
    offBoard: ['superseded'],
    uatDefault: 'required',
    archiveDir: 'tickets/archive',
    classifications: [],
    ticketTypes: [],
    routes: {},
    classPriority: {},
    priorities: ['critical', 'high', 'medium', 'low'],
  };
  let cfg = '';
  try {
    cfg = readFileSync(join(aiDir, 'config.yml'), 'utf8');
  } catch {
    return out;
  }
  const arr = (re) => {
    const m = cfg.match(re);
    return m ? m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : null;
  };
  out.flow = arr(/^\s*flow:\s*\[([^\]]*)\]/m) || out.flow;
  out.humanOnly = arr(/^\s*human_only:\s*\[([^\]]*)\]/m) ?? out.humanOnly;
  out.offBoard = arr(/^\s*off_board:\s*\[([^\]]*)\]/m) || out.offBoard;
  out.priorities = arr(/^priorities:\s*\[([^\]]*)\]/m) || out.priorities;
  const uat = cfg.match(/^uat:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+default:[ \t]*(\w+)/m);
  if (uat) out.uatDefault = uat[1];
  const arch = cfg.match(/archive_done_to:[ \t]*(\S+)/);
  if (arch) out.archiveDir = arch[1];
  // classification keys = the valid `t new` types (two-space-indented under `classifications:`).
  // ticketTypes narrows those to the ones that BELONG on the ticket board (routes_to tickets or
  // backlog) — a create form offering `question` or `decision` would file the item in the wrong
  // store; the CLI stays permissive over the full list.
  const BOARD_ROUTES = ['tickets', 'backlog'];
  const lines = cfg.split('\n');
  let inBlock = false;
  for (const line of lines) {
    if (/^classifications:\s*$/.test(line)) { inBlock = true; continue; }
    if (inBlock) {
      if (/^\S/.test(line)) break;
      const m = line.match(/^\s{2}([A-Za-z][\w-]*):/);
      if (!m) continue;
      out.classifications.push(m[1]);
      const route = (line.match(/routes_to:[ \t]*([A-Za-z-]+)/) || [])[1];
      if (route) out.routes[m[1]] = route;
      const prio = (line.match(/priority:[ \t]*([A-Za-z-]+)/) || [])[1];
      if (prio) out.classPriority[m[1]] = prio;
      if (!route || BOARD_ROUTES.includes(route)) out.ticketTypes.push(m[1]);
    }
  }
  return out;
}
