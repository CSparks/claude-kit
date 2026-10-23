// generations.mjs — which cargo artifacts are an older generation of one that lives on (KIT-T636).
//
// Cargo names an artifact <crate>-<hash>[.ext]; a rebuild with a changed hash writes a new
// generation beside the old one and never removes it. The newest generation of a crate is live
// however old it is; generations built within GENERATION_WINDOW_MS of it are siblings from one
// build (host/target variants, build-script compile vs run) and are live too.
//
//   parseName(name, hashPattern) -> { crate, hash } | null
//   staleItems(items)            -> the items of older generations; items = [{ crate, hash, mtimeMs, ... }]

export const ARTIFACT_HASH = '[0-9a-f]{16}';
export const INCREMENTAL_HASH = '[0-9a-z]{8,14}';
export const GENERATION_WINDOW_MS = 60 * 60 * 1000;
const LIB_EXT = /^\.(rlib|rmeta|a|so|dylib)$/;
const LIB_PREFIX = 'lib';

export function parseName(name, hashPattern = ARTIFACT_HASH) {
  const m = new RegExp(`^(.+?)-(${hashPattern})([.].*)?$`).exec(name);
  if (!m) return null;
  const crate = m[1].startsWith(LIB_PREFIX) && LIB_EXT.test(m[3] || '') ? m[1].slice(LIB_PREFIX.length) : m[1];
  return { crate, hash: m[2] };
}

export function staleItems(items) {
  const byCrate = new Map();
  for (const it of items) {
    const hashes = byCrate.get(it.crate) || new Map();
    hashes.set(it.hash, Math.max(hashes.get(it.hash) ?? 0, it.mtimeMs));
    byCrate.set(it.crate, hashes);
  }
  const newest = new Map([...byCrate].map(([crate, hashes]) => [crate, Math.max(...hashes.values())]));
  return items.filter((it) => byCrate.get(it.crate).get(it.hash) < newest.get(it.crate) - GENERATION_WINDOW_MS);
}
