// chain-producer.mjs — a command that writes a log by redirect and then searches or reads that same log in a later
// segment (KIT-T1439). The retrieval gate refuses the whole command, so the producing segment never runs either; the
// block leads with the one-call rewrite that filters the producer's own output, and the two-call form that keeps the log.
//
//   chainProducer(command, file) -> the command through the producing segment, earlier segments kept and the redirect
//                                   cut; null when no segment of the command redirects into `file`
//   producerLines({ command, files, filter, tool }) -> block lines (empty when no producer writes the file)
//     filter  the output filter the rewrite pipes into (`grep -E '<pattern>'`, `tail -n 40`)
//     tool    the tool that then reads the kept log ('Grep' or 'Read')

const SEGMENT_SPLIT = /\s*(?:&&|\|\||;|\n)\s*/;
const STDERR_MERGE = /\s*2>&1/g;
const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function redirectInto(file) {
  const target = escape(norm(file));
  return new RegExp(`\\s*(?:1|&)?>>?\\s*["']?(?:\\./)?${target}["']?(?=[\\s);&|]|$)`);
}

// The command up to the end of the producing segment, so a leading `cd` or `mkdir` stays in the rewrite.
export function chainProducer(command, file) {
  const text = String(command).replace(/\\/g, '/');
  const m = redirectInto(file).exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length).split(SEGMENT_SPLIT)[0];
  return `${text.slice(0, m.index)} ${rest.replace(STDERR_MERGE, '')}`.replace(/\s+/g, ' ').trim() || null;
}

export function producerLines({ command, files, filter, tool }) {
  const file = files.length === 1 ? files[0] : null;
  const producer = file && chainProducer(command, file);
  if (!producer) return [];
  return [
    `Nothing ran: the gate refuses the whole command, so the segment that writes ${file} did not run either.`,
    `  One call, the producer's own output filtered:  ${producer} 2>&1 | ${filter}`,
    `  Or keep the log: run  ${producer} > ${file} 2>&1; echo exit=$?  then the ${tool} tool on ${file}.`,
    '',
  ];
}
