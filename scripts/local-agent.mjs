#!/usr/bin/env node
// local-agent.mjs — run one headless local Qwen agent (KIT-D080; docs/local-qwen-lane.md).
//
//   node scripts/local-agent.mjs --brief <file> --repo <dir> --report <file>
//        [--ticket ID] [--title "…"] [--test "cargo t -p x"]... [--land] [--job targeted-change]
//        [--model qwen3.8-27b-3x] [--max-revisions 2] [--slots 3] [--rig D:\llm] [--dry-run]
//
// The brief (a file) is the whole task; the report (a file) is the whole answer. Launches
// `codex exec` through the rig's codex-local.cmd, which starts the router when it is down.
// Up to --slots (3) agents run at once; a direct-mode writer excludes a second writer in one repo.
//
// BROKER-OWNED TREE (target/broker/broker.lock live): the agent gets a read-only view and returns a
// patch envelope; this wrapper submits it to the broker (skills/patch-worker protocol), waits, and on
// stale/gate/failed feeds the result back for up to --max-revisions revisions. The local agent never
// writes the tree. --land resubmits a green patch with --land (needs --ticket).
//
// Exit: 0 done (or patch passed), 1 failed after revisions, 2 usage, 75 no free slot.

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordAgent } from '../hooks/lib/agent-roster.mjs';
import { LOCAL_MODEL, DEFAULT_SLOTS, modeFor, buildPrompt, buildInvocation, extractPatch, submitArgs, acquireSlot } from './local-agent-lib.mjs';

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EX_USAGE = 2;
const EX_NO_SLOT = 75;

function parseArgs(argv) {
  const opts = { test: [] };
  const flags = new Set(['land', 'dry-run']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (flags.has(key)) opts[key] = true;
    else if (key === 'test') opts.test.push(argv[++i]);
    else opts[key] = argv[++i];
  }
  return opts;
}

function runLauncher({ repo, model, mode, rigDir, prompt, outFile }) {
  const { command, args } = buildInvocation({ repo, model, mode, outFile, rigDir });
  const r = spawnSync('cmd.exe', ['/c', command, ...args], { cwd: repo, input: prompt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let message = '';
  try { message = readFileSync(outFile, 'utf8'); } catch { message = r.stdout || ''; }
  return { code: r.status, message, stderr: r.stderr || '' };
}

function node(args, input, cwd) {
  const r = spawnSync(process.execPath, args, { cwd, input, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

// Submit the envelope, wait for the verdict: { passed, text }.
function submitToBroker({ patch, opts, repo, revises }) {
  const sub = node(submitArgs({ kitRoot: KIT_ROOT, root: repo, ticket: opts.ticket, title: opts.title || 'local-agent patch', tests: opts.test, land: !!opts.land, revises }), patch, repo);
  const id = sub.code === 0 ? sub.out.split(/\s+/).pop() : '';
  if (!id) return { passed: false, id: '', text: `submit failed:\n${sub.out}` };
  const wait = node([join(KIT_ROOT, 'scripts', 'broker', 'wait.mjs'), id, '--root', repo], '', repo);
  return { passed: wait.code === 0, id, text: wait.out };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.brief || !opts.repo || !opts.report) {
    console.error('usage: local-agent.mjs --brief <file> --repo <dir> --report <file> [--ticket ID] [--dry-run]');
    return EX_USAGE;
  }
  const repo = resolve(opts.repo);
  const mode = modeFor(repo);
  const model = opts.model || LOCAL_MODEL;
  const rigDir = opts.rig || process.env.LLM_RIG_DIR || 'D:\\llm';
  const brief = readFileSync(resolve(opts.brief), 'utf8');
  const scratch = mkdtempSync(join(tmpdir(), 'local-agent-'));
  const outFile = join(scratch, 'last-message.txt');
  const prompt = buildPrompt({ brief, mode, ticket: opts.ticket });

  if (opts['dry-run']) {
    console.log(JSON.stringify({ mode, model, ...buildInvocation({ repo, model, mode, outFile, rigDir }), prompt }, null, 2));
    return 0;
  }

  const slot = acquireSlot({ dir: join(tmpdir(), 'kit-local-agent'), slots: Number(opts.slots) || DEFAULT_SLOTS, repo, mode });
  if (!slot) {
    console.error('no free local-agent slot (all busy, or a direct-mode writer already holds this repo)');
    return EX_NO_SLOT;
  }
  const started = Date.now();
  const log = [];
  let status = 'done';
  let ok = true;
  try {
    const maxRevisions = mode === 'broker' ? Number(opts['max-revisions'] ?? 2) : 0;
    let nextPrompt = prompt;
    let revises = '';
    for (let attempt = 0; attempt <= maxRevisions; attempt++) {
      const run = runLauncher({ repo, model, mode, rigDir, prompt: nextPrompt, outFile });
      log.push(`## Attempt ${attempt + 1} (launcher exit ${run.code})`, run.message.trim() || run.stderr.trim() || '(no output)');
      if (mode !== 'broker') {
        ok = run.code === 0;
        break;
      }
      const patch = extractPatch(run.message);
      if (!patch) {
        ok = false;
        log.push('Broker result: no patch envelope in the reply.');
        nextPrompt = `${prompt}\n\n# Previous attempt\nYour reply had no patch envelope between the PATCH markers. Reply with the envelope.`;
        continue;
      }
      const res = submitToBroker({ patch, opts, repo, revises });
      revises = res.id;
      ok = res.passed;
      log.push(`Broker ${res.id || '(not queued)'}: ${res.passed ? 'passed' : 'not passed'}`, res.text);
      if (ok) break;
      nextPrompt = `${prompt}\n\n# Previous attempt (revise it)\nYour patch:\n${patch}\nBroker verdict:\n${res.text}`;
    }
    status = ok ? 'done' : 'error';
  } finally {
    slot.release();
    rmSync(scratch, { recursive: true, force: true });
  }
  const header = [`# local-agent report`, `mode: ${mode}`, `model: ${model}`, `job: ${opts.job || 'targeted-change'}`, `status: ${status}`, `seconds: ${Math.round((Date.now() - started) / 1000)}`, ''];
  mkdirSync(dirname(resolve(opts.report)), { recursive: true });
  writeFileSync(resolve(opts.report), [...header, ...log, ''].join('\n'));
  recordAgent(repo, { id: `local-${started.toString(36)}`, status, task: opts.title || opts.ticket || 'local-agent run', scope: 'local-agent', model: 'local-qwen', job: opts.job || 'targeted-change', durationMs: Date.now() - started, source: 'local-agent' });
  return ok ? 0 : 1;
}

process.exit(main());
