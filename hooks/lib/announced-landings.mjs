// announced-landings — which commits an earlier assistant reply of the session already named by sha (KIT-T976).
// The land-alert lists only landings the maintainer was not yet told about.
//
//   shasNamedBefore(transcriptLines)   -> string[]  every 7-40 hex token in the assistant prose of all
//                                                   assistant entries except the last (the reply being judged)
//   unannounced(landed, named)         -> the landings whose full sha no named token is a prefix of
//   unannouncedIn(transcriptFile, landed) -> unannounced() against a transcript file; unreadable names nothing

import { readFileSync } from 'node:fs';
import { assistantTextOf } from './assistant-text.mjs';

const MIN_SHA_CHARS = 7;
const SHA_TOKEN = new RegExp(String.raw`\b[0-9a-f]{${MIN_SHA_CHARS},40}\b`, 'gi');

function assistantTexts(transcriptLines) {
  const texts = [];
  for (const line of transcriptLines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if ((entry?.type || entry?.message?.role) === 'assistant') texts.push(assistantTextOf(entry?.message?.content));
  }
  return texts;
}

export function shasNamedBefore(transcriptLines) {
  const prior = assistantTexts(transcriptLines).slice(0, -1);
  return prior.flatMap((text) => (text.match(SHA_TOKEN) || []).map((t) => t.toLowerCase()));
}

export const unannounced = (landed, named) => landed.filter((c) => !named.some((token) => c.sha.toLowerCase().startsWith(token)));

export function unannouncedIn(transcriptFile, landed) {
  try {
    return unannounced(landed, shasNamedBefore(readFileSync(transcriptFile, 'utf8').split('\n').filter(Boolean)));
  } catch {
    return landed;
  }
}
