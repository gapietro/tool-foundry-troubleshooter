# Dispatch brief — the claim-veracity extractor (issue #212)

**Read this file first and in full. It is the whole of your instructions.**

You are being asked to author a *blinded* instrument. The reason this brief is long is that three
previous attempts to blind this work failed, each in a way its designer had not imagined, and every
constraint below is a repair for a **measured** failure rather than a precaution.

> **This brief contains no answers.** It is safe to read, safe to quote, and safe to carry into a
> fresh session. It deliberately does not tell you which reports are suspect — see §5.

---

## 1. What you are building

Two artifacts, both authored **before** either is run against the corpus:

**(a) A claim extractor.** Input: the prose body of one diagnostic report. Output: a list of
discrete, machine-checkable factual claims the report makes *about the ServiceNow instance* — the
kind of claim that is **either true or false of the instance, independent of whether the diagnosis
is any good.** That property is the definition; treat it as the test, not any list of examples.
Recommendations, judgements, hedges and predictions are not claims.

Extract every claim meeting that definition, whatever it is about — schema, configuration, records,
state, relationships, execution history. **No enumeration of claim shapes is given, deliberately**
(§5), and you should not infer one from the fact that some shapes are easier to adjudicate than
others: what is extracted and what is adjudicable are different questions, settled at different
stages, and conflating them biases the instrument at the stage where bias is invisible.

**Extraction may use a model.** The registration makes extraction a language problem and adjudication
a mechanical one — see §7 for what "deterministic" does and does not require of you. Run the
extraction over the corpus **once** and freeze its output as an artifact; do not re-run it after
inspecting the results.

**Adjudicability is not your filter.** Emit the claim even when you doubt the adjudicator can settle
it. A claim the adjudicator returns `unresolvable` on is a correctly handled claim; a claim you
declined to emit is invisible, and invisible is the one outcome the recall figure cannot detect.

**(b) A deterministic adjudicator.** Input: one extracted claim. Output: exactly one of three
verdicts, defined in §2. It performs a **metadata membership test** against a live instance. It
contains **no model call and no rubric.** If a claim cannot be reduced to a deterministic test, the
adjudicator returns `unresolvable` — it never escalates to a judge.

The split is load-bearing: extraction is a language problem, adjudication is not. Do not blur them.

---

## 2. The three-valued verdict — two-valued is forbidden

| Verdict | Meaning |
|---|---|
| `refuted` | The instance contradicts the claim, **and a positive control passed** |
| `supported` | The instance corroborates the claim |
| `unresolvable` | Cannot be adjudicated — mutable state, ambiguous probe result, or a control that did not pass |

**Why three and not two, in this project's own words:**

> *An instrument's inability to observe must never be recorded as an observation.*

This project has already shipped, and measured, a defect of exactly this shape: a probe that could
not see what it was looking for reported a confident absence, the absence read as a positive
finding, and a wrong conclusion followed with no diagnostic signal anywhere. An oracle that collapses
*"I cannot see"* into *"the claim is false"* reproduces the exact defect it exists to detect. A
`refuted` you cannot stand behind is worse than an `unresolvable`.

### 2.1 Two probe rules that are not negotiable

1. **Field existence is decided by membership in the `sys_dictionary` field list — never by whether
   a query filtered on that field succeeds.** On this platform a *nonexistent field name* comes back
   as `Access denied`, byte-identical to a genuinely missing read ACL. The query path can lie; the
   metadata path has no failing step to misread.
2. **Any verdict resting on a null or absent observation is control-paired.** If the evidence for
   your verdict is *"the probe returned nothing"* — whichever way that cuts — then in the **same call
   and the same auth context** you must also probe something **known to be present** on that same
   target. Control fails → `unresolvable`, never a verdict. A null result is worth exactly its
   probe's sensitivity, so the control is recorded next to the null, always.

   **Note the direction, because the registration stated it the other way round and that is now
   corrected** (§AW11c). The dangerous case is a report claiming a thing is **present** and the
   metadata read coming back empty — an empty read is indistinguishable from a broken read, and this
   is where an uncontrolled `refuted` is manufactured. The opposite case — a report claiming a thing
   is *absent*, refuted by observing it present — rests on a positive observation that is
   self-evidencing and needs no control. The rule above is stated over the *evidence's* shape, not
   the *claim's*, so it covers both without you having to work out which is which.

### 2.2 The reference state is the run, not today — and you cannot see the run

The adjudicator reads a **live** instance. The claims were written about that instance **as it stood
when the reports were produced**, some time ago, and the instance has been used since.

**Therefore: if a claim's truth can have changed between then and now, it is `unresolvable`, and it
is `unresolvable` even when today's read looks decisive.** A claim that was false then can read true
today, and the burn cannot be repeated to correct it. Structural facts — what a table's schema
declares — are stable enough to adjudicate. Anything counting, listing, or asserting the existence of
individual records is not, and a confident verdict there is a fabricated one.

This is the §2 rule applied to time rather than to permissions: *the instrument's inability to
observe the past must not be recorded as an observation about it.* You are not being asked to
work around this. Routing those claims to `unresolvable` **is** the correct handling, and the
registration already predicts a non-trivial number of them.

---

## 3. What you may read — an allowlist, and it is closed

**Read only these paths. Everything else in the repository is out of bounds, including files that
look harmless, files you are merely curious about, and files referenced by the ones below.**

| Path | Why it is permitted |
|---|---|
| `benchmark/EXTRACTOR-BRIEF.md` | This file |
| `benchmark/scorecard-template.md` | The report *shape* — the only description of report structure you get |
| `benchmark/v14-reports/*.md` | The 20 raw report bodies. **This is your corpus and your only sample of real report prose** |
| `./src/**` — **repository root only** | Codebase conventions, ES5/Rhino constraints. Cleared at dispatch time with a residual noted below — read it for *how code is written here*, never for facts about fixtures |
| `./test/_loadScriptInclude.js`, `./test/_glideStub.js`, `./test/_stripComments.js`, `./test/stripComments.test.js`, `./test/utf16ClipContract.test.js`, `./test/PaRetentionSweep.test.js` | Test style, the `vm` loader, and the Glide stub — **six named files, verified clean. NOT `./test/**`; see below** |
| `./package.json`, `./eslint.config.mjs` | Toolchain |

> **`./test/**` was withdrawn as an entry (§AW11e/§AW11f).** One file in that tree carried, as
> ordinary fixture prose, strings that happen to state ground truth an adjudication in this pass
> depends on. Nothing there names a report, so it was not a complete key — but it would have supplied
> an answer the live probe exists to produce, and an extractor authored after meeting it is not cold
> in the sense this pass requires. The six files named above are permitted because each was checked
> individually; the rest of the tree is not.
>
> **No detail beyond that is given here, and the omission is deliberate (§AW11f).** An earlier version
> of this paragraph quoted the offending strings verbatim and labelled what each one adjudicated. That
> reproduced the leak into the one file every author is required to read — a worse version of the
> defect it documented, since the original strings were unlabelled fixture data and the description
> supplied their significance. The full detail lives in `DECISION.md` §AW11e/§AW11f, which is on your
> exclusion list, and that split is the point: **the record belongs where the author cannot read it.**
>
> **Residual on `./src/**`, stated rather than waved through.** It is clear of this pass's
> adjudications, but not free of fixture context: some comments reference fixture identifiers and how
> earlier passes behaved. None of it identifies a false claim in this corpus. Specific files and
> identifiers are deliberately not named, for the reason in the paragraph above. It is disclosed so
> that if anything you meet there *does* surface a specific fact about a specific numbered report,
> §4's tripwire applies and you stop — and so §9's attestation has something concrete to answer
> against.

> **The two `src`/`test` rows are anchored to the repository root and the anchor is load-bearing.**
> There is a second, unrelated `src/` tree nested under `benchmark/`, and **it is an answer key** —
> it declares the fixtures' true structure. An unanchored glob, or a `grep -r` from the repo root,
> reaches it. Confine every search to `./src` and `./test` explicitly; do not let a recursive tool
> decide the boundary for you.

**This is an allowlist, not a deny-list, and the inversion is deliberate.** Previous versions of this
procedure enumerated forbidden files. Enumeration covers the cases its author thought of; three
separate leak sources were later found that the list did not name, the last two on the day this brief
was written. A closed allowlist has no default-admit.

**If you believe you need a path not listed above, stop and ask the operator.** Do not decide for
yourself that a file is safe. You are not in a position to know — that is the entire point of §5.

**Specifically and without exception, do not open** `benchmark/seed-app/**` (**including its nested
`src/`**), `benchmark/seeds/**`, `benchmark/DECISION.md`, `BACKLOG.md`, `GRADE.md`, `CHANGELOG.md`,
`DESIGN.md`, `benchmark/README.md`, `benchmark/v14-rows.json`, `benchmark/scorecard-v14.md`,
`benchmark/v14-ambiguity-flags.json`, `benchmark/scoring-v14/**`, or any
`benchmark/raw-evidence-*.md`, **or any file under `./test/` other than the six named above**. This
list is redundant with the allowlist and is given only so that a slip is obvious rather than subtle —
**the allowlist governs; if the two ever disagree, the allowlist wins and you ask.** (No individual
`./test/` file is singled out here; naming one would point at it, which is §AW11f's lesson.)

---

## 4. Abort tripwire — check this before your first action, and again if anything surfaces

**If, at any point, you find you already know a specific fact about a specific numbered report in
this corpus — which one is wrong, what it got wrong, a row count, a field name it named — STOP.**

Do not write a line. Do not attempt to "set it aside" or compensate. Report to the operator:
what you know, and where it appeared. The dispatch is abandoned and re-run from a clean session.

**Two authors have already hit this tripwire and both aborted correctly. Aborting is a success.**
Producing a contaminated extractor is the only failure mode that cannot be repaired afterwards,
because the material it would be validated against can be spent exactly once.

---

## 5. Why you are not told which reports are suspect

A small subset of the 20 reports is known to contain a false claim. **You are not told which, and
you must not try to work it out.** Process all 20 uniformly.

If you knew the subset, an extractor tuned to fire on those reports would score perfect recall while
measuring nothing — the instrument would be validated against its own answer key. The recall figure
is the only evidence that the extractor works at all, and per the registration **a veracity figure
may not be reported without its recall figure**. Contaminate the recall and the entire pass produces
no reportable number.

**The corollary that catches people:** do not iterate. Do not build the extractor, look at which
claims it emitted for which reports, form a theory about which ones matter, and refine. Write it
against report *shape*, freeze it, hand it back. It is not tuned, by design, and an untuned honest
recall figure is the deliverable — including if that figure is bad.

---

## 6. Contamination applies to authoring, not to execution

**You do not run the sweep.** You author, freeze, and hand back. The operator fires the single
sweep afterwards.

This is not an arbitrary split. Contamination corrupts *judgement* — decisions about what the
extractor should match. Once the extractor and adjudicator are frozen, executing them is
deterministic, so who runs them cannot influence the result. A contaminated session may safely
execute a blind instrument; it may not author one.

---

## 7. Acceptance criteria

- **Runs on this codebase's toolchain.** Match existing `src/` conventions; ES5/Rhino-safe if any
  part is destined for the platform (no `Set`, no `Map`, no arrow functions in platform-bound code).
  `npx eslint` clean.
- **Unit tests, written first.** Test the extractor against report prose *you author yourself* as
  fixtures — not against corpus reports whose claims you have adjudicated. The extractor's behaviour
  on the corpus must be unobserved until the burn.
- **The adjudicator is separately testable with the instance stubbed.** Its three-way branch,
  including the control-failure path, must have a test each. The control-failure → `unresolvable`
  path is the one that matters most and the one easiest to leave uncovered.
- **No network calls at import time.** The instance client is injected, not constructed inline.
- **Deterministic output ordering**, so two runs over the same input diff cleanly. **This is a
  requirement on serialisation, not on the extractor's inference.** A model-backed extractor is
  expected (§1) and is not required to be reproducible; what must be deterministic is the
  *adjudicator*, and the ordering and formatting of whatever the extractor emits — sort the claim
  list by a stable key, do not let map iteration or arrival order into the output. The extraction
  pass over the corpus is run **once** and its output frozen as a committed artifact, which is what
  makes the downstream figures reproducible without the model being so.

---

## 8. What you must return

A short written handback containing:

1. **What you built** — files, entry points, how the operator invokes the sweep.
2. **Extraction heuristics, stated plainly** — what counts as a claim and what you deliberately
   excluded. This is the document a reviewer checks for shape.
3. **Known limitations** — claim shapes you expect to miss. Be generous here; an honest predicted
   miss costs nothing, and a surprise miss after the burn costs the figure.
4. **The blinding attestation** (§9). Without it there is no recall figure, and therefore no
   veracity figure, and therefore no pass.

**Reviewers will check shape, lint and tests only.** Nobody will steer your claim-detection
heuristics, because everyone else on this project is contaminated and steering from a contaminated
position is tuning against the answer key at one remove — which voids the figure just as surely as
reading the key would.

---

## 9. The blinding attestation — mandatory, and the second question is the one that counts

Return both answers in writing, even when the answer is "none".

1. **Every file you opened**, as a list. Not a summary — the list.
2. **"Did any system-injected context — a memory file, a project reminder, an environment note, a
   pre-loaded instruction, anything you did not choose to open — surface facts about specific
   numbered reports in this corpus?"**

Question 2 is mandatory because question 1 cannot discharge the burden. **An author cannot list what
it never chose to read.** Both previous contaminations arrived through injected context while the
read-log stayed clean, and question 2 is the only check that caught either. A reviewer cannot answer
it from outside your session — which is why it is asked of you, and why the burden of demonstrating
blindness sits with you rather than with a reviewer to demonstrate contamination.

The calibration material cannot be re-spent to settle an argument about whether you were blind. An
unresolved doubt therefore resolves against the instrument, not in its favour.

---

## 10. For the operator dispatching this

**Do not dispatch this as a subagent from a session that has run `/next`, read `BACKLOG.md`, or
opened any file in §3's exclusion paragraph.** Blinding is a property of the *dispatching session*,
not of the author: project context is injected into every agent spawned from a project-scoped
session, and a session that has already loaded contaminated material carries it into every agent it
spawns — measured, not assumed, including one case where the author was placed outside the
repository entirely and *still* quoted material that had already been redacted from disk.

Start a **new session**, in a scope that never carried the answer, and give it this file's path.

Neither a neutral working directory nor a redacted memory file is sufficient on its own.
