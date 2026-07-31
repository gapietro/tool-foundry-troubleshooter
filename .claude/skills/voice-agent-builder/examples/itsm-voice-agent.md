# Example: ITSM Voice Agent with Twilio

> Complete setup for a voice-based IT service desk agent with Twilio telephony integration.

---

## Overview

This example creates a voice assistant with an "Incident Manager" agent that handles phone-based IT support calls. Callers can:
- Report new incidents
- Check status of existing incidents
- Request updates on open tickets

## Setup Steps

### 1. Voice Assistant

| Setting | Value |
|---------|-------|
| Name | IT Service Desk |
| Description | Phone-based IT support for incident reporting and status checks |
| Language | English |
| Welcome message | "Hello, you've reached the IT Service Desk. How can I help you today?" |

### 2. Twilio Configuration

1. Purchase a phone number in Twilio console
2. In ServiceNow: Assistant Designer > IT Service Desk > Edit > Communication > Twilio
3. Enter Twilio Auth Token
4. Copy the generated webhook URL
5. In Twilio: Phone Number > Voice Configuration > Webhook URL = (paste URL)

### 3. Authentication

| Setting | Value |
|---------|-------|
| Primary identification | Phone number |
| Fallback identification | Employee ID |
| Authentication method | Knowledge-based (last 4 of employee ID) |
| MFA | Single-factor (`glide.voice.authenticate.mfa_mandatory = false`) |

### 4. Safeguards

| Setting | Value |
|---------|-------|
| Fallback action | Connect to live agent |
| Capture details before handoff | Yes |
| Max call duration | 10 minutes |
| Inactivity reprompt | 30 seconds |
| Record producer | "IT Support Request" (for ticket creation fallback) |

### 5. AI Voice Agent: Incident Manager

| Setting | Value |
|---------|-------|
| Name | Incident Manager |
| Description | Handles incident reporting, status checks, and updates |
| Security | Any authenticated user |

**Instructions:**
```
You are an IT Service Desk agent handling phone calls. Be concise and conversational.

Step 1: Ask the caller what they need help with
Step 2: Determine if they want to:
   a) Report a new incident → use create_incident tool
   b) Check status → ask for incident number, use get_incident tool
   c) Add a comment → ask for incident number and comment, use add_comment tool
Step 3: Confirm the action was taken
Step 4: Ask if there's anything else you can help with
Step 5: If no, thank them and end the call

Keep responses brief — this is a phone conversation, not a text chat.
Never read out sys_ids or technical identifiers.
Use plain language for states (say "open" not "1", "in progress" not "2").
```

**Tools:**
1. `get_incident` (script) — Retrieve incident by number
2. `create_incident` (script) — Create new incident
3. `add_comment` (script) — Add work note to incident
4. `search_knowledge` (search retrieval) — Search KB for self-service solutions

### 6. Activation Checklist

- [x] Twilio channel configured
- [x] Authentication set up
- [x] Fallback to live agent configured
- [x] Incident Manager agent associated
- [x] All tools tested via AI Agent Studio > Testing

---

## Sample Conversations

**Caller reports new incident:**
```
Agent: Hello, you've reached the IT Service Desk. How can I help you today?
Caller: My laptop won't connect to the VPN
Agent: I'm sorry to hear that. Let me create an incident for you.
       Can you tell me which VPN client you're using?
Caller: Cisco AnyConnect
Agent: I've created incident INC0045123 for VPN connectivity issues
       with Cisco AnyConnect. A technician will be assigned shortly.
       Is there anything else I can help with?
```

**Caller checks status:**
```
Agent: Hello, you've reached the IT Service Desk. How can I help you today?
Caller: I want to check on my incident INC0045100
Agent: Let me look that up... Incident INC0045100 is currently in progress.
       It's assigned to the Network Support team. The last update was
       2 hours ago noting that the team is investigating the root cause.
       Would you like to add any comments?
```

---

*Example validated against ServiceNow Zurich voice agent documentation.*
