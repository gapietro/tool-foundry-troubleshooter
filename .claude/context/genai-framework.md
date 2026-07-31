# GenAI Framework Context

> This document covers the GenAI Controller and skill development patterns for Now Assist.

---

## GenAI Controller Overview

The GenAI Controller is the orchestration layer that manages all generative AI operations in ServiceNow. It handles:

- Skill routing and execution
- Prompt template management
- LLM provider abstraction
- Response processing and formatting

## Skill Architecture

### What is a Skill?

A skill is a packaged unit of GenAI functionality that:
- Has a defined purpose (summarize, generate, classify, etc.)
- Accepts structured input
- Produces structured output
- Can be invoked via API, Flow Designer, or UI

### Skill Components

```
┌────────────────────────────────────────────┐
│                  Skill                      │
├────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────────┐  │
│  │   Manifest   │  │  Prompt Template   │  │
│  │  (metadata)  │  │   (instructions)   │  │
│  └──────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │ Input Schema │  │  Output Processor  │  │
│  │  (validation)│  │   (formatting)     │  │
│  └──────────────┘  └────────────────────┘  │
└────────────────────────────────────────────┘
```

### Skill Manifest Structure

```json
{
  "skill_id": "custom_summarizer",
  "name": "Custom Case Summarizer",
  "description": "Summarizes cases with domain-specific focus",
  "version": "1.0.0",
  "category": "summarization",
  "input_schema": {
    "type": "object",
    "required": ["case_sys_id"],
    "properties": {
      "case_sys_id": {
        "type": "string",
        "description": "Sys ID of the case to summarize"
      },
      "focus_areas": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Areas to emphasize in summary"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "summary": { "type": "string" },
      "key_points": { "type": "array" },
      "recommended_actions": { "type": "array" }
    }
  },
  "configuration": {
    "model_preference": "gpt-4",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

## Prompt Engineering

### Prompt Template Structure

```javascript
var promptTemplate = {
    system: `You are a ServiceNow case analyst. Your role is to provide
             clear, actionable summaries of support cases.`,

    user: `Summarize the following case:

           Case Number: {{case.number}}
           Short Description: {{case.short_description}}
           Description: {{case.description}}

           Comments:
           {{#each comments}}
           - [{{this.created_on}}] {{this.author}}: {{this.value}}
           {{/each}}

           Focus on: {{focus_areas}}

           Provide:
           1. A brief summary (2-3 sentences)
           2. Key points (bullet list)
           3. Recommended next actions`,

    assistant_prefix: `## Case Summary\n\n`
};
```

### Prompt Best Practices

1. **Be Specific About Format**
   ```
   // Good
   "Return a JSON object with keys: summary, confidence, sources"

   // Bad
   "Summarize this data"
   ```

2. **Provide Examples (Few-shot)**
   ```
   Example input: "Server is down, users cannot login"
   Example output: {
     "category": "infrastructure",
     "urgency": "high",
     "affected_service": "authentication"
   }
   ```

3. **Set Clear Boundaries**
   ```
   "Only use information provided in the context.
    Do not make assumptions about data not present.
    If information is missing, indicate 'Not specified'."
   ```

4. **Handle Edge Cases**
   ```
   "If the case has no comments, state 'No additional context available'
    rather than leaving the section empty."
   ```

## Skill Development Patterns

### Pattern 1: Context Gathering Skill

Collects and prepares data before LLM invocation.

```javascript
// Skill: gather_case_context
var GatherCaseContext = Class.create();
GatherCaseContext.prototype = {

    execute: function(input) {
        var caseGR = new GlideRecord('sn_customerservice_case');
        caseGR.get(input.case_sys_id);

        return {
            case: this._extractCaseData(caseGR),
            comments: this._getComments(input.case_sys_id),
            related_incidents: this._getRelatedIncidents(caseGR),
            customer_history: this._getCustomerHistory(caseGR.account)
        };
    },

    _extractCaseData: function(gr) {
        return {
            number: gr.number.toString(),
            short_description: gr.short_description.toString(),
            description: gr.description.toString(),
            state: gr.state.getDisplayValue(),
            priority: gr.priority.getDisplayValue(),
            created: gr.sys_created_on.toString()
        };
    },

    // ... additional helper methods
};
```

### Pattern 2: Chain-of-Thought Skill

Breaks complex reasoning into steps.

```javascript
// Skill: analyze_root_cause
var steps = [
    {
        name: 'extract_symptoms',
        prompt: 'List all symptoms mentioned in this incident...'
    },
    {
        name: 'identify_patterns',
        prompt: 'Based on these symptoms, identify potential patterns...',
        depends_on: 'extract_symptoms'
    },
    {
        name: 'determine_cause',
        prompt: 'Given the patterns identified, determine the most likely root cause...',
        depends_on: 'identify_patterns'
    }
];

// Execute steps sequentially, passing results forward
var results = {};
steps.forEach(function(step) {
    var context = step.depends_on ? results[step.depends_on] : input;
    results[step.name] = controller.executePrompt(step.prompt, context);
});
```

### Pattern 3: Validation & Fallback Skill

Includes validation and graceful degradation.

```javascript
// Skill: generate_response_with_validation
var GenerateWithValidation = Class.create();
GenerateWithValidation.prototype = {

    execute: function(input) {
        // Attempt primary generation
        var result = this._generate(input, 'gpt-4');

        // Validate output
        if (!this._isValid(result)) {
            // Retry with more explicit instructions
            result = this._generate(input, 'gpt-4', {
                additional_instructions: this.VALIDATION_PROMPT
            });
        }

        // Fallback if still invalid
        if (!this._isValid(result)) {
            return this._fallbackResponse(input);
        }

        return result;
    },

    _isValid: function(result) {
        // Check required fields present
        // Check format matches schema
        // Check content passes safety filters
        return true; // validation logic
    },

    _fallbackResponse: function(input) {
        return {
            status: 'fallback',
            message: 'Unable to generate response. Please review manually.',
            original_input: input
        };
    }
};
```

### Pattern 4: Retrieval-Augmented Generation (RAG)

Enhances generation with retrieved context.

```javascript
// Skill: answer_with_knowledge
var AnswerWithKnowledge = Class.create();
AnswerWithKnowledge.prototype = {

    execute: function(input) {
        // 1. Search knowledge base
        var relevantArticles = this._searchKnowledge(input.question);

        // 2. Build context from articles
        var context = this._buildContext(relevantArticles);

        // 3. Generate answer with context
        var prompt = `
            Answer the following question using ONLY the provided context.
            If the answer is not in the context, say "I don't have information about that."

            Context:
            ${context}

            Question: ${input.question}
        `;

        var answer = controller.executePrompt(prompt);

        // 4. Return with sources
        return {
            answer: answer,
            sources: relevantArticles.map(a => a.number),
            confidence: this._calculateConfidence(answer, relevantArticles)
        };
    }
};
```

## Testing Skills

### Unit Testing

```javascript
// Test skill execution
describe('CustomSummarizer', function() {

    it('should summarize case with all fields', function() {
        var input = {
            case_sys_id: 'test_case_001',
            focus_areas: ['timeline', 'resolution']
        };

        var result = skill.execute(input);

        expect(result.summary).toBeDefined();
        expect(result.summary.length).toBeGreaterThan(50);
        expect(result.key_points).toBeArray();
    });

    it('should handle missing comments gracefully', function() {
        var input = {
            case_sys_id: 'case_no_comments'
        };

        var result = skill.execute(input);

        expect(result.summary).toContain('No additional context');
    });
});
```

### Integration Testing

```javascript
// Test against a real instance via One Extend (no sn_genai.GenAIController class exists)
var capabilityId = 'custom_summarizer_capability_sys_id';
var resp = sn_one_extend.OneExtendUtil.execute({
    executionRequests: [{ capabilityId: capabilityId, payload: testInput }]
});
var result = resp.capabilities[capabilityId];

gs.info('Skill execution result: ' + JSON.stringify(result));
// Manually verify output quality
```

## Performance Considerations

| Factor | Recommendation |
|--------|----------------|
| **Token Usage** | Keep prompts concise; summarize context before sending |
| **Latency** | Use streaming for long responses; set appropriate timeouts |
| **Caching** | Cache repeated queries; use prompt fingerprinting |
| **Batching** | Group similar requests when possible |

## Error Handling

```javascript
try {
    var resp = sn_one_extend.OneExtendUtil.execute({
        executionRequests: [{ capabilityId: capabilityId, payload: input }]
    });
    var result = resp.capabilities[capabilityId];

    if (result.status === 'error') {
        // Handle skill-level error
        handleSkillError(result.error);
    }

} catch (e) {
    // Handle system-level error
    if (e.message.includes('rate_limit')) {
        // Implement exponential backoff
        retryWithBackoff(skillId, input);
    } else if (e.message.includes('timeout')) {
        // Simplify request or increase timeout
        retryWithSimplifiedInput(skillId, input);
    } else {
        // Log and escalate
        gs.error('GenAI Controller error: ' + e.message);
        throw e;
    }
}
```

---

## GenAI Controller Architecture (Zurich)

The GenAI Controller in Zurich follows a capability chain:

```
Capability → Skill → Prompt Template → LLM Provider → Response
```

### Capability Framework

The `sys_one_extend_*` tables form the capability registration system:
- `sys_one_extend_capability` — Top-level capability registration
- `sys_one_extend_capability_definition` — API surface definition (CRITICAL: `api` and `api_type` fields)
- `sys_one_extend_definition_config` — Default configuration (CRITICAL: `default=true`)
- `sys_one_extend_definition_attribute` — Input/output schema attributes

### Provider and Model Configuration (BYOLLM)

Zurich supports Bring Your Own LLM:

| Provider | Connection URL Format | Default Model |
|----------|----------------------|---------------|
| Azure OpenAI | `https://{resource}.openai.azure.com` | GPT-4 |
| Amazon Bedrock | IAM user with `bedrock:InvokeModel` | Amazon Titan |
| Google Vertex AI | Vertex AI endpoint | Gemini |
| Now LLM Service | ServiceNow-hosted | Now LLM |

Custom providers can be added via custom transformers that implement request/response translation.

### Advanced Features

- **Recursive Summarization**: Breaks long content into chunks, summarizes each, then summarizes the summaries. May cause slower processing due to multiple LLM calls.
- **Dynamic Translation**: Translates skill outputs to user's preferred language. Not available for Virtual Agent or Now Assist panel capabilities.
- **Web Search Integration**: Some skills can augment responses with web search results. NOT supported by Azure OpenAI.

### Limitations

- GenAI Controller only supports **text generation** (no image/audio)
- Only one provider can be default per capability at a time
- Capabilities from other Now Assist applications use Now LLM Service and cannot be reconfigured
- GenAI log data retained for 6 months by default
