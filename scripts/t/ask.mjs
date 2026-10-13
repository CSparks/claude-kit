// t/ask.mjs — `t ask` and `t resolve` on a question file (KIT-T448): the CLI side of the
// open -> asked -> resolved lifecycle. Pure file mutation; t.mjs wraps it with the refresh.

import { readFileSync, writeFileSync } from 'node:fs';
import { sep } from 'node:path';
import { readIdentity } from '../../hooks/lib.mjs';
import { findItemFile } from '../q-show.mjs';
import { resolveUser } from '../identity.mjs';
import { stampAsk, resolveQuestion, isOpenQuestion } from '../question-asks.mjs';

const SESSION_ENVS = ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID'];
const QUESTIONS_DIR = `${sep}questions${sep}`;

/** The session this ask belongs to: --session, the harness env, then the store's .session pointer. */
export function sessionName(root, flag, env = process.env) {
  const fromEnv = SESSION_ENVS.map((k) => env[k]).find(Boolean);
  const name = flag || fromEnv || readIdentity(`${root}${sep}.ai`).session;
  if (!name) throw new Error('no session id found — pass --session <name>');
  return name;
}

function questionFile(root, id) {
  const file = findItemFile(id, root);
  if (!file || !file.includes(QUESTIONS_DIR)) throw new Error(`${id}: no question file (t ask / t resolve take ${'<KEY>-Q###'} ids)`);
  return file;
}

export function askQuestion(root, id, flags = {}) {
  const file = questionFile(root, id);
  const session = sessionName(root, flags.session);
  writeFileSync(file, stampAsk(readFileSync(file, 'utf8'), session));
  return { id, session, file };
}

export function resolveQuestionFile(root, id, answer, flags = {}) {
  const file = questionFile(root, id);
  const text = readFileSync(file, 'utf8');
  if (!isOpenQuestion(text)) throw new Error(`${id}: already resolved`);
  const who = flags.by || resolveUser();
  writeFileSync(file, resolveQuestion(text, who, answer));
  return { id, who, file };
}

