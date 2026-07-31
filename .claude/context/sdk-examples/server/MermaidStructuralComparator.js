// MermaidStructuralComparator — detects structurally duplicate Mermaid flowchart
// diagrams via weighted Jaccard similarity over parsed nodes and edges.
//
// Ported from tool-foundry-whiteboard server/src/services/dedup/mermaid-comparator.ts.
// Zero external dependencies. ES5-only so it runs unchanged on the Rhino engine in any
// scoped application (no Set/Map/arrow-functions/template-literals/let/const) — "sets"
// are plain objects keyed by member string. The Jaccard set math is inlined here rather
// than calling JaccardSimilarityUtil (#96) so this Script Include is self-contained; swap
// _jaccard() for that utility if you have it installed and want a single source of truth.
//
// Public contract:
//   parseMermaidGraph(mermaidText)            -> { nodes: {label:true}, edges: {"a->b":true} }
//   calculateStructuralOverlap(graph1, graph2) -> Number 0..1 (0.6*nodeJaccard + 0.4*edgeJaccard)
//   isDuplicateDiagram(newText, existingTextArray, threshold) -> Boolean (threshold default 0.6)
// Convenience:
//   compareDiagrams(textA, textB)              -> Number 0..1 (parse both, then overlap)
//   findDuplicateIndex(newText, existingTextArray, threshold) -> Number index of first match, or -1
var MermaidStructuralComparator = Class.create();
MermaidStructuralComparator.prototype = {

  initialize: function() {
    this.DEFAULT_THRESHOLD = 0.6;
    this.NODE_WEIGHT = 0.6;
    this.EDGE_WEIGHT = 0.4;
  },

  /**
   * Parse a Mermaid flowchart string into a structural representation.
   * Supports `flowchart TB|TD|LR|RL|BT` and `graph` variants. Node labels and edge
   * endpoints are normalized (lowercased, non-alphanumeric stripped) so two diagrams
   * that differ only in punctuation/casing still compare as structurally identical.
   *
   * @param {String} mermaid - raw Mermaid diagram text
   * @return {Object} { nodes: {normalizedLabel: true}, edges: {"labelA->labelB": true} }
   */
  parseMermaidGraph: function(mermaid) {
    var nodes = {};
    var edges = {};

    if (!mermaid || typeof mermaid !== 'string') {
      return { nodes: nodes, edges: edges };
    }

    // Split into trimmed, non-empty lines.
    var rawLines = mermaid.split('\n');
    var lines = [];
    var i;
    for (i = 0; i < rawLines.length; i++) {
      var trimmed = ('' + rawLines[i]).replace(/^\s+|\s+$/g, '');
      if (trimmed.length > 0) {
        lines.push(trimmed);
      }
    }

    // Skip the leading "flowchart TD" / "graph LR" declaration line if present.
    var startIndex = (lines.length > 0 && /^(flowchart|graph)\s+(TB|TD|LR|RL|BT)/i.test(lines[0])) ? 1 : 0;

    // Map of node id -> normalized label, and the raw [idA, idB] edge pairs.
    var nodeLabels = {};
    var rawEdges = [];

    for (i = startIndex; i < lines.length; i++) {
      var line = lines[i];

      if (line.indexOf('-->') !== -1) {
        // Edge chain: split on --> and pull a node id (+ optional [Label]) from each segment.
        var segments = line.split('-->');
        var segmentIds = [];
        var s;
        for (s = 0; s < segments.length; s++) {
          var segment = segments[s].replace(/^\s+|\s+$/g, '');
          var match = segment.match(/^(\w+)(?:\[([^\]]*)\])?/);
          if (match) {
            var id = match[1];
            var label = match[2];
            if (label) {
              nodeLabels[id] = this._normalize(label);
            }
            if (!nodeLabels.hasOwnProperty(id)) {
              nodeLabels[id] = this._normalize(id);
            }
            segmentIds.push(id);
          }
        }
        // Consecutive pairs in the chain become directed edges.
        var j;
        for (j = 0; j < segmentIds.length - 1; j++) {
          rawEdges.push([segmentIds[j], segmentIds[j + 1]]);
        }
        continue;
      }

      // Standalone node definition: A[Label]
      var nodeMatch = line.match(/^(\w+)\[([^\]]*)\]/);
      if (nodeMatch) {
        nodeLabels[nodeMatch[1]] = this._normalize(nodeMatch[2]);
      }
    }

    // Build the node set from resolved labels.
    var key;
    for (key in nodeLabels) {
      if (nodeLabels.hasOwnProperty(key)) {
        nodes[nodeLabels[key]] = true;
      }
    }

    // Build the edge set using resolved labels (fall back to normalized id).
    var e;
    for (e = 0; e < rawEdges.length; e++) {
      var idA = rawEdges[e][0];
      var idB = rawEdges[e][1];
      var labelA = nodeLabels.hasOwnProperty(idA) ? nodeLabels[idA] : this._normalize(idA);
      var labelB = nodeLabels.hasOwnProperty(idB) ? nodeLabels[idB] : this._normalize(idB);
      edges[labelA + '->' + labelB] = true;
    }

    return { nodes: nodes, edges: edges };
  },

  /**
   * Weighted structural overlap between two parsed graphs.
   * Nodes count for 60% and edges for 40% of the score — node identity is a stronger
   * signal of "same diagram" than wiring, which can vary while the steps stay the same.
   *
   * @param {Object} m1 - graph from parseMermaidGraph()
   * @param {Object} m2 - graph from parseMermaidGraph()
   * @return {Number} 0..1
   */
  calculateStructuralOverlap: function(m1, m2) {
    var nodeOverlap = this._jaccard(m1.nodes, m2.nodes);
    var edgeOverlap = this._jaccard(m1.edges, m2.edges);
    return this.NODE_WEIGHT * nodeOverlap + this.EDGE_WEIGHT * edgeOverlap;
  },

  /**
   * True if `newDiagram` is a structural duplicate of any diagram in `existingDiagrams`.
   * Empty/unparseable diagrams never match.
   *
   * @param {String} newDiagram
   * @param {Array} existingDiagrams - array of Mermaid strings
   * @param {Number} [threshold=0.6]
   * @return {Boolean}
   */
  isDuplicateDiagram: function(newDiagram, existingDiagrams, threshold) {
    return this.findDuplicateIndex(newDiagram, existingDiagrams, threshold) !== -1;
  },

  /**
   * Index of the first existing diagram whose overlap with `newDiagram` is >= threshold,
   * or -1 if none. Lets agent tools resolve the matched record (e.g. return its sys_id).
   *
   * @param {String} newDiagram
   * @param {Array} existingDiagrams
   * @param {Number} [threshold=0.6]
   * @return {Number} matching index, or -1
   */
  findDuplicateIndex: function(newDiagram, existingDiagrams, threshold) {
    var limit = (typeof threshold === 'number') ? threshold : this.DEFAULT_THRESHOLD;
    if (!existingDiagrams || !existingDiagrams.length) {
      return -1;
    }

    var newGraph = this.parseMermaidGraph(newDiagram);
    if (this._size(newGraph.nodes) === 0) {
      return -1;
    }

    var k;
    for (k = 0; k < existingDiagrams.length; k++) {
      var existingGraph = this.parseMermaidGraph(existingDiagrams[k]);
      if (this._size(existingGraph.nodes) === 0) {
        continue;
      }
      if (this.calculateStructuralOverlap(newGraph, existingGraph) >= limit) {
        return k;
      }
    }
    return -1;
  },

  /**
   * Convenience: parse two raw Mermaid strings and return their structural overlap.
   * An empty / unparseable diagram (no nodes) scores 0 against anything — consistent
   * with findDuplicateIndex(), so two empty or non-Mermaid inputs are never reported
   * as duplicates by the AI Agent Tool wrapper that calls this method.
   *
   * @param {String} textA
   * @param {String} textB
   * @return {Number} 0..1
   */
  compareDiagrams: function(textA, textB) {
    var graphA = this.parseMermaidGraph(textA);
    var graphB = this.parseMermaidGraph(textB);
    if (this._size(graphA.nodes) === 0 || this._size(graphB.nodes) === 0) {
      return 0;
    }
    return this.calculateStructuralOverlap(graphA, graphB);
  },

  // --- Helpers -------------------------------------------------------------

  // Lowercase, strip non-alphanumeric (keep spaces), collapse whitespace, trim.
  _normalize: function(text) {
    if (text === null || text === undefined) {
      return '';
    }
    return ('' + text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  },

  // Jaccard coefficient over two object-keyed sets: |intersection| / |union|.
  // Two empty sets are defined as identical (1) to match the reference implementation.
  _jaccard: function(a, b) {
    var sizeA = this._size(a);
    var sizeB = this._size(b);
    if (sizeA === 0 && sizeB === 0) {
      return 1;
    }

    var intersection = 0;
    var key;
    for (key in a) {
      if (a.hasOwnProperty(key) && b.hasOwnProperty(key)) {
        intersection++;
      }
    }

    var union = sizeA + sizeB - intersection;
    return union === 0 ? 0 : intersection / union;
  },

  // Count own-enumerable keys (set cardinality).
  _size: function(obj) {
    var count = 0;
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        count++;
      }
    }
    return count;
  },

  type: 'MermaidStructuralComparator'
};
