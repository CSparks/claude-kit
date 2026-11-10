// What counts as ROUTING a request inside a turn, for the request-capture gate (KIT-T927): a command that
// writes the work store (cap, or a `t` verb that records an item or a maintainer comment), or a dispatch whose
// prompt carries the maintainer's words. Judged from the commands and dispatch prompts of the turn.
//
//   routedByCommand(commands) -> boolean
//   routedByDispatch(prompts, userText) -> boolean

import { commandLeads } from './command-leads.mjs';

const ROUTING_VERBS = new Set(['new', 'request', 'note', 'notes', 'epic', 'question', 'comment', 'criterion', 'decide', 'triage']);
const FLAGS_WITH_VALUE = new Set(['--root', '--project']);
const MAINTAINER_TOKEN = /\[maintainer-words:/i;
const QUOTE_WORDS = 6;
const WHOLE_MESSAGE_MIN_CHARS = 12;

const script = (lead) => {
  if (lead.tool === 'cap' || lead.tool === 't') return { name: lead.tool, rest: lead.args };
  if (lead.tool !== 'node' || !lead.args.length) return null;
  const file = lead.args[0].replace(/^["']|["']$/g, '').replace(/\\/g, '/').split('/').pop().toLowerCase();
  return file === 'cap.mjs' || file === 't.mjs' ? { name: file.slice(0, -4), rest: lead.args.slice(1) } : null;
};

const verbOf = (rest) => {
  for (let i = 0; i < rest.length; i++) {
    if (FLAGS_WITH_VALUE.has(rest[i])) { i++; continue; }
    if (!rest[i].startsWith('-')) return rest[i].replace(/^["']|["']$/g, '');
  }
  return '';
};

export function routedByCommand(commands) {
  return commands.some((c) => commandLeads(c).some((lead) => {
    const s = script(lead);
    return s && (s.name === 'cap' || ROUTING_VERBS.has(verbOf(s.rest)));
  }));
}

const words = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim().split(' ').filter(Boolean);

export function routedByDispatch(prompts, userText) {
  const message = words(userText);
  return prompts.some((prompt) => {
    if (MAINTAINER_TOKEN.test(prompt)) return true;
    const body = ` ${words(prompt).join(' ')} `;
    if (message.length < QUOTE_WORDS) return message.join(' ').length >= WHOLE_MESSAGE_MIN_CHARS && body.includes(` ${message.join(' ')} `);
    for (let i = 0; i + QUOTE_WORDS <= message.length; i++) if (body.includes(` ${message.slice(i, i + QUOTE_WORDS).join(' ')} `)) return true;
    return false;
  });
}
