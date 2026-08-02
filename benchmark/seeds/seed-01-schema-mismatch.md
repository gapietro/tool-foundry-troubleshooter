# Seed 01 — tool schema mismatch

| | |
|---|---|
| **Expected root-cause layer** | `tool_schema` (layer 3) |
| **Expected fix target** | the tool's **word-typed contract** — map the word to its integer inside the script, or change the tool description + agent instructions to pass 1–5. **Not** "the tool input schema": Fluent script-tool inputs have no `type` property, so that fix is not expressible — see "Expected diagnosis" |
| **Fluent source** | `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts` |
| **Agent name** | Seed 01 Ticket Prioritizer |
| **Also stresses** | artifact paging — this seed is built to produce a LARGE trace |

## The defect

> **PREDICTED, NOT OBSERVED.** No seed has been installed or executed. What
> follows is derived from the Fluent source and from the records emitted into
> `seed-app/dist/`, which is build-time evidence, not runtime evidence.
> **Confirm at Task 12** before scoring, and correct this section if the run
> disagrees. Four predictions in this seed set were already wrong once and were
> only caught by reading `dist/`.

The instructions require the agent to express priority as a **word**
("critical", "high", …), and `set_ticket_priority` passes that word straight
through to `x_snc_tsbench_ticket.priority`, which is an **integer** choice
column, 1–5. `'critical'` is not an integer, so the requested priority is **not
what ends up in the column** (a non-numeric string on an integer field typically
settles at `0` — see "Expected diagnosis" for why no literal value is scored) —
while `gr.update()` still reports success, so the agent tells the user the ticket
was prioritised.

**Where the declaration actually lives — and where it does not.** Script-tool
inputs have no `type` property in Fluent. The emitted `sn_aia_tool.input_schema`
is `[{name, description, mandatory}]`, byte-identical in shape to seeds 3 and 4's
*correct* tools (verified in `dist/`). So there is nothing in the tool's input
schema for a layer-3 sweep to find wrong, and "constrain the input schema to
1–5" is not something the schema can express. The word-typed contract is
declared in two places that *are* readable:

1. the tool **description** — "the priority as a word — critical, high,
   moderate, low or planning";
2. the tool **script**, which does `gr.setValue('priority', inputs.priority)`
   with no mapping or validation.

Those are what a diagnosis can cite and what a builder could actually change.

**Column type corrected 2026-08-01.** ~~The column is a `ChoiceColumn`.~~ It was
originally declared with `ChoiceColumn`, which emits `internal_type=choice`,
`max_length=40` — a *string-backed* column that stores `'critical'` quite
happily. The mechanism above was false as shipped. The column is now
`IntegerColumn` + choices, emitting `internal_type=integer` (the shape
`task.priority` itself uses on gpinst01), which makes the mismatch real. See
`../seed-app/src/fluent/seed-01-schema-mismatch.now.ts`.

## Why it is built this way

The instructions are deliberately verbose and multi-step. Seed 1 is the
benchmark's artifact-paging stressor: the native harness's weakest documented
area is large evidence, and a benchmark of five small traces would never
exercise it.

**Deviation from LLD §7, recorded not hidden.** §7 specifies writing to
`incident.priority`. This seed writes to `x_snc_tsbench_ticket`, a table the
fixture app owns. R-19 measured that a scoped app cannot always reach a global
table — `syslog` stays `DENIED` even with a self-declared `sys_scope_privilege`.
A seed that failed at the scope boundary would be correctly diagnosed as a
privilege problem, and would score as a miss on `tool_schema`. The defect under
test is unchanged; the obstacle in front of it is removed.

## Setup

1. Install the fixture app (Task 12): `cd benchmark/seed-app && now-sdk install --alias gpinst01`
2. Insert one bench ticket with `short_description` set and `priority` empty.
   Record its sys_id. (This is possible only because
   `seed-app/src/fluent/seed-tables-acl.now.ts` grants record ACLs and the table
   sets `allowWebServiceAccess` — Build Rule #42. Without both, an admin insert
   returns *Access denied: User Not Authorized* and this step cannot be done at
   all.)

## Trigger

Open a fresh conversation with **Seed 01 Ticket Prioritizer** and give it the
ticket sys_id plus an urgent-sounding description — e.g. *"the payment gateway
is down for all customers, no workaround"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `tool_schema`: the tool accepts and forwards a priority **word**
while the target column is an integer choice 1–5, so the value is never stored.

Fix target: **the tool's word-typed contract** — map the word to its integer
value inside the script before `setValue`, or change the tool description and
the agent instructions to pass 1–5. Do **not** expect "constrain the input
schema to 1–5"; as "The defect" explains, the Fluent input schema has no type
field to constrain, so that fix is not expressible and must not be the standard
a run is scored against.

Evidence a correct diagnosis should cite: the trace showing `priority_stored`
**disagreeing with `priority_requested`** in the tool result, plus the
`x_snc_tsbench_ticket.priority` dictionary entry showing `internal_type=integer`.

**`priority_stored` measured at Task 12 (2026-08-02): `null`.** The seed
execution `b07dc9082baa4314f243fed2ce91bf4b` called `set_ticket_priority` with
`priority: "critical"` and the tool returned `{ok: true, priority_requested:
"critical", priority_stored: null}` while the record's `priority` column read
back empty over REST. GlideRecord silently discarded the non-numeric string —
the seed's mechanism is confirmed as built. (Pre-measurement guidance, kept for
the record: any value that is not the requested word scores as correct
evidence; only `priority_stored == "critical"` would have refuted the seed.)
One correction surfaced by the de-risk pass: the **choice list did not
install** — `schema_lookup` reports `has_choices: false` on the installed
column — so the defect as measured is "word written to a plain Integer column",
not "integer choice 1–5". The integer typing is the operative half and the
seed's diagnosis target is unchanged.

### Scoring note — layers 3 and 4 (M18)

This defect straddles two layers by construction: it is a disagreement *between*
the tool contract (layer 3) and the column type (layer 4), and neither side is
wrong on its own. `root_cause_layer_correct` is binary, so the resolution is
stated here rather than left to the scorer:

- **`tool_schema` (layer 3) is the expected answer** and scores full marks.
- **A run answering "layer 4 — the column is Integer-typed and the tool sends a
  word" also scores full marks.** It describes the same finding from the other
  side and identifies the same fix. (Wording updated 2026-08-02: the measured
  installed state is a **plain Integer column with no choice list** —
  `has_choices: false`, see "The defect" — so do not require the word "choice"
  in the answer, and do not penalise a run for correctly reporting that no
  choice list exists. "Integer choice 1–5" answers score the same as "Integer
  column" answers; the load-bearing half is the integer typing.)
- A run naming only one side *without* the disagreement — e.g. "the column is
  Integer-typed" with no mention of what is being written to it — scores 0. The
  finding is the mismatch, not either half.

## Safety

Touches only `x_snc_tsbench_ticket`, owned by the fixture app. Nothing shared.
