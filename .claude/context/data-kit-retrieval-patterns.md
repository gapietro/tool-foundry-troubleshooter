# Data Kit & Retrieval Patterns — ServiceNow Zurich

> RAG setup with ServiceNow Data Kit: data source configuration, search profile creation, retrieval in skills, chunking strategies, embedding configuration, relevance tuning, and integration with Now Assist skills.

---

## Overview

Retrieval-Augmented Generation (RAG) in ServiceNow is powered by **Data Kit** — the platform's data ingestion and retrieval framework. Data Kit indexes ServiceNow content (knowledge articles, catalog items, documents) into searchable embeddings that AI agents and Now Assist skills can query.

This enables skills and agents to answer questions grounded in your organization's actual data rather than relying solely on the LLM's training knowledge.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    RAG Pipeline                               │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ Data Source  │───▶│  Data Kit    │───▶│   Embeddings   │  │
│  │ (KB, table)  │    │  Ingestion   │    │    Store       │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
│                                                  │           │
│                                                  ▼           │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Generated  │◀───│   LLM +      │◀───│ Search Profile │  │
│  │  Response   │    │   Context    │    │   (Retrieval)  │  │
│  └─────────────┘    └──────────────┘    └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Components

### Data Sources

A data source defines what content to index. Common sources:

| Source Type | Table | What Gets Indexed |
|-------------|-------|-------------------|
| **Knowledge Base** | `kb_knowledge` | Knowledge articles (title, body, metadata) |
| **Service Catalog** | `sc_cat_item` | Catalog item descriptions and details |
| **Custom Table** | Any table | Specified fields from your custom tables |
| **Attachment** | `sys_attachment` | PDF, DOCX, TXT file content |

### Search Profiles

A search profile defines how retrieval works for a specific use case:

| Setting | Purpose | Typical Value |
|---------|---------|---------------|
| **Data sources** | Which indexed content to search | 1-3 data sources |
| **Result count** | How many chunks to retrieve | 3-10 |
| **Relevance threshold** | Minimum similarity score | 0.5-0.8 |
| **Filter conditions** | Narrow results (by category, language, etc.) | Per use case |

### Embeddings

Embeddings are vector representations of content chunks. ServiceNow handles:
- Chunking (splitting content into pieces)
- Embedding generation (converting chunks to vectors)
- Storage (vector index)
- Retrieval (similarity search)

---

## Setting Up Data Kit

### Step 1: Configure a Data Source

Navigate to **Data Kit > Data Sources** and create:

```
Data Source Configuration:
  Name: "IT Knowledge Base"
  Table: kb_knowledge
  Fields to index:
    - short_description (title)
    - text (body content)
    - kb_category (metadata)
  Filter: active=true AND workflow_state=published
  Refresh schedule: Daily at 2:00 AM
```

### Step 2: Configure Chunking

Chunking splits documents into pieces for embedding. The strategy affects retrieval quality.

| Strategy | Chunk Size | Overlap | Best For |
|----------|-----------|---------|----------|
| **Fixed size** | 500-1000 tokens | 50-100 tokens | General purpose |
| **Paragraph** | Varies | None | Well-structured articles |
| **Sentence** | 1-3 sentences | 1 sentence | Short, focused answers |

**Recommendation:** Start with fixed-size chunks of 500 tokens with 50-token overlap. Adjust based on retrieval quality.

### Step 3: Create a Search Profile

Navigate to **Data Kit > Search Profiles** and create:

```
Search Profile Configuration:
  Name: "IT Support Search"
  Data sources: ["IT Knowledge Base"]
  Result count: 5
  Relevance threshold: 0.6
  Filter: none (or narrow by category if needed)
```

### Step 4: Run Initial Ingestion

After configuring the data source, trigger the initial ingestion:

1. Go to the data source record
2. Click "Ingest Now" or wait for the scheduled refresh
3. Monitor the ingestion job for errors
4. Verify chunk count after ingestion completes

---

## Integration Patterns

### Pattern 1: RAG in a Now Assist Skill

A Now Assist skill that retrieves context before generating a response:

```
Skill: Answer IT Questions
  Input: user_question (string)

  Prompt Template:
  System: "You are an IT support assistant. Answer questions using ONLY the
  provided context. If the context doesn't contain the answer, say
  'I don't have information about that in our knowledge base.'"

  User: "Context from knowledge base:
  {{retrieved_context}}

  Question: {{user_question}}

  Answer the question based on the context above. Cite the source
  article number when possible."
```

The platform automatically:
1. Takes the `user_question`
2. Searches the configured search profile
3. Injects retrieved chunks as `{{retrieved_context}}`
4. Sends the combined prompt to the LLM

### Pattern 2: RAG in an Agent Tool (Search Retrieval)

An AI agent can use a **Search retrieval** tool type:

```
Agent Tool Configuration:
  Type: Search retrieval
  Name: search_knowledge_base
  Description: "Search the IT knowledge base for answers to technical questions"
  Search profile: "IT Support Search"
  Result count: 5
```

The agent invokes this tool like any other tool. The platform handles the retrieval.

### Pattern 3: RAG with Custom Retrieval Script

For complex retrieval logic, use a script tool that calls the search API:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var query = String(inputs.question || "").trim();
        if (!query) {
            outputs.error = "question is required";
            outputs.status = "error";
            return outputs;
        }

        // Use the Search API to retrieve from Data Kit
        var search = new sn_search.Search();
        search.setQuery(query);
        search.setSearchProfile('it_support_search');
        search.setLimit(5);

        var results = search.execute();
        var articles = [];

        while (results.hasNext()) {
            var result = results.next();
            articles.push({
                title: result.getTitle(),
                snippet: result.getSnippet(),
                source: result.getRecordNumber(),
                score: result.getScore()
            });
        }

        outputs.articles = articles;
        outputs.count = articles.length;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Pattern 4: Multi-Source RAG

Retrieve from multiple sources and merge results:

```
Search Profile: "Comprehensive IT Search"
  Data sources:
    - IT Knowledge Base (kb_knowledge)
    - Incident Solutions (incident, filter: resolved)
    - Change Procedures (change_request, filter: successful)
  Result count: 10
  Deduplication: Enabled
```

This allows the agent to find answers across knowledge articles, past incident resolutions, and successful change procedures.

---

## Relevance Tuning

### Improving Retrieval Quality

| Problem | Solution |
|---------|----------|
| Results are not relevant | Increase relevance threshold (0.6 → 0.75) |
| Too few results returned | Decrease relevance threshold (0.75 → 0.5) |
| Results miss the right article | Adjust chunking — smaller chunks for specific answers |
| Results return entire articles | Adjust chunking — smaller chunks for focused retrieval |
| Results from wrong category | Add filter conditions to the search profile |
| Stale content in results | Increase ingestion frequency |

### Relevance Threshold Guide

| Threshold | Effect |
|-----------|--------|
| 0.3-0.4 | Very permissive — many results, some irrelevant |
| 0.5-0.6 | Balanced — good recall with reasonable precision |
| 0.7-0.8 | Strict — fewer results but higher relevance |
| 0.9+ | Very strict — may miss relevant content |

**Start at 0.6** and adjust based on testing.

### Chunking Size Impact

| Chunk Size | Retrieval Behavior |
|-----------|-------------------|
| Small (100-200 tokens) | Very specific answers, may lose context |
| Medium (300-500 tokens) | Good balance of specificity and context |
| Large (500-1000 tokens) | More context per chunk, less precise matching |

**Rule of thumb:** If your questions need specific facts → use smaller chunks. If your questions need broader understanding → use larger chunks.

---

## Voice Agent Considerations

For voice agents using search retrieval tools:

1. **Use a dedicated search profile** — not the same one used by text-based agents
2. **Configure for fewer results** (2-3 instead of 5-10) to reduce latency
3. **Prioritize short, factual content** — long articles don't work well in voice responses

```
Voice Search Profile:
  Name: "Voice IT Search"
  Data sources: ["IT Knowledge Base"]
  Result count: 3
  Relevance threshold: 0.7  (higher = fewer but more relevant)
  Filter: short_description IS NOT EMPTY
```

---

## Data Kit Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Embedding model is fixed | Cannot use custom embeddings | Use ServiceNow's provided model |
| Ingestion latency | New content isn't immediately searchable | Trigger manual re-ingestion for urgent content |
| Max chunk size | Limited by platform | Stay within recommended ranges |
| Cross-scope data | Data Kit respects application scope | Ensure data sources are in the correct scope |
| Attachment parsing | Not all file formats are supported | Stick to PDF, DOCX, TXT |

---

## Testing RAG Quality

### Manual Testing

1. Prepare 10-20 test questions with known correct answers
2. For each question, run the search profile and check:
   - Does the correct article appear in the results?
   - Is it in the top 3 results?
   - Is the relevant chunk retrieved (not a different section of the right article)?

### Automated Testing

```javascript
// Test retrieval quality via script
var testCases = [
    {question: "How do I reset my password?", expected_kb: "KB0001234"},
    {question: "VPN not connecting", expected_kb: "KB0005678"},
    {question: "Request new laptop", expected_kb: "KB0009012"}
];

var results = [];
for (var i = 0; i < testCases.length; i++) {
    var search = new sn_search.Search();
    search.setQuery(testCases[i].question);
    search.setSearchProfile('it_support_search');
    search.setLimit(5);

    var searchResults = search.execute();
    var found = false;
    var rank = -1;
    var position = 0;

    while (searchResults.hasNext()) {
        position++;
        var result = searchResults.next();
        if (result.getRecordNumber() === testCases[i].expected_kb) {
            found = true;
            rank = position;
            break;
        }
    }

    results.push({
        question: testCases[i].question,
        expected: testCases[i].expected_kb,
        found: found,
        rank: rank
    });
}
```

### Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Recall@5** | >80% | Correct answer in top 5 results |
| **Recall@3** | >60% | Correct answer in top 3 results |
| **MRR** (Mean Reciprocal Rank) | >0.5 | Average of 1/rank for correct answers |

---

## Related Resources

- [GenAI Framework](./genai-framework.md) — Skill architecture and prompt patterns
- [Now Assist Platform](./now-assist-platform.md) — Platform capabilities
- [Tool Script Rules](./tool-script-rules.md) — Script tool patterns for custom retrieval
- [Customer Interaction Patterns](./customer-interaction-patterns.md) — Channel-specific RAG considerations

---

*Patterns based on ServiceNow Zurich Data Kit documentation. Search API and retrieval patterns match Zurich platform capabilities.*
