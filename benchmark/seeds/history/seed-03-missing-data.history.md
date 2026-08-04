# Seed 03 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec: [`seed-03-missing-data.md`](../seed-03-missing-data.md) —
which does not link back here, deliberately.

## Task 12 (2026-08-02)

Both scored runs diagnosed layer 5 with the `genuinely_empty` verdict
(unfiltered count 0, ACL denial ruled out) and scored 6/6, on seed execution
`c4cd01842b6a4bd417a6ffbeee91bfc3`.
