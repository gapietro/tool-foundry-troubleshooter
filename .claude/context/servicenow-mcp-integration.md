# ServiceNow MCP Integration Reference

> ServiceNow Zurich supports both MCP Server (expose SN to external AI) and MCP Client (consume external MCP servers from AI agents).

---

## MCP Server Console

The MCP Server Console allows administrators to expose ServiceNow functionality to external AI clients using the Model Context Protocol (MCP).

### Tables

| Table | API Name | Description |
|-------|----------|-------------|
| MCP Tool Definitions | `sn_mcp_tool_definition` | Tool definitions exposed via MCP |
| MCP Servers | `sn_mcp_server` | Server configurations |

### Setup

1. Navigate to: All > MCP Server Console
2. Create or configure MCP server endpoints
3. Define tools to expose via MCP protocol

### Authentication

MCP Server Console supports OAuth for external client authentication.

### Quickstart MCP Server

ServiceNow provides a quickstart MCP server for rapid setup. The quickstart server exposes common ServiceNow operations as MCP tools.

---

## MCP Client (AI Agent -> External MCP Servers)

The MCP Client allows ServiceNow AI agents to consume tools from external MCP servers.

### Plugin

`sn_mcp_client`

### Prerequisites

1. Generative AI Controller plugin (`com.sn.generative.ai`) installed
2. Latest Now Assist AI Agents plugin (`sn_aia`)
3. System property `sn_aia.enable_mcp_tool` set to `true`
4. Supports MCP Protocol version **2025-06-18**
5. Does NOT support PRM and Elicitation

### Tables

| Table | API Name | Description |
|-------|----------|-------------|
| MCP Execution Logs | `sn_mcp_execution_logs` | Request/response logs, method, tool/list call, session mapping |
| MCP Client Server Session Mappings | `sn_mcp_client_server_session_mapping` | Sessions mapped to server by capability |
| Model Context Protocol Servers | `sn_mcp_server` | List of configured MCP servers |

### Authentication Options for External MCP Servers

| Method | Description |
|--------|-------------|
| **OAuth 2.1** (Dynamic Registration) | Auto-registers client with MCP server |
| **OAuth 2.1** (Manual Registration) | Manual client registration |
| **API Key** | Simple key-based auth |
| **Others** | Manual Connection & Credential Alias |

**Grant types supported:** Authorization Code, Client Credentials

### Adding an MCP Server

Navigation: All > AI Agent Studio > Settings > Manage MCP Servers > New

Configure:
- Server URL
- Authentication method
- Connection/credential aliases

### Adding MCP Tool to an Agent

Navigation: All > AI Agent Studio > Create and manage > AI agents > [agent] > Add tools > MCP server tool

**MCP Tool Fields:**
| Field | Description |
|-------|-------------|
| Select MCP Server | Choose configured server |
| Select tool | Pick from discovered tools |
| Name | Tool name |
| Description | Description sent to LLM for tool selection |
| Execution Mode | `copilot` (UI: Supervised) or `autopilot` (UI: Autonomous) |
| Display output | Show output to user |
| Processing message | Message while tool executes |
| Output transformation strategy | How to transform raw output |

### Testing MCP Tools

Navigation: All > AI Agent Studio > Testing > Test AI reasoning tab

### Roles

| Role | Description |
|------|-------------|
| `sn_mcp_client.admin` | MCP Client admin (inherited from sn_aia.admin) |
| `sn_mcp_client.viewer` | MCP Client read-only (inherited from sn_aia.viewer) |

### Guardian Integration

Enable Guardian check for MCP tool executions:
1. Set `mcp_guardian_check = true` in agent properties
2. Enable Now Assist Guardian on AI Agent Studio Settings page
3. Both must be enabled for Guardian to check MCP tool inputs/outputs

### Gotchas

- `sn_aia.enable_mcp_tool` defaults to `false` -- must be explicitly enabled
- MCP Protocol version 2025-06-18 does NOT include PRM and Elicitation support
- When OAuth tokens expire, you must re-authenticate before adding MCP tools to agents
- `sn_mcp_client.cursor.max_iterations` controls pagination (0 = unlimited)
- Always test MCP tools in the Test AI reasoning tab before production use

---

*Validated against ServiceNow Zurich documentation.*
