// restore-check.test.mjs — the check after a restore (KIT-T572): a file put back through `git checkout-index`
// (CRLF under autocrlf) is the journalled file, so it is no mismatch; a real difference is named with what
// differed; and the restore-mismatch fault clears when a later restore verifies clean.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, restore, restoreMismatches } from './preimage.mjs';
import { describeMismatches } from './restore-check.mjs';
import { recordFault, recordRestoreClean } from './health-store.mjs';
import { selfCheck } from './health.mjs';
import { ensureDirs } from './result.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

function crlfTree() {
  const s = fixture();
  g(['config', 'core.autocrlf', 'true'], s.root);
  commitOnMain(s.root, 'lib.rs', 'fn a() {}\nfn b() {}\n', 'add lib');
  writeFileSync(join(s.root, 'lib.rs'), 'fn a() {}\nfn b() {}\n');
  return s;
}

const journalOf = (s, id) => ensureDirs(s.cfg) && capture(s.cfg, { id, cwd: s.root, paths: ['lib.rs'] });

test('an LF file restored through checkout-index under autocrlf is not a mismatch', () => {
  const s = crlfTree();
  try {
    const journal = journalOf(s, 'j-1');
    writeFileSync(join(s.root, 'lib.rs'), 'fn changed() {}\n');
    restore(s.cfg, journal);
    assert.equal(readFileSync(join(s.root, 'lib.rs'), 'utf8'), 'fn a() {}\r\nfn b() {}\r\n', 'checkout wrote the working form');
    assert.deepEqual(restoreMismatches(journal), []);
  } finally { s.done(); }
});

test('control: a file whose content differs after the restore is a mismatch, and the description says what differed', () => {
  const s = crlfTree();
  try {
    const journal = journalOf(s, 'j-2');
    restore(s.cfg, journal);
    writeFileSync(join(s.root, 'lib.rs'), 'fn a() {}\nfn other() {}\nfn c() {}\n');
    assert.deepEqual(restoreMismatches(journal), ['lib.rs']);
    assert.match(describeMismatches(journal)[0], /^lib\.rs: content differs, first at line 2 \(\d+ bytes, journal \d+\)$/);
    writeFileSync(join(s.root, 'lib.rs'), 'fn a() {}\r\nfn b() {}\r\n\r\n');
    assert.match(describeMismatches(journal)[0], /^lib\.rs: content differs/);
    assert.deepEqual(restoreMismatches(journal), ['lib.rs'], 'an extra blank line is real');
  } finally { s.done(); }
});

test('a genuine line-ending-only difference is described as such', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'lib.rs', 'a\nb\n', 'add');
    writeFileSync(join(s.root, 'lib.rs'), 'a\nb\n');
    const journal = journalOf(s, 'j-3');
    writeFileSync(join(s.root, 'lib.rs'), 'a\r\nb\r\n');
    assert.deepEqual(restoreMismatches(journal), ['lib.rs']);
    assert.match(describeMismatches(journal)[0], /^lib\.rs: line endings only/);
  } finally { s.done(); }
});

test('a tracked file git sees unmodified is no mismatch when only its line endings differ from the journal', () => {
  const s = fixture();
  try {
    commitOnMain(s.root, 'lib.rs', 'a\r\nb\r\n', 'add crlf');
    writeFileSync(join(s.root, 'lib.rs'), 'a\nb\n');
    const journal = journalOf(s, 'j-4');
    restore(s.cfg, journal);
    g(['checkout', 'HEAD', '--', 'lib.rs'], s.root);
    assert.equal(readFileSync(join(s.root, 'lib.rs'), 'utf8'), 'a\r\nb\r\n');
    assert.equal(g(['status', '--porcelain'], s.root), '');
    assert.deepEqual(restoreMismatches(journal), []);
    writeFileSync(join(s.root, 'lib.rs'), 'a\r\nc\r\n');
    assert.deepEqual(restoreMismatches(journal), ['lib.rs'], 'control: a content difference stays a mismatch');
  } finally { s.done(); }
});

test('a restore-mismatch fault stands until a later restore verifies clean, then the self-check drops it', () => {
  const s = fixture();
  try {
    recordFault(s.cfg, { kind: 'restore-mismatch', id: 'j-old', detail: 'after the restore lib.rs differ(s) from the journal' });
    const standing = selfCheck(s.cfg, { skipNoDaemon: true }).entries;
    assert.deepEqual(standing.map((e) => e.kind), ['own-fault:restore-mismatch']);
    assert.match(standing[0].detail, /lib\.rs/);
    recordRestoreClean(s.cfg, new Date(Date.now() + 1000));
    assert.deepEqual(selfCheck(s.cfg, { skipNoDaemon: true }).entries, []);
  } finally { s.done(); }
});
