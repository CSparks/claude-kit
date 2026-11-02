// handback-landed.mjs — what the reconciler must verify before it names a step (KIT-T827).
//
//   resumable(row, sessionId)             -> can a SendMessage reach this agent: its transcript (the roster row's outputFile)
//                                            exists and belongs to the session asking; an agent from an earlier session
//                                            fails with "No transcript found for agent ID"
//   landedOnMain(root, ticket, sha)       -> is the landed commit an ancestor of HEAD and recorded in the ticket file
//                                            (so nothing is left to verify by hand)

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { CHILD_OPTIONS } from '../../scripts/runtime-publish-guard.mjs';
import { ticketText } from './successor.mjs';

const SHORT_SHA = 7;

export function resumable(row, sessionId) {
  const transcript = row && row.outputFile ? String(row.outputFile) : '';
  return !!sessionId && !!transcript && transcript.includes(sessionId) && existsSync(transcript);
}

export function landedOnMain(root, ticket, sha) {
  if (!sha || !ticket) return false;
  const ancestor = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, 'HEAD'], { stdio: 'ignore', ...CHILD_OPTIONS });
  return ancestor.status === 0 && String(ticketText(root, ticket) || '').includes(sha.slice(0, SHORT_SHA));
}
