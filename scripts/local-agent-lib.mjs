// local-agent-lib.mjs — the pure parts of the local Qwen dispatch lane (KIT-D080): prompt and
// launcher-argument assembly, patch-envelope extraction, broker submit arguments, and the
// concurrency slots. scripts/local-agent.mjs is the runner that spawns the launcher.
//
//   LOCAL_MODEL                          the router preset id: 3 agents share one load of the 27B
//   modeFor(repo)                        'broker' when a broker daemon owns the tree, else 'direct'
//   buildPrompt({ brief, mode, ... })    the full prompt the local agent receives on stdin
//   buildInvocation({ repo, model, mode, outFile, rigDir })  { command, args } for codex-local.cmd
//   extractPatch(text)                   the patch envelope between the PATCH markers, or ''
//   submitArgs({ root, ticket, ... })    argv for scripts/broker/submit.mjs
//   acquireSlot({ dir, slots, repo, mode })  { index, release } or null (all slots busy / writer clash)

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { liveBroker } from '../hooks/dispatch-broker.mjs';

export const LOCAL_MODEL = 'qwen3.8-27b-3x';
export const PATCH_BEGIN = '=== PATCH BEGIN ===';
export const PATCH_END = '=== PATCH END ===';
export const DEFAULT_SLOTS = 3;

export function modeFor(repo) {
  return liveBroker(repo) ? 'broker' : 'direct';
}

const BROKER_RULES = [
  'This checkout is owned by a build-broker daemon: you NEVER write it. You have a read-only view.',
  'Read the files you need, then author the whole change as ONE patch envelope and end your reply with it',
  `between a line \`${PATCH_BEGIN}\` and a line \`${PATCH_END}\`. The wrapper submits it to the broker.`,
  'Envelope format (paths relative to the repo root):',
  '  *** edit path/to/file.rs',
  '  <<<<<<< SEARCH',
  '  exact old text, appearing exactly once in the file',
  '  =======',
  '  new text',
  '  >>>>>>> REPLACE',
  '  *** write path/to/new_file.rs      (full content of a NEW file only)',
  '  *** delete path/to/old_file.rs',
  'Include enough context lines in each SEARCH block to make it unique. Never run cargo or git writes.',
];

const DIRECT_RULES = [
  'Edit only the files named in the brief. Run the acceptance check named in the brief and report its output.',
  'Never run git commit, git push or git stash. Never touch files outside the repo.',
];

/** The prompt: the brief first, then the lane rules and the report shape. */
export function buildPrompt({ brief, mode, ticket }) {
  const rules = mode === 'broker' ? BROKER_RULES : DIRECT_RULES;
  return [
    '# Brief',
    String(brief).trim(),
    '',
    '# Rules',
    ...(ticket ? [`Ticket: ${ticket}`] : []),
    'Make the smallest change that meets the acceptance criteria. If the brief is not enough to do it',
    'safely, stop and say what is missing instead of guessing.',
    ...rules,
    '',
    '# Report',
    'End with: files changed, the acceptance check you ran and its result, and anything that deviated.',
  ].join('\n');
}

/** `codex exec` through the rig launcher: it starts the router if needed and applies `--profile local`. */
export function buildInvocation({ repo, model = LOCAL_MODEL, mode, outFile, rigDir = 'D:\\llm' }) {
  return {
    command: join(rigDir, 'codex-local.cmd'),
    args: [
      'exec',
      '--model', model,
      '--cd', repo,
      '--sandbox', mode === 'broker' ? 'read-only' : 'workspace-write',
      '--skip-git-repo-check',
      '--output-last-message', outFile,
      '-',
    ],
  };
}

export function extractPatch(text) {
  const t = String(text);
  const start = t.lastIndexOf(PATCH_BEGIN);
  if (start < 0) return '';
  const body = t.slice(start + PATCH_BEGIN.length);
  const end = body.indexOf(PATCH_END);
  return (end < 0 ? body : body.slice(0, end)).replace(/^\r?\n/, '').replace(/\s+$/, '') + '\n';
}

export function submitArgs({ kitRoot, root, ticket, title, tests = [], land = false, revises = '' }) {
  return [
    join(kitRoot, 'scripts', 'broker', 'submit.mjs'),
    '--root', root,
    ...(ticket ? ['--ticket', ticket] : []),
    '--title', title,
    ...tests.flatMap((t) => ['--test', t]),
    ...(land ? ['--land'] : []),
    ...(revises ? ['--revises', revises] : []),
  ];
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
};

/**
 * Claim one of `slots` lane slots (a file per slot holding the owner's pid, repo and mode).
 * Returns null when every slot is busy, or when a direct-mode agent already writes `repo`
 * (one writer per checkout, KIT-D077); broker-mode agents share a tree freely.
 */
export function acquireSlot({ dir, slots = DEFAULT_SLOTS, repo, mode, pid = process.pid }) {
  mkdirSync(dir, { recursive: true });
  const held = new Map();
  for (const name of readdirSync(dir).filter((f) => /^slot-\d+\.json$/.test(f))) {
    try {
      const row = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (alive(row.pid)) held.set(Number(name.match(/\d+/)[0]), row);
      else rmSync(join(dir, name), { force: true });
    } catch {
      rmSync(join(dir, name), { force: true });
    }
  }
  if (mode === 'direct' && [...held.values()].some((r) => r.mode === 'direct' && r.repo === repo)) return null;
  for (let index = 0; index < slots; index++) {
    if (held.has(index)) continue;
    const file = join(dir, `slot-${index}.json`);
    try {
      writeFileSync(file, JSON.stringify({ pid, repo, mode }), { flag: 'wx' });
    } catch {
      continue;
    }
    return { index, release: () => existsSync(file) && rmSync(file, { force: true }) };
  }
  return null;
}
