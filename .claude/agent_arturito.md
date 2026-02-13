# Arturito - Agent Philosophy & Architecture

## Identity

**Role:** The Smart Receptionist. First point of contact for all users.
**Analogy:** The front desk of a corporate building. Doesn't need to do accounting, but knows who does, where everything is, and gets you where you need to go.
**Bot ID:** `00000000-0000-0000-0000-000000000001`
**Speed Target:** <2 seconds response time. Fastest agent.

## Operating Principles

1. **Speed over depth.** If regex can resolve it, never call GPT. If navigation solves it, don't process data.
2. **Explicit delegation.** If it's Andrew's or Daneel's job, say so clearly with actionable instructions.
3. **UI Copilot.** The ONLY agent that controls the user's interface (filter, sort, navigate, open modals).
4. **Transparent limitations.** If unknown input: list capabilities contextually. Never invent answers about data.
5. **Bilingual.** Responds in whatever language the user writes (EN/ES).

## Personality

- 5-level sarcasm scale (1=corporate, 5=ultra sarcastic), default=4
- Core voice: "Sarcastic but competent co-worker who knows everything about the company systems"
- Stored in-memory per space_id (volatile, resets on restart)

## Architecture

### Message Flow
```
User message --> Slash command check (/bva, /pnl, /help, /sarcasmo)
    |                  |
    | (no slash)       +--> route_slash_command() --> handler --> response
    v
interpret_message() [NLU]
    |
    +--> interpret_local() [regex, <50ms]
    |       Match? --> return intent + entities
    |       No match? --> fall through
    |
    +--> interpret_with_gpt() [GPT mini, <2s]
    v
route() or route_async() [Dispatch]
    |
    +--> Permission check (global + RBAC)
    +--> ROUTES table lookup --> handler function
    +--> Special: GREETING/SMALL_TALK --> OpenAI Assistants API (web) or generate_small_talk()
```

### Key Files (Backend)
| File | Purpose |
|------|---------|
| `api/routers/arturito.py` | 3 entry points: /message (Google Chat), /web-chat (NGM HUB), /webhook |
| `services/arturito/nlu.py` | NLU engine: regex (25 intents) + GPT fallback + VALID_INTENTS list |
| `services/arturito/router.py` | ROUTES dict (22 routes) + dispatch + slash commands |
| `services/arturito/permissions.py` | Global on/off + RBAC per role (in-memory, volatile) |
| `services/arturito/persona.py` | 5-level personality system |
| `services/arturito/handlers/*.py` | Intent handlers (bva, pnl, info, sow, ngm_hub, copilot, vault) |

### Key Files (Frontend)
| File | Purpose |
|------|---------|
| `arturito.html` + `arturito.js` | Full-page chat with OpenAI Assistants API thread memory |
| `arturito_widget.js` | Floating bubble on all pages, copilot mode with page-specific handlers |
| `arturito_analytics.js` | Command analytics dashboard in Agent Hub settings |

## Current Capabilities (25 intents)

### CRITICAL - Do Not Break
These flows have active users making business decisions based on them:
- **BUDGET_VS_ACTUALS** - BVA reports with project filtering
- **PNL_COGS** - P&L reports with project filtering
- **CONSULTA_ESPECIFICA** - Category-specific budget queries with construction term detection

### Navigation & Copilot
- **NGM_ACTION** - 30+ navigation patterns (open expenses, go to pipeline, etc.)
- **COPILOT** - Page-level commands (filter, sort, search, expand, collapse)
- **NGM_HELP** - UI/system location help with module keyword matching

### CRUD Operations
- **LIST_PROJECTS** / **CREATE_PROJECT**
- **LIST_VENDORS** / **CREATE_VENDOR**
- **SEARCH_EXPENSES** - Multi-entity extraction (amount, vendor, category, project)

### Data Vault
- **VAULT_UPLOAD** / **VAULT_CREATE_FOLDER** / **VAULT_SEARCH** / **VAULT_LIST** / **VAULT_DELETE** / **VAULT_ORGANIZE**

### Conversational
- **GREETING** / **SMALL_TALK** / **INFO** / **SET_PERSONALITY**

### Operational
- **REPORT_BUG** / **EXPENSE_REMINDER** / **SCOPE_OF_WORK**

## Permissions System

### Layer 1: Global Action Permissions
Static dict `ARTURITO_PERMISSIONS` with enabled/disabled + risk_level per intent.
- Delete/Update operations: disabled by default
- Read/Create/Navigation: enabled by default
- Modifiable at runtime via API (CEO/COO only), but IN-MEMORY (resets on restart)

### Layer 2: Role-Based Access (RBAC)
`INTENT_ROLE_PERMISSIONS` maps intents to allowed roles.
- If role not in list: returns delegation suggestion ("That's a task for [Team]. Want me to send a request?")
- If no RBAC config for intent: implicitly allowed

**Persistence:** Permissions are now stored in `agent_config` table with keys `arturito_perm_<INTENT>`. Loaded on startup, saved on every change via `save_permission_to_db()`. Server restart = loads from DB.

## Learning Mechanisms

### Active Systems

| System | Table | Status |
|--------|-------|--------|
| **Intent log** | `arturito_intent_log` | Implemented. Logs every intent: user, raw_text, detected_intent, confidence, source (local/gpt), action_result, processing_ms, delegated_to. |
| **User patterns** | `arturito_user_patterns` | Implemented. Auto-updated via `log_arturito_intent()` RPC. Tracks per-user intent frequency (hit_count, last_used). |
| **Delegation tracking** | Field `delegated_to` in intent log | Implemented. Tracks when Arturito redirects to Andrew/Daneel. |

### Not Yet Built

| System | Purpose |
|--------|---------|
| **Proactive suggestions** | Use `arturito_user_patterns` to suggest top intents per user |
| **NLU auto-tuning** | Analyze intent log to find patterns where GPT fallback triggers frequently -> add regex |

## Adding a New Capability (Checklist)

### Standard procedure (4 files minimum, 6 if permissions needed):

**Required (always):**

| Step | File | What to do |
|------|------|-----------|
| 1 | `services/arturito/nlu.py` | Add to `VALID_INTENTS` list + add regex patterns in `interpret_local()` + add to `NLU_SYSTEM_PROMPT` |
| 2 | `services/arturito/handlers/<file>.py` | Implement handler function |
| 3 | `services/arturito/handlers/__init__.py` | Export the handler |
| 4 | `services/arturito/router.py` | Import handler + add to `ROUTES` dict + add to `_CAPABILITY_GROUPS` for transparency |

**Optional (if permission-gated):**

| Step | File | What to do |
|------|------|-----------|
| 5 | `services/arturito/permissions.py` | Add to `ARTURITO_PERMISSIONS` and `INTENT_ROLE_PERMISSIONS` |
| 6 | `services/arturito/permissions.py` | Add default to `reset_permissions_to_defaults()` |

### Handler template:
```python
# services/arturito/handlers/<my_handler>.py
from typing import Dict, Any

def handle_my_capability(request: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle MY_CAPABILITY intent.

    Args:
        request: {intent, entities, raw_text, confidence}
        context: {user_name, user_email, user_role, space_id, current_page}

    Returns:
        {text: str, action: str, data: dict (optional)}
    """
    entities = request.get("entities", {})
    # ... implementation ...
    return {
        "text": "Result message",
        "action": "my_capability_result",
    }
```

### ROUTES entry template:
```python
"MY_CAPABILITY": {
    "handler": handle_my_capability,
    "required_entities": [],
    "optional_entities": ["param1", "param2"],
    "description": "What this capability does",
},
```

### Capability group entry (for transparency messages):
Add to `_CAPABILITY_GROUPS` in router.py under the appropriate category:
```python
"Category": [
    ("trigger phrase", "Short description of what it does"),
],
```

## Self-Awareness Rules

When Arturito does NOT understand:
- **DO:** Show contextual capability menu based on current page
- **DO:** Suggest the most likely intent if confidence is 0.3-0.5
- **DON'T:** Invent answers about data it hasn't queried
- **DON'T:** Silently fall through to generic small talk for action-like messages

When Arturito does NOT have permission:
- **DO:** Name the specific permission and which role can grant it
- **DO:** Offer to send a delegation request to the responsible team

When something is another agent's domain:
- **DO:** Name the agent, explain what they do, and how to invoke them
- **DON'T:** Attempt to handle it partially
