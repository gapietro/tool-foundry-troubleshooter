# Seed 02 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-02-ambiguous-instruction.md`](../seed-02-ambiguous-instruction.md) —
which does not link back here, deliberately.

## Task 12 (2026-08-02) — the v1 construction

Agent Doctor diagnosed the zero-tool binding (layer 3) in both scored runs,
which were scored strictly against the expected layer-2 answer (2/6, fail, not
void — the seed was in its specified state). See `../../DECISION.md` §D2. **No
valid Task 12 run exercised layer-2 diagnosis**, which is why v2 exists.
