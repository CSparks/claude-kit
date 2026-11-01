// kit-queue-ticket.mjs — one rolling ticket per recurring subject, owned by the kit agent's queue. A tick that
// finds the same subject every hour updates the ticket's body in place instead of filing another ticket (KIT-D121).
// The ticket carries the kit-queue label: orient lists it and `broker blockers` reports it, but the Stop
// kit-bug-dispatch gate never counts it against the session that saw it (the standing kit agent owns the queue).
//
//   rollKitQueueTicket({ shape, title, detail, project, create }) -> { id, created } | null; create:false only updates an open ticket
//   QUEUE_LABEL                                            -> the label that marks a queue-owned ticket

import { writeFileSync } from 'node:fs';
import { fileKitBug, kitStoreRoot, openKitBugFor } from './kit-bug.mjs';

export const QUEUE_LABEL = 'kit-queue';

const DESCRIPTION_HEAD = '## Description\n';
const SHAPE_MARK = /\n\nkit-bug-shape: /;
const stampOf = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function rewriteBody(path, text, detail) {
  const start = text.indexOf(DESCRIPTION_HEAD);
  const mark = SHAPE_MARK.exec(text);
  if (start < 0 || !mark) return;
  const bodyStart = start + DESCRIPTION_HEAD.length;
  const next = `${text.slice(0, bodyStart)}${String(detail).trim()}${text.slice(mark.index)}`.replace(/^updated: .*$/m, `updated: ${stampOf()}`);
  if (next !== text) writeFileSync(path, next);
}

export function rollKitQueueTicket({ shape, title, detail = '', project = '', create = true }) {
  try {
    const root = kitStoreRoot();
    if (!root || !shape) return null;
    const open = openKitBugFor(root, shape);
    if (open) {
      rewriteBody(open.path, open.text, detail);
      return { id: (/^id:\s*(\S+)/m.exec(open.text) || [, ''])[1], created: false };
    }
    if (!create) return null;
    const made = fileKitBug({ shape, title, detail, project });
    const file = made?.created ? openKitBugFor(root, shape) : null;
    if (file) writeFileSync(file.path, file.text.replace(/^labels: \[kit-bug\]$/m, `labels: [kit-bug, ${QUEUE_LABEL}]`));
    return made;
  } catch {
    return null;
  }
}
