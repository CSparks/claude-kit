// `t triage <capture> [--type <t>] [--title "<text>"] [--priority <p>]`: turn one inbox capture into a
// ticket (type from --type or the capture's leading `(type)`; the whole capture is the Description) and
// move the capture to inbox/triaged/. A capture routed to another store refuses: use triage --plan.
//
//   triageCapture(root, capture, flags, scaffold) -> { id, path, moved }   (scaffold = t.mjs scaffoldNew)

import { existsSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { capText, capTitle, leadingType } from './triage/cap-text.mjs';
import { moveCapToTriaged } from './triage/write-item.mjs';

function captureFile(root, capture) {
  const aiDir = join(root, '.ai');
  const candidates = [
    isAbsolute(capture) ? capture : resolve(capture),
    join(aiDir, 'inbox', basename(capture)),
    join(aiDir, 'inbox', `${capture}.md`),
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error(`t triage: no capture '${capture}' (looked in ${join(aiDir, 'inbox')})`);
  if (basename(join(hit, '..')) !== 'inbox') throw new Error(`t triage: ${hit} is not directly in .ai/inbox/ (already triaged?)`);
  return hit;
}

export function triageCapture(root, capture, flags, scaffold) {
  if (!capture) throw new Error('t triage: usage: t triage <inbox-file> [--type <type>] [--title "<text>"]');
  const file = captureFile(root, capture);
  const body = readFileSync(file, 'utf8');
  const type = flags.type || leadingType(body);
  if (!type) throw new Error('t triage: the capture carries no (type) tag; pass --type <ticket type>');
  const text = capText(body);
  const title = (flags.title || capTitle(text)).trim();
  const made = scaffold(root, type, title, { description: text, priority: flags.priority });
  const moved = moveCapToTriaged(join(root, '.ai'), join('inbox', basename(file)));
  return { id: made.id, path: made.path, moved };
}
