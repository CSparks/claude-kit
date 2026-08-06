(bug) Supersede links are asymmetric in the KIT store: 6 tickets carry `superseded_by`
with no reciprocal `supersedes` on the newer ticket, so index-tickets' summary reads
"9 superseded ... 3 chain(s)" — both numbers now same-scope (post KIT-T125) but they
count different sets. reconcile-supersede only writes reciprocals between two ACTIVE
tickets. Fix direction: reconcile (or the indexer) should treat `superseded_by` on any
ticket as authoritative and either backfill the reciprocal or count chains from the
union. Found by the wave-3 agent 2026-08-04 while closing KIT-T125/T154. --priority medium
