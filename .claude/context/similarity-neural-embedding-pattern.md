# Neural Embedding Similarity Pattern (Native-First)

The **semantic** tier of the similarity ladder — Jaccard (#96, lexical) → TF-IDF (#97, statistical) →
**neural (this doc, semantic)**. Neural embeddings catch duplicates that *mean* the same thing even
when their **vocabulary diverges completely** (few or no shared tokens) — the case the lexical and
statistical tiers cannot reach.

> **Lead with the native, no-egress path.** On **Zurich Patch 8 (2026-05)** AI Search RAG can surface
> raw embedding vectors and semantic-similarity scores to server scripts — but as **accessors on the
> search results a retrieval returns** (`response.getSearchResults()[i].getSemanticEmbedding()`), not
> as methods on `sn_ais_rag.RAGRetrievalDefinitionUtil` itself. Keeping the neural tier native-first
> with no off-instance egress is the goal; **(confirm on instance during build)** the end-to-end flow
> below — in particular whether two *arbitrary free-text strings* can be embedded on demand through
> this surface (the accessors describe *retrieved/indexed* documents). The external embedding-API call
> (`RESTMessageV2` → a hosted model) is a **governed fallback only**, foregrounded with a data-egress
> warning for regulated tenants.

## The native path (primary, no egress)

**On Zurich Patch 8, 2026-05**, a `new sn_ais_rag.RAGRetrievalDefinitionUtil()` instance exposes
`execute`, `getSemanticIndexes`, `getChunkSize`, … — **not** `getSemanticEmbedding()` /
`getSemanticSimilarity()` directly (`typeof instance.getSemanticEmbedding === 'undefined'`). Those
names are **accessors on the search-result objects** a RAG retrieval returns, not on the util:

- **`response.getSearchResults()[i].getSemanticEmbedding()`** — the raw semantic-index embedding
  vector for a retrieved result.
- **`response.getSearchResults()[i].getSemanticSimilarity()`** — a semantic-similarity score for a
  retrieved result.
- **`chunkInfo.getSemanticSimilarityScore()`** — a per-chunk score.

So the real shape is **run a RAG retrieval → iterate `response.getSearchResults()` → read each
result's `.getSemanticEmbedding()` / `.getSemanticSimilarity()`.** These accessors describe
**retrieved/indexed** documents — i.e. what the query returned. This still runs **on-instance with no
off-instance egress**, but it is not, as written, an "embed two arbitrary strings on demand" call.

> **(confirm on instance during build) before treating this as the primary path:**
> - **The end-to-end "two arbitrary texts → vectors → cosine" flow.** The accessors above sit on
>   *retrieved* results; whether arbitrary free-text input can be embedded on demand through this
>   surface must be re-validated against a configured semantic index. If it cannot, the native-first
>   framing needs rethinking (the cache table and cosine reuse below stay valid once the vectors come
>   from a real source).
> - Any *additional* method name such as `getSemanticSimilarityScore()`, and the request-builder
>   surface `sn_search.RAGRetrievalRequest` + `RAGRetrievalSemanticConfiguration().embeddingModelId(...)`
>   `.semanticIndexNames(...)`.
> - The embedding **model identity, source table, and token limit** (e.g. an "E5"/`E5FT` model in
>   `ais_semantic_embedding_model`), **and the vector dimensionality** — `~1024-dim` is stated below
>   but could not be independently confirmed without a live retrieval against a configured index.

### Verdict table — where to get vectors / scores

| Source | Use it for | Status |
|---|---|---|
| RAG **search-result** accessors — `response.getSearchResults()[i].getSemanticEmbedding()` / `.getSemanticSimilarity()` | **Primary (native, no egress).** Raw vectors and semantic scores from server script — accessors on *retrieved* RAG results, not on `RAGRetrievalDefinitionUtil` | *Confirm on instance during build:* the call shape, whether arbitrary free-text pairs are embeddable on demand, the request-builder surface, and the `~1024-dim` dimensionality |
| PI (Predictive Intelligence) record-to-record similarity | "Records similar to **this record**" — record-shaped, not arbitrary free-text pairs | **Non-licensable platform ML, NOT ITSM-Pro gated** (verified). Exact PI API/namespace — e.g. `sn_ml.SimilaritySolutionStore`, `com.glide.platform_ml`, the `licensable=false` flag — and "Workflow Similarity" specifics (`workflow_similarity_trainer`, `MLPredictor`, `CAPABILITY_SIMILARITY_WORKFLOW`, solution counts): *confirm on instance during build* |
| `AISASearchUtil` | **Steer away** for this use case — returns ranked records, not scores/vectors | *Confirm on instance during build*; regardless, use `RAGRetrievalDefinitionUtil` for embeddings/scores |
| User-authored Skill Kit skill emitting a vector | **Steer away** — tool/skill outputs follow a text/json result contract, so a vector-out skill is not expected | The categorical "no" and any capability counts: *confirm on instance during build* |
| External embedding API via `RESTMessageV2` | **Governed fallback only** (see below) — off-instance egress | Outbound REST works; external-model specifics (e.g. OpenAI `text-embedding-3-small` / 1536-dim) are off-instance, not ServiceNow platform facts |

> **PI similarity is the right shape for "records similar to this record," and the wrong shape for
> arbitrary free-text pairs.** It is **non-licensable platform ML and not ITSM-Pro gated** (verified).
> For dedup of agent-generated free-text artifacts, use `RAGRetrievalDefinitionUtil` embeddings + the
> shipped cosine routine below.

> **Does not contradict `data-kit-retrieval-patterns.md` line 291** ("Embedding model is fixed —
> cannot use custom embeddings"): that is true for the **managed Data Kit RAG pipeline** (you cannot
> swap the model it indexes with). The **raw vectors** that fixed model produces are still
> **script-readable** via the search-result accessor `getSearchResults()[i].getSemanticEmbedding()` —
> which is what this pattern uses.

## Wrapper: embed → reuse the shipped cosine routine (do NOT re-implement)

The cosine math already ships in **`TfidfSimilarityUtil` (#97)** — `cosineSimilarity(vecA, vecB)`
over `{term: weight}` sparse vectors. **Reuse it; do not re-implement cosine.** Convert the dense
embedding array (`~1024-dim` — *confirm dimensionality on instance*) into the index-keyed object shape
that routine consumes, then call it.

> **Call shape:** `getSemanticEmbedding()` / `getSemanticSimilarity()` are accessors on **RAG search
> results**, not on the util — so a vector comes from `response.getSearchResults()[i]`, not from
> `rag.getSemanticEmbedding(text)`. The `embed()` helper below sketches that shape; **(confirm on
> instance during build)** the retrieval request construction and whether arbitrary free-text input
> embeds on demand.

```javascript
// AI Agent Script Tool / Script Include wrapper — native semantic similarity, no egress.
// Reuses TfidfSimilarityUtil.cosineSimilarity (#97); does NOT re-implement cosine math.
(function execute(inputs, outputs) {
  var rag = new sn_ais_rag.RAGRetrievalDefinitionUtil();   // native, on-instance

  // Run a retrieval, then read the embedding off a returned search result — the vector is a
  // search-result accessor, NOT rag.getSemanticEmbedding(text). Confirm request shape on instance.
  function embed(text) {
    var response = rag.execute(/* RAG retrieval request for `text` — confirm builder shape on instance */);
    var results = response.getSearchResults();
    return (results && results.length) ? results[0].getSemanticEmbedding() : null;  // raw vector
  }

  var v1 = embed(inputs.text1);
  var v2 = embed(inputs.text2);

  // Adapt the dense array to the {index: weight} sparse shape TfidfSimilarityUtil.cosineSimilarity expects.
  // (Reuse-over-reimplementation tradeoff: this dense->object + for-in pass is heavier than a plain
  //  dense dot-product loop, but it keeps a single shipped cosine routine — acceptable here.)
  function toSparse(vec) {
    var o = {}, i;
    for (i = 0; i < vec.length; i++) { o['d' + i] = vec[i]; }
    return o;
  }

  var tfidf = new x_snc_myapp.TfidfSimilarityUtil();        // shipped cosine routine (#97)
  var score = tfidf.cosineSimilarity(toSparse(v1), toSparse(v2));

  outputs.result = JSON.stringify({ score: score, backend: 'neural' });
})(inputs, outputs);
```

> If you prefer the platform's own scorer, read `.getSemanticSimilarity()` off a retrieved search
> result instead of embedding + cosine — both are native. Either way, return
> `{ score, backend: 'neural' }`.
>
> **Tool-script rule:** a wrapper that reads records to assemble candidate text is an AI Agent tool
> script and must use `GlideRecordSecure` + `addUserEncodedQuery()` (`tool-script-rules.md` Rule 2);
> the math/embedding Script Include it calls is not itself bound by that rule. (The snippet above
> compares two passed-in texts and reads no records.)

## Embedding-cache table (avoid recomputing vectors)

Embedding a text is more expensive than a Jaccard/TF-IDF pass, so cache the vector keyed on a
**native digest of the normalized text**. Normalize with the **same `normalizeText` the other
backends use** (so equivalent texts hash identically), then hash with **`GlideDigest`**
(`getSHA256Hex`) — a standard scoped-script API. *(Confirm the exact `GlideDigest` method surface —
`getSHA256Hex` / `getMD5Hex` — on instance during build.)*

| Column | Type | Purpose |
|---|---|---|
| `text_hash` | String (indexed) | SHA-256 hex of the normalized text — the cache key |
| `embedding_json` | Large String / JSON | The ~1024-dim vector serialized with `JSON.stringify` |
| `model` | String | Embedding model identifier, so a model change invalidates the row *(model name: confirm on instance during build)* |
| `created_on` | Glide Date/Time | For TTL eviction — re-embed when the row ages out |

Lookup flow: normalize → `getSHA256Hex` → `GlideRecord` by `text_hash` (+ matching `model`); on hit
deserialize `embedding_json`; on miss run the retrieval and read the vector off the search result
(`getSearchResults()[i].getSemanticEmbedding()`), store, and return. Including
`model` + `created_on` lets you evict on model upgrade or TTL.

## External `RESTMessageV2` path — governance-gated FALLBACK only

> **WARNING — data egress.** This path sends ticket / free-text content **off-instance** to a hosted
> embedding model. For regulated tenants this is frequently a **non-starter**. Use it **only** when
> AI Search semantic indexing is not enabled **and** off-instance egress is explicitly acceptable
> under the tenant's data-governance policy.

`sn_ws.RESTMessageV2` can POST text to an external embedding endpoint from a Script Include / AI
Agent Script Tool and parse the returned vector, then feed it into the same shipped
`cosineSimilarity` routine. **Do not re-document REST mechanics here** — the connection/credential
alias, `RESTMessageV2` setup, and error handling are covered by the `/skill-tool-script-writer`
RESTMessageV2 template; point at it. External-model specifics (model name, vector dimensionality) are
off-instance and **not ServiceNow platform facts**.

## Appendix — MID Server embedding sidecar (UNVERIFIED / ADVANCED)

> **Unverified.** No such sidecar exists on the instance. Listed only for completeness for teams that
> already run a MID Server and want embeddings computed inside the network boundary instead of via a
> public endpoint. A MID Server could host a local embedding model and return vectors over the MID
> ECC queue, keeping data inside the tenant's perimeter while still using a custom model. Treat the
> entire approach as advanced/unverified and validate end-to-end before relying on it.

## Wiring into the three-tier dedup policy (#98)

Neural is a **math layer**; the decision lives in the policy layer. It slots into the
[three-tier dedup policy](similarity-dedup-policy-pattern.md) (#98) as the **`neural` backend**: the
wrapper returns `{ score, backend: 'neural' }` and the policy selects the **`neural` threshold row**
(the same calibrated-cosine row TF-IDF references — both produce cosine scores on the same scale).
**The thresholds are NOT restated here** — see the keystone's canonical table, where every value is a
tunable default imported from the external `merge-service.ts`, not a ServiceNow constant. Math layer
and policy layer stay separate concerns.

Relative to the other backends:

- **Jaccard (#96)** — lexical, no corpus; the cheapest, no-corpus fallback / structural-attribute tier.
- **TF-IDF (#97)** — corpus-aware statistical; the paraphrase-within-shared-vocabulary tier (and the
  shipped `cosineSimilarity` routine this doc reuses).
- **Neural (this doc, #100)** — semantic; the divergent-vocabulary tier. Native-first via AI Search
  RAG, with the external REST path as a governed fallback.
- **Mermaid structural (#99)** — the diagram-artifact counterpart.

## Best Practices

1. **Prefer the native path.** `RAGRetrievalDefinitionUtil` keeps embeddings on-instance — no egress,
   no external model governance. Demote the REST path to a fallback gated by data-governance sign-off.
2. **Reuse the shipped cosine routine.** Call `TfidfSimilarityUtil.cosineSimilarity` (#97); do not
   re-implement cosine math.
3. **Cache vectors.** Key on a `GlideDigest` SHA-256 of the normalized text; include `model` +
   `created_on` for invalidation and TTL.
4. **Use PI for record-to-record, not free-text pairs.** PI similarity (non-licensable, not ITSM-Pro
   gated) is the right shape for "records like this record"; use embeddings + cosine for arbitrary
   free-text dedup.
5. **Mark unconfirmed specifics.** Anything beyond the verified set —
   request-builder surface, model name/table/token limit, exact PI API, `AISASearchUtil` behavior,
   the `GlideDigest` method surface — stays labelled "(confirm on instance during build)".

## Related Resources

- `similarity-dedup-policy-pattern.md` — three-tier dedup policy (#98); the canonical threshold home; this doc is its `neural` backend
- `similarity-tfidf-pattern.md` — TF-IDF cosine (#97); ships the reusable `cosineSimilarity` routine and the `normalizeText` tokenizer
- `similarity-jaccard-pattern.md` — Jaccard lexical (#96); the no-corpus tier
- `similarity-mermaid-structural-pattern.md` — Mermaid structural (#99); the diagram-artifact tier
- `data-kit-retrieval-patterns.md` — managed Data Kit RAG (the fixed-model managed pipeline; raw vectors remain script-readable)
- `tool-script-rules.md` Rule 2 — GlideRecordSecure + addUserEncodedQuery() for AI Agent tool scripts that read records
- `/skill-tool-script-writer` — RESTMessageV2 template for the external-embedding fallback (do not re-document REST mechanics)
