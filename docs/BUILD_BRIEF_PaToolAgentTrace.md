# Build Brief — PaToolAgentTrace

**What this is:** a self-contained prompt to paste into a **fresh** Claude Code session to build
the first Agent Doctor tool core. It carries the hard-won facts a new session cannot know — the
live-verified instance state and the traps that cost hours to find — so they are not rediscovered.

**Written:** 2026-07-30, immediately after Phase 0 closed with a GO verdict.
**Naming:** one brief per tool core. Later ones should follow this shape rather than replacing it.

---

Build `PaToolAgentTrace`, the first Agent Doctor tool core, in this repo.

## Where things stand

`main` is clean and current. A ServiceNow SDK app (`x_snc_troubleshoot`, SDK 4.9.2) is scaffolded, building, and installing to **gpinst01**. A Phase 0 pre-flight has already been run and its verdict is **GO** — do not re-run it. Read these first:

- `docs/LOW_LEVEL_DESIGN.md` — **§2.1** (the execution-side data model this tool owns) and **§4.1** (this tool's full spec: args, resolution, 7-step summary algorithm, detail mode)
- `docs/PREFLIGHT_FINDINGS.md` — what was measured live on the instance
- `DESIGN.md` §4 — rulings R-1..R-12, the build contract
- `CLAUDE.md` auto-loads `.claude/context/sdk-reference.md` (40 build rules). 39 golden Fluent examples in `.claude/context/sdk-examples/`.

## What to build

`PaToolAgentTrace` per LLD §4.1 — a Script Include in `src/fluent/`, exposed later as an AI Agent script tool. Start with the core: plan header → task tree → tool calls → messages → error mining → failure signatures → latency flags. Detail mode and `PaArtifactStore` paging can follow.

Follow the SDK/MCP boundary in `CLAUDE.md`: **SDK owns creation** (Fluent DSL in `src/fluent/`, `now-sdk build` then `now-sdk install --alias gpinst01`); **MCP owns runtime** (execute, trace, query). Never commit to `main` — branch, PR, merge.

## Verified facts — use these, don't re-derive them

- **14 of 15 tables are readable from `x_snc_troubleshoot`** via `GlideRecordSecure`, with no privilege grant. That includes every table this tool needs: `sn_aia_execution_plan`, `_execution_task`, `_tools_execution`, `_message`, `sn_aia_agent`, `sn_aia_usecase`, `sys_cs_conversation`.
- **`syslog` is DENIED** from our scope. It needs a `sys_scope_privilege` Read grant. That blocks `PaToolLogAnalysis`, not this tool — but don't be surprised by it.
- Verify anything yourself with `GET /api/x_snc_troubleshoot/scope_probe/reads` (`src/fluent/scope-readability.now.ts`).
- Known-answer failure specimens exist on **keynexus01** (not gpinst01) for testing: `78f347b72f198310f824ac1bcfa4e3bd` (script error in a `context_processing_script`, root cause sitting in `sn_aia_message`), plus a silent non-terminating stall and a script `ReferenceError`.

## Traps that will cost you hours — all found the hard way

1. **Never touch the exception object in a cross-scope `catch`.** A denial throws `ScopeAccessNotGrantedException`, and reading `.message` off it throws *again* (`Illegal access to getter method getMessage`), escaping the handler and 500-ing the whole request. Record `'DENIED'` and move on. LLD §4's "every empty/denied read is an explicit finding" contract depends on this catch surviving.
2. **The table is `syslog`. `sys_log` does not exist.** Docs are corrected; older text may not be.
3. **`sn_aia_execution_task` fields are `status` and `type`** — not `state`/`task_type` — and there is **no `agent` field**. Also has `parent` (the task tree), `order`, `output`, `execution_time_ms`, `start_time`/`end_time`, `og_task_id`, `task_dependencies`.
4. **Querying a non-existent field returns rows with it silently absent, not an error.** So a wrong field name looks like an empty result rather than a bug. Assert on field presence; never infer "no data" from an absent field.
5. **`servicenow_query` returns a narrow default field set.** Always pass an explicit `fields` list before concluding something is unreadable.
6. **Tasks are not 1:1 with tool calls** — 19 tool calls produced 27 task rows in a measured run. Don't assume the mapping.
7. **`plan.agent` is often empty.** Resolve via `usecase` too — see LLD §4.1's resolution rule.
8. **`sn_aia_tools_execution` is denied over the REST API but readable from inside a scoped script.** MCP reconnaissance understates what the tool will actually see. Don't design around a REST denial.
9. If you later wrap this as an AI Agent script tool: `input_schema` is an **array** of `{name, description, mandatory}` (a JSON-Schema object causes a *silent, never-terminating stall*); there is **no `outputs` object** — the signature is `(function(inputs) { ... return result })(inputs)`; complex inputs arrive as **JSON strings**; and never use `Now.ref()` for roles/agents/scriptIds in the AI family (phantom GUIDs, fails silently).

## How to verify it works

Build and install, then drive it from MCP against real execution records on the instance. A tool that returns a plausible-looking summary from empty data is the failure mode to guard against — the platform hands back blanks rather than errors in several places, so check that what you rendered actually came from rows that exist.

Ask before making design choices the LLD doesn't settle. Don't silently narrow the §4.1 spec — if you defer part of it (detail mode, artifact paging), say so explicitly.
