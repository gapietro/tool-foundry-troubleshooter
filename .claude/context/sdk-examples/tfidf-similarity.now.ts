/**
 * Golden Example: TF-IDF Cosine Similarity subsystem
 *
 * A corpus-aware TF-IDF deduplication utility for ServiceNow: higher quality than
 * lexical Jaccard, no external API / license required. Fills the OOB gap where
 * Predictive Intelligence Similarity needs an ITSM Pro license — TF-IDF trained on
 * your own record corpus works on base ITSM.
 *
 * This single file defines the whole subsystem:
 *   1. Table   x_snc_myapp_tfidf_corpus   — persisted IDF table (term -> document_frequency)
 *   2. Table   x_snc_myapp_tfidf_artifact — key -> text cache for registerArtifact/getSimilarity
 *   3. ScriptInclude TfidfSimilarityUtil   — the math + corpus management (external .js)
 *   4. ScheduledScript                     — weekly batch corpus rebuild
 *
 * Pattern reference: context/similarity-tfidf-pattern.md
 * Source port:       Now-AI-Foundry/tool-foundry-whiteboard
 *                    server/src/services/dedup/embedding-similarity.ts (TF-IDF backend)
 *
 * IMPORTANT — scope rename required when copying: replace `x_snc_myapp_` with your
 * project's scope prefix across BOTH this file AND server/TfidfSimilarityUtil.js
 * (the .js references the table names by string). Otherwise the build fails with
 * TS11 / TS303 scope-prefix errors, and at runtime the util would query the wrong tables.
 *
 * PLATFORM DESIGN NOTE: the Node original kept the corpus in a process-memory Map.
 * ServiceNow scripts are stateless across transactions, so the corpus lives in the
 * table below. Corpus size N is stored on a reserved sentinel row (term =
 * '__corpus_size__'), NOT denormalized onto every term row — so adding one document
 * touches only that document's term rows, avoiding a full-table update on every add.
 *
 * Key concepts:
 *   - export const name MUST match the table name exactly (not a camelCase alias)
 *   - ScriptInclude name MUST match the class name in the script (TfidfSimilarityUtil)
 *   - accessibleFrom: 'public' lets AI Agent Script Tools / cross-scope callers use it
 *   - Add a unique index on `term` after install (or via `now-sdk explain index-api`)
 *     for corpus-scale performance — omitted here to keep the example build-portable
 */

import '@servicenow/sdk/global'
import { Table, StringColumn, IntegerColumn, MultiLineTextColumn } from '@servicenow/sdk/core'
import { ScriptInclude, ScheduledScript } from '@servicenow/sdk/core'

// ---------------------------------------------------------------------------
// 1. Corpus IDF table — one row per stemmed term + one reserved sentinel row
//    (term = '__corpus_size__') holding the corpus document count N.
// ---------------------------------------------------------------------------
export const x_snc_myapp_tfidf_corpus = Table({
  name: 'x_snc_myapp_tfidf_corpus',
  label: 'TF-IDF Corpus Term',
  extensible: false,
  display: 'term',
  audit: false,

  schema: {
    term: StringColumn({
      label: 'Stemmed Term',
      mandatory: true,
      maxLength: 100,
    }),

    document_frequency: IntegerColumn({
      label: 'Document Frequency',
      defaultValue: 0,
    }),
  },
})

// ---------------------------------------------------------------------------
// 2. Artifact cache — backs registerArtifact(key, text) / getSimilarity(k1, k2).
//    Optional: omit if callers always pass text directly to computeTfidfSimilarity.
// ---------------------------------------------------------------------------
export const x_snc_myapp_tfidf_artifact = Table({
  name: 'x_snc_myapp_tfidf_artifact',
  label: 'TF-IDF Artifact',
  extensible: false,
  display: 'artifact_key',
  audit: false,

  schema: {
    artifact_key: StringColumn({
      label: 'Artifact Key',
      mandatory: true,
      maxLength: 255,
    }),

    artifact_text: MultiLineTextColumn({
      label: 'Artifact Text',
      maxLength: 8000,
    }),
  },
})

// ---------------------------------------------------------------------------
// 3. Script Include — TF-IDF math + corpus management (ES5/Rhino-safe, zero deps).
// ---------------------------------------------------------------------------
export const tfidfSimilarityUtil = ScriptInclude({
  $id: Now.ID['tfidf-similarity-util'],
  name: 'TfidfSimilarityUtil',
  description: 'Corpus-aware TF-IDF cosine similarity (smooth IDF). Persists corpus in x_snc_myapp_tfidf_corpus. Zero external dependencies.',
  active: true,
  accessibleFrom: 'public',
  script: Now.include('./server/TfidfSimilarityUtil.js'),
})

// ---------------------------------------------------------------------------
// 4. Scheduled Job — weekly batch rebuild of the IDF corpus. Corpus-scale scans
//    MUST run in a Scheduled Job, never inline (298s transaction limit).
//    Here: seed IDF weights from the last 90 days of resolved incidents.
// ---------------------------------------------------------------------------
export const tfidfCorpusRebuild = ScheduledScript({
  $id: Now.ID['tfidf-corpus-rebuild'],
  name: 'TF-IDF Corpus Rebuild',
  active: true,
  frequency: 'weekly',
  daysOfWeek: ['sunday'],
  executionTime: { hours: 3, minutes: 0, seconds: 0 },
  script: `(function rebuildTfidfCorpus() {
  try {
    var util = new TfidfSimilarityUtil();
    // Seed IDF from the last 90 days of resolved incidents (state=6 = Resolved).
    var encodedQuery = 'sys_updated_on>=javascript:gs.daysAgoStart(90)^state=6';
    var count = util.rebuildCorpus('incident', encodedQuery, ['short_description', 'description']);
    gs.info('[TF-IDF] Weekly corpus rebuild complete: ' + count + ' incidents');
  } catch (e) {
    gs.error('[TF-IDF] Corpus rebuild failed: ' + e.message);
  }
})();`,
})
