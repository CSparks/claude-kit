# request-gate re-fires on a request captured in another repo's store

Observed client-rx-clinical session 2026-08-05: Chris asked for a KIT feature mid-session;
it was captured + shipped in the kit's own store (KIT-T179). The dispatching session's
request-gate cannot see that store, so its Stop hook re-flags the same phrase on EVERY
subsequent stop — three times in one session — and each reply must re-carry a
`[no-capture]` token for work that IS captured.

Root cause: request-capture matches against the current repo's `.ai` only; a request
routed cross-repo (the routes_to target being another project, exactly what the kit
scope is for) looks permanently un-captured. Same blind spot family as KIT-T177
residual 4 / progress residual 3.

Fix directions (pick at triage): satisfy the gate when the reply carries a receipt
citing an id in ANY registered store (central store lookup via q --scope all); or
remember flagged-phrase → token acknowledgements per session so one ack silences that
phrase's re-fires; or both.
