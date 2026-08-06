#!/usr/bin/env node
// Host compatibility launcher for plugin hooks.
//
// Claude Code and Codex share the same lifecycle event family, but two wire details
// differ:
//   1. Codex apply_patch reports the whole patch in tool_input.command, while the
//      original Claude hooks expect one tool_input.file_path + content/new_string.
//   2. Codex requires structured stdout for several events where Claude accepts
//      plain hook output.
//
// Every hook is launched through this file. Claude payloads/output pass through
// unchanged. Codex is detected by PLUGIN_ROOT, which Codex sets in addition to the
// compatibility CLAUDE_PLUGIN_ROOT variable.

import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE_PAYLOAD_HOOKS = new Set([
  'pre-write.mjs',
  'lint.mjs',
  'jscpd.mjs',
  'ingest-data.mjs',
]);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function addedContent(block) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

export function parsePatchFiles(command, cwd = process.cwd()) {
  if (typeof command !== 'string' || !command.includes('*** Begin Patch')) return [];
  const header = /^\*\*\* (Add|Update|Delete) File: (.+?)\r?$/gm;
  const matches = [...command.matchAll(header)];
  const files = [];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? command.indexOf('*** End Patch', start);
    const block = command.slice(start, end === -1 ? command.length : end);
    const rawPath = match[2].trim();
    const move = block.match(/^\*\*\* Move to: (.+?)\r?$/m);
    const paths = move ? [rawPath, move[1].trim()] : [rawPath];
    const content = addedContent(block);

    for (const path of paths) {
      const filePath = isAbsolute(path) ? resolve(path) : resolve(cwd, path);
      files.push({
        operation: match[1].toLowerCase(),
        filePath,
        content,
      });
    }
  }

  const unique = new Map();
  for (const file of files) unique.set(file.filePath.toLowerCase(), file);
  return [...unique.values()];
}

export function codexFilePayloads(payload, scriptName) {
  if (!FILE_PAYLOAD_HOOKS.has(scriptName)) return [payload];
  if (payload?.tool_name !== 'apply_patch') return [payload];
  const command = payload?.tool_input?.command;
  const files = parsePatchFiles(command, payload.cwd || process.cwd());
  if (!files.length) return [payload];

  return files.map((file) => ({
    ...payload,
    tool_input: {
      ...(payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {}),
      file_path: file.filePath,
      content: file.content,
      new_string: file.content,
      operation: file.operation,
    },
  }));
}

function joinOutput(parts) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join('\n');
}

function jsonValue(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function formatCodexSuccess(event, stdout, stderr) {
  const out = joinOutput(stdout);
  const err = joinOutput(stderr);
  const existingJson = jsonValue(out);
  if (existingJson && !err) return JSON.stringify(existingJson);

  if (event === 'SessionStart' || event === 'UserPromptSubmit') {
    return joinOutput([out, err]);
  }

  if (event === 'PreToolUse' || event === 'PostToolUse') {
    const additionalContext = joinOutput([out, err]);
    if (!additionalContext) return '';
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: event,
        additionalContext,
      },
    });
  }

  if (event === 'PreCompact' || event === 'PostCompact') {
    const systemMessage = joinOutput([out, err]);
    return systemMessage ? JSON.stringify({ systemMessage }) : '';
  }

  if (event === 'Stop' || event === 'SubagentStop') {
    if (out) {
      return JSON.stringify({
        decision: 'block',
        reason: out,
        ...(err ? { systemMessage: err } : {}),
      });
    }
    return err ? JSON.stringify({ systemMessage: err }) : '';
  }

  return joinOutput([out, err]);
}

function runHook(scriptPath, payload) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

async function main() {
  const scriptName = process.argv[2] || '';
  if (!/^[a-z0-9-]+\.mjs$/.test(scriptName) || scriptName === 'compat-run.mjs') {
    process.stderr.write(`invalid hook script: ${scriptName || '(missing)'}\n`);
    process.exit(1);
  }
  const scriptPath = resolve(HERE, scriptName);
  if (dirname(scriptPath) !== HERE) {
    process.stderr.write(`hook script escapes hooks directory: ${scriptName}\n`);
    process.exit(1);
  }

  const raw = await readStdin();
  const payload = safeJson(raw);
  const isCodex = Boolean(process.env.PLUGIN_ROOT);
  const payloads = isCodex ? codexFilePayloads(payload, scriptName) : [payload];
  const results = payloads.map((item) => runHook(scriptPath, item));
  const failed = results.find((result) => result.error || (result.status ?? 1) !== 0);

  if (!isCodex || failed) {
    for (const result of results) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    if (failed?.error) process.stderr.write(`${failed.error.message}\n`);
    process.exit(failed ? (failed.status ?? 1) : 0);
  }

  const output = formatCodexSuccess(
    String(payload.hook_event_name || ''),
    results.map((result) => result.stdout),
    results.map((result) => result.stderr),
  );
  if (output) process.stdout.write(output);
}

const THIS_FILE = resolve(fileURLToPath(import.meta.url));
const INVOKED = process.argv[1] ? resolve(process.argv[1]) : '';
if (INVOKED === THIS_FILE) await main();
