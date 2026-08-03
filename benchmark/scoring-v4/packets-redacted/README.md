# Redacted scoring packets — issue #100

## What this directory is

Twenty scoring packets, `row-01-native-seed-01-run-1.md` through
`row-20-custom-seed-05-run-2.md`, one per row of the v4 benchmark pass. Each is
a copy of the corresponding original packet in `benchmark/scoring-v4/`,
identical in every respect except that the embedded seed specification (§2 of
each packet) has had its prior-pass outcome narratives removed. The rubric
text, the run's own report, the run's measurements, and everything else about
each packet is untouched.

## Why it exists — issue #100

A scoring packet has to hand a blind scorer the seed's specification so it
knows the expected root-cause layer and fix target — that exposure is
intentional and is what makes an independent verdict possible at all. The gap
found in #100 is that four of the five seed specs (all but seed 01) also
narrate, inside that same specification, what *earlier* diagnostic runs
concluded and — in some cases — literally what grade those runs received:
`benchmark/seeds/seed-03-missing-data.md` said two earlier runs "scored 6/6";
`seed-04-genai-unmapped.md` described how "the doubled scored runs SPLIT" and
one "scored the canonical 2/0/1/0 decoy row"; `seed-05-inactive-usecase.md`
said "Both scored runs" earned specific credit; `seed-02-ambiguous-instruction.md`
cited a result "scored strictly against the expected layer-2 answer (2/6,
fail...)". A scorer reading any of that learns not just the right answer (which
is fine — that's the rubric's job) but the grade a comparable run already
received, which contaminates the very independence a blind re-score exists to
provide.

The originals in `benchmark/scoring-v4/row-*.md` already carried a first
redaction pass at build time (visible as inline "Editorial note" blockquotes)
that stripped the literal score sentences. It did not go far enough: the
`**OBSERVED AT TASK 12 (…) — the prediction held.**` callout headers and the
surrounding "what happened last time" narrative survived in the seed-03,
seed-04, and seed-05 packets, which is still a scorer being told a prior pass
ran, held, and (for seed 04) how two specific prior runs diverged. This
directory closes that gap all the way, verified by grep against the exact
literal patterns named in #100 plus the block-level pattern ("OBSERVED AT TASK
12" callouts) they were embedded in.

## What was removed

Every `**OBSERVED AT TASK 12 …**` callout block (and, for seed 02, the
"History: the v1 construction was refuted at Task 12" section, which the
original packets had already gutted down to an editorial note) — i.e. any
passage stating what a previous diagnostic run did, concluded, or scored.
Where a removal left a gap, it was replaced with a single neutral marker line:

```
> [prior-pass observations removed — see issue #100]
```

so the redaction is visible and auditable rather than silent. Twelve packets
were touched this way — the four rows each for seed 03, seed 04, and seed 05.
The eight seed-01 and seed-02 packets needed no further changes: seed 01's
spec never narrated a prior outcome, and seed 02's packets had already had
their one leaky section (a "History" narrative citing "2/6, fail") fully
excised at build time.

## What was deliberately kept

Everything that tells a scorer **how to grade**, as opposed to what someone
else already scored:

- The full 6-point rubric, the `passes_gate` derivation, and the void-run
  rules (packet §1) — untouched in all 20 packets.
- Seed 04's decoy-scoring rule in full: naming the empty `connection` as root
  cause still earns `root_cause_layer_correct`, but must score `fix_target_correct
  = 0` and, critically, `fix_usable_unedited = 0` — "**The correct row for a
  decoy hit is 2 / 0 / … / 0, `passes_gate` = 0.**" This is the exact
  guidance the R-22 decoy exists to enforce, and it reads intact in
  `row-13` / `row-14` / `row-15` / `row-16`.
- Seed 05's partial-credit case: a diagnosis naming only "the use case/trigger
  is inactive" without the specific gate (`sn_aia_trigger_configuration.active`)
  scores 1 of 2 on `fix_target_correct`, not full — intact in `row-17` through
  `row-20`.
- Every seed's expected root-cause layer, expected fix target, expected
  diagnosis, scoring notes, and blind-rule tokens.
- Each run's own report, its own measurements, and its own identity — none of
  that is seed-spec content and none of it was touched.

## Verification

Every packet in this directory was grepped for the leak patterns named in
#100 — `scored 6/6`, `2/6`, `2/0/1/0`, `OBSERVED AT TASK 12`, `both scored
runs`, `the doubled scored runs` — with zero hits. Each redacted packet was
diffed against its unredacted original and, in every case, the only lines
that differ fall inside packet §2 ("Seed specification"), never in the
rubric, the run report, or the measurements.

## The unredacted originals remain

`benchmark/scoring-v4/row-*.md` are untouched by this directory and remain
in place so the two scoring rounds — against the leaky originals and against
these redacted packets — can be compared. `benchmark/scoring-v4/results/`,
`benchmark/scoring-v4/rescore/`, `benchmark/raw-evidence-v4.md`, and the seed
spec files under `benchmark/seeds/` are all likewise untouched; the seed specs
themselves are addressed separately under #100, this directory only builds
clean copies of the scoring packets that quote them.
