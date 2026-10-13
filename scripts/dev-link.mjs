#!/usr/bin/env node
// dev-link — point the INSTALLED claude-kit plugin at a kit tree. The install dir becomes a
// junction, so hooks, commands, agents, skills and the bin/ shims (q, t, cap) all load from it.
//
//   node scripts/dev-link.mjs           # link the install dir -> the sealed runtime (`current`)
//   node scripts/dev-link.mjs --live    # link the install dir -> this working repo (writer loop)
//   node scripts/dev-link.mjs --unlink  # restore the frozen snapshot
//
// The sealed runtime holds the tested, committed tree and moves only through
// `npm run publish:runtime` (KIT-T450). `--live` runs half-edits, so only the writer uses it.
// `/plugin update` replaces the link with a fresh snapshot — re-run dev-link to re-link.
// bootstrap.mjs calls linkPlugin, so a bootstrap run keeps the install on the runtime.

import { readFileSync, existsSync, rmSync, renameSync, symlinkSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runtimeCurrent } from './runtime-path.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'claude-kit@claude-kit';
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';

const defaultHome = () => process.env.CLAUDE_HOME || join(homedir(), '.claude');

/** The installed plugin's directory per installed_plugins.json, or '' when not installed. */
export function pluginInstallPath(claudeHome = defaultHome()) {
  try {
    const data = JSON.parse(readFileSync(join(claudeHome, 'plugins', 'installed_plugins.json'), 'utf8'));
    return ((data.plugins && data.plugins[KEY]) || [])[0]?.installPath || '';
  } catch {
    return '';
  }
}

const isLink = (path) => { try { return lstatSync(path).isSymbolicLink(); } catch { return false; } };
const sameTree = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return false; } };

/** Point the install dir at `target`; the frozen snapshot is kept once as `<dir>.snapshot-bak`. */
export function linkPlugin({ claudeHome = defaultHome(), target }) {
  const installPath = pluginInstallPath(claudeHome);
  if (!installPath) throw new Error(`${KEY} is not installed — run /plugin install ${KEY} first.`);
  if (isLink(installPath)) {
    if (sameTree(installPath, target)) return { action: 'unchanged', installPath };
    rmSync(installPath, { recursive: true, force: true });
  } else if (existsSync(installPath)) {
    const bak = installPath + '.snapshot-bak';
    if (existsSync(bak)) rmSync(installPath, { recursive: true, force: true });
    else renameSync(installPath, bak);
  }
  symlinkSync(target, installPath, LINK_TYPE);
  return { action: 'linked', installPath };
}

/** Remove the link and restore the frozen snapshot. */
export function unlinkPlugin({ claudeHome = defaultHome() } = {}) {
  const installPath = pluginInstallPath(claudeHome);
  if (!installPath || !isLink(installPath)) return { action: 'unchanged', installPath };
  rmSync(installPath, { recursive: true, force: true });
  const bak = installPath + '.snapshot-bak';
  if (existsSync(bak)) renameSync(bak, installPath);
  return { action: 'unlinked', installPath };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = (name) => process.argv.includes(name);
  try {
    if (flag('--unlink')) {
      const r = unlinkPlugin();
      console.log(r.action === 'unlinked' ? 'unlinked — frozen snapshot restored. /reload-plugins to apply.' : 'not dev-linked — nothing to do.');
    } else {
      const target = flag('--live') ? REPO : runtimeCurrent();
      if (!target) throw new Error('no sealed runtime published yet — run `npm run publish:runtime` (or pass --live for the working repo).');
      const r = linkPlugin({ target });
      console.log(r.action === 'unchanged' ? `already linked: ${r.installPath} -> ${target}` : `linked: ${r.installPath}\n    -> ${target}\n\n/reload-plugins to apply. (node scripts/dev-link.mjs --unlink to revert.)`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
