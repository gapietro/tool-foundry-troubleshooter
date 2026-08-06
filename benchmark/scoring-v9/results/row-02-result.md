# Row 02 — scoring reasoning

**Packet:** `benchmark/scoring-v9/row-02-native-seed-01-run-2.md`
**Seed:** 01 (tool schema mismatch) · **Arm:** native (Agent Doctor) · **Run:** 2
**Scored blind** — only the packet was read. No other file, no shell, no web.

---

## Step 0 — void check (§A3)

§A3 lists exactly two known void conditions, both seed-specific: seed 5
(activation-gate setup) and seed 4 (capability sys_id mismatch). This is seed 01,
so neither applies. Nothing in the packet suggests the seed was out of its
specified state: the report shows the agent calling `set_ticket_priority` with
`priority: "critical"` and the tool returning `priority_stored: null` — i.e. the
seeded defect was live and was what the run measured. Terminal state of the
diagnostic run itself is `completed` with empty `state_reason`.

Two run-level oddities are noted in §5 and considered:

- the `x_snc_troubleshoot_run` anchor record stuck at `status: running`;
- the report's unverified prose claim that `syslog` is caller-restricted.

Neither is a void condition. §A3 defines voidness as *"the seed was not in the
state its spec requires"* — an anchor-record bookkeeping artefact in the
diagnosing harness and an unverified sentence in the report do not change what
was tested. **Not void.**

---

## `root_cause_layer_correct` — **2**

Expected layer: `tool_schema` (layer 3). The seed's M18 scoring note governs:
layer 3 scores full marks, an equivalent layer-4 framing ("column is
Integer-typed and the tool sends a word") *also* scores full marks, and naming
only one side without the disagreement scores 0.

The run's RC-1 is labelled **"Layer 3 (Tool definition) + 4 (Data schema)"** and
states the disagreement explicitly:

> "The tool calls `gr.setValue('priority', inputs.priority)` where
> `inputs.priority` is a word such as `"critical"`. The column is declared
> **type: Integer**."

That is the mismatch, both halves, named as one finding. The FAILURE SUMMARY
says the same thing independently ("type mismatch … the tool script passes a
plain string word ('critical') to `gr.setValue()`").

The seed's 2026-08-02 wording update also says not to require the word "choice"
and not to penalise a run that reports no choice list. This run says only
"Integer" and never claims a choice list — fully consistent with the measured
installed state (`type: Integer`, `has_choices: false`).

RC-1 is presented first and is the run's primary cause. RC-2 (non-mandatory
inputs) and RC-3 (recovered ReAct parser TypeError) are secondary and are
explicitly framed as such — RC-3 is stated to be "a latent fragility, not the
cause of the silent write failure". The rubric contains no dilution penalty for
additional, correctly-subordinated findings, and the primary cause is right.

**Award 2.**

## `fix_target_correct` — **2**

Expected fix target: *the tool's word-typed contract* — map the word to its
integer inside the script, **or** change the tool description + agent
instructions to pass 1–5. The spec explicitly warns that "constrain the input
schema to 1–5" is **not** the expected answer and must not be the standard.

Fix 1 is literally the first branch of the expected target: *"Map priority words
to integers in the tool script"*, targeting `sn_aia_tool … field script`, with
the mapping `{critical:1, high:2, moderate:3, low:4, planning:5}` inserted before
the `setValue` call, plus an explicit error return for an unmapped word. This is
the specified fix, not an approximation of it.

Consideration of the two extra fixes:

- **Fix 2** ("mark both inputs mandatory") touches the input schema, which is
  adjacent to the disclaimed "constrain the input schema" answer. But it is not
  that answer: it changes `mandatory`, a property the emitted
  `[{name, description, mandatory}]` schema genuinely has, and the run does not
  offer it as the fix for the type mismatch — it is scoped to RC-2. It is
  therefore an addition, not a substitution of a non-expressible fix for the
  real one.
- **Fix 3** (description wording about interpreting `priority_stored: null`) is
  labelled defensive and does not displace Fix 1 either.

No partial band is needed: the specific target is named, not merely the area, so
the "justify a 1" clause in §A does not engage.

**Award 2.**

## `evidence_cites_trace_and_config` — **1**

The rule requires the root cause to cite BOTH the execution trace AND at least
one config/schema source. RC-1's Evidence row cites both, in the same cell:

- **Trace:** execution task `b2dbf5912ba6cf54f243fed2ce91bf2a` output
  `{"ok":true,"priority_requested":"critical","priority_stored":null}`, plus the
  message-stream row `32dbf5912ba6cf54f243fed2ce91bfc1` corroborating the null.
- **Config/schema:** `schema_lookup` on `x_snc_tsbench_ticket` reporting
  `priority` type = Integer, and the `sn_aia_tool` script body read from the
  `agent_config` artifact (page 3) showing the raw `setValue`.

This matches the seed's own "evidence a correct diagnosis should cite" almost
item for item: `priority_stored` disagreeing with `priority_requested` in the
tool result, plus the column's integer typing. The audit trail independently
records `schema_lookup`, `agent_trace`, `agent_config` and `read_artifact` calls,
so the citations are not fabricated narration.

**Award 1.**

## `fix_usable_unedited` — **1**

Gate constraint first: this column may not be 1 while `fix_target_correct` = 0.
`fix_target_correct` = 2 here, so the constraint does not bind, and the R-22
decoy reasoning (well-formed fix at the wrong target = no-op) does not apply —
this fix is at the right target and does repair the defect the seed carries.

Applicability as written: Fix 1 gives the current line verbatim, the replacement
code verbatim, the insertion point ("at the top of the IIFE before the write"),
and a complete word→integer map covering exactly the five words the tool
description advertises. The snippet is ES5, guards the unmapped case, and
preserves the IIFE's JSON-string return convention. A builder could paste it
without inventing anything.

**One point I am flagging rather than resolving silently.** The fix names its
target as a runtime record (`sn_aia_tool` sys_id `8953…`, field `script`) rather
than the Fluent source file that owns that script. Under this project's
SDK-owns-creation convention, a builder would have to translate the target from
the record to the Fluent definition. The rubric does not address this: its test
is whether the *proposed fix* could be applied "as written, with no manual
editing first", and the proposed content — the code — needs no editing; only the
address is expressed in runtime rather than source terms, and the address is
unambiguous (one tool, one script field). I resolved this **in the run's favour
(1)** because (a) the rubric's own worked example of an unusable fix is a
*substantively wrong-target* fix, not a wrongly-addressed correct one, and (b)
penalising it would import a source-vs-runtime requirement the rubric never
states. I do not regard this as a genuine rubric gap for this row — it is a
judgement call that the rubric's wording resolves — so `ambiguous` is recorded
as **no**, with the reasoning above on the record.

Fix 2 is not required to be correct for this column (the column asks whether
"the Fix Report's proposed fix" is usable and on-target; Fix 1 is that fix), and
in any case `mandatory` is a real property of the emitted schema, so Fix 2 is
applicable too, merely secondary.

**Award 1.**

---

## Total and gate

```
root_cause_layer_correct  2
fix_target_correct        2
evidence_cites_trace...   1
fix_usable_unedited       1
                        ----
total                     6 / 6
```

§A2 expression, applied exactly:

```
passes_gate = 1 iff root_cause_layer_correct == 2 AND fix_usable_unedited == 1
            = 1 iff 2 == 2 AND 1 == 1
            = 1
```

**`passes_gate` = yes.** Void = no. Ambiguous = no (see the flagged judgement
call under `fix_usable_unedited`).

## What was deliberately not counted

- **Presentation quality.** The report is well-structured; that earned nothing.
  It scores 6 because RC-1 names the mismatch, Fix 1 is the spec's own fix, and
  both trace and schema are cited — each verifiable against the packet.
- **Sweep breadth.** 7/7 layers swept and 17 tool calls are recorded in the
  audit trail, but no rubric column pays for breadth.
- **RC-3's unresolved TypeError** and the unverified `syslog` claim (§5). Both
  are honestly hedged in the report ("UNCONFIRMED", "platform logs would be
  needed"), neither is offered as the root cause, and no rubric column penalises
  an explicitly-flagged open item.
