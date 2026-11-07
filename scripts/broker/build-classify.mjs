// build-classify.mjs — does a tool invocation compile, and does it run a program afterwards (KIT-D135)?
//
//   classify(tool, args, cwd) -> { gated, runs, sub }
//     tool   'cargo' | 'cargo-nextest' | 'cargo-ndk'   (the extension point for other build tools: add a case)
//     gated  the invocation compiles, so it takes cores from the machine build budget
//     runs   it starts the built program (`cargo run` and aliases of it): the hold ends when the program starts
// A project alias (`.cargo/config.toml` [alias]) is expanded first, so `cargo t` and `cargo editor` are judged as
// what they run.

import { GATED_SUBS } from './cargo-subs.mjs';
import { aliasOf } from './alias.mjs';

const BUILTIN_ALIASES = { b: 'build', c: 'check', t: 'test', r: 'run', d: 'doc' };
const FLAGS_WITH_VALUE = new Set(['--config', '-Z', '-C', '--color', '--manifest-path']);
const INFO_ONLY = new Set(['--version', '-V', '--help', '-h', 'help', 'version']);
const MAX_ALIAS_DEPTH = 5;

function subcommand(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('+')) continue;
    if (FLAGS_WITH_VALUE.has(a)) { i++; continue; }
    if (!a.startsWith('-')) return a;
  }
  return '';
}

function expand(sub, cwd) {
  let name = sub;
  for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth++) {
    const alias = aliasOf(`cargo ${name}`, cwd);
    const next = alias ? subcommand(alias) : BUILTIN_ALIASES[name];
    if (!next || next === name) return name;
    name = next;
  }
  return name;
}

export function classify(tool, args, cwd = process.cwd()) {
  if (args.some((a) => INFO_ONLY.has(a))) return { gated: false, runs: false, sub: '' };
  if (tool === 'cargo') {
    const sub = expand(subcommand(args), cwd);
    return { gated: GATED_SUBS.has(sub), runs: sub === 'run', sub };
  }
  return { gated: tool === 'cargo-nextest' || tool === 'cargo-ndk', runs: false, sub: tool };
}
