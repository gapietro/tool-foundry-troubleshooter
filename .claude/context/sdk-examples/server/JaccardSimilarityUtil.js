// JaccardSimilarityUtil — zero-dependency, no-corpus lexical/structural similarity for ServiceNow.
//
// Ported from tool-foundry-whiteboard server/src/services/dedup/similarity.ts (Jaccard
// backend) + the shared normalizeText/stem tokenizer. Jaccard coefficient over token
// SETS: |intersection| / |union|. Zero external dependencies, ES5-only so it runs
// unchanged on Rhino in any scoped app.
//
// PLATFORM CONSTRAINT vs the Node port: Node represented token sets with ES2015 `Set`.
// On the ServiceNow server runtime (Rhino, verified on Zurich Patch 8, 2026-05) BOTH `Set`
// AND `Map` are absent (typeof Map === 'undefined'; "Map is not defined"). Token sets and
// any per-transaction cache MUST therefore be plain objects keyed by the member string.
// Scripts are also stateless across transactions, so any such object cache is per-
// transaction only — it is gone by the next execution. See
// context/similarity-jaccard-pattern.md.
//
// Unlike TF-IDF (#97), Jaccard needs NO corpus: it compares the two texts directly, so it
// is the lexical / no-corpus fallback and the structural-attribute tier. The
// normalizeText + stem tokenizer is IDENTICAL to TfidfSimilarityUtil so both backends
// agree on what a "term" is and the #98 policy layer can switch between them cleanly.
//
// Public contract:
//   normalizeText(text)                                  -> String (lowercase, depunct, collapsed)
//   stem(word)                                           -> String (suffix-stripped root)
//   tokenize(text)                                       -> { token: true }  (plain-object token SET)
//   calculateSimilarity(text1, text2)                    -> Number 0..1  (Jaccard; empty/empty -> 1)
//   calculateCombinedSimilarity(title1, desc1, title2, desc2) -> Number 0..1 (70% title + 30% desc)
//   isTitleDuplicate(t1, t2, threshold)                  -> Boolean (exact -> substring -> Jaccard)
//   getSimilarity(text1, text2)                          -> { score: Number, backend: 'lexical' }
var JaccardSimilarityUtil = Class.create();
JaccardSimilarityUtil.prototype = {

  initialize: function() {
    // Suffix list in strip order (longest/most-specific first). IDENTICAL to
    // TfidfSimilarityUtil so the two backends tokenize a "term" the same way. One suffix
    // stripped per word; word must be > 3 chars and the root must remain >= 3 chars.
    this.SUFFIXES = [
      'ation', 'ion', 'ment', 'ness', 'able', 'ible',
      'ize', 'ise', 'ify',
      'ing', 'ted', 'ed', 'er', 'est', 'ly',
      'es', 's'
    ];
    // Default title-duplicate threshold and title/desc weights — DOMAIN-TUNED STARTING
    // POINTS to calibrate per corpus, NOT platform constants. See the pattern doc.
    this.DEFAULT_TITLE_THRESHOLD = 0.5;
    this.TITLE_WEIGHT = 0.7;
    this.DESC_WEIGHT = 0.3;
  },

  // --- Pure text functions (no platform calls) ----------------------------

  // Lowercase, strip punctuation (keep word chars + whitespace), collapse whitespace, trim.
  // IDENTICAL to TfidfSimilarityUtil._normalizeText.
  normalizeText: function(text) {
    if (text === null || text === undefined) {
      return '';
    }
    return ('' + text)
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  },

  // Suffix-stripping stemmer (not a full Porter stemmer — handles the common suffixes that
  // cause false negatives in short-text dedup). IDENTICAL to TfidfSimilarityUtil._stem.
  stem: function(word) {
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

  // Normalize -> split -> stem -> drop empties. Returns a plain-object token SET keyed by
  // stemmed token ({ token: true }) — the no-`Set` set representation (Set is undefined on
  // Rhino). Duplicate tokens collapse, which is exactly what Jaccard set math wants.
  tokenize: function(text) {
    var set = {};
    var normalized = this.normalizeText(text);
    if (normalized === '') {
      return set;
    }
    var parts = normalized.split(' ');
    var i;
    for (i = 0; i < parts.length; i++) {
      var t = this.stem(parts[i]);
      if (t.length > 0) {
        set[t] = true;
      }
    }
    return set;
  },

  // --- Jaccard set math (plain objects only — no Set, no Map) --------------

  /**
   * Jaccard coefficient between two texts: |intersection| / |union| over their token sets.
   * Two empty texts are defined as identical (-> 1); one empty and one non-empty -> 0.
   *
   * @param {String} text1
   * @param {String} text2
   * @return {Number} 0..1
   */
  calculateSimilarity: function(text1, text2) {
    var setA = this.tokenize(text1);
    var setB = this.tokenize(text2);
    return this._jaccard(setA, setB);
  },

  // Jaccard over two plain-object sets. Counts intersection, then derives union as
  // |A| + |B| - |intersection| so the union set never has to be materialized.
  _jaccard: function(setA, setB) {
    var sizeA = 0;
    var sizeB = 0;
    var intersection = 0;
    var key;
    for (key in setA) {
      if (setA.hasOwnProperty(key)) {
        sizeA++;
        if (setB.hasOwnProperty(key)) {
          intersection++;
        }
      }
    }
    for (key in setB) {
      if (setB.hasOwnProperty(key)) {
        sizeB++;
      }
    }
    var union = sizeA + sizeB - intersection;
    if (union === 0) {
      // Both sets empty -> identical by definition.
      return 1;
    }
    return intersection / union;
  },

  /**
   * Weighted similarity over a title + description pair. 70% title + 30% description by
   * default. The weights are DOMAIN-TUNED STARTING POINTS to calibrate, not constants.
   *
   * @param {String} title1
   * @param {String} desc1
   * @param {String} title2
   * @param {String} desc2
   * @return {Number} 0..1
   */
  calculateCombinedSimilarity: function(title1, desc1, title2, desc2) {
    var titleScore = this.calculateSimilarity(title1, title2);
    var descScore = this.calculateSimilarity(desc1, desc2);
    return (this.TITLE_WEIGHT * titleScore) + (this.DESC_WEIGHT * descScore);
  },

  /**
   * Three-strategy title duplicate check, cheapest-first:
   *   1. exact normalized match,
   *   2. substring containment (one normalized title contains the other),
   *   3. Jaccard >= threshold.
   * `threshold` defaults to 0.5 (a domain-tuned starting point to calibrate).
   *
   * @param {String} t1
   * @param {String} t2
   * @param {Number} [threshold]
   * @return {Boolean}
   */
  isTitleDuplicate: function(t1, t2, threshold) {
    var thr = (threshold === null || threshold === undefined) ? this.DEFAULT_TITLE_THRESHOLD : threshold;
    var n1 = this.normalizeText(t1);
    var n2 = this.normalizeText(t2);
    if (n1 === '' && n2 === '') {
      return true;
    }
    if (n1 === n2) {
      return true;
    }
    if (n1 !== '' && n2 !== '' && (n1.indexOf(n2) !== -1 || n2.indexOf(n1) !== -1)) {
      return true;
    }
    return this.calculateSimilarity(t1, t2) >= thr;
  },

  /**
   * Convenience wrapper returning the backend-tagged shape the #98 policy layer consumes.
   * @return {Object} { score: Number, backend: 'lexical' }
   */
  getSimilarity: function(text1, text2) {
    return { score: this.calculateSimilarity(text1, text2), backend: 'lexical' };
  },

  type: 'JaccardSimilarityUtil'
};
