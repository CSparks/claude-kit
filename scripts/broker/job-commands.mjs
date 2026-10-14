// job-commands.mjs — what a job runs and how its run is judged.
//
// `jobCommands(cfg, job)` → the job's commands, or `verify_default` when it gave none.
// `isGreen(entries)` → every command exited 0 or failed only on foreign tests.
// `foreignOf(entries)` → the foreign failures across the commands.

export const jobCommands = (cfg, job) => (Array.isArray(job.commands) && job.commands.length ? job.commands : cfg.verifyDefault);

export const isGreen = (entries) => entries.every((c) => c.exit === 0 || (c.foreign && c.foreign.length));

export const foreignOf = (entries) => entries.flatMap((c) => c.foreign || []);
