# Seed 04 — prior-pass history

**Not for scorer packets.** This file records what earlier diagnostic runs did
and what they scored. It is the half of the old spec that the scorer blind rule
(`../README.md`, "The scorer blind rule", issue #100) keeps away from a blind
scorer, whose packet embeds the spec verbatim.

Scorer-facing spec:
[`seed-04-genai-unmapped.md`](./seed-04-genai-unmapped.md) — which does not
link back here, deliberately.

## Task 12 (2026-08-02) — the decoy performed its function

The doubled scored runs SPLIT: run 1 found the dangling `api` and proposed the
exact healthy repoint (`936e514a53b3b110f028ddeeff7b128c`); run 2 named the
empty `connection` as primary cause and scored the canonical 2/0/1/0 decoy row.

See `../DECISION.md` §D3, including the `genai_log check_config` sampling gap
this exposed — first-100-by-name cannot reach an `x_*` capability.
