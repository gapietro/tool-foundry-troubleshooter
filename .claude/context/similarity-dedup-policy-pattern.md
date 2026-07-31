# Similarity Dedup Policy Pattern (Three-Tier Keystone)

**This is a server-side dedup *architecture* — a before-insert Business Rule, an after-insert
Business Rule, and a Scheduled Job — exposed to a Now Assist agent ONLY via an optional AI Agent
Script Tool wrapper. It is NOT agent configuration, and it is NOT a single skill or prompt.** The
backend similarity *math* ships separately (Jaccard #96, TF-IDF #97, Mermaid structural #99); this
doc is the **single canonical policy layer** that decides, for a given score and backend, whether to
suppress, auto-merge, or suggest — and on which platform trigger each runs.

> **Why this doc is the keystone.** The three backend docs each used to reproduce their own
> three-tier pipeline and threshold table, and they had already drifted. To stop that drift, **every
> suppress / auto-merge / suggest threshold lives here and only here.** The backend docs return a
> `{ score, backend }` tuple and defer to this table; they do not restate the numbers.

## Verified platform facts (Zurich Patch 8, 2026-05)

All confirmed read-only on the instance; anything not in this set is marked
*(confirm on instance during build)*.

- **AI Agent Script Tool contract** — `sn_aia_tool` exists (scope `sn_aia`, extends `sys_metadata`);
  `type=script` is a valid choice; the tool exposes an inputs/outputs contract (e.g. `text1`/`text2`
  in, `outputs.result` JSON out), so an agent can invoke a custom Script Include via the tool
  wrapper. **This is the only verified Now Assist hook into this architecture** — it is server-side
  dedup plumbing, not agent configuration.
- **Burst gate = before-insert Business Rule** — `sys_script` supports `when=before` +
  `action_insert=true`; a before-insert BR can call `setAbortAction(true)` to suppress a write
  synchronously *before* it is persisted.
- **Auto-merge / suggest = after-insert Business Rule** — `sys_script` supports `when=after` +
  `action_insert=true`. If Flow Designer is used, the correct shape is **"after-insert BR → a Flow
  with a Created trigger, or a Subflow invoked by that flow/BR"** — a Subflow does **not** itself
  carry a record-creation trigger.
- **Corpus / cross-type scan = Scheduled Job on `sysauto_script`** — the table `sysauto_script`
  ("Scheduled Script Execution") runs async via `sys_trigger` and carries `run_type`
  (daily/weekly/periodically/on_demand). The correct table is **`sysauto_script`**; there is **no
  `ScheduledScript` class**.
- **~298s synchronous cap** — `sysrule_quota` row `name="UI Transactions"` has `max_duration=298`
  (seconds), governing foreground form/xmlhttp/report transactions. Background jobs run under far
  larger quotas — the justification for pushing corpus-scale scans to a Scheduled Job.
- **PI Similarity is non-licensable platform ML** — the `ml_capability` "Similarity"
  (`value=similarity_trainer`, active, scope global) is part of Predictive Intelligence. The license
  flags live on the **plugin** `com.glide.platform_ml` (a `v_plugin`/`sys_package` field, not an
  `ml_capability` field): `licensable=false`, `license_model=none` — the `capacity` model belongs to
  the *licensable* PI add-ons (`com.glide.platform_ml_atf` / `_task`), not the core. This architecture **complements** PI
  Similarity; the gap it fills is the agent-artifact tiered-*policy* layer, **not** raw similarity
  scoring, and there is **no** ITSM-Pro license requirement to claim.
- **Tool-script security rule** — per `tool-script-rules.md` Rule 2, AI Agent **tool scripts** must
  use `GlideRecordSecure` + `addUserEncodedQuery()` (field-level + row-level ACLs, both required).
  This binds the **tool-wrapper script only** — not the underlying math Script Include (the repo's
  own Script Include golden examples use plain `GlideRecord`).

## Architecture at a glance

```
agent generates artifact
        │
        ▼
  (optional) AI Agent Script Tool wrapper  ── GlideRecordSecure + addUserEncodedQuery()
        │   returns { score, backend }
        ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 1  Burst gate     before-insert BR   setAbortAction(true)│  synchronous, pre-write
│ TIER 2  L3 auto-merge  after-insert BR  (→ Flow w/ Created    │  synchronous post-write
│                         trigger, or Subflow invoked by it)    │
│ TIER 3  L2 suggest     after-insert BR   write Suggestion rec │  synchronous post-write
└─────────────────────────────────────────────────────────────┘
        │
        ▼
  Cross-type / corpus scan   Scheduled Job on sysauto_script    async, large quota
```

The **math layer** (Jaccard/TF-IDF/neural/Mermaid) and this **policy layer** are always separate
concerns: the math returns `{ score, backend }`; the policy picks the threshold row by `backend` and
makes the suppress/merge/suggest decision.

## The three tiers

### Tier 1 — Burst gate (before-insert Business Rule)

Runs as a **before-insert Business Rule** (`when=before`, `action_insert=true`). It compares the
incoming artifact against the **last N records in the same type bucket** (e.g. same generating run /
session `sys_id`, indexed query) and, if the score clears the **burst** threshold, calls
`setAbortAction(true)` to **suppress the write synchronously before it is persisted**. This catches a
chatty agent emitting the same artifact repeatedly inside one extraction run, without ever creating
the duplicate row.

### Tier 2 — L3 auto-merge (after-insert Business Rule)

Runs as an **after-insert Business Rule** (`when=after`, `action_insert=true`), optionally handing
off to **a Flow with a Created trigger, or a Subflow invoked by that flow/BR** (a Subflow is *not*
triggered directly on record creation). At **`≥ L3`** it treats the new record as a duplicate of an
existing one: update / enrich the existing record and discard the new one (or relate-and-redirect).

> **`[PARTIAL]`-prefixed artifacts** (incompletely extracted, flagged with a `[PARTIAL]` marker)
> use a relaxed auto-merge bar of **`min(L3, 0.6)`** — a partial extraction that strongly resembles
> a fuller existing record should fold into it rather than spawn a near-empty duplicate.

### Tier 3 — L2 suggest (after-insert Business Rule)

Runs as an **after-insert Business Rule**. When the score falls in the band **`[L2_LOW, L3)`**, the
record is *likely* a duplicate but not confidently so: write a **"Similarity Suggestion" record**
linking the new and matched records for **human review** — no auto-merge. This is the
human-in-the-loop tier.

## Cross-type / corpus dedup (Scheduled Job on `sysauto_script`)

Comparing **every** artifact against **every** other (cross-type, full-corpus) is an O(n²) scan that
will exceed the **~298-second synchronous cap** (`sysrule_quota` "UI Transactions",
`max_duration=298`). It therefore runs **only as a Scheduled Job on the `sysauto_script` table**
(async via `sys_trigger`, far larger background quota), at a **lower threshold (0.40 default)** to
catch looser cross-type relationships that the per-insert tiers — scoped to one type bucket — never
compare. There is no `ScheduledScript` class; the artifact is a `sysauto_script` row.

## Threshold table — tunable defaults imported from `merge-service.ts`

> **Every number in this table is a default imported verbatim from the external Node app's
> `merge-service.ts`, NOT a ServiceNow-validated constant.** They are starting points for
> calibration against your own corpus, not platform guarantees. **How to recalibrate:** label a few
> hundred known duplicate / non-duplicate pairs from your data, score them with the active backend,
> then set L3 just above the score where false-merges begin and `L2_LOW` where genuine pairs start
> appearing — per backend, because lexical scores run systematically lower than cosine scores.

The **policy layer selects the row by the `backend` tag** returned from the math layer.

| Backend tag | L3 auto-merge | Burst gate | L2 suggest band `[L2_LOW, L3)` | Notes |
|---|---|---|---|---|
| `neural` (#100) | `0.85` | `0.70` | `[0.65, 0.85)` | Calibrated cosine on semantic embeddings — highest resolution |
| `tfidf` (#97) | `0.85` | `0.70` | `[0.65, 0.85)` | Same cosine semantics as neural (both produce calibrated cosine scores) |
| `lexical` (Jaccard, #96) | *lower row — calibrate* | *lower row — calibrate* | *lower row — calibrate* | Jaccard set-overlap scores run **systematically lower** than cosine; do not reuse the cosine row. Start lower and tune against labelled pairs |
| `mermaid-structural` (#99) | `0.80` | `0.80` (use L3) | `[0.60, 0.80)` | Weighted Jaccard over graph nodes/edges; structural, not textual |
| *cross-type (any backend)* | — | — | — | Batch-only at **`0.40`** in the Scheduled Job; flags looser cross-type matches for review |
| `[PARTIAL]` artifacts (any backend) | `min(L3, 0.6)` | — | — | Relaxed auto-merge bar so partial extractions fold into fuller records |

> The `lexical` (Jaccard) row is intentionally left as "calibrate" rather than a fixed number: the
> external app does not ship a single validated lexical row, and Jaccard's scale is corpus-dependent.
> Treat the cosine rows as the upper reference and tune the lexical thresholds **down** from there.

## Backend-tag selector

The math methods all return the same tuple shape:

```javascript
{ score: 0.83, backend: 'neural' }   // or 'tfidf' | 'lexical' | 'mermaid-structural'
```

The policy layer reads `backend`, looks up the matching threshold row above, and applies the
suppress / auto-merge / suggest decision. This keeps **math and policy as separate concerns**: adding
a new backend means adding a row here, not editing every Business Rule, and swapping backends for a
given artifact type never changes the decision logic.

The three tiers run in **different triggers**, so the decision is **split by trigger phase** — do
not collapse them into one function. The before-insert BR checks only the burst gate; the after-insert
BR checks auto-merge then suggest. (Folding `burst` into the same chain as `l3`/`l2_low` would shrink
the suggest band to `[L2_LOW, burst)` and return `burst_suppress` after the row already exists, where
suppressing-before-write is impossible.)

```javascript
// Policy decision (illustrative) — runs inside the BR / tool wrapper after scoring.

// Tier 1 — before-insert BR: burst gate only. Suppresses the write before it happens.
function decideBeforeInsert(result) {
  var row = THRESHOLDS[result.backend];          // selected by backend tag
  if (result.score >= row.burst) return 'burst_suppress';
  return 'allow';                                // let the insert proceed
}

// Tiers 2 & 3 — after-insert BR: the row already exists, so burst is not an option here.
function decideAfterInsert(result, isPartial) {
  var row = THRESHOLDS[result.backend];
  var l3 = isPartial ? Math.min(row.l3, 0.6) : row.l3;
  if (result.score >= l3)         return 'auto_merge';   // Tier 2 — [L3, 1]
  if (result.score >= row.l2_low) return 'suggest';      // Tier 3 — [L2_LOW, L3)
  return 'store';
}
```

## AI Agent tool-wrapper example

The **optional** path that lets an agent score a candidate *before* writing. Because this wrapper
**queries records** (to assemble the candidate text it compares against), it is an AI Agent tool
script and **must** use `GlideRecordSecure` + `addUserEncodedQuery()` per `tool-script-rules.md`
Rule 2 — field-level *and* row-level ACLs, both required:

```javascript
(function execute(inputs, outputs) {
  // Tool-script rule: GlideRecordSecure + addUserEncodedQuery() are BOTH mandatory here
  // because this wrapper reads records. (The underlying math Script Include, called below,
  // is server-side and is NOT bound by the tool-script rule — the repo's TfidfSimilarityUtil /
  // JaccardSimilarityUtil examples use plain GlideRecord.)
  var candidates = [];
  var gr = new GlideRecordSecure(inputs.table);
  gr.addUserEncodedQuery(inputs.encodedQuery || '');   // row-level ACLs
  gr.setLimit(20);
  gr.query();
  while (gr.next()) {
    candidates.push(gr.getValue('short_description') + ' ' + gr.getValue('description'));
  }

  // Math layer — server-side Script Include, returns { score, backend }. Not a tool script.
  var util = new x_snc_myapp.TfidfSimilarityUtil();
  var best = { score: 0, backend: 'tfidf' };
  var i;
  for (i = 0; i < candidates.length; i++) {
    var s = util.computeTfidfSimilarity(inputs.text, candidates[i]);
    if (s > best.score) { best.score = s; }
  }
  outputs.result = JSON.stringify(best);   // policy layer (BR/Scheduled Job) owns the decision
})(inputs, outputs);
```

> **Boundary restated:** the **tool-wrapper** script is bound by Rule 2 (GlideRecordSecure +
> addUserEncodedQuery); the **math Script Include** it calls is not. Keep record access in the
> wrapper and pure math in the Script Include.

## The OOB gap this fills

The platform ships PI **Similarity** (non-licensable platform ML — plugin `com.glide.platform_ml`,
`licensable=false`, `license_model=none`; **not** an ITSM-Pro plugin gate) and advisory-only / domain-scoped
OOB dedup (e.g. KB top-N similar, the Change Collision Detector keyed on `cmdb_ci`). What it does
**not** ship is a **calibrated, three-tier suppress/auto-merge/suggest policy engine for
agent-generated artifacts**, exposed to an agent through the one verified hook (an AI Agent Script
Tool wrapper). This architecture **complements** PI Similarity by supplying exactly that policy layer
— it is not a workaround for a license.

## Best Practices

1. **Keep all thresholds here.** Backend docs return `{ score, backend }` and defer to this table —
   never restate numbers in a backend doc (that is what caused the drift this keystone fixes).
2. **Calibrate per backend and per corpus.** The numbers are external defaults; lexical scores in
   particular must be tuned down from the cosine rows.
3. **Right trigger for the right tier.** Burst = before-insert BR with `setAbortAction(true)`;
   auto-merge/suggest = after-insert BR (→ Flow with a Created trigger, or a Subflow invoked by it,
   never a Subflow triggered directly on create); cross-type = Scheduled Job on `sysauto_script`.
4. **Push O(n²) scans off the foreground transaction** — the ~298s "UI Transactions" cap makes
   corpus-scale scans a Scheduled Job concern.
5. **Honor the tool-script rule in the wrapper only.** GlideRecordSecure + addUserEncodedQuery() in
   the tool wrapper; plain math in the Script Include.

## Related Resources

- `similarity-jaccard-pattern.md` — Jaccard lexical backend (#96); `backend: 'lexical'`
- `similarity-tfidf-pattern.md` — TF-IDF cosine backend (#97); `backend: 'tfidf'`
- `similarity-neural-embedding-pattern.md` — neural embeddings backend (#100); `backend: 'neural'`
- `similarity-mermaid-structural-pattern.md` — Mermaid structural backend (#99); `backend: 'mermaid-structural'`
- `tool-script-rules.md` Rule 2 — GlideRecordSecure + addUserEncodedQuery() mandate for AI Agent tool scripts
- Source port: `Now-AI-Foundry/tool-foundry-whiteboard` `server/src/services/dedup/merge-service.ts` (threshold defaults)
