// trailer.mjs — the `Broker-Gate:` trailer a landing commit carries (KIT-T472): the ticket
// evidence floor (KIT-T061) cites it. It names the job whose result JSON holds the logs, what
// ran, and whether the full suite still owes a run.
//
// `gateTrailer(job, commands, { reused, selection })` → one trailer line.

const PASSED = (c) => c.exit === 0;

export function gateTrailer(job, commands, { reused = null, selection = null } = {}) {
  const ran = `${commands.filter(PASSED).length}/${commands.length} commands green`;
  const from = reused ? `, reused check ${reused.job}` : '';
  const scope = selection ? '; affected gate, full suite on the cadence' : '';
  return `Broker-Gate: ${job.id} ${ran}${from}${scope} (target/broker/results/${job.id}.json)`;
}
