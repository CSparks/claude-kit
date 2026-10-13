// id-reserve.mjs — mint an id that no concurrent creator can also mint (KIT-T451).
//
// `nextId` reads max+1 from disk, so two creators that read before either writes get the same
// id. A reservation is an exclusive-create marker (`wx`) named by the id in a per-store directory
// outside the data repo; the first creator to claim an id owns it, the loser takes the next.
// Reserved ids are never reused, so an abandoned creation leaves a gap, like a deleted ticket.
//
//   reserveNextId(root, store) -> '<KEY>-<TYPE><NUM>'

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readIdConfig, maxStoreNum, formatItemId, STORE_TYPE } from './id-utils.mjs';

const RESERVE_DIR = 'claude-kit-id-reserve';
const HASH_CHARS = 16;
const MAX_ATTEMPTS = 10000;

const reserveDir = (root) => join(tmpdir(), RESERVE_DIR, createHash('sha1').update(resolve(root).toLowerCase()).digest('hex').slice(0, HASH_CHARS));

export function reserveNextId(root, store) {
  if (!STORE_TYPE[store]) throw new Error(`unknown store '${store}' (one of: ${Object.keys(STORE_TYPE).join(', ')})`);
  const { key, pad } = readIdConfig(root);
  if (!key) throw new Error(`no ids.key in ${join(root, '.ai', 'config.yml')} — add an ids block (ids: key: ABC, pad: 3)`);
  const dir = reserveDir(root);
  mkdirSync(dir, { recursive: true });
  for (let n = maxStoreNum(root, store) + 1, tries = 0; tries < MAX_ATTEMPTS; n++, tries++) {
    const id = formatItemId(key, store, n, pad);
    try {
      writeFileSync(join(dir, id), String(process.pid), { flag: 'wx' });
      return id;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  throw new Error(`could not reserve a free ${store} id after ${MAX_ATTEMPTS} attempts`);
}
