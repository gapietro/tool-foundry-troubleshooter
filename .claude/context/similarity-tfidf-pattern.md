# TF-IDF Cosine Similarity Pattern

A corpus-aware text-similarity technique for ServiceNow agent workflows. TF-IDF (term
frequency–inverse document frequency) scores two texts by the **weighted vocabulary they share**,
where rare terms count more than common ones. It is higher quality than lexical Jaccard, needs **no
external API and no LLM/model call** (pure deterministic in-script compute), and is the natural
intermediate tier between Jaccard (lexical) and neural embeddings.

> **Use TF-IDF when:** descriptions are paraphrased (same meaning, different words within a shared
> vocabulary domain), a corpus of past records exists to train IDF weights, you want a lightweight
> fully deterministic check with no model/capacity dependency, and you need synchronous single-pair scoring.
> **Do not use TF-IDF when:** vocabulary diverges completely across records (natural-language with
> no shared domain terms) — use neural (#100). For structural/attribute dedup — use Jaccard (#96).

## Overview

TF-IDF turns each text into a sparse vector over its stemmed tokens. Each term's weight is its
normalized frequency in the text (TF) multiplied by how rare it is across the corpus (IDF). Two
texts are compared by the cosine of the angle between their vectors — 1.0 is identical direction,
0 is no shared weighted vocabulary. Because IDF down-weights terms that appear in many documents
("the", "issue", "error") and up-weights distinctive domain terms ("vpn", "kerberos", "smartcard"),
TF-IDF catches paraphrased duplicates that share meaning but few exact tokens — e.g. *"VPN drops
intermittently"* vs *"VPN disconnects frequently"* — which lexical overlap alone would miss.

The crucial dependency is the **corpus**: IDF weights are only meaningful once the corpus has been
populated with representative documents. With an empty corpus every IDF collapses to the same
constant and the score degrades to plain term-frequency cosine.

## Key Concepts

### The IDF formula (smooth variant)

This pattern uses the **scikit-learn default smooth IDF**:

```
idf(term) = log( (N + 1) / (df + 1) ) + 1
```

- `N` — total documents in the corpus
- `df` — number of corpus documents containing the term
- The `+1` smoothing in numerator and denominator prevents division by zero for unseen terms and
  keeps every IDF strictly positive (a term in every document still contributes `log(1)+1 = 1`).

The term weight in a document's vector is `tf(term) × idf(term)`, where `tf` is the term's count
divided by the document's token count (normalized so long and short documents are comparable).

### Tokenizer (shared with Jaccard #96)

Both texts are tokenized identically before vectorizing:

1. **normalizeText** — lowercase, strip punctuation (`[^\w\s]`), collapse whitespace, trim.
2. **stem** — a lightweight suffix stripper (17 suffixes, longest-first; words ≤ 3 chars untouched,
   root must remain ≥ 3 chars). Not a full Porter stemmer — just enough to fold `running`/`runs` →
   `runn`/`run` family so morphological variants don't read as different terms.

Using the same tokenizer as Jaccard means the two backends agree on what a "term" is, so the
[three-tier policy](#composition-with-the-three-tier-dedup-policy-98) can switch between them cleanly.

### Corpus state: a table, not in-memory (the key platform change)

The Node original held the corpus in a process-memory `Map` that lived for one session. **ServiceNow
scripts are stateless across transactions** — a `Map` built in one Business Rule execution is gone by
the next. So the corpus IDF state must be **persisted in a table** and read back on each scoring call.

| Column | Type | Purpose |
|---|---|---|
| `term` | String (index recommended) | Stemmed token |
| `document_frequency` | Integer | Number of corpus documents containing this term |

**Corpus size N** is stored on a **reserved sentinel row** (`term = '__corpus_size__'`), *not* as a
`total_documents` column repeated on every row. Denormalizing N onto every row (as a naive port would)
means each `addDocument` has to rewrite every term row to bump N — an update storm that scales with
vocabulary size. The sentinel-row approach makes `addDocument` touch only the rows for that document's
terms plus one counter row. (If you prefer, N can equally live in a system property; the sentinel row
keeps the whole corpus in one table.)

Reading stats for a scoring call is cheap: one query for the sentinel row (N) plus one `term IN (...)`
query for just the vocabulary of the two texts being compared. Index the `term` column so both are
fast at corpus scale.

### Cosine similarity

```
cosine(A, B) = (A · B) / (‖A‖ · ‖B‖)
```

Vectors are sparse (`{term: weight}`); the dot product sums over shared terms only. Returns `0` when
either vector has zero magnitude. Two empty texts are defined as identical (`1`); one empty and one
non-empty is `0`.

## Script Include: `TfidfSimilarityUtil`

Golden example: [`sdk-examples/tfidf-similarity.now.ts`](sdk-examples/tfidf-similarity.now.ts)
→ implementation [`sdk-examples/server/TfidfSimilarityUtil.js`](sdk-examples/server/TfidfSimilarityUtil.js).
ES5/Rhino-safe, zero external dependencies, scoped-app safe.

### Contract

| Method | Input | Returns |
|---|---|---|
| `addDocument(text)` | string | — (registers text in the corpus / IDF table) |
| `computeTfidfVector(text, stats?)` | string, optional `{N, df}` | `{ term: weight }` |
| `cosineSimilarity(vecA, vecB)` | two `{term: weight}` objects | `Number` 0–1 |
| `computeTfidfSimilarity(text1, text2, stats?)` | two strings, optional stats | `Number` 0–1 |
| `registerArtifact(key, text)` | string, string | — (addDocument + cache text by key) |
| `getSimilarity(key1, key2)` | two keys | `{ score: Number, backend: 'tfidf' }` |
| `rebuildCorpus(sourceTable, encodedQuery, textFields)` | string, string, string[] | `Number` documents processed |

> The optional `stats` argument (`{ N, df: { term: docFrequency } }`) lets a caller inject corpus
> statistics — useful to score against a pre-loaded snapshot, and what makes the math unit-testable
> without a live corpus table.

### Corpus management pattern

**Populate the corpus before scoring.** Two ways:

1. **Incremental** — call `addDocument(text)` (or `registerArtifact(key, text)`) as each record is
   created. Good for steadily growing corpora.
2. **Batch rebuild** — call `rebuildCorpus(sourceTable, encodedQuery, textFields)` from a Scheduled
   Job to recompute IDF from scratch over a bounded record set. Good for periodic refresh and for
   seeding from history.

### Example: score a candidate against an existing record

```javascript
var util = new TfidfSimilarityUtil();

// Corpus already built (incrementally or via the rebuild job).
var score = util.computeTfidfSimilarity(
  current.short_description + ' ' + current.description,
  existingGr.getValue('short_description') + ' ' + existingGr.getValue('description')
);

if (score >= 0.85) {
  // Auto-merge / redirect to existing record.
} else if (score >= 0.65) {
  // Surface as an L2 suggestion for human review.
}
```

### Example: AI Agent Script Tool wrapper

```javascript
(function execute(inputs, outputs) {
  var util = new TfidfSimilarityUtil();
  var score = util.computeTfidfSimilarity(inputs.text1, inputs.text2);
  outputs.result = JSON.stringify({ score: score, isDuplicate: score >= 0.85, backend: 'tfidf' });
})(inputs, outputs);
```

## Scheduled Job: batch corpus build

Corpus-scale scans must run in a **Scheduled Job**, never inline in a synchronous Business Rule — a
full-corpus rebuild can easily exceed the 298-second transaction limit. The golden example defines a
weekly job; the core is one call:

```javascript
(function rebuildTfidfCorpus() {
  try {
    var util = new TfidfSimilarityUtil();
    // Seed IDF from the last 90 days of resolved incidents (state=6 = Resolved).
    var encodedQuery = 'sys_updated_on>=javascript:gs.daysAgoStart(90)^state=6';
    var count = util.rebuildCorpus('incident', encodedQuery, ['short_description', 'description']);
    gs.info('[TF-IDF] Weekly corpus rebuild complete: ' + count + ' incidents');
  } catch (e) {
    gs.error('[TF-IDF] Corpus rebuild failed: ' + e.message);
  }
})();
```

`rebuildCorpus` clears the existing corpus rows, then registers each matching record's concatenated
text fields. Scope the `encodedQuery` to a representative, bounded window (e.g. 90 days, one category,
one knowledge base) — IDF should reflect the population you actually dedup against, and a bounded
corpus keeps both the rebuild and per-query reads fast.

## Platform constraints

| Operation | Where it is safe | Why |
|---|---|---|
| Single-pair `computeTfidfSimilarity` | Synchronous Business Rule, AI Agent Tool | Reads N + the two texts' vocabulary only — small, indexed |
| `addDocument` on insert | `after insert` Business Rule | One counter row + this document's term rows |
| `rebuildCorpus` / corpus-scale scan | **Scheduled Job only** | Full-table delete + full-source scan; will blow the 298s transaction limit inline |

Always index the `term` column. Concatenate `short_description` + `description` for richer vocabulary
than title alone.

## Threshold guidance

When TF-IDF is the active backend, the policy layer selects the **`tfidf` threshold row**. **The
canonical threshold table now lives in the three-tier dedup policy keystone
([`similarity-dedup-policy-pattern.md`](similarity-dedup-policy-pattern.md), #98)** — this doc no
longer restates the suppress / auto-merge / suggest numbers, so there is a single source of truth and
the backend docs cannot drift. The `tfidf` row uses the same calibrated-cosine semantics as `neural`
(Jaccard's lexical scores run lower and use a separate row); every value there is labelled a tunable
default imported from the external `merge-service.ts`, not a ServiceNow constant. Tighten per use case
(e.g. a stricter KB-publish hard-block) by overriding the row in the policy layer.

## Use Cases

### 1. Incident duplicate prevention at insert — lightweight deterministic alternative

| Attribute | Value |
|---|---|
| **Table** | `incident` |
| **Trigger** | Business Rule `before insert`; or AI Agent Tool before creating an incident |
| **When to prefer this** | Predictive Intelligence Similarity is a separate platform ML capability (non-licensable platform ML — the core plugin `com.glide.platform_ml` is `licensable=false`, `license_model=none`; the `capacity` model applies only to the *licensable* PI add-ons, not the core — and it is a solution that must be trained/retrained asynchronously). TF-IDF trained on your own incident corpus is a lightweight, fully deterministic in-script alternative with no PI-model or async-training dependency. "VPN drops intermittently" and "VPN disconnects frequently" share few exact tokens but score high TF-IDF similarity via shared weighted domain terms. |
| **Thresholds** | `≥ 0.85` → redirect to existing incident; `0.70–0.85` → surface to Tier 1 triage |
| **Corpus** | Seed IDF from the last 90 days of closed incidents per category; rebuild weekly via Scheduled Job |

### 2. KB duplicate hard-block at publish time

| Attribute | Value |
|---|---|
| **Table** | `kb_knowledge` |
| **Trigger** | Business Rule `before update` when `workflow_state` → `published`; or client-side advisory while authoring |
| **OOB gap filled** | OOB KB duplicate detection is advisory-only (top-5 similar shown) and **does not block publication**. TF-IDF enables a configurable threshold-based hard block independent of PI / Now Assist licensing — the most direct gap OOB does not fill. |
| **Thresholds** | `≥ 0.95` → block publish (likely exact duplicate); `0.80–0.95` → require author acknowledgment |
| **Corpus** | All published articles in the same knowledge base; small enough to rebuild on each publish |

### 3. Semantic change collision when CI is unknown

| Attribute | Value |
|---|---|
| **Table** | `change_request` |
| **Trigger** | Business Rule `before insert/update` when `cmdb_ci` is null |
| **OOB gap filled** | The OOB Collision Detector works **only on `task_ci` / `cmdb_ci` relationships** — silent when the CI field is empty. TF-IDF on `short_description` + `description` against open changes in the same window catches description-level overlap the OOB tool misses. |
| **Thresholds** | `≥ 0.75` → flag for CAB review with the matching change number |
| **Corpus** | Open + recently approved changes within the same change window (± 48h); small bounded corpus — rebuild on each query, no Scheduled Job needed |

## Composition with the three-tier dedup policy (#98)

TF-IDF is the **math layer** for text artifacts when no neural backend is licensed. It slots into the
[three-tier dedup policy](similarity-dedup-policy-pattern.md) (`#98`) as the `tfidf` backend: the
policy layer owns the thresholds and the suppress / merge / suggest decision; the comparator only
returns `{score, backend: 'tfidf'}`. High-volume insert scenarios (use cases 1 and 2) apply the full
Burst Gate → L3 → L2 pipeline with the `tfidf` threshold row (see the keystone's threshold table —
this doc does not restate the numbers). Lower-volume single-pass scenarios (use case 3) need only
L3/L2 — no burst gate.

Relative to the other backends:

- **Jaccard (#96)** — lexical, no corpus needed; cheaper but lower quality. Use as the no-corpus
  fallback or for structural/attribute dedup.
- **TF-IDF (this doc)** — corpus-aware, no API/license; the intermediate quality tier.
- **Neural (#100)** — highest quality, requires embeddings (API or platform model). Use when
  vocabulary diverges and a license is available.

The math layer and the policy layer are always separate concerns.

## Best Practices

1. **Populate the corpus first.** Similarity is meaningless against an empty corpus — seed it via
   `rebuildCorpus` before relying on scores.
2. **Scope the corpus to what you dedup against.** Per category, per knowledge base, per change
   window. A focused corpus gives sharper IDF weights and faster queries.
3. **Index the `term` column** and keep `addDocument` to `after insert`; push rebuilds to a Scheduled
   Job.
4. **Let the policy layer own the decision.** Call the util only for the score; keep
   suppress / merge / suggest logic in the policy tier so all backends behave consistently.

## Common Issues

| Issue | Cause | Solution |
|---|---|---|
| Everything scores near 0 or equal | Corpus empty or not populated | Run `rebuildCorpus`; confirm the sentinel `__corpus_size__` row exists with N > 0 |
| Paraphrases not detected | Corpus too small / wrong domain to weight rare terms | Seed a larger, domain-representative corpus |
| Slow / transaction timeout | `rebuildCorpus` or large scan run inline | Move to a Scheduled Job; add the `term` index; bound the corpus query |
| Scores drift over time | Corpus stale relative to current language | Rebuild on a schedule (weekly for incidents; on publish for KB) |

## Related Resources

- [`sdk-examples/tfidf-similarity.now.ts`](sdk-examples/tfidf-similarity.now.ts) — golden example (2 tables + Script Include + Scheduled Job)
- [`sdk-examples/server/TfidfSimilarityUtil.js`](sdk-examples/server/TfidfSimilarityUtil.js) — ES5/Rhino-safe implementation
- `similarity-dedup-policy-pattern.md` — three-tier dedup policy (`#98`); composition target
- `similarity-jaccard-pattern.md` — lexical Jaccard (`#96`); shared tokenizer, no-corpus fallback
- Source port: `Now-AI-Foundry/tool-foundry-whiteboard` `server/src/services/dedup/embedding-similarity.ts`
