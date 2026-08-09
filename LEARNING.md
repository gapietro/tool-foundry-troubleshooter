# Learning ledger

Active-recall sessions from real work in this repo, logged per `/learn`. Dimensions are the
rubric's: modality fit · boundaries & interfaces · failure modes & partial success · security &
data · concurrency · observability · testing.

Confidence is set from what was demonstrated in the attempt, not from the explanation that
followed. Re-encountering a `shaky` concept and nailing it is the progression worth watching.

---

## observability — shaky
- 2026-08-09: **Admissibility of a null observation.** Asked what made a correctly-executed query returning zero rows untrustworthy; answered with the finding (`run_as: user`) rather than the method. Gap: a negative result is evidence only against a demonstrated capacity to produce a positive one — needs a readiness predicate before the probe, and a positive control (here, the measured ~1s fire time) to calibrate the silence against. Linked to the TDD red-first rule: a test never seen failing hasn't been shown able to detect anything. (tool-foundry-troubleshooter, #151 seed qualification)

## testing — shaky
- 2026-08-09: **When a threshold binds.** Asked why §A3.4's known 8-valid-run floor failed to constrain the v9 pass; answered "I don't know" — honest and gap-locating. Gap: pre-commitment works through *ordering*, not through writing-down; a threshold consulted after the data exists becomes a degree of freedom rather than a criterion, resolvable by someone who can see which reading flatters which arm. Corollary drawn: §Z6 leaving per-arm-vs-across-pass "contested" is an open degree of freedom parked next to a pending measurement. §W5 is the honest amendment pattern (forced by `n` alone, identical for any observed count). (tool-foundry-troubleshooter, next scored pass sizing)
