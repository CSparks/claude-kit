// health-read.mjs — what the session hooks (orient at SessionStart, flush at Stop) say about the
// broker's self-check (KIT-T307): one line per entry of <target>/broker/health.json, none when the
// file is absent, empty or unreadable. Never throws.

import { existsSync, readFileSync } from 'node:fs';
import { brokerPaths, readBrokerConfig } from './config.mjs';
import { join } from 'node:path';

export function healthWarnings(root) {
  try {
    const file = join(brokerPaths(readBrokerConfig(root)).home, 'health.json');
    if (!existsSync(file)) return [];
    const list = JSON.parse(readFileSync(file, 'utf8'));
    return (Array.isArray(list) ? list : []).map((e) => `broker ${e.kind} since ${e.since}: ${e.detail} (likely: ${e.cause})`);
  } catch {
    return [];
  }
}
