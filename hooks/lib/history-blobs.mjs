// A file whose bytes equal a blob a commit recorded for that very path authors nothing: `git checkout <rev> -- <path>`
// and `git restore --source=<rev>` put committed content back (KIT-T1337). Commits are the ones HEAD, a branch, a tag or
// a remote ref reach; a stash or any other unreachable object counts for nothing. Blob ids are computed here from the
// file's bytes (as-is and with CRLF read as LF), so no clean filter runs; any git failure means "not in history".
//
//   committedPathContent(root, rels, readBytes) -> Set of the paths in `rels` whose bytes some reachable commit holds at that path
//     readBytes(rel) -> [Buffer] the byte variants to try, the first being the bytes on disk

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const CHUNK = 100;
const LOG_BUFFER_BYTES = 256 * 1024 * 1024;
const RAW_META = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) \S+$/;
const ABSENT_BLOB = /^0+$/;
const REACHABLE = ['HEAD', '--branches', '--tags', '--remotes'];

const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// Every blob id some reachable commit recorded at each of the paths, from `git log --raw -z` (renames off, merges diffed per parent).
function recordedBlobs(root, rels) {
  const log = execFileSync('git', ['--literal-pathspecs', 'log', ...REACHABLE, '--no-renames', '-m', '--format=', '--raw', '--no-abbrev', '-z', '--', ...rels], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, maxBuffer: LOG_BUFFER_BYTES,
  });
  const parts = log.split('\0');
  const blobs = new Map();
  for (let i = 0; i + 1 < parts.length; i++) {
    const meta = RAW_META.exec(parts[i].replace(/^\n+/, ''));
    if (!meta) continue;
    if (!ABSENT_BLOB.test(meta[1])) blobs.set(parts[i + 1], (blobs.get(parts[i + 1]) || new Set()).add(meta[1]));
    i += 1;
  }
  return blobs;
}

export function committedPathContent(root, rels, readBytes) {
  const found = new Set();
  const wanted = rels.map((rel) => [rel, readBytes(rel).slice(0, 2).map(blobId)]).filter(([, ids]) => ids.length);
  for (let i = 0; i < wanted.length; i += CHUNK) {
    const chunk = wanted.slice(i, i + CHUNK);
    try {
      const recorded = recordedBlobs(root, chunk.map(([rel]) => rel));
      for (const [rel, ids] of chunk) if (ids.some((id) => recorded.get(rel)?.has(id))) found.add(rel);
    } catch {
      /* git cannot answer: nothing in this chunk is proven committed */
    }
  }
  return found;
}
