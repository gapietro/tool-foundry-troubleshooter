# Learning ledger

Active-recall sessions from real work in this repo, logged per `/learn`. Dimensions are the
rubric's: modality fit · boundaries & interfaces · failure modes & partial success · security &
data · concurrency · observability · testing.

Confidence is set from what was demonstrated in the attempt, not from the explanation that
followed. Re-encountering a `shaky` concept and nailing it is the progression worth watching.

---

## observability — shaky
- 2026-08-09: **Admissibility of a null observation.** Asked what made a correctly-executed query returning zero rows untrustworthy; answered with the finding (`run_as: user`) rather than the method. Gap: a negative result is evidence only against a demonstrated capacity to produce a positive one — needs a readiness predicate before the probe, and a positive control (here, the measured ~1s fire time) to calibrate the silence against. Linked to the TDD red-first rule: a test never seen failing hasn't been shown able to detect anything. (tool-foundry-troubleshooter, #151 seed qualification)

## failure modes & partial success — solid
- 2026-08-12: **Tightening a validator can recreate the defect it inherits.** Asked what
  target-binding the evidence-rule citation check would do to seed 05's honest path given no rep
  had ever called `query_table`; answered immediately and correctly — *"it would still fail — no
  query_table means no second source"*, i.e. 2/4 → 0/4. That is #78's own failure mode (a correct
  diagnosis of an absence made structurally unreportable) reproduced BY the fix meant to strengthen
  #78. The reusable move: before tightening a check, ask whether the compliant path it demands is
  REACHABLE in the system as built — a validator may only close a dishonest route once an honest
  one exists, so the change is *blocked* on the upstream gate, not merely paired with it. Corollary
  the answer forced: the two changes must ship as two pre-registrations in sequence, because
  shipping them together cannot attribute the movement (§AN1a single-variable). Second corollary:
  the 2/4 being protected was spurious — passes on a mislabelled citation — so the honest number
  going DOWN is the instrument improving. (tool-foundry-troubleshooter, #204)

## testing — shaky
- 2026-08-09: **When a threshold binds.** Asked why §A3.4's known 8-valid-run floor failed to constrain the v9 pass; answered "I don't know" — honest and gap-locating. Gap: pre-commitment works through *ordering*, not through writing-down; a threshold consulted after the data exists becomes a degree of freedom rather than a criterion, resolvable by someone who can see which reading flatters which arm. Corollary drawn: §Z6 leaving per-arm-vs-across-pass "contested" is an open degree of freedom parked next to a pending measurement. §W5 is the honest amendment pattern (forced by `n` alone, identical for any observed count). (tool-foundry-troubleshooter, next scored pass sizing)
