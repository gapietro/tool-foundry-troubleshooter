# Customer Interaction Patterns — ServiceNow AI Agents (Zurich)

> How end users interact with AI agents: Now Assist panel, Virtual Agent, Service Portal, Employee Center, and embedded agent experiences. Covers integration points, UX considerations, and channel-specific design patterns.

---

## Overview

AI agents can reach end users through multiple channels in ServiceNow. Each channel has different capabilities, constraints, and user expectations. Choosing the right channel — and designing the agent experience for that channel — is critical for adoption.

This document covers the five primary interaction channels and their design considerations.

---

## Interaction Channels

```
┌──────────────────────────────────────────────────────────────┐
│                   End User Touchpoints                        │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Now Assist  │  │   Virtual    │  │  Service Portal    │  │
│  │   Panel     │  │    Agent     │  │   / Employee Ctr   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌────────┴───────────┐  │
│  │  Workspace  │  │    Chat      │  │   Web Widgets /    │  │
│  │  Side Panel │  │   Interface  │  │   UX Builder       │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │    Voice    │  │     API      │                          │
│  │   (Phone)   │  │  (Headless)  │                          │
│  └─────────────┘  └──────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Channel 1: Now Assist Panel

### What It Is

A side panel in the Agent Workspace (and other UIs) that provides AI-powered assistance to IT agents and other workspace users. This is the primary "assist" experience.

### User Profile

- **Who:** IT agents, support staff, service desk operators
- **Context:** User is already working on a record (incident, case, etc.)
- **Expectation:** Quick, contextual help related to the current record

### Capabilities

| Capability | Description |
|-----------|-------------|
| **Summarize** | Summarize the current record's details and history |
| **Suggest resolution** | Recommend resolution based on similar past incidents |
| **Draft response** | Generate a customer-facing response |
| **Search knowledge** | Find relevant KB articles |
| **Custom skills** | Any registered Now Assist skill |

### Design Patterns

**Contextual Awareness:** The panel knows which record the user is viewing. Skills can access the current record's sys_id and table name.

```
Skill Input (automatic):
  - current_record_sys_id: "abc123..."
  - current_record_table: "incident"
  - user_sys_id: "def456..."
```

**Response Format:** Keep responses short — the panel is a narrow sidebar. Aim for:
- Summary: 3-5 sentences
- Suggestions: 3-5 bullet points
- Actions: Clear buttons/links

**Streaming:** Now Assist supports streaming responses for skills, so users see text appearing progressively rather than waiting for the full response.

### Limitations

- No complex forms or multi-step wizards in the panel
- Limited rendering (markdown text, lists, basic formatting)
- Panel context is one record at a time

---

## Channel 2: Virtual Agent (VA)

### What It Is

A chat interface for end users to interact with AI agents conversationally. Available in Service Portal, Employee Center, and Mobile.

### User Profile

- **Who:** End users (employees, customers)
- **Context:** User has a problem or request and is starting a conversation
- **Expectation:** Conversational, guided interaction — like chatting with a help desk

### Capabilities

| Capability | Description |
|-----------|-------------|
| **Topic flows** | Guided conversation paths for specific request types |
| **Free text** | Natural language understanding for unstructured input |
| **AI agent routing** | Route to an AI agent for complex reasoning |
| **Live agent handoff** | Transfer to a human agent when needed |
| **Card rendering** | Rich responses with buttons, links, and forms |

### Integration with AI Agents

Virtual Agent can invoke AI agents via the **Chat trigger** type:

```
User message → VA NLU → Topic/Intent → AI Agent (Chat trigger) → Agent response → VA message
```

### Design Patterns

**Conversation Flow:** Structure agent responses for chat:

```
Agent response format for VA:
1. Acknowledge: "I understand you're having trouble with [issue]."
2. Action/Question: "Let me look into that." or "Can you tell me [detail]?"
3. Result: "I found [result]. Here's what I recommend..."
4. Next step: "Would you like me to [action], or is there anything else?"
```

**Rich Responses:** VA supports cards with buttons:

```javascript
// Tool output that renders as a card in VA
outputs.result = JSON.stringify({
    type: "card",
    title: "Incident Created",
    body: "Your incident INC0010042 has been created.",
    actions: [
        {label: "View Incident", url: "/nav_to.do?uri=incident.do?sys_id=..."},
        {label: "Check Status Later", action: "close"}
    ]
});
```

**Live Agent Handoff:** When the AI agent can't resolve the issue:

```
Instructions addition:
"If you cannot resolve the issue after 2 attempts, or if the user asks for a human,
respond with: 'Let me connect you with a support agent who can help further.'
The system will automatically transfer the conversation to a live agent."
```

### Limitations

- VA conversations are stateless between sessions
- Complex data visualization is limited in chat
- Voice VA has additional constraints (string-only I/O)

---

## Channel 3: Service Portal / Employee Center

### What It Is

Web interfaces where end users browse services, submit requests, and self-serve. Employee Center is the newer, configurable alternative to Service Portal.

### User Profile

- **Who:** End users browsing for help or submitting requests
- **Context:** User is navigating a portal, may not have a specific conversation started
- **Expectation:** Self-service with AI assistance embedded in the experience

### Integration Points

| Component | AI Integration |
|-----------|---------------|
| **Search** | AI-enhanced search results (Now Assist Search) |
| **Catalog** | AI-powered catalog item recommendations |
| **KB articles** | AI-generated answers from knowledge base |
| **Widgets** | Custom Service Portal widgets with AI functionality |
| **UX Builder** | Custom Employee Center pages with AI components |

### Design Patterns

**Embedded Chat:** Add Virtual Agent chat widget to portal pages for conversational AI access.

**AI-Enhanced Search:** Configure Now Assist Search to provide AI-generated answers alongside traditional search results.

```
User searches: "how to reset my password"
Results:
  1. [AI Answer] "To reset your password, go to Settings > Security > Change Password..."
  2. [KB Article] KB0001234: Password Reset Procedure
  3. [Catalog Item] Password Reset Request
```

**Proactive Suggestions:** Use AI to suggest relevant content based on the user's context:

```
User on Employee Center homepage:
  - "Based on your recent incidents, you might find these helpful:"
  - KB article about VPN setup
  - Catalog item for software request
```

---

## Channel 4: Voice (Phone)

### What It Is

Voice-based interaction through ServiceNow's voice agent capability, allowing users to speak with an AI agent over the phone.

### User Profile

- **Who:** End users calling a support line
- **Context:** User is on a phone, cannot see a screen
- **Expectation:** Natural spoken interaction, quick resolution

### Design Constraints

| Constraint | Impact |
|-----------|--------|
| **String-only I/O** | All tool inputs and outputs must be `string` type |
| **No visual output** | Cannot show tables, cards, or formatted text |
| **Latency sensitivity** | Users expect <3 second response times |
| **No links or sys_ids** | Responses must be fully spoken/readable |
| **Reduced search profiles** | Use dedicated search profiles for faster retrieval |

### Design Patterns

**Natural Language Responses:**

```javascript
// BAD — not voice-friendly
outputs.result = JSON.stringify({number: "INC0010001", state: "In Progress", priority: "2"});

// GOOD — voice-friendly
outputs.result = "Your incident I-N-C-0-0-1-0-0-0-1 is currently in progress with high priority. " +
    "It was last updated 2 hours ago and is assigned to the network support team.";
```

**Confirmation Patterns:**

```
Agent instructions for voice:
"After taking any action, read back what you did and ask for confirmation.
For example: 'I've created a new incident for your network issue with high priority.
The incident number is I-N-C-0-0-1-0-0-4-2. Would you like me to do anything else?'"
```

**Spell-Out Pattern:** For numbers and codes, spell them out:

```javascript
// Format incident number for voice
var number = gr.getValue('number');
outputs.result = "Your incident number is " + number.split('').join('-');
// "Your incident number is I-N-C-0-0-1-0-0-0-1"
```

### Limitations

- No multi-turn file upload
- No visual confirmation of data entry
- Background noise can cause transcription errors
- Longer conversations may hit timeout limits

---

## Channel 5: API (Headless)

### What It Is

Programmatic invocation of AI agents without any user interface — for automation, integration, and batch processing.

### User Profile

- **Who:** Systems, not humans
- **Context:** Another application or workflow is calling the agent
- **Expectation:** Structured input/output, reliable execution, no user interaction

### Invocation

```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();
var resp = runtime.startAiAgentConversation({
    targetRecordId: recordSysId,
    targetTable: 'incident',
    agentId: agentSysId,
    objective: 'Classify this incident',
    canInteractWithUser: false
});
```

### Design Patterns

**Structured Output:** API consumers need predictable output formats:

```
Agent instructions:
"Always return your results as a JSON object in the work notes field with these exact keys:
{
  'category': '...',
  'priority': '...',
  'assignment_group': '...',
  'confidence': 0.0-1.0,
  'reasoning': '...'
}
Do not include any text outside the JSON object."
```

**Batch Processing:** For scheduled triggers processing multiple records:

```
Agent instructions:
"Process the target record completely and independently.
Do not reference or depend on results from other records.
Each invocation handles exactly one record."
```

---

## Channel Selection Guide

| User Need | Recommended Channel | Why |
|-----------|-------------------|-----|
| Agent needs AI help while working on a ticket | Now Assist Panel | Contextual, in-workflow |
| End user has a problem and wants to chat | Virtual Agent | Conversational, guided |
| End user browsing for self-service | Service Portal / Employee Center | Embedded, discoverable |
| User calling on the phone | Voice | Accessible, hands-free |
| Automated process needs AI reasoning | API | No UI needed, batch-friendly |
| Scheduled batch processing | API (Scheduled trigger) | Automated, scalable |

---

## Cross-Channel Considerations

### Consistent Agent Identity

If the same agent serves multiple channels, adjust the output format per channel but keep the logic consistent:

```
Agent instructions:
"Your analysis logic is the same regardless of channel.
However, format your response based on how you were invoked:
- If the user is present (chat): Use conversational language, ask follow-up questions
- If canInteractWithUser is false (API/trigger): Return structured JSON in work notes
- If the context suggests voice: Use spoken-language format with spelled-out numbers"
```

### Multi-Channel Testing

Test each agent across all intended channels:

| Test | What to Verify |
|------|---------------|
| Chat | Conversational flow is natural, cards render correctly |
| Voice | Responses are speakable, no sys_ids or JSON in speech |
| API | Output is structured, no conversational filler text |
| Panel | Responses fit in sidebar width, are concise |

---

## Related Resources

- [Now Assist Platform](./now-assist-platform.md) — Platform architecture
- [Agentic Patterns](./agentic-patterns.md) — Agent strategies and triggers
- [Prompt Engineering Patterns](./prompt-engineering-patterns.md) — Channel-specific prompting
- [Agent Instruction Templates](./agent-instruction-templates.md) — Strategy templates

---

*Channel patterns validated against ServiceNow Zurich. Voice agent constraints from Zurich voice agent documentation.*
