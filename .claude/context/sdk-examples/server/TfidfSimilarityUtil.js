// TfidfSimilarityUtil — corpus-aware TF-IDF cosine similarity for ServiceNow.
//
// Ported from tool-foundry-whiteboard server/src/services/dedup/embedding-similarity.ts
// (TF-IDF backend) + the normalizeText/stem tokenizer from similarity.ts. Uses the
// scikit-learn smooth IDF variant: idf = log((N+1)/(df+1)) + 1. Zero external
// dependencies, ES5-only so it runs unchanged on Rhino in any scoped app.
//
// PLATFORM DESIGN CHANGE vs the Node port: Node held the corpus (document count +
// per-term document frequency) in a process-memory Map. ServiceNow scripts are
// stateless across transactions, so the corpus is persisted in a table instead.
// Corpus size N is stored on a reserved sentinel row (term = '__corpus_size__')
// rather than denormalized onto every term row, so adding a document touches only
// the rows for that document's terms — not the whole table. See
// context/similarity-tfidf-pattern.md.
//
// The corpus MUST be populated (addDocument / rebuildCorpus) before similarity is
// meaningful. With an empty corpus every IDF collapses to a constant and the score
// degrades to plain TF cosine.
//
// Public contract:
//   addDocument(text)                         -> void   (register text in corpus / IDF table)
//   computeTfidfVector(text [, stats])         -> { term: weight }
//   cosineSimilarity(vecA, vecB)               -> Number 0..1
//   computeTfidfSimilarity(text1, text2 [, stats]) -> Number 0..1
//   registerArtifact(key, text)                -> void   (addDocument + cache text by key)
//   getSimilarity(key1, key2)                  -> { score: Number, backend: 'tfidf' }
//   rebuildCorpus(sourceTable, encodedQuery, textFields) -> Number (batch; run from a Scheduled Job)
// The optional `stats` arg ({ N: Number, df: { term: Number } }) lets callers inject
// corpus statistics (and makes the math unit-testable without a corpus table).
var TfidfSimilarityUtil = Class.create();
TfidfSimilarityUtil.prototype = {

  initialize: function() {
    // Rename this scope prefix (x_snc_myapp_) to your app's scope across BOTH this
    // file and tfidf-similarity.now.ts before deploying.
    this.CORPUS_TABLE = 'x_snc_myapp_tfidf_corpus';
    this.ARTIFACT_TABLE = 'x_snc_myapp_tfidf_artifact';
    // Reserved term row that holds the corpus size N. Cannot collide with a real
    // token in normal ITSM/KB text; treat it as reserved.
    this.CORPUS_SIZE_KEY = '__corpus_size__';
    // Suffix list in strip order (longest/most-specific first). One suffix stripped
    // per word; word must be > 3 chars and the root must remain >= 3 chars.
    this.SUFFIXES = [
      'ation', 'ion', 'ment', 'ness', 'able', 'ible',
      'ize', 'ise', 'ify',
      'ing', 'ted', 'ed', 'er', 'est', 'ly',
      'es', 's'
    ];
  },

  // --- Pure text functions (no platform calls) ----------------------------

  // Lowercase, strip punctuation (keep word chars + whitespace), collapse whitespace, trim.
  _normalizeText: function(text) {
    if (text === null || text === undefined) {
      return '';
    }
    return ('' + text)
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  },

  // Suffix-stripping stemmer (not a full Porter stemmer — handles the common
  // suffixes that cause false negatives in short-text dedup).
  _stem: function(word) {
    if (word.length <= 3) {
      return word;
    }
    var i;
    for (i = 0; i < this.SUFFIXES.length; i++) {
      var suffix = this.SUFFIXES[i];
      var rootLen = word.length - suffix.length;
      if (rootLen >= 3 && word.slice(rootLen) === suffix) {
        return word.slice(0, rootLen);
      }
    }
    return word;
  },

  // Normalize -> split -> stem -> drop empties. Returns an ARRAY (TF needs counts).
  _tokenize: function(text) {
    var normalized = this._normalizeText(text);
    if (normalized === '') {
      return [];
    }
    var parts = normalized.split(' ');
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var t = this._stem(parts[i]);
      if (t.length > 0) {
        out.push(t);
      }
    }
    return out;
  },

  // Distinct tokens preserving first-seen order.
  _uniqueTerms: function(tokens) {
    var seen = {};
    var out = [];
    var i;
    for (i = 0; i < tokens.length; i++) {
      if (!seen.hasOwnProperty(tokens[i])) {
        seen[tokens[i]] = true;
        out.push(tokens[i]);
      }
    }
    return out;
  },

  // Normalized term frequency: each occurrence contributes 1/tokenCount.
  _computeTf: function(tokens) {
    var tf = {};
    var n = tokens.length;
    var i;
    for (i = 0; i < n; i++) {
      var tok = tokens[i];
      tf[tok] = (tf.hasOwnProperty(tok) ? tf[tok] : 0) + 1 / n;
    }
    return tf;
  },

  // --- TF-IDF vector + cosine ----------------------------------------------

  /**
   * Build a TF-IDF vector for `text`. `stats` ({N, df}) is loaded from the corpus
   * table when not supplied. IDF uses the smooth variant log((N+1)/(df+1)) + 1.
   *
   * @param {String} text
   * @param {Object} [stats] - { N: Number, df: { term: docFrequency } }
   * @return {Object} { term: tfidfWeight }
   */
  computeTfidfVector: function(text, stats) {
    var tokens = this._tokenize(text);
    var resolved = stats || this._loadCorpusStats(this._uniqueTerms(tokens));
    var tf = this._computeTf(tokens);
    var docCount = Math.max(resolved.N || 0, 1);
    var df = resolved.df || {};
    var vec = {};
    var term;
    for (term in tf) {
      if (tf.hasOwnProperty(term)) {
        var docFreq = df.hasOwnProperty(term) ? df[term] : 0;
        var idf = Math.log((docCount + 1) / (docFreq + 1)) + 1;
        vec[term] = tf[term] * idf;
      }
    }
    return vec;
  },

  /**
   * Cosine similarity of two sparse vectors represented as {term: weight} objects.
   * Returns 0 when either vector has zero magnitude.
   */
  cosineSimilarity: function(vecA, vecB) {
    var dot = 0;
    var normA = 0;
    var normB = 0;
    var term;
    for (term in vecA) {
      if (vecA.hasOwnProperty(term)) {
        normA += vecA[term] * vecA[term];
        if (vecB.hasOwnProperty(term)) {
          dot += vecA[term] * vecB[term];
        }
      }
    }
    for (term in vecB) {
      if (vecB.hasOwnProperty(term)) {
        normB += vecB[term] * vecB[term];
      }
    }
    var denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) {
      return 0;
    }
    return dot / denom;
  },

  /**
   * TF-IDF cosine similarity between two texts. Empty/empty -> 1; one-empty -> 0.
   * Loads corpus stats once for the combined vocabulary when `stats` is not given.
   *
   * @param {String} text1
   * @param {String} text2
   * @param {Object} [stats] - inject { N, df } to skip the corpus-table read
   * @return {Number} 0..1
   */
  computeTfidfSimilarity: function(text1, text2, stats) {
    var tokens1 = this._tokenize(text1);
    var tokens2 = this._tokenize(text2);
    if (tokens1.length === 0 && tokens2.length === 0) {
      return 1;
    }
    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0;
    }
    var resolved = stats;
    if (!resolved) {
      var vocab = this._uniqueTerms(tokens1.concat(tokens2));
      resolved = this._loadCorpusStats(vocab);
    }
    var vec1 = this.computeTfidfVector(text1, resolved);
    var vec2 = this.computeTfidfVector(text2, resolved);
    return this.cosineSimilarity(vec1, vec2);
  },

  // --- Corpus persistence (GlideRecord) ------------------------------------

  /**
   * Register a document in the IDF corpus: increment document_frequency for each
   * distinct term in the text, and increment the corpus size N (sentinel row).
   */
  addDocument: function(text) {
    var terms = this._uniqueTerms(this._tokenize(text));
    if (terms.length === 0) {
      return;
    }
    this._incrementTerm(this.CORPUS_SIZE_KEY, 1);
    var i;
    for (i = 0; i < terms.length; i++) {
      this._incrementTerm(terms[i], 1);
    }
  },

  _incrementTerm: function(term, delta) {
    var gr = new GlideRecord(this.CORPUS_TABLE);
    gr.addQuery('term', term);
    gr.setLimit(1);
    gr.query();
    if (gr.next()) {
      var current = parseInt(gr.getValue('document_frequency'), 10) || 0;
      gr.setValue('document_frequency', current + delta);
      gr.update();
    } else {
      var ins = new GlideRecord(this.CORPUS_TABLE);
      ins.initialize();
      ins.setValue('term', term);
      ins.setValue('document_frequency', delta);
      ins.insert();
    }
  },

  /**
   * Load corpus stats: N from the sentinel row, and document_frequency for the
   * given terms in a single indexed query.
   *
   * @param {Array} terms
   * @return {Object} { N: Number, df: { term: docFrequency } }
   */
  _loadCorpusStats: function(terms) {
    var stats = { N: 0, df: {} };

    var meta = new GlideRecord(this.CORPUS_TABLE);
    meta.addQuery('term', this.CORPUS_SIZE_KEY);
    meta.setLimit(1);
    meta.query();
    if (meta.next()) {
      stats.N = parseInt(meta.getValue('document_frequency'), 10) || 0;
    }

    if (terms && terms.length) {
      var gr = new GlideRecord(this.CORPUS_TABLE);
      gr.addQuery('term', 'IN', terms.join(','));
      gr.query();
      while (gr.next()) {
        stats.df[gr.getValue('term')] = parseInt(gr.getValue('document_frequency'), 10) || 0;
      }
    }
    return stats;
  },

  // --- Artifact cache + convenience API ------------------------------------

  /**
   * Add the text to the corpus AND cache it by key so getSimilarity(key1, key2)
   * can score two registered artifacts.
   */
  registerArtifact: function(key, text) {
    this.addDocument(text);
    var gr = new GlideRecord(this.ARTIFACT_TABLE);
    gr.addQuery('artifact_key', key);
    gr.setLimit(1);
    gr.query();
    if (gr.next()) {
      gr.setValue('artifact_text', text);
      gr.update();
    } else {
      var ins = new GlideRecord(this.ARTIFACT_TABLE);
      ins.initialize();
      ins.setValue('artifact_key', key);
      ins.setValue('artifact_text', text);
      ins.insert();
    }
  },

  /**
   * Similarity between two artifacts previously stored via registerArtifact.
   * @return {Object} { score: Number, backend: 'tfidf' }
   */
  getSimilarity: function(key1, key2) {
    var score = this.computeTfidfSimilarity(this._readArtifact(key1), this._readArtifact(key2));
    return { score: score, backend: 'tfidf' };
  },

  _readArtifact: function(key) {
    var gr = new GlideRecord(this.ARTIFACT_TABLE);
    gr.addQuery('artifact_key', key);
    gr.setLimit(1);
    gr.query();
    return gr.next() ? gr.getValue('artifact_text') : '';
  },

  /**
   * Rebuild the entire IDF corpus from a source table. Clears existing corpus rows,
   * then registers each matching record's concatenated text fields. Run from a
   * Scheduled Job (corpus-scale scans must not run inline — 298s transaction limit).
   *
   * @param {String} sourceTable - e.g. 'incident' or 'kb_knowledge'
   * @param {String} [encodedQuery] - GlideRecord encoded query to scope the corpus
   * @param {Array} [textFields] - fields to concatenate (default short_description+description)
   * @return {Number} documents processed
   */
  rebuildCorpus: function(sourceTable, encodedQuery, textFields) {
    var fields = (textFields && textFields.length) ? textFields : ['short_description', 'description'];

    var del = new GlideRecord(this.CORPUS_TABLE);
    del.query();
    del.deleteMultiple();

    var gr = new GlideRecord(sourceTable);
    if (encodedQuery) {
      gr.addEncodedQuery(encodedQuery);
    }
    gr.query();
    var processed = 0;
    while (gr.next()) {
      var parts = [];
      var i;
      for (i = 0; i < fields.length; i++) {
        parts.push(gr.getValue(fields[i]) || '');
      }
      this.addDocument(parts.join(' '));
      processed++;
    }
    gs.info('[TfidfSimilarityUtil] Corpus rebuilt from ' + sourceTable + ': ' + processed + ' documents');
    return processed;
  },

  type: 'TfidfSimilarityUtil'
};
