# Claim extraction — the frozen prompt

> **This file is the extractor.** Everything mechanical around it (schema validation, ordering,
> serialisation) is plumbing; this document is the part that decides what gets emitted, and it is the
> artifact cleared under DECISION.md §AX5.
>
> **Derived from DECISION.md §AX3 and §AX10's count ruling only.** Nothing in it comes from the claim
> inventory fixture, by §AX12.2 — an extractor built from the fixture's own line-drawing rules would
> score its author's consistency instead of measuring enumeration.
>
> **Frozen.** Do not revise it in response to output seen on the corpus. §AX7.2 governs what a
> post-repair figure may be called.
>
> **Amended once, under §AX13, before any report had been extracted** — `polarity` and `asserted_value`
> were added to the output schema. The freeze is against revision in response to *observed output*;
> nothing had been run, so there was no output to respond to. That window is now closed.

---

## Your task

You are given the prose body of one diagnostic report. List every **factual claim about the
ServiceNow instance** that the report makes.

Return **only** the claims, as JSON matching the schema in "Output" below. Do not summarise the report,
do not evaluate the diagnosis, and do not comment on your own process.

## What a claim is

A **claim** is a statement in the report that is **true or false of instance state, independent of
whether the diagnosis is any good**, and whose truth could be settled by reading the instance.

That property is the definition. Apply it as a test; it is not a list of shapes to pattern-match, and
you should not restrict yourself to the categories below — they illustrate the definition, they do not
bound it.

- an assertion that a table, column, record, or field exists or does not exist
- an assertion of a field's value, a record's identity, or a name
- an assertion of a count — of records, of rows returned, of configured items, of calls made
- an assertion that a named tool, agent, or configuration is present, absent, active, or inactive

## What is not a claim

- judgements of severity, confidence, likelihood or risk
- recommendations, proposed fixes, and next steps — including a proposed value for a field, which
  asserts a desired state rather than a present one
- statements about what the report's own author did, read, checked, or concluded
- restatements of the diagnostic method
- any assertion about **the run** rather than about the instance

The last one carries an exception that matters, and it is registered rather than optional:

> **A count is a claim even when it counts run events.** The number of calls made, tasks executed, rows
> returned or records touched is a claim. Everything else about a run — what an individual call
> returned, the state of an execution plan, how long anything took, how large anything was — is not.

Where "the run" appears above it means **any** execution being discussed: the one the report diagnoses
and the diagnostic work itself. Neither is instance state.

## Emit it even when you doubt it can be checked

Whether a claim can be settled against an instance is decided later, by different machinery. It is not
your filter.

Emit a claim you suspect is unverifiable. A claim that is emitted and later found unresolvable has been
handled correctly; a claim you declined to emit is invisible, and invisible is the one outcome that
cannot be detected downstream.

## Granularity

These are conventions about the **shape of your output**, not about what counts as a claim.

1. **Split by what is being described, and by what is being said about it.** If one sentence says the
   same thing about three different subjects, that is three entries. If several readings are offered
   together as evidence for a single assertion, that is one entry.
2. **Say each thing once.** Where the report states the same thing in more than one place, emit a single
   entry and list every place it appears among its occurrences. A repetition in a summary, a table, or a
   closing section is another occurrence of the same claim, never an additional one.
3. **Quote exactly.** Every occurrence carries a substring copied verbatim from the line it cites. Do
   not normalise whitespace, correct spelling, or trim punctuation inside the quoted span.

## Output

Return a single JSON object:

```json
{
  "claims": [
    {
      "proposition": "A self-contained statement of the claim, readable without the report.",
      "kind": "existence | field_value | count | identity | state",
      "polarity": "asserts | denies",
      "asserted_value": "the value the report states, where it states one",
      "subject": { "table": "...", "record": "...", "field": "..." },
      "occurrences": [{ "line": 12, "quote": "verbatim substring of line 12" }]
    }
  ]
}
```

- `proposition` — stand-alone. A reader who has not seen the report must be able to tell what would make
  it true.
- `kind` — the closest of the five. If a claim asserts a field's value, that is `field_value` even when
  it also implies the record exists.
- `polarity` — required, and it is a statement about the proposition you just wrote, not about the
  report's tone. `asserts` where the proposition says the thing holds — it is there, it has that value,
  it is active. `denies` where the proposition says it does not hold — it is not there, there are none
  of them, it is not active. Write the proposition first and then read it back: whichever of the two
  makes the proposition true of an instance is the one to record. **Do not leave it out and do not guess
  it from context**; nothing downstream can recover it, and a claim recorded with the wrong one is worse
  than one recorded with none.
- `asserted_value` — the value the report states for the thing, where it states one, copied as the report
  gives it. Omit it entirely where the claim asserts no particular value. It is a record of what was
  claimed; it is not used to decide anything, so do not normalise, round or interpret it.
- `subject` — include the parts you can identify; omit keys you cannot. Include a record identifier
  whenever the report supplies one.
- `occurrences` — at least one, each with the **1-based** line number within the report body you were
  given, and a quote that appears verbatim on that line.

Emit `{"claims": []}` for a report that asserts nothing about instance state. That is a legitimate
result and not a failure.
