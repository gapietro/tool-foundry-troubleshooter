# Task 11 — Seeded-Failure Benchmark Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the measuring instrument for the Phase 1a harness decision — a seeded-failure catalog (five broken agents as Fluent in a separate scoped fixture app) plus the scoring protocol and scorecard template that Task 12 executes against Agent Doctor.

**Architecture:** Five deliberately-broken agents live in a **second SDK project** at `benchmark/seed-app/` (scope `x_snc_tsbench`), not in the product app — Fluent for reproducibility across the Phase 1b re-run, a separate scope so no customer installs five broken agents. Alongside it, four markdown deliverables: the run protocol, the seed-location decision record, five seed specs, and a scorecard template whose columns are dictated by DESIGN.md rulings rather than by convenience.

**Tech Stack:** ServiceNow SDK 4.9.2 (Fluent DSL, TypeScript), markdown. No Jest — there is no logic here to unit-test (see Global Constraints).

**Source spec:** `docs/superpowers/specs/2026-07-31-task-11-benchmark-suite-design.md`
**Issue:** #31

---

## Global Constraints

- **Branch `feature/task-11-benchmark-suite` already exists and is checked out.** Never commit to `main`. Every change needs a GitHub issue (#31).
- **Scope of this task is scaffold + build. NO `now-sdk install`, no seed executions triggered, no failing execution sys_ids captured.** Those are Task 12.
- **`now-sdk init` requires instance connectivity but creates NO instance-side record.** Measured 2026-07-31: it logs into gpinst01 as admin and prints "Application created successfully", but `sys_scope` and `sys_app` queries for `scope=x_snc_tsbench` return zero rows while the same filter returns 9 real rows for other scopes — a genuine absence, not R-6's silent blank. The `scopeId` written into `now.config.json` materializes on the instance only at first `now-sdk install`.
- **Fluent build rules that bite in this task** (`.claude/context/sdk-reference.md`):
  - `#43` — **no backtick, no `\n`, no `${...}` inside any backtick template**, including inside `//` comments in one. A markdown code span in an instructions template closes it, and the diagnostics (`TS2796`, `TS304`, `TS20`) point at unrelated lines.
  - `#21` — `securityAcl` is MANDATORY on `AiAgent` and `AiAgenticWorkflow` (`TS210` without it). Use `type: 'Any authenticated user'`.
  - `#32` — inline `tools[]` entries on an `AiAgent` carry **NO `$id`** (`ScriptToolDetails` rejects it at typecheck).
  - `#34` — every tool needs a **non-empty `description`**, or a platform Data Policy silently skips the tool record at install while its m2m row installs anyway.
  - `#31` — `triggerConfig` belongs on `AiAgenticWorkflow`, never a bare `AiAgent`; pair it with `executionMode: 'autopilot'` and `state: 'published'`.
  - `#19` / R-5 — script tool `script` is a self-invoking IIFE with a **required trailing `(inputs)`**; `inputs` is an **ARRAY** of `{name, description, mandatory}`. A JSON-Schema object causes a silent never-terminating stall.
  - `#9` — `Table` export name must match the table name exactly.
  - `#41` / `#42` — a `Table()` installs with no ACLs and `ws_access=false`; `autoNumber` does not populate `number`. **Not applied in this task** — the fixture tables are seed props read by a broken agent, not data surfaces, and both rules concern install-time behaviour this task does not reach. Recorded so a later reader sees it was decided, not missed.
- **Every commit message ends with:** `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **No Jest tests in this task.** Deliverables are markdown plus Fluent definitions. This repo's Jest suite covers Script Include logic under `test/` (R-14); there is no new logic here. Verification is `now-sdk build` in the fixture app, plus regression checks that the root build and existing suite are undisturbed.

---

## File Structure

| Path | Responsibility |
|---|---|
| `benchmark/seed-app/now.config.json` | Fixture app identity — scope `x_snc_tsbench` |
| `benchmark/seed-app/README.md` | The never-install-alongside-the-product rule, and why the second scope exists |
| `benchmark/seed-app/src/fluent/seed-01-schema-mismatch.now.ts` | Seed 1 — agent + script tool with a free-string `priority`, plus the target table whose column is an integer choice |
| `benchmark/seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts` | Seed 2 — agent told to "assign to the right group" with no lookup guidance and no group tool |
| `benchmark/seed-app/src/fluent/seed-03-missing-data.now.ts` | Seed 3 — agent + empty `x_snc_tsbench_routing` lookup table |
| `benchmark/seed-app/src/fluent/seed-04-genai-unmapped.now.ts` | Seed 4 — own capability definition with `connection` empty |
| `benchmark/seed-app/src/fluent/seed-05-inactive-usecase.now.ts` | Seed 5 — workflow whose trigger carries one activation gate false |
| `benchmark/README.md` | The run protocol (replaces the 17-line placeholder) |
| `benchmark/DECISION-seed-location.md` | The R-13 resolution and its evidence |
| `benchmark/scorecard-template.md` | One row per scored run; column set fixed by rulings |
| `benchmark/seeds/seed-0{1..5}-*.md` | Per-seed spec: defect, expected layer, expected fix target, construction, trigger steps, expected diagnosis, safety notes |
| `docs/IMPLEMENTATION_PLAN.md` | Task 11's OPEN block replaced by the resolution |
| `docs/LOW_LEVEL_DESIGN.md` | §8 item 8 closed (body **and** label); §7 seed-3 table name corrected |
| `DESIGN.md` | New ruling R-21 |
| `package.json`, `README.md`, `CHANGELOG.md` | Version bump to `2026.07.3112` |

---

## Task 1: Fixture app scaffold

**Files:**
- Create: `benchmark/seed-app/` (via `now-sdk init`)
- Create: `benchmark/seed-app/README.md`
- Modify: none

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable SDK project at `benchmark/seed-app/` with scope `x_snc_tsbench`, into which Tasks 2 and 3 add `src/fluent/seed-*.now.ts` files. Its `npm run build` is `now-sdk build`.

- [ ] **Step 1: Scaffold the project**

`now-sdk init` refuses to run inside an existing SDK project's tree with the full template list, so create the directory first and run it from there.

```bash
mkdir -p benchmark/seed-app
cd benchmark/seed-app
now-sdk init \
  --appName "TS Bench Seeds" \
  --packageName x-snc-tsbench \
  --scopeName x_snc_tsbench \
  --template typescript.basic
```

Expected output ends with `Application created successfully.` It will print `Attempting to log into instance https://gpinst01.service-now.com as admin` — that is expected and creates no instance record (Global Constraints).

- [ ] **Step 2: Verify the scope and that nothing landed on the instance**

```bash
cat benchmark/seed-app/now.config.json
```

Expected: `"scope": "x_snc_tsbench"` and a `scopeId` GUID.

Then confirm the instance is untouched, via the foundry MCP tools (never `curl` — CLAUDE.md):
`servicenow_query` on `sys_scope`, query `scope=x_snc_tsbench`, fields `["sys_id","name","scope","sys_class_name"]`.
Expected: **zero rows.** If rows come back, stop and report — the scaffold created an app record and the "no install" constraint is already breached.

- [ ] **Step 3: Install dependencies and prove the empty project builds**

```bash
cd benchmark/seed-app && npm install && now-sdk build
```

Expected: build succeeds against the stock `src/fluent/example.now.ts`. If `now-sdk build` reports missing `@types/servicenow/fluent`, run `now-sdk dependencies` first (it needs instance auth; it reads types, it does not write records).

This step exists to separate "the scaffold is broken" from "my seed is broken" before any seed is written.

- [ ] **Step 4: Delete the stock example**

```bash
rm benchmark/seed-app/src/fluent/example.now.ts
```

- [ ] **Step 5: Regression-check the product build and test suite**

The nested project must not disturb the root. R-14 established that `now-sdk build` lints **every** file under `src/`, so a nested project placed carelessly turns a total build failure into a mystery. `benchmark/` is outside `src/`, so this should pass — assert it rather than assume it.

```bash
cd /Users/gpietro/projects/tool-foundry-troubleshooter && now-sdk build && npm test
```

Expected: root build succeeds; Jest all green (PaArtifactStore, PaAuditLogger, PaRunAnchor, PaScriptToolAdapter, PaToolAgentTrace, PaToolReadArtifact, agentDoctorInstructions).

- [ ] **Step 6: Write the fixture app README**

Create `benchmark/seed-app/README.md`:

```markdown
# TS Bench Seeds — benchmark fixture app

**Scope:** `x_snc_tsbench` · **Never install this alongside the product app.**

Five deliberately broken AI Agents. They exist to be diagnosed by Agent Doctor
during the Phase 1a benchmark (IMPLEMENTATION_PLAN.md Tasks 11-12) and have no
other purpose. Every one of them is wrong on purpose.

## Why this is a separate scope

The seeds have to be Fluent, because Phase 1b re-runs the same benchmark against
the custom harness and *the comparison is only valid on identical seeds*. They
must not be in `x_snc_troubleshoot`, because that is the app a customer installs.
A second scope is what satisfies both. See `../DECISION-seed-location.md`.

## Build and install

    npm install
    now-sdk build
    now-sdk install --alias gpinst01

Install is **Task 12's** step, not Task 11's. Task 11 stops at a passing build.

## Do not

- Do not install this into a customer instance, ever.
- Do not reference these seeds from `docs/agent/playbook.md`. An agent that has
  read the answer key is not being measured on anything.
- Do not repair a seed because it looks broken. That is the feature.
```

- [ ] **Step 7: Verify the fixture app's build artifacts are gitignored**

The root `.gitignore` uses unanchored patterns (`dist/`, `node_modules/`, `.now/`), which match at any depth — so the nested project's artifacts are already covered.

```bash
git status --porcelain benchmark/ | grep -E 'node_modules|dist/|\.now/' && echo "LEAK" || echo "clean"
```

Expected: `clean`. If `LEAK`, add the offending path to the root `.gitignore` before committing.

- [ ] **Step 8: Commit**

```bash
git add benchmark/seed-app .gitignore
git commit -m "$(cat <<'EOF'
feat: scaffold the x_snc_tsbench benchmark fixture app

Second SDK project for the five deliberately-broken benchmark seeds,
resolving the seed-location question Task 11 has carried open since
2026-07-30 (DESIGN.md R-13). Fluent for reproducibility across the
Phase 1b re-run; a separate scope so the product app never ships five
broken agents to a customer.

now-sdk init contacts the instance but creates no record there --
verified: sys_scope for scope=x_snc_tsbench returns zero rows while the
same filter returns 9 rows for other scopes.

Issue #31

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Seeds 1–3 — the three plain-agent seeds

**Files:**
- Create: `benchmark/seed-app/src/fluent/seed-01-schema-mismatch.now.ts`
- Create: `benchmark/seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts`
- Create: `benchmark/seed-app/src/fluent/seed-03-missing-data.now.ts`
- Create: `benchmark/seeds/seed-01-schema-mismatch.md`
- Create: `benchmark/seeds/seed-02-ambiguous-instruction.md`
- Create: `benchmark/seeds/seed-03-missing-data.md`

**Interfaces:**
- Consumes: the `benchmark/seed-app/` project from Task 1.
- Produces: exported constants `seed01Agent`, `x_snc_tsbench_ticket`, `seed02Agent`, `seed03Agent`, `x_snc_tsbench_routing`. Task 3 does not reference them; Task 4's README links the spec files by path.

**One deviation from LLD §7, made deliberately.** §7 specifies seed 1's script writing to `incident.priority`. The fixture app is brand new and holds no cross-scope privileges, and R-19 measured that a scoped app cannot always reach a global table — `syslog` remains `DENIED` even with a self-declared `sys_scope_privilege`. A seed that fails at the scope boundary would test the wrong thing: Agent Doctor would correctly diagnose a privilege problem, and the scorecard would record a miss on `tool_schema`. Seed 1 therefore writes to `x_snc_tsbench_ticket`, a table the fixture app owns, whose `priority` column is an integer choice 1–5. The defect under test — a tool declaring a free string against a column that wants an integer choice — is identical, and nothing else is in the way of it. Record this deviation in the seed spec, not only here.

- [ ] **Step 1: Write seed 1's Fluent definition**

Create `benchmark/seed-app/src/fluent/seed-01-schema-mismatch.now.ts`:

```typescript
import '@servicenow/sdk/global'
import { AiAgent, Table, StringColumn, IntegerColumn, ChoiceColumn } from '@servicenow/sdk/core'

/**
 * SEED 1 - tool schema mismatch. Expected layer: tool_schema.
 * Expected fix target: the tool input schema.
 *
 * THE DEFECT, ON PURPOSE: the tool declares priority as a free string and the
 * instructions tell the agent to phrase it in words, but the column is an
 * integer choice 1-5. The write coerces to empty and the agent reports success.
 *
 * This seed is also the artifact-paging stressor - the instructions are verbose
 * and multi-step so the trace is LARGE. Paging is the native harness's weakest
 * documented area and the benchmark has to exercise it.
 *
 * Deviation from LLD 7: the target is this app's own table, not incident.
 * R-19 measured that a scoped app cannot always reach a global table, and a
 * seed that fails at the scope boundary tests the wrong layer.
 *
 * Rules: #43 no backtick or backslash-n inside these templates. #32 no $id on
 * tools[]. #34 description is mandatory. #19 the trailing (inputs) is required.
 * R-5 inputs is an ARRAY.
 */
export const x_snc_tsbench_ticket = Table({
    name: 'x_snc_tsbench_ticket',
    label: 'Bench Ticket',
    display: 'short_description',
    schema: {
        short_description: StringColumn({ label: 'Short description', maxLength: 160 }),
        priority: ChoiceColumn({
            label: 'Priority',
            choices: { '1': 'Critical', '2': 'High', '3': 'Moderate', '4': 'Low', '5': 'Planning' },
            dropdown: 'none',
        }),
        escalation_count: IntegerColumn({ label: 'Escalation count' }),
    },
})

export const seed01Agent = AiAgent({
    $id: Now.ID['seed-01-agent'],
    name: 'Seed 01 Ticket Prioritizer',
    description: `Sets the priority on a bench ticket from a description of how urgent it is. Benchmark seed - deliberately broken.`,
    agentRole: `You are a ticket triage assistant. You read a request and set the ticket priority to match its urgency.`,
    securityAcl: {
        $id: Now.ID['seed-01-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `You triage bench tickets. Work through EVERY step below in order and report what you did at each one. Do not skip steps and do not summarise - the operator needs the full working.

Step 1. Restate the request in your own words, then list the factors that bear on urgency: who is affected, how many people, whether there is a workaround, and whether revenue or safety is involved.

Step 2. For each factor in step 1, say whether it raises or lowers the priority, and by how much. Show your reasoning for each one separately.

Step 3. Decide the priority. Express it in WORDS - critical, high, moderate, low, or planning. Never use a number.

Step 4. Call set_ticket_priority with the ticket sys_id and the priority word you chose in step 3.

Step 5. Report the result of the call, then restate the full chain of reasoning from steps 1 to 4 so the operator can audit it.

Step 6. List anything you were unsure about and what evidence would have settled it.`,
        },
    ],
    tools: [
        {
            name: 'set_ticket_priority',
            type: 'script',
            description: `Sets the priority on a bench ticket. Give it the ticket sys_id and the priority as a word - critical, high, moderate, low or planning. Returns the ticket number and the priority that was stored.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var gr = new GlideRecord('x_snc_tsbench_ticket');
    if (!gr.get(inputs.ticket)) {
        return JSON.stringify({ ok: false, error: 'ticket not found' });
    }
    gr.setValue('priority', inputs.priority);
    gr.update();
    return JSON.stringify({ ok: true, ticket: inputs.ticket, priority_stored: gr.getValue('priority') });
})(inputs);`,
            inputs: [
                {
                    name: 'ticket',
                    description: `The sys_id of the bench ticket to update.`,
                    mandatory: false,
                },
                {
                    name: 'priority',
                    description: `The priority as a word: critical, high, moderate, low or planning.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
```

- [ ] **Step 2: Build to verify seed 1 compiles**

```bash
cd benchmark/seed-app && now-sdk build
```

Expected: PASS. If it fails with `TS2796` / `TS304` / `TS20` at scattered line numbers, grep the templates for a backtick (Build Rule #43) before reading any other diagnostic.

- [ ] **Step 3: Write seed 2's Fluent definition**

Create `benchmark/seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts`:

```typescript
import '@servicenow/sdk/global'
import { AiAgent } from '@servicenow/sdk/core'

/**
 * SEED 2 - ambiguous instruction. Expected layer: instruction.
 * Expected fix target: the instruction text.
 *
 * THE DEFECT, ON PURPOSE: "assign it to the right group" with no definition of
 * right, no lookup table, and NO TOOL that could resolve a group. The agent has
 * nothing to reason from and will either invent a group name or stall.
 *
 * Note what is deliberately absent: this agent has NO tools at all. That is the
 * seed. An agent with a group-lookup tool would be testing something else.
 */
export const seed02Agent = AiAgent({
    $id: Now.ID['seed-02-agent'],
    name: 'Seed 02 Request Router',
    description: `Routes an incoming request to the correct assignment group. Benchmark seed - deliberately broken.`,
    agentRole: `You are a request routing assistant.`,
    securityAcl: {
        $id: Now.ID['seed-02-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `Read the incoming request and assign it to the right group. Be accurate - assigning to the wrong group delays the requester. Confirm the assignment back to the user when you are done.`,
        },
    ],
})
```

- [ ] **Step 4: Write seed 3's Fluent definition**

Create `benchmark/seed-app/src/fluent/seed-03-missing-data.now.ts`:

```typescript
import '@servicenow/sdk/global'
import { AiAgent, Table, StringColumn } from '@servicenow/sdk/core'

/**
 * SEED 3 - missing data. Expected layer: data. Expected fix target: data seeding.
 *
 * THE DEFECT, ON PURPOSE: the routing table exists, the tool reads it correctly,
 * the instructions are clear - and the table is EMPTY. Every lookup returns
 * nothing. This is the seed that distinguishes a diagnosis of "the data is
 * absent" from one of "the read failed", which look identical from the trace
 * unless the tool reports empty reads explicitly.
 *
 * Table renamed from LLD 7's x_snc_troubleshoot_bench_routing: a scoped table
 * name must begin with its OWN app's scope value (R-13, 40 of 40 sampled tables,
 * no exceptions), and this app is x_snc_tsbench.
 *
 * The table is created with NO seed records. That absence is the defect - do
 * not add rows.
 */
export const x_snc_tsbench_routing = Table({
    name: 'x_snc_tsbench_routing',
    label: 'Bench Routing Rule',
    display: 'category',
    schema: {
        category: StringColumn({ label: 'Category', maxLength: 80 }),
        assignment_group: StringColumn({ label: 'Assignment group', maxLength: 80 }),
    },
})

export const seed03Agent = AiAgent({
    $id: Now.ID['seed-03-agent'],
    name: 'Seed 03 Category Router',
    description: `Routes a request by looking its category up in the bench routing table. Benchmark seed - deliberately broken.`,
    agentRole: `You are a routing assistant. You resolve a category to an assignment group using the routing table, and you never guess.`,
    securityAcl: {
        $id: Now.ID['seed-03-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `Route the request to an assignment group.

1. Determine the category of the request.
2. Call lookup_routing_rule with that category to get the assignment group.
3. Report the assignment group you found.

The routing table is the only authority on which group handles which category. Never guess a group name and never invent one.`,
        },
    ],
    tools: [
        {
            name: 'lookup_routing_rule',
            type: 'script',
            description: `Looks up the assignment group for a category in the bench routing table. Give it a category name. Returns the matching assignment group, or reports explicitly that no rule matched.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var gr = new GlideRecord('x_snc_tsbench_routing');
    gr.addQuery('category', inputs.category);
    gr.query();
    if (!gr.next()) {
        return JSON.stringify({ ok: true, matched: false, category: inputs.category, rules_in_table: 0 });
    }
    return JSON.stringify({ ok: true, matched: true, category: inputs.category, assignment_group: gr.getValue('assignment_group') });
})(inputs);`,
            inputs: [
                {
                    name: 'category',
                    description: `The category to look up in the routing table.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
```

- [ ] **Step 5: Build to verify seeds 1–3 compile together**

```bash
cd benchmark/seed-app && now-sdk build
```

Expected: PASS.

- [ ] **Step 6: Write the three seed spec documents**

Each file uses this exact structure. Create `benchmark/seeds/seed-01-schema-mismatch.md`:

```markdown
# Seed 01 — tool schema mismatch

| | |
|---|---|
| **Expected root-cause layer** | `tool_schema` (layer 3) |
| **Expected fix target** | the tool input schema |
| **Fluent source** | `../seed-app/src/fluent/seed-01-schema-mismatch.now.ts` |
| **Agent name** | Seed 01 Ticket Prioritizer |
| **Also stresses** | artifact paging — this seed is built to produce a LARGE trace |

## The defect

`set_ticket_priority` declares `priority` as a free string, and the instructions
require the agent to express priority in words. The column
`x_snc_tsbench_ticket.priority` is an integer choice, 1–5. The word never
matches a choice value, the write coerces to empty, and `gr.update()` reports
success — so the agent tells the user the ticket was prioritised.

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
   Record its sys_id.

## Trigger

Open a fresh conversation with **Seed 01 Ticket Prioritizer** and give it the
ticket sys_id plus an urgent-sounding description — e.g. *"the payment gateway
is down for all customers, no workaround"*. Capture the resulting
`sn_aia_execution_plan` sys_id.

## Expected diagnosis

Root cause in `tool_schema`: the tool's `priority` input is a free string while
the target column is an integer choice 1–5. Fix target: the tool input schema
(constrain to 1–5, or map words to values before the write).

Evidence a correct diagnosis should cite: the trace showing
`priority_stored` empty in the tool result, plus the column definition.

## Safety

Touches only `x_snc_tsbench_ticket`, owned by the fixture app. Nothing shared.
```

Create `benchmark/seeds/seed-02-ambiguous-instruction.md` with the same table structure, `Expected root-cause layer: instruction (layer 2)`, `Expected fix target: the instruction text`, Fluent source `../seed-app/src/fluent/seed-02-ambiguous-instruction.now.ts`, agent name `Seed 02 Request Router`. Defect section: *"Assign it to the right group" defines neither "right" nor any means of determining it. The agent has no group-lookup tool, no routing table, and no list of groups in its instructions — so it must either invent a group name or stall. What is absent is the seed: adding a lookup tool would test a different layer.* Setup: install the fixture app; no data setup needed. Trigger: fresh conversation, give it a request to route, e.g. *"my laptop will not boot"*; capture the execution plan sys_id. Expected diagnosis: root cause in `instruction` — the instruction requires a determination the agent has no means to make; fix target is the instruction text (name the groups, or supply a lookup tool and say to use it). Safety: no data touched.

Create `benchmark/seeds/seed-03-missing-data.md` with the same structure, `Expected root-cause layer: data (layer 5)`, `Expected fix target: data seeding`, Fluent source `../seed-app/src/fluent/seed-03-missing-data.now.ts`, agent name `Seed 03 Category Router`. Defect section: *The table exists, the tool queries it correctly, and the instructions are unambiguous. The table is empty. Every lookup returns `matched: false`. This is the seed that separates "the data is absent" from "the read failed" — indistinguishable from a trace unless the tool reports empty reads explicitly, which is exactly the R-6 / R-11 failure mode this project keeps legislating against.* Setup: install the fixture app and **add no rows to `x_snc_tsbench_routing`** — the emptiness is the defect. Trigger: fresh conversation, ask it to route a request in any category; capture the execution plan sys_id. Expected diagnosis: root cause in `data` — the routing table holds zero rows; fix target is data seeding, not the tool or the instructions. A diagnosis naming the tool or the query is a **miss**, and the scorecard should record it as one. Safety: table owned by the fixture app; created empty by design.

- [ ] **Step 7: Commit**

```bash
git add benchmark/seed-app/src/fluent benchmark/seeds
git commit -m "$(cat <<'EOF'
feat: add benchmark seeds 1-3 as Fluent plus their specs

Seed 1 tool-schema mismatch (also the artifact-paging stressor),
seed 2 ambiguous instruction, seed 3 missing data.

Seed 1 deviates from LLD section 7 by writing to the fixture app's own
table rather than incident: R-19 measured that a scoped app cannot
always reach a global table, and a seed failing at the scope boundary
would be correctly diagnosed as a privilege problem and score as a miss
on tool_schema. Deviation recorded in the seed spec.

Seed 3's table is renamed to x_snc_tsbench_routing -- a scoped table
name must begin with its own app's scope value (R-13).

Issue #31

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Seeds 4–5 — the two structurally exotic seeds

**Files:**
- Create: `benchmark/seed-app/src/fluent/seed-04-genai-unmapped.now.ts`
- Create: `benchmark/seed-app/src/fluent/seed-05-inactive-usecase.now.ts`
- Create: `benchmark/seeds/seed-04-genai-unmapped.md`
- Create: `benchmark/seeds/seed-05-inactive-usecase.md`

**Interfaces:**
- Consumes: the `benchmark/seed-app/` project from Task 1.
- Produces: exported constants `seed04Capability`, `seed04Agent`, `seed05Agent`, `seed05Workflow`.

These two are separated from Task 2 because neither is a plain `AiAgent`: seed 4 writes a record into a **global** table via the generic `Record()` fallback, and seed 5 needs an `AiAgenticWorkflow` to own a trigger at all (Build Rule #31). Both carry install-time risk this task does not reach, and both spec files must say so.

- [ ] **Step 1: Write seed 4's Fluent definition**

Create `benchmark/seed-app/src/fluent/seed-04-genai-unmapped.now.ts`:

```typescript
import '@servicenow/sdk/global'
import { AiAgent, Record } from '@servicenow/sdk/core'

/**
 * SEED 4 - GenAI capability not mapped to a provider.
 * Expected layer: genai_stack. Expected fix target: capability mapping.
 *
 * THE DEFECT, ON PURPOSE: a capability definition whose connection - the bound
 * provider credential alias - is EMPTY. R-18 established that connection is
 * exactly that binding, so an empty one IS the "capability not mapped to a
 * provider" finding this seed needs to produce.
 *
 * SHARED-INSTANCE SAFETY, which is why this seed is shaped this way.
 * LLD 7 carries an explicit warning: do NOT unmap real capabilities. gpinst01
 * is shared. This seed therefore creates its OWN capability definition rather
 * than breaking an existing one. Nothing real is unmapped and no other tenant
 * of the instance is affected. This closes LLD section 8 item 8.
 *
 * INSTALL RISK, not reached by Task 11: sys_one_extend_capability_definition
 * is a GLOBAL table, and a scoped app writing into one may be refused at
 * install. Task 11 verifies only that this BUILDS. If install fails at Task 12,
 * the fallback is the bogus-capability-reference construction described in the
 * seed spec.
 */
export const seed04Capability = Record({
    table: 'sys_one_extend_capability_definition',
    $id: Now.ID['seed-04-capability'],
    data: {
        name: 'x_snc_tsbench_unmapped_capability',
        capability: 'x_snc_tsbench_unmapped_capability',
        api_type: 'generic',
        connection: '',
    },
})

export const seed04Agent = AiAgent({
    $id: Now.ID['seed-04-agent'],
    name: 'Seed 04 Summarizer',
    description: `Summarises a bench ticket through a capability that has no provider bound to it. Benchmark seed - deliberately broken.`,
    agentRole: `You are a summarisation assistant.`,
    securityAcl: {
        $id: Now.ID['seed-04-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `Summarise the bench ticket the user names. Use the summarise_ticket tool for the summarisation itself - do not summarise it yourself, because the operator needs the capability path exercised. Report the summary the tool returns.`,
        },
    ],
    tools: [
        {
            name: 'summarise_ticket',
            type: 'script',
            description: `Summarises a bench ticket by invoking the x_snc_tsbench_unmapped_capability GenAI capability. Give it a ticket sys_id. Returns the generated summary.`,
            executionMode: 'autopilot',
            active: true,
            recordType: 'custom',
            script: `(function (inputs) {
    var payload = { capability: 'x_snc_tsbench_unmapped_capability', ticket: inputs.ticket };
    var result = sn_one_extend.OneExtendUtil.execute(payload);
    return JSON.stringify({ ok: true, capability: payload.capability, result: result });
})(inputs);`,
            inputs: [
                {
                    name: 'ticket',
                    description: `The sys_id of the bench ticket to summarise.`,
                    mandatory: false,
                },
            ],
        },
    ],
})
```

- [ ] **Step 2: Build to verify seed 4 compiles**

```bash
cd benchmark/seed-app && now-sdk build
```

Expected: PASS. If `Record()` rejects the global table at **build** time, that is a finding — stop, record it in the seed spec, and switch seed 4 to the fallback construction (a tool referencing a capability name that does not exist at all). Do not silently proceed with a seed that cannot be built.

- [ ] **Step 3: Write seed 5's Fluent definition**

Create `benchmark/seed-app/src/fluent/seed-05-inactive-usecase.now.ts`:

```typescript
import '@servicenow/sdk/global'
import { AiAgent, AiAgenticWorkflow } from '@servicenow/sdk/core'

/**
 * SEED 5 - use case exists but is inactive. Expected layer: wiring.
 * Expected fix target: activation.
 *
 * THE DEFECT, ON PURPOSE: the trigger configuration is inactive. The agent is
 * fine, the instructions are fine, the workflow is published - nothing fires.
 *
 * WHY THIS IS A WORKFLOW AND NOT A BARE AGENT: Build Rule #31. triggerConfig on
 * a bare AiAgent yields a sn_aia_trigger_configuration whose usecase is null,
 * so there is no backing flow and no business rule - the trigger never fires
 * for a DIFFERENT reason than the one this seed is testing, and with no
 * diagnostic signal at all. Only AiAgenticWorkflow creates the sn_aia_usecase
 * record the trigger binds to.
 *
 * TWO GATES, AND THE SEED TESTS WHICH ONE. LLD section 8 item 2 (R-18)
 * established two INDEPENDENT activation gates:
 * sn_aia_trigger_configuration.active and
 * sn_aia_trigger_agent_usecase_m2m.active. A use case reads as inactive when
 * either is off. This seed turns OFF the trigger-configuration gate and leaves
 * the m2m gate ON, so a correct diagnosis has to name the specific gate rather
 * than observe that "something is inactive".
 *
 * MUST BE VERIFIED AT INSTALL, NOT ASSUMED: SDK 4.9.0 deploys triggers INACTIVE
 * by default. active: false below is therefore what we intend AND what the SDK
 * would do anyway - so at Task 12 the m2m gate must be confirmed ON on the
 * instance. If both gates land off, the seed tests nothing and the run is void.
 */
export const seed05Agent = AiAgent({
    $id: Now.ID['seed-05-agent'],
    name: 'Seed 05 Ticket Acknowledger',
    description: `Acknowledges a newly created bench ticket. Benchmark seed - the agent is fine, its trigger is not.`,
    agentRole: `You are an acknowledgement assistant.`,
    securityAcl: {
        $id: Now.ID['seed-05-acl'],
        type: 'Any authenticated user',
    },
    channel: 'nap_and_va',
    agentType: 'internal',
    active: true,
    versionDetails: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `A bench ticket has just been created. Acknowledge it by restating its short description and the priority it was given.`,
        },
    ],
})

export const seed05Workflow = AiAgenticWorkflow({
    $id: Now.ID['seed-05-workflow'],
    name: 'Seed 05 Ticket Acknowledgement',
    description: `Fires on bench ticket creation and acknowledges the ticket. Benchmark seed - the trigger configuration is deliberately inactive.`,
    securityAcl: {
        $id: Now.ID['seed-05-workflow-acl'],
        type: 'Any authenticated user',
    },
    team: {
        $id: Now.ID['seed-05-team'],
        name: 'Seed 05 Acknowledgement Team',
        members: [seed05Agent as any],
    },
    versions: [
        {
            name: 'V1',
            number: 1,
            state: 'published',
            instructions: `Delegate to Seed 05 Ticket Acknowledger to acknowledge the newly created bench ticket.`,
        },
    ],
    executionMode: 'autopilot',
    triggerConfig: [
        {
            name: 'Seed 05 Bench Ticket Created',
            active: false,
            channel: 'Now Assist Panel',
            targetTable: 'x_snc_tsbench_ticket',
            triggerFlowDefinitionType: 'record_create',
            triggerCondition: 'active=true',
            objectiveTemplate: 'Acknowledge the newly created bench ticket',
        },
    ],
})
```

- [ ] **Step 4: Build to verify all five seeds compile together**

```bash
cd benchmark/seed-app && now-sdk build
```

Expected: PASS. `seed05Workflow` references `x_snc_tsbench_ticket`, defined in seed 1's file — confirm the cross-file reference resolves (it is a table *name* string, not an import, so it should).

- [ ] **Step 5: Write the two seed spec documents**

Create `benchmark/seeds/seed-04-genai-unmapped.md` using the Task 2 Step 6 structure: `Expected root-cause layer: genai_stack (layer 6)`, `Expected fix target: capability mapping`, Fluent source `../seed-app/src/fluent/seed-04-genai-unmapped.now.ts`, agent name `Seed 04 Summarizer`. It must carry these sections:

- **The defect** — the capability definition `x_snc_tsbench_unmapped_capability` exists with `connection` empty. R-18 established `connection` is the bound provider credential alias, so an empty one is precisely "capability not mapped to a provider".
- **Shared-instance safety** — the seed creates its **own** capability rather than unmapping a real one. LLD §7 warns explicitly against unmapping real capabilities on the shared instance. **This closes LLD §8 item 8**, qualified as *build-proven, not yet runtime-proven*.
- **Install risk and the fallback** — `sys_one_extend_capability_definition` is a global table and a scoped app writing into one may be refused at install. If Task 12's install refuses it, fall back to a tool referencing a capability name that exists nowhere. Note that the fallback produces a *reference not found* signature rather than a *not mapped to a provider* one, so if it is used, the seed's expected diagnosis changes and the scorecard must be scored against the fallback's signature — not the original one.
- **Setup / Trigger / Expected diagnosis / Safety** per the Task 2 structure.

Create `benchmark/seeds/seed-05-inactive-usecase.md`, `Expected root-cause layer: wiring (layer 7)`, `Expected fix target: activation`, Fluent source `../seed-app/src/fluent/seed-05-inactive-usecase.now.ts`, agent name `Seed 05 Ticket Acknowledger`, workflow `Seed 05 Ticket Acknowledgement`. It must carry:

- **The defect** — `sn_aia_trigger_configuration.active` is false; everything else is correct and published.
- **The two gates** — `sn_aia_trigger_configuration.active` and `sn_aia_trigger_agent_usecase_m2m.active` are independent (LLD §8 item 2, R-18). One is off, the other on, so a correct diagnosis must **name the specific gate**. A diagnosis saying only "the use case is inactive" scores partial, not full, on fix target.
- **A pre-run check that is mandatory, not advisory** — SDK 4.9.0 deploys triggers inactive by default, so before scoring, confirm on the instance that the m2m gate is ON. If both gates are off the seed tests nothing and **the run is void** — record it as void rather than scoring it.
- **Setup / Trigger / Expected diagnosis / Safety.** Trigger: insert a row into `x_snc_tsbench_ticket` and confirm nothing fires; the diagnosis subject is the non-firing, so the "execution plan sys_id" for this seed may not exist — the spec must say what the tester gives Agent Doctor instead (the agent/workflow name).

- [ ] **Step 6: Commit**

```bash
git add benchmark/seed-app/src/fluent benchmark/seeds
git commit -m "$(cat <<'EOF'
feat: add benchmark seeds 4-5 as Fluent plus their specs

Seed 4 declares its OWN capability definition with connection empty
rather than unmapping a real one -- gpinst01 is shared and LLD section 7
forbids unmapping real capabilities. This closes LLD section 8 item 8,
build-proven and not yet runtime-proven.

Seed 5 is an AiAgenticWorkflow rather than a bare agent: Build Rule #31
means triggerConfig on a bare AiAgent yields a null usecase and never
fires, which would break the seed for the wrong reason. One activation
gate off, the other on, so the diagnosis has to name which.

Issue #31

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: The protocol, the scorecard, and the decision record

**Files:**
- Modify: `benchmark/README.md` (replace the 17-line placeholder wholesale)
- Create: `benchmark/DECISION-seed-location.md`
- Create: `benchmark/scorecard-template.md`

**Interfaces:**
- Consumes: the seed spec files from Tasks 2 and 3 (linked by path).
- Produces: `benchmark/scorecard-template.md`, which Task 12 copies to `benchmark/scorecard-agent-doctor.md` and fills.

- [ ] **Step 1: Write the seed-location decision record**

Create `benchmark/DECISION-seed-location.md`. It records the resolution of the question Task 11 carried open since 2026-07-30, and must contain:

- **The decision** — a separate scoped fixture app, `benchmark/seed-app/`, scope `x_snc_tsbench`, seeds as Fluent.
- **The two rejected options and why**, as a table: Fluent in `src/fluent/` gives reproducibility but ships five broken agents inside the product app; MCP/Foundry automation keeps them out but violates CLAUDE.md's port-to-Fluent rule and is not reproducible months later, which is exactly when Phase 1b needs them.
- **What the decision costs**, stated rather than elided: a second scope and a second install target.
- **The measured fact that made "scaffold without installing" viable** — `now-sdk init` contacts the instance but creates no record there; `sys_scope` for `scope=x_snc_tsbench` returned zero rows while the same filter returned 9 rows for other scopes, so the absence is genuine and not R-6's silent blank.
- **The consequence for seed 3** — the lookup table is `x_snc_tsbench_routing`, not LLD §7's `x_snc_troubleshoot_bench_routing`, because a scoped table name must begin with its own app's scope value (R-13).

- [ ] **Step 2: Write the scorecard template**

Create `benchmark/scorecard-template.md`. One row per scored run, 10 rows. It must contain, in this order:

**A. The 6-point rubric** — root-cause layer correct (2) · fix target correct (2) · evidence cites trace + config/schema (1) · fix output usable by the builder AI without manual editing (1).

**B. Four further columns, each with the sentence saying why it exists:**

| Column | Why it is here |
|---|---|
| `layers_swept` — n/7 and which | R-3 amendment. The same probe ran **19** tool calls on keynexus01 and **5** on gpinst01, both finishing `state=Completed` with empty `state_reason` and neither capped. Without this column a lucky shallow run scores identically to a thorough one. |
| `layers_available` — n/7 and which | §3.1 of the design. Separates *did not look* from *could not look — no tool exists*. `swept 1/7, available 1/7` is an agent doing everything it can; `swept 1/7, available 7/7` is one that stopped early. Identical scores, opposite verdicts. |
| `cause_of_death` — `completed \| tool_limit \| context \| supervision_stall \| security \| wandered \| genai_down` | DESIGN.md §2.3. A 0-point budget death and a 0-point reasoning death are opposite verdicts on the gate. |
| `continuous_tool_execution_limit` and `max_auto_executions` per attached tool | R-4 / #30. **Read at run time, not assumed.** E2's 19-call result was reachable only because that probe's `max_auto_executions` was 20 against an instance-typical 10 — 477 of 483 production rows sit at the dictionary default. |

**C. Operational columns** — tool calls, assists consumed, wall clock, failure behavior (graceful partial vs. wandering/stuck), free-text notes.

**D. A "how to read the budget knobs" procedure**, since the template ships them blank:
- property: `servicenow_query` on `sys_properties`, `name=sn_aia.continuous_tool_execution_limit`, field `value`
- binding: `servicenow_query` on `sn_aia_agent_tool_m2m`, filtered to the agent under test, field `max_auto_executions`, one row per attached tool
- A pre-filled value is an assumption wearing a measurement's clothes. If either differs from the instance-typical or dictionary default, `benchmark/DECISION.md` must say so and say what the difference is.

**E. A note that `layers_swept` is derived, not eyeballed** — per R-20, from `x_snc_troubleshoot_audit`: distinct `tool_name` over rows where `run = <run_id>` and `action_type = 'result'`.

- [ ] **Step 3: Replace the benchmark README**

Overwrite `benchmark/README.md` entirely — the placeholder's stated reason for existing (the seed-location question had to be settled first) is now discharged, and R-18b requires a correction to replace the text it invalidates rather than sit beside it. The new README must contain:

- **What this directory is** and pointers to the seed specs, the scorecard template, and the decision record.
- **The blind rule, preserved verbatim from the placeholder** — the seeded-failure catalog must **not** be referenced from `docs/agent/playbook.md`; an agent that has read the answer key is not being measured on anything.
- **The protocol:** smoke test first against gpinst01 execution `c9d63a932bda8b9417a6ffbeee91bfd0` (expected `script_error` citing `context_processing_script` line 42) — chosen deliberately because it is *invisible from the plan header* (`state=Completed`, empty `state_reason`, all 11 tasks and all 5 tool calls `Success`), so it tests whether a diagnosis that stops at the header gets caught. Then 2 runs per seed in fresh conversations = 10 scored runs, blind.
- **Run identity** — scored runs key on `_agentic_context_.conversation_id`. DESIGN.md §2.4 disqualifies time-window keying outright: PaRunAnchor's "one anchor per user per 30 min" fallback would glue run 2 onto run 1, interleaving artifacts and audit rows and letting run 2 `read_artifact` into run 1's evidence.
- **The tool-availability dependency, stated as fact.** Agent Doctor currently has tools for **layer 1 only** (`docs/agent/agent-doctor-instructions.md`), and all five gate-scored seeds target layers 2–7. Until Tasks 7–8 land, a scored run would return near-0/10 by construction and the Task 12 gate would read that as *"< 5/10 → full custom harness as designed"*. The `layers_available` column exists to make this visible in the data. Tracked separately as a blocker issue.
- **The de-risking step that is unavailable** — DESIGN.md §2.1 casts `PaEvidenceCollector` as the pre-scoring de-risker (separating *"tools cannot see the defect"* from *"agent cannot reason to it"*). It is not built and not in the Phase 1a task list. The substitute is a manual pass invoking the tool cores directly against each seed. An unbuilt de-risker everyone assumes ran is how a benchmark produces scores nobody can interpret.
- **Stretch seeds 6–8** — a short pointer to LLD §7. Not gate-scored; the swap-in set if a core seed proves unbuildable.

- [ ] **Step 4: Verify no placeholder text survives**

```bash
grep -rn "TBD\|TODO\|Empty for now\|explicitly undecided" benchmark/ --include=*.md
```

Expected: no matches. The phrase `explicitly undecided` belonged to the placeholder and must not survive the decision.

- [ ] **Step 5: Commit**

```bash
git add benchmark/README.md benchmark/DECISION-seed-location.md benchmark/scorecard-template.md
git commit -m "$(cat <<'EOF'
feat: add the benchmark protocol, scorecard template and seed-location decision

The scorecard carries four columns beyond the 6-point rubric, three
required by rulings and one found while building the instrument:
layers_swept (R-3), layers_available (the could-not-look state),
cause_of_death (section 2.3) and both budget knobs read at run time
(R-4 / issue #30).

benchmark/README.md replaces the placeholder wholesale rather than
appending to it -- the question it existed to hold open is now answered
(R-18b).

Issue #31

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Doc reconciliation and the blocker issue

**Files:**
- Modify: `docs/IMPLEMENTATION_PLAN.md` (Task 11's OPEN block, ~line 279)
- Modify: `docs/LOW_LEVEL_DESIGN.md` (§7 seed-3 row; §8 item 8)
- Modify: `DESIGN.md` (append ruling R-21)

This project treats a ruling's Change clause naming a document section as **a work item, not a record** (R-18c), and the ledger walk is bidirectional (R-19a). These edits are part of the task, not follow-up.

- [ ] **Step 1: Replace the OPEN block in the implementation plan**

In `docs/IMPLEMENTATION_PLAN.md`, the block beginning `> **OPEN — decide before Task 11, not during it (raised 2026-07-30, DESIGN.md R-13).**` and running through `> Not decided here.` is **replaced** — not annotated — with the resolution:

```markdown
> **RESOLVED 2026-07-31 (issue #31, DESIGN.md R-21).** The five seeded failure agents live in a
> **separate scoped fixture app** — `benchmark/seed-app/`, scope `x_snc_tsbench`, authored as Fluent.
> Fluent gives the reproducibility the Phase 1b re-run needs (the two harnesses are only comparable
> on identical seeds); the separate scope keeps five deliberately broken agents out of the product
> app a customer installs. The cost — a second scope and a second install target — is accepted.
> Rationale and rejected options: `benchmark/DECISION-seed-location.md`.
```

Also update Task 11's file list at the top of the task to name the actual deliverables (`benchmark/README.md`, `benchmark/DECISION-seed-location.md`, `benchmark/scorecard-template.md`, `benchmark/seeds/seed-0{1..5}-*.md`, `benchmark/seed-app/`).

- [ ] **Step 2: Correct LLD §7's seed-3 table name**

In `docs/LOW_LEVEL_DESIGN.md` §7, the seed 3 row reads `x_snc_troubleshoot_bench_routing`. Replace it with `x_snc_tsbench_routing` and add a short pointer: *a scoped table name must begin with its own app's scope value (R-13), and the seeds live in `x_snc_tsbench` (R-21).*

Leaving the two documents disagreeing about a table name is the precise shape of the R-13 defect this project already paid for once.

- [ ] **Step 3: Close LLD §8 item 8 — body AND label**

Item 8 currently reads `**STILL OPEN** (not in Phase 0 scope), but narrowed by R-18 … Still to be confirmed before Task 11.`

Per R-19b, **the status label is part of the claim** — correcting the body while leaving the label at `STILL OPEN` produces a document that contradicts itself at a glance, and the label is what a reader scans. Change **both**:

- Label → `**CLOSED 2026-07-31 (R-21), build-proven**`
- Body → the construction is a capability definition **owned by the fixture app** with `connection` empty; R-18 established `connection` is the bound provider credential alias, so an empty one is precisely the "capability not mapped to a provider" finding. Creating a new capability rather than unmapping a real one is what respects the shared-instance constraint the item exists to protect.
- Qualify honestly: **build-proven, not yet runtime-proven** — the runtime half arrives with Task 12, and the install-refusal fallback is recorded in `benchmark/seeds/seed-04-genai-unmapped.md`.

- [ ] **Step 4: Append ruling R-21 to DESIGN.md**

Add after R-20, following the house format (`**R-N — <headline>. (date)**`, then `**Found:**` / `**Change:**`). It must record **two** things:

1. **The seed-location decision** — separate scoped fixture app; the two rejected options and why; the accepted cost; and the measured fact that `now-sdk init` creates no instance-side record.
2. **The layer-availability finding**, which is the part a future ledger walk most needs to see: Agent Doctor ships tools for layer 1 only, all five gate-scored seeds target layers 2–7, and a scored run today would return near-0/10 **by construction** — which the Task 12 gate table reads as *"< 5/10 → full custom harness as designed"*, the most expensive decision in the project, reached from a missing-tools gap rather than anything measured about the native harness. **Change:** the scorecard records `layers_available` alongside `layers_swept`, extending R-3's *finished vs. did not look* distinction to a third state, *could not look*; and Task 12's scored protocol is blocked on Tasks 7–8, filed as its own issue.

- [ ] **Step 5: File the blocker issue**

```bash
gh issue create --title "Task 12 is blocked on Tasks 7-8: Agent Doctor can sweep layer 1, the seeds target layers 2-7" --label enhancement --assignee @me --body "$(cat <<'EOF'
Found while building the Task 11 scorecard (#31).

`docs/agent/agent-doctor-instructions.md` states it directly: *"You have tools for LAYER 1 ONLY … Layers 2 through 7 have no tool in this build. Report every one of them as NOT SWEPT."* Task 10 shipped two tools — `agent_trace` and `read_artifact` — as the deliberate vertical-slice scope from the Phase 1a build brief. The remaining five cores are Tasks 7–8, unbuilt.

The five gate-scored benchmark seeds target layers **3, 2, 5, 6, 7**. Not one targets layer 1.

**Consequence:** a scored 10-run benchmark executed against the build as it stands returns near-0/10 **by construction**, and the Task 12 gate table reads that as:

> **< 5/10** → Full custom harness as designed

That is the most expensive decision in the project, reached from a missing-tools gap rather than from anything measured about the native harness.

**Mitigated but not resolved by #31.** The scorecard now records `layers_available` alongside `layers_swept`, so the gap is visible in the data rather than silently scoring as agent failure. That makes the result *interpretable*; it does not make it *meaningful*. Tasks 7–8 must land before Task 12's scored protocol runs.

Related: #29 (Task 10's body still says "the 7 script tools").
EOF
)"
```

- [ ] **Step 6: Verify the docs no longer contradict each other**

```bash
grep -rn "x_snc_troubleshoot_bench_routing" docs/ DESIGN.md benchmark/
grep -n "STILL OPEN" docs/LOW_LEVEL_DESIGN.md
grep -n "OPEN — decide before Task 11" docs/IMPLEMENTATION_PLAN.md
```

Expected: the first returns no matches; the second no longer returns item 8; the third returns nothing.

- [ ] **Step 7: Commit**

```bash
git add docs/IMPLEMENTATION_PLAN.md docs/LOW_LEVEL_DESIGN.md DESIGN.md
git commit -m "$(cat <<'EOF'
docs: apply R-21 -- seed location resolved, LLD item 8 closed

Replaces the OPEN block in IMPLEMENTATION_PLAN.md Task 11 rather than
annotating it (R-18b). Closes LOW_LEVEL_DESIGN.md section 8 item 8 in
both body and status label (R-19b: the label is part of the claim).
Corrects LLD section 7's seed-3 table name to x_snc_tsbench_routing.

R-21 also records the layer-availability finding: Agent Doctor sweeps
layer 1 only while all five gate-scored seeds target layers 2-7, so a
scored run today returns near-0/10 by construction and the gate would
read that as "build the full custom harness".

Issue #31

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Version bump and PR

**Files:**
- Modify: `package.json` (version field)
- Modify: `README.md` (version badge, line 3)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump the version**

Current is `2026.07.3111`. Same day, next merge → **`2026.07.3112`**.

- `package.json` `"version": "2026.07.3112"`
- `README.md` line 3: `![Version](https://img.shields.io/badge/version-2026.07.3112-blue)`

- [ ] **Step 2: Add the changelog entry**

Follow the existing house format in `CHANGELOG.md`. It must record: the fixture app and the seed-location resolution; the five seeds; the protocol, scorecard template and decision record; the four scorecard columns and which ruling each discharges (R-3, R-4/#30, §2.3, and the new availability column); the LLD §8 item 8 closure as build-proven; and the Tasks 7–8 blocker.

- [ ] **Step 3: Final verification before the PR**

```bash
cd /Users/gpietro/projects/tool-foundry-troubleshooter && now-sdk build && npm test
cd benchmark/seed-app && now-sdk build
```

Expected: all three pass. Report the actual output — per `superpowers:verification-before-completion`, evidence before assertions. If the fixture build could not be run for any reason, say so plainly and do not claim it passed (design §1.4).

- [ ] **Step 4: Commit and push**

```bash
git add package.json README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
chore: bump version to 2026.07.3112 and add the changelog entry

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feature/task-11-benchmark-suite
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "Task 11: seeded-failure benchmark suite + seed-location decision (R-21)" --body "$(cat <<'EOF'
Closes #31.

Builds the measuring instrument for the Phase 1a harness gate. DESIGN.md section 1: *"Under A the load-bearing component is the **benchmark**, not Agent Doctor."*

## The decision that was blocking this task

Task 11 has carried an explicit `OPEN — decide before Task 11, not during it` block since 2026-07-30 (R-13). **Resolved:** the five broken seed agents live in a separate scoped fixture app, `benchmark/seed-app/`, scope `x_snc_tsbench`, authored as Fluent — reproducible for the Phase 1b re-run, and out of the product app a customer installs. Rationale and rejected options in `benchmark/DECISION-seed-location.md`.

## What ships

- `benchmark/seed-app/` — second SDK project, five seeds as Fluent, **build-verified, not installed**
- `benchmark/README.md` — the run protocol (replaces the placeholder wholesale, R-18b)
- `benchmark/scorecard-template.md`, `benchmark/DECISION-seed-location.md`, five seed specs
- Doc reconciliation: plan Task 11, LLD section 7 + section 8 item 8, DESIGN.md R-21

## The finding worth reading

Building the scorecard surfaced that **Agent Doctor has tools for layer 1 only**, while all five gate-scored seeds target layers 2–7. A scored run today returns near-0/10 **by construction**, and the Task 12 gate reads that as *"< 5/10 → full custom harness as designed"* — the most expensive decision in the project, reached from a missing-tools gap rather than anything measured about the harness.

The scorecard now records `layers_available` alongside `layers_swept`, extending R-3's *finished vs. did not look* distinction to a third state: *could not look*. That makes the result interpretable; it does not make it meaningful. Tasks 7–8 must land before Task 12 runs — filed separately.

## Not done here, deliberately

No `now-sdk install`, no seed executions triggered, no failing execution sys_ids captured. Those are Task 12. The seeds are proven to **build**, not to fail as specified — seed 4's global-table write and seed 5's activation gates both carry install-time risk recorded in their spec files.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage.** Design §1 → Task 1 + Task 5 Step 4. §2 deliverables → Tasks 1–4. §3 scorecard incl. the four columns → Task 4 Step 2; §3.1 availability → Task 4 Step 2 + Task 5 Steps 4–5; §3.2 run identity → Task 4 Step 3. §4 protocol → Task 4 Step 3. §5 seeds → Tasks 2–3; §5.1 seed 4 → Task 3 Steps 1, 5 + Task 5 Step 3; §5.2 seed 5 → Task 3 Steps 3, 5; §5.3 stretch seeds → Task 4 Step 3 (pointer only). §6 reconciliation → Task 5. §7 testing → Task 1 Step 5, Task 6 Step 3.

**Placeholder scan.** No TBD/TODO. Every Fluent file is given in full. The seed spec documents for seeds 2–5 are specified by required-section rather than reproduced verbatim, with seed 1's full text as the template — a deliberate call to keep the plan readable; each is unambiguous about what it must contain.

**Type consistency.** `x_snc_tsbench_ticket` is defined in seed 1's file and referenced by name (a string, not an import) in seed 5's `targetTable` — checked at Task 3 Step 4. Table export names match table names exactly (Rule #9). `seed05Agent` is defined before `seed05Workflow` references it in the same file. Tool `inputs` are arrays of `{name, description, mandatory}` throughout (R-5). No `$id` appears on any `tools[]` entry (Rule #32); every tool has a non-empty `description` (Rule #34); every `script` ends with the trailing `(inputs)` (Rule #19).

**One gap accepted knowingly:** the plan cannot prove seeds *fail as specified* — only that they build. That is Task 12's, and the PR body says so rather than letting the reader infer completeness.
