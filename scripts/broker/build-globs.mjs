// build-globs.mjs — the one definition of what a broker owns: files whose change can fail a
// compilation (KIT-D097). Docs, .ai/, scripts no build reads and files only embedded as data
// (include_str!/include_bytes! targets such as .rhai scripts) are written directly, never queued,
// never pause the daemon, and the dispatch guard never blocks them. build-inputs.mjs adds the
// include!() targets, which are Rust code under any extension.
//
//   BUILD_INPUT_GLOBS   every path a compile reads as code or configuration
//   PAUSE_GLOBS         the same minus Cargo.lock (patch.mjs journals it, so a dirty lock never pauses)
//   isBuildInput(path)  a repo-relative path matches BUILD_INPUT_GLOBS

import { matchesAny } from './glob.mjs';

export const PAUSE_GLOBS = ['**/*.rs', '**/Cargo.toml', '**/.cargo/config', '**/.cargo/config.toml', '**/rust-toolchain', '**/rust-toolchain.toml'];
export const BUILD_INPUT_GLOBS = [...PAUSE_GLOBS, '**/Cargo.lock'];

export const isBuildInput = (path) => matchesAny(BUILD_INPUT_GLOBS, String(path).replace(/\\/g, '/'));
