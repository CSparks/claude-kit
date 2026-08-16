// Readers for a project's .ai/ configuration. All use the same tolerant YAML-subset
// line scan (no yaml dependency) and are FAIL-OPEN: a missing or malformed file
// returns the documented default, never a throw.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Compile a list of regex sources, skipping bad patterns (shared by request-gate).
export function compileSignals(patterns) {
  const out = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(p, 'i'));
    } catch {
      /* skip a bad pattern, keep the rest */
    }
  }
  return out;
}

// The `capture:` block of .ai/config.yml — the request-gate ratchet's knobs. Lives
// here so every config parser has one home (KIT-T059).
export function loadCaptureConfig(root, defaultSignals = []) {
  const out = { enabled: true, mode: 'block-once', signals: compileSignals(defaultSignals) };
  let text;
  try {
    text = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
  } catch {
    return out;
  }
  const block = text.match(/^capture:[ \t]*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return out;
  const body = block[1];
  if (/^\s*enabled:\s*false\b/m.test(body)) out.enabled = false;
  const mode = body.match(/^\s*mode:\s*["']?([a-z-]+)/m);
  if (mode) out.mode = mode[1];
  const sig = body.match(/^\s*signals:[ \t]*\n((?:\s*-\s*.*\n?)+)/m);
  if (sig) {
    const list = [...sig[1].matchAll(/^\s*-\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]);
    if (list.length) out.signals = compileSignals(list);
  }
  return out;
}

// watch_repos from a repo's .ai/config.yml (paths relative to the repo root) — extra repos
// (e.g. a backport target) whose working-tree state a resume should also surface.
export function watchRepos(root) {
  try {
    const m = readFileSync(join(root, '.ai', 'config.yml'), 'utf8').match(/watch_repos:[ \t]*\[([^\]]*)\]/);
    if (m) return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  } catch {
    /* no config / no key */
  }
  return [];
}

// Cross-project lineage from a repo's .ai/lineage.yml — how this project relates to others
// (the engine it builds on, an ancestor it descends from, sibling apps, dead repos to avoid).
// Surfaced on resume so a blank context reads it instead of reconstructing it. Returns [] on
// any error.
export function readLineage(root) {
  let lines;
  try {
    lines = readFileSync(join(root, '.ai', 'lineage.yml'), 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
  const items = [];
  let cur = null;
  for (const ln of lines) {
    const start = ln.match(/^[ \t]*-[ \t]+name:[ \t]*["']?(.+?)["']?[ \t]*$/);
    if (start) {
      cur = { name: start[1].trim(), role: '', note: '', url: '', path: '' };
      items.push(cur);
      continue;
    }
    if (!cur) continue;
    const kv = ln.match(/^[ \t]+([a-z]+):[ \t]*["']?(.*?)["']?[ \t]*$/);
    if (kv && Object.prototype.hasOwnProperty.call(cur, kv[1])) cur[kv[1]] = kv[2].trim();
  }
  return items;
}

// The project's UAT resolution (KIT-D034): `required` (review IS the human acceptance
// stage — the queue waits on the human) or `none` (the agent closes directly, so no
// queue accrues). Defaults to `required` (the template default) on any miss.
export function uatDefault(root) {
  try {
    const cfg = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
    const m = cfg.match(/^uat:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+default:[ \t]*(\w+)/m);
    if (m) return m[1];
  } catch {
    /* no config — fall through to the template default */
  }
  return 'required';
}
