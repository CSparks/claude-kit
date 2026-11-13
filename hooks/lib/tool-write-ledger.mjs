// Storage of the accepted-writes ledger (tool-writes.mjs, KIT-T888). One appended record per entry, so the writers of a
// checkout recording at once never drop each other's entries (KIT-T1138); a state file an older hook version wrote is
// read before the records. Every path fails open.
//
//   appendToolWriteEntries(root, entries) -> add `entries`, oldest first
//   toolWriteEntries(root)                -> the newest TOOL_WRITE_ENTRIES_MAX entries, oldest first

import { appendTurnRecord, readTurnRecords, readTurnState } from './turn-state.mjs';

const SLOT = 'toolwrites';
export const TOOL_WRITE_ENTRIES_MAX = 300;

export const appendToolWriteEntries = (root, entries) => {
  for (const entry of entries) appendTurnRecord(root, SLOT, entry);
};

export function toolWriteEntries(root) {
  const legacy = (readTurnState(root, SLOT) || {}).entries;
  return [...(Array.isArray(legacy) ? legacy : []), ...readTurnRecords(root, SLOT)].slice(-TOOL_WRITE_ENTRIES_MAX);
}
