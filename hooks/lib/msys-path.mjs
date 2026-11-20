// A Git Bash (MSYS) path as the native path the Node process reads (KIT-T1444). Git itself resolves `/tmp/x` and
// `/c/x` through the MSYS mount table; a Node process on Windows sees `/tmp/x` as `C:\tmp\x`, so a gate that reads a
// path the command names maps it first.
//
//   msysToNative(path) -> string   `/c/x` -> `c:/x` (every platform, the form the gates always read);
//                                  `/tmp[/x]` -> the OS temp dir (Windows only, where MSYS mounts /tmp as the user temp dir);
//                                  any other path unchanged

import { tmpdir } from 'node:os';

const DRIVE = /^\/([A-Za-z])\//;
const TMP = /^\/tmp(?=\/|$)/;

export function msysToNative(path, { platform = process.platform, temp = tmpdir() } = {}) {
  const p = String(path);
  if (DRIVE.test(p)) return p.replace(DRIVE, '$1:/');
  return platform === 'win32' && TMP.test(p) ? p.replace(TMP, temp.replace(/\\/g, '/')) : p;
}
