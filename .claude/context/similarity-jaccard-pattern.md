# Jaccard Similarity Pattern

A zero-dependency, **no-corpus** text-similarity technique for ServiceNow agent workflows. Jaccard
scores two texts by the fraction of their token **sets** that overlap —
`|intersection| / |union|`. It is the cheapest tier of the similarity ladder: it needs no corpus to
train, no embedding backend, and no external API, so it runs even before any of the higher tiers are
available. It is the in-loop duplicate check a Now Assist agent can call **before a write**.

> **Use Jaccard for the lexical / no-corpus / structural-attribute tier ONLY.**
> - Use it when no corpus exists yet to train TF-IDF (#97), when no embedding backend is available
>   (#100), or when you are comparing **structured attributes** (titles, tags, short labels) rather
>   than prose.
> - **Escalate to TF-IDF (#97)** when descriptions are paraphrased within a shared vocabulary domain
>   and a corpus of past records exists to weight rare terms.
> - **Escalate to neural (#100)** when vocabulary diverges completely across records (same meaning,
>   no shared tokens).
>
> Jaccard only counts **exact shared tokens** (after normalize + stem). "VPN drops intermittently"
> and "VPN disconnects frequently" share almost no tokens and score low on Jaccard even though they
> mean the same thing — that paraphrase case is exactly where you escalate to TF-IDF or neural.

## Overview

Jaccard turns each text into a **set** of stemmed tokens (membership only — counts are discarded),
then divides the size of the intersection by the size of the union. Two texts that share most of
their distinct tokens score near 1; two with little overlap score near 0. Because it discards term
frequency and corpus statistics, Jaccard is fast, stateless, and requires no setup — but it is also
the lowest-resolution backend: it catches near-identical and structurally-overlapping text, not
semantic paraphrase.

This makes Jaccard the right tool for two jobs:

1. **The no-corpus fallback** — the duplicate check that works on day one, before any corpus has been
   collected to train TF-IDF and before an embedding backend is configured.
2. **Structural-attribute dedup** — comparing titles, tags, category labels, or other short
   structured fields where shared tokens *are* the signal and there is no prose to paraphrase.

## Key Concepts

### Token SETS as plain objects (no `Set`, no `Map`)

Jaccard operates on **sets** of tokens. The Node original used the ES2015 `Set` type. On the
ServiceNow server runtime this is impossible: verified on **Zurich Patch 8 (2026-05)**, both `Set`
**and** `Map` are absent from the Rhino server runtime (`typeof Map === 'undefined'`; constructing
one throws "Map is not defined"). The Script Include therefore represents every token set as a
**plain object keyed by the token string** (`{ token: true }`); set membership is
`obj.hasOwnProperty(token)`, set size is a `for…in` count, and the union is derived arithmetically as
`|A| + |B| − |intersection|` so the union set is never materialized.

The same constraint applies to any cache: ServiceNow scripts are **stateless across transactions**, so
any in-transaction memo must be a **plain object built and discarded within the one transaction** — it
is gone by the next execution. Do not describe a cache as a `Map` (a `Map` cannot even be constructed
in this runtime), and do not assume an object cache persists between calls.

### Tokenizer (identical to TF-IDF #97)

Both texts are tokenized identically before the set math — and the tokenizer is the **exact same
`normalizeText` + `stem` pair shipped in `TfidfSimilarityUtil` (#97)**:

1. **normalizeText** — lowercase, strip punctuation (`[^\w\s]`), collapse whitespace, trim.
2. **stem** — a lightweight longest-first suffix stripper (17 suffixes; words ≤ 3 chars untouched;
   the root must remain ≥ 3 chars). Not a full Porter stemmer — just enough to fold morphological
   variants (`running`/`runs`) into the same term.

Using the identical tokenizer means the lexical (Jaccard) and statistical (TF-IDF) backends agree on
what a "term" is, so the [three-tier dedup policy](#composition-into-the-three-tier-dedup-policy-98)
can switch between them cleanly.

### The Jaccard coefficient

```
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

where `A` and `B` are the token sets of the two texts. Two empty texts are defined as identical
(`1`); a non-empty text against an empty one scores `0` (empty intersection over a non-empty union).

### Combined title + description score

`calculateCombinedSimilarity(title1, desc1, title2, desc2)` blends two Jaccard scores —
**70% title + 30% description** by default. Titles carry the strongest identity signal for
agent-generated artifacts (pain points, use cases, KB drafts), so they are weighted higher; the
description Jaccard breaks ties between artifacts with similar titles.

> The `70/30` weights — and every threshold below — are **domain-tuned starting points to
> calibrate** against your own data, **not** ServiceNow platform constants.

### Three-strategy title duplicate check

`isTitleDuplicate(t1, t2, threshold)` runs cheapest-first, short-circuiting:

1. **Exact normalized match** — the two titles normalize to the same string.
2. **Substring containment** — one normalized title contains the other (catches "VPN issue" vs
   "VPN issue on laptop").
3. **Jaccard ≥ threshold** — fall back to set overlap, default `threshold = 0.5`.

## Script Include: `JaccardSimilarityUtil`

Golden example: [`sdk-examples/jaccard-similarity.now.ts`](sdk-examples/jaccard-similarity.now.ts)
→ implementation [`sdk-examples/server/JaccardSimilarityUtil.js`](sdk-examples/server/JaccardSimilarityUtil.js).
ES5/Rhino-safe, **zero external dependencies, no corpus, no table**, scoped-app safe,
`accessibleFrom: 'public'` so an AI Agent Script Tool or a cross-scope caller can invoke it.

> **Cross-scope reach.** `accessibleFrom: 'public'` ("All application scopes") is what lets the
> Script Include be called from an AI Agent Script Tool and from other scopes; `package_private`
> would block cross-scope calls. Note that a **tool's own Caller Restriction / `caller_access`** can
> still gate reach independently of the Script Include's `accessibleFrom` — *(confirm on instance
> during build)*.

### Contract

| Method | Input | Returns |
|---|---|---|
| `normalizeText(text)` | string | `String` — lowercased, depunctuated, whitespace-collapsed |
| `stem(word)` | string | `String` — suffix-stripped root |
| `tokenize(text)` | string | `{ token: true }` — plain-object token **set** (no `Set`) |
| `calculateSimilarity(text1, text2)` | two strings | `Number` 0–1 (Jaccard; empty/empty → 1) |
| `calculateCombinedSimilarity(title1, desc1, title2, desc2)` | four strings | `Number` 0–1 (70% title + 30% desc) |
| `isTitleDuplicate(t1, t2, threshold?)` | two strings, optional number (default `0.5`) | `Boolean` |
| `getSimilarity(text1, text2)` | two strings | `{ score: Number, backend: 'lexical' }` |

`getSimilarity` returns the backend-tagged `{ score, backend: 'lexical' }` shape the
[three-tier policy](#composition-into-the-three-tier-dedup-policy-98) consumes — the policy layer
uses the `backend` tag to select the matching threshold row.

### Example: AI Agent Script Tool wrapper

Pass `{text1, text2}` in, set `outputs.result` to a JSON string out — the `sn_aia_tool` script-type
inputs / `outputs.result` contract. This is the one verified hook that lets an agent call the
Script Include as a tool before generating or writing an artifact.

```javascript
(function execute(inputs, outputs) {
  var util = new x_snc_myapp.JaccardSimilarityUtil();
  var score = util.calculateSimilarity(inputs.text1, inputs.text2);
  outputs.result = JSON.stringify({ score: score, isDuplicate: score >= 0.5, backend: 'lexical' });
})(inputs, outputs);
```

The inline `>= 0.5` boolean is a convenience default for a standalone agent check (a domain-tuned
starting point to calibrate). In the full architecture the policy layer (#98) owns the
suppress/merge/suggest decision off the returned score — the tool only returns the score.

> This wrapper performs **no record access**, so the AI Agent tool-script rule mandating
> `GlideRecordSecure` + `addUserEncodedQuery()` (`tool-script-rules.md` Rule 2) is not triggered
> here. A wrapper that queries records to assemble the candidate text **must** follow that rule —
> the underlying math Script Include, called server-side, is not itself bound by it.

## Platform constraints

| Operation | Where it is safe | Why |
|---|---|---|
| Single-pair `calculateSimilarity` / `calculateCombinedSimilarity` | Synchronous Business Rule, AI Agent Tool | Pure in-memory set math on two texts — no I/O, no corpus read |
| Compare against the last N records in a bucket | `before insert` Business Rule | Small bounded `GlideRecord` query + N set comparisons |
| Corpus-scale scan (every record against every other) | **Scheduled Job only** | A full O(n²) scan will exceed the synchronous transaction limit |

Single-pair comparison is safe synchronously in a Business Rule or an AI Agent Tool. **Corpus-scale
scans must move to a Scheduled Job**, where background quotas are far larger. The synchronous bound to
respect is the **~298-second synchronous-transaction cancel limit** (the exact governing mechanism —
e.g. a Transaction Quota Rule with a ~298s max duration versus another bound — *confirm on instance
during build*). Background jobs run under far larger quotas, which is the justification for pushing
batch work off the foreground transaction.

## The OOB gap this fills

The platform does **not** ship a calibrated, three-tier (suppress / auto-merge / suggest) dedup
**policy engine** for **agent-generated** artifacts, and OOB KB / collision dedup is advisory-only or
domain-scoped (e.g. the Change Collision Detector keys off `cmdb_ci` relationships, not free text).

Predictive Intelligence (PI) **Similarity** is a **non-licensable platform-ML capability**. The
`Similarity` `ml_capability` record is real (`active=1`, `sys_scope=global`, package *Predictive
Intelligence*, `value=similarity_trainer`). The license flags live on the **plugin**
`com.glide.platform_ml` (a `v_plugin`/`sys_package`, not `ml_capability`, field): `licensable=false`,
`license_model=none` — the non-licensable PI core. (The `capacity` model belongs to the *licensable*
PI add-ons `com.glide.platform_ml_atf` / `com.glide.platform_ml_task`, not the core.) It is **not** a
separate ITSM-Pro plugin gate, and the contractual SKU gate is not observable from instance data.
Frame the gap accordingly: this pattern **complements** PI Similarity by supplying the
agent-artifact, in-loop, no-corpus lexical tier and (with #98) the tiered-policy layer — **not** by
working around a license requirement.

## Composition into the three-tier dedup policy (#98)

Jaccard is the **lexical math layer**. It slots into the calibrated three-tier dedup policy
(**#98 — [`similarity-dedup-policy-pattern.md`](similarity-dedup-policy-pattern.md)**) as the `lexical` backend: the
**policy layer owns all thresholds and the suppress / auto-merge / suggest decision**; the comparator
only returns `{ score, backend: 'lexical' }`. The math layer and the policy layer are always separate
concerns.

> **The canonical threshold table lives in the #98 keystone, not here.** This doc deliberately does
> **not** restate the suppress/auto-merge/suggest numbers, so there is one source of truth and the
> backend docs cannot drift. The policy selects the threshold **row** that matches the returned
> `backend` tag — Jaccard's lexical scores run lower than TF-IDF/neural cosine scores, so it gets its
> own lower row. See `similarity-dedup-policy-pattern.md` (#98) for the calibrated burst / L3 / L2 /
> cross-type values, all labelled tunable defaults.

Relative to the other backends:

- **Jaccard (this doc, #96)** — lexical, no corpus, cheapest, lowest resolution. The no-corpus
  fallback and structural-attribute tier.
- **TF-IDF (#97)** — corpus-aware, no API/license; the intermediate quality tier for paraphrase
  within a shared vocabulary.
- **Neural (#100)** — highest quality, semantic; use when vocabulary diverges. Native-first via AI Search RAG embeddings.
- **Mermaid structural (#99)** — the diagram-artifact counterpart (inlines the same Jaccard set math).

## Best Practices

1. **Use Jaccard only for the lexical / no-corpus / structural-attribute tier.** For paraphrase
   within a shared vocabulary escalate to TF-IDF (#97); for divergent vocabulary escalate to neural
   (#100).
2. **Keep candidate sets small.** Single-pair and last-N-in-bucket comparisons are fine synchronously;
   push corpus-scale O(n²) scans to a Scheduled Job (the ~298s synchronous bound).
3. **Calibrate the weights and thresholds.** The `70/30` title/desc weights and any threshold are
   domain-tuned starting points, not constants — tune them against your own data.
4. **Let the policy layer own the decision.** Call the util only for the score; keep the
   suppress / merge / suggest logic in the #98 policy tier so all backends behave consistently.

## Common Issues

| Issue | Cause | Solution |
|---|---|---|
| `Map is not defined` / `Set is not defined` at runtime | ES2015 collections reintroduced into the Script Include | Use plain objects keyed by the token string — `Set`/`Map` are absent on the Rhino server runtime (Zurich P8) |
| Paraphrases scored near 0 | Texts mean the same thing but share few exact tokens | Expected — escalate to TF-IDF (#97) or neural (#100); Jaccard is lexical only |
| Everything scores high | Comparing very short titles that share generic tokens | Use `calculateCombinedSimilarity` to factor in the description; raise the threshold |
| Slow / transaction timeout | O(n²) corpus scan run inline | Move the scan to a Scheduled Job; bound the candidate set with an indexed `GlideRecord` query |

## Related Resources

- [`sdk-examples/jaccard-similarity.now.ts`](sdk-examples/jaccard-similarity.now.ts) — golden `ScriptInclude` example (+ inline AI Agent Script Tool wrapper)
- [`sdk-examples/server/JaccardSimilarityUtil.js`](sdk-examples/server/JaccardSimilarityUtil.js) — ES5/Rhino-safe implementation (plain-object token sets)
- `similarity-dedup-policy-pattern.md` — three-tier dedup policy (#98); the canonical threshold home and composition target
- `similarity-tfidf-pattern.md` — corpus-aware TF-IDF text dedup (#97); shares this tokenizer; the paraphrase-within-vocabulary tier
- `similarity-neural-embedding-pattern.md` — neural embeddings (#100); the divergent-vocabulary tier
- `similarity-mermaid-structural-pattern.md` — structural dedup of Mermaid diagrams (#99); inlines the same Jaccard set math
- `tool-script-rules.md` Rule 2 — GlideRecordSecure + addUserEncodedQuery() mandate for AI Agent tool scripts that query records
- Source port: `Now-AI-Foundry/tool-foundry-whiteboard` `server/src/services/dedup/similarity.ts`
