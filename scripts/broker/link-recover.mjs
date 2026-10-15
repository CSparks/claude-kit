// link-recover.mjs — self-heal a stale-incremental link failure. rustc's incremental state can go
// inconsistent (a unit pruned or half-written under a build) and the link then fails with
// `undefined symbol: anon.<hash>.<n>.llvm.<n>`; a clean build of that crate fixes it.
//
// `linkFailure(log)` → null | { crate } (crate null when the log names none).
// `recoverLink(targetDir, failure)` → a one-line note after clearing that crate's incremental units (all if unnamed).

import { clearIncremental } from './incremental.mjs';

const LINK_FAILED = /linking with `[^`]+` failed/;
const ANON_UNDEFINED = /undefined symbol: anon\.[0-9a-f]+\.\d+\.llvm\./;
const COULD_NOT_COMPILE = /could not compile `([^`]+)`/;

export function linkFailure(log) {
  const text = String(log);
  if (!LINK_FAILED.test(text) || !ANON_UNDEFINED.test(text)) return null;
  const m = text.match(COULD_NOT_COMPILE);
  return { crate: m ? m[1] : null };
}

export function recoverLink(targetDir, { crate }) {
  const removed = clearIncremental(targetDir, crate ? [crate] : []);
  return `link failure (undefined anon.*.llvm symbol): cleared ${removed} incremental unit(s) of ${crate || 'all crates'} and retried once`;
}
