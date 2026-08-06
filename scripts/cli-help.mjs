// cli-help.mjs — one spelling of the help FLAG for every kit CLI (KIT-T184).
//
// Each CLI answered `--help` with whatever its arg parser happened to do with an unknown token:
// `cap --help` CAPTURED an inbox item whose entire body was "--help", `t --help` and `rem --help`
// printed "unknown subcommand '--help'" alongside the usage, and `code-graph --help` dumped the
// whole graph as JSON. An agent discovering a tool by asking it for usage got a wrong answer and,
// in cap's case, a file in the work store.
//
// This module settles ONLY what "asked for help" means. Each CLI keeps its own usage TEXT — the
// text is the tool's business, the flag spelling is shared.

export const isHelpFlag = (arg) => arg === '--help' || arg === '-h';

// For a CLI whose arguments are STRUCTURED (verbs, ids, flags): the flag counts anywhere, so
// `t new --help` is a request for usage rather than a ticket titled "--help".
export const wantsHelp = (argv) => argv.some(isHelpFlag);

// For a CLI whose arguments are FREE TEXT (cap): only the FIRST position counts. A capture is
// prose and may legitimately contain "-h" or the word help — `cap bug "-h prints nothing"` must
// still be captured, not swallowed by the help path.
export const wantsHelpFirst = (argv) => isHelpFlag(argv[0]);
