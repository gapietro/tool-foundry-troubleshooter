# Building Discipline

> Always ask before building. Clarification prevents rework.

---

## The Core Rule

**When asked to build, create, or implement anything: STOP and ASK FIRST.**

This applies to ALL creation tasks:
- Skills, functions, scripts, APIs
- Features, buttons, UI components
- Integrations, workflows, automations
- Documentation, templates, configs

## Why This Matters

Building without clarification leads to:
- Wasted effort on wrong solutions
- Multiple revision cycles
- Frustration for everyone
- Features that miss the mark

A few questions upfront saves hours of rework.

## The Process

```
User Request → STOP → ASK Questions → Get Answers → THEN Build
```

### Step 1: STOP

When you see a build request, pause. Do not:
- Generate code
- Create files
- Write implementations
- Produce solutions

### Step 2: ASK

Use the `AskUserQuestion` tool to clarify:

| Question | Why It Matters |
|----------|----------------|
| What problem does this solve? | Ensures you understand the goal |
| Who will use this? | Affects design decisions |
| What inputs are expected? | Defines the interface |
| What outputs are needed? | Defines success criteria |
| What happens on errors? | Prevents fragile solutions |

### Step 3: GET ANSWERS

Wait for the user to respond. Do not proceed until you have clarity on at least:
- The core purpose
- The expected behavior
- The success criteria

### Step 4: THEN BUILD

Only after clarification, proceed with implementation. Reference the answers in your solution.

## Example Interaction

**User:** "Create a function to validate email addresses"

**Wrong Response:**
```javascript
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**Correct Response:**
"Before I build this, let me clarify a few things:"
- Should it just check format, or also verify the domain exists?
- Are there specific domains to allow/block (e.g., company emails only)?
- What should it return - boolean, error message, or detailed validation result?
- Should it handle edge cases like plus-addressing (user+tag@example.com)?

## When to Use Brainstorming

For complex or ambiguous requests, invoke the `/brainstorming` workflow:

- Multi-component systems
- Architectural decisions
- Features with many possible approaches
- Anything that will take more than 30 minutes to build

Brainstorming explores the problem space before committing to a solution.

## Skip Conditions

Users can skip this discipline by explicitly saying:
- "Just build it"
- "Skip the questions"
- "Here's the detailed spec: [full requirements]"
- "Same as we did for X"

If the user provides detailed acceptance criteria upfront, you may proceed without additional questions.

## Remember

- Questions are not delays; they're investments
- Users appreciate being asked rather than receiving wrong solutions
- A 2-minute clarification prevents a 2-hour rewrite
- When in doubt, ASK

---

**This discipline applies to ALL skills and tools in this project.**
