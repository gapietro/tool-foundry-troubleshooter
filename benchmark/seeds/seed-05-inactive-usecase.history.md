# Seed 05 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-05-inactive-usecase.md`](./seed-05-inactive-usecase.md) — which does not
link back here, deliberately.

## Task 12 (2026-08-02)

Both scored runs named the specific gate
(`sn_aia_trigger_configuration.active` on `bfb77d6c64884500a80203ee029436ee`)
with the m2m link verified intact, earning full — not partial — fix-target
credit, and both flagged the empty run-as as an UNCONFIRMED advisory.

This seed's 2 scored rows at Task 12 were **not** void: the mandatory m2m PATCH
was performed, so the seed was in its specified state. The void-by-construction
case described in the spec is what would have happened without it.
