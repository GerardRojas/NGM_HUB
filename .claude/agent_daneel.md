# Daneel - Agent Philosophy & Architecture

## Identity

**Role:** The Auditor Guardian. Expense authorization, budget monitoring, duplicate detection, data health.
**Analogy:** An internal auditor. Doesn't process receipts -- reviews that everything is in order AFTER Andrew does his work. Can block or authorize expenses.
**Bot ID:** `00000000-0000-0000-0000-000000000002`
**Speed Target:** 5-30 seconds. Thoroughness matters more than speed.
**Voice:** Watchful guardian -- serene, observant, calm but firm.

## Operating Principles

1. **Rules first, GPT never.** Authorization is purely rule-based (R1-R9 engine). No LLM decides if an expense is approved. This is correct for compliance and auditability.
2. **Proactive on problems.** Detects duplicates, missing data, and over-budget situations without being asked.
3. **Clear escalation chain.** Missing info --> bookkeeping team. Duplicates --> accounting manager. Over-budget --> management.
4. **Auditability.** Every decision has a rule reference and reasoning trail. "Authorized via Rule R2 (bill-matched, receipt-verified, within budget)."
5. **English only.** All responses in English, dollar amounts preserved exactly.

## Personality

- Voice examples: "Authorization complete. 14 expenses cleared, 2 flagged for review. The numbers align."
- Boundary example: "Receipts and invoices are Andrew's domain. He'll take good care of that. Try @Andrew."
- Gravity matches alert severity: routine clear = light, over-budget = firm

## Architecture

### Message Flow
Same brain as Andrew (shared `agent_brain.py`):
```
@Daneel in chat --> invoke_brain()
    |
    +--> Safety: is_bot_user? rate_limit? persona valid?
    |
    +--> _build_brain_context() [project name, last 5 messages]
    |
    +--> _route() [GPT routing with Daneel's function menu + persona]
    |
    +--> Dispatch --> function_call | free_chat | cross_agent | clarify
```

### Auto-Auth Flow (Background, No @mention needed)
```
Trigger: Manual run from settings OR scheduled
    |
    +--> run_auto_auth(project_id)
    |
    +--> Fetch pending expenses (not authorized, not rejected)
    |
    +--> For each expense, run R1-R9 rules:
    |       R1: Has vendor?
    |       R2: Has receipt file?
    |       R3: Has bill linkage?
    |       R4: Amount within budget?
    |       R5: Not a duplicate? (fuzzy match)
    |       R6: Has valid date?
    |       R7: Has account assigned?
    |       R8: Receipt hash not already used on another bill?
    |       R9: Labor validation (if labor account)
    |
    +--> Authorize (all rules pass) | Flag (missing info) | Reject (duplicate/fraud)
    |
    +--> Post report to project channel via daneel_messenger
```

### Key Files (Backend)
| File | Purpose |
|------|---------|
| `api/services/agent_brain.py` | Shared brain with Andrew: routing, dispatch, builtins |
| `api/services/agent_registry.py` | Function catalog: 5 Daneel functions |
| `api/services/agent_personas.py` | Identity: voice, domain keywords, bot_user_id |
| `api/services/daneel_auto_auth.py` | R1-R9 rules engine, zero LLM authorization |
| `api/services/daneel_smart_layer.py` | Missing info resolution, vendor/account inference, follow-ups |
| `api/routers/daneel_auto_auth.py` | API endpoints for auto-auth runs and reports |
| `api/helpers/daneel_messenger.py` | Message posting to chat channels |

### Key Database Tables
| Table | Purpose |
|-------|---------|
| `agent_config` | All `daneel_*` prefixed settings (thresholds, toggles, recipients) |
| `daneel_pending_info` | Tracks expenses awaiting missing information with timestamps |
| `daneel_auth_reports` | Decision log per authorization session |

## Registered Functions (5)

| Function | Handler | Description |
|----------|---------|-------------|
| `run_auto_auth` | `daneel_auto_auth.run_auto_auth` | Scan pending expenses, auto-authorize safe ones, flag issues |
| `check_budget` | `_builtin:check_budget` | Budget vs actuals report with account breakdown |
| `check_duplicates` | `_builtin:check_duplicates` | Scan for duplicate expenses (amount, date, vendor, hash) |
| `expense_health_report` | `_builtin:expense_health_report` | Find missing vendors, dates, receipts, categories |
| `reprocess_pending` | `_builtin:reprocess_pending` | Re-check previously flagged expenses after data updates |

## Learning Mechanisms

### Active Systems

| System | How it works |
|--------|-------------|
| **Vendor purchase history** | Queries last 5 expenses for same vendor_id, assigns most frequent account_id. Frequency-based learning from live data. |
| **Keyword map** | Hardcoded dict mapping construction terms to accounts ("lumber" -> "Materials", "delivery" -> "Delivery"). Static, not learned. |
| **Similar expense lookup** | Same project + similar amount (+/-5%) + last 30 days to infer missing fields. |

### Newly Implemented

| System | Table | Status |
|--------|-------|--------|
| **Decision override tracking** | `daneel_decision_overrides` | Implemented. DB trigger on `expenses_manual_COGS` status changes auto-captures when a human overrides a Daneel decision. Logs: original_decision, original_rule, new_status, override_by. |
| **Override pattern analytics** | `get_daneel_override_patterns()` RPC | Implemented. Returns vendor+rule combinations that are frequently overridden (min 3 overrides in 90 days). |

### Not Yet Built

| System | Purpose |
|--------|---------|
| **Duplicate false-positive tracking** | If Daneel flags a "duplicate" and human marks it legitimate, remember the pattern. Same vendor + same amount recurring monthly (e.g., rent) = not duplicate. |
| **Budget pattern prediction** | With 6+ months of history, predict which accounts will exceed budget before it happens. |
| **Rule auto-tuning** | Use override patterns to suggest threshold adjustments or vendor-specific exception rules. |

## Configuration (DB-Stored in `agent_config`)

### Budget Monitoring
- `daneel_auto_auth_enabled` (bool, default false)
- Warning threshold (50-95%), Critical threshold (85-100%)
- Overspend alerts, no-budget alerts

### Authorization Rules
- `daneel_auto_auth_require_bill` (bool, default true)
- `daneel_auto_auth_require_receipt` (bool, default true)
- `daneel_fuzzy_threshold` (int, default 85) -- duplicate similarity %
- `daneel_amount_tolerance` (float, default 0.05)
- `daneel_labor_keywords` (string, default "labor")
- Receipt hash cross-check enabled

### Escalation
- `daneel_bookkeeping_role` / `daneel_bookkeeping_users` -- missing info recipients
- `daneel_accounting_mgr_role` / `daneel_accounting_mgr_users` -- escalation recipients
- Smart layer: follow-up hours, escalation hours

## Adding a New Capability (Checklist)

Same process as Andrew (shared brain + registry):

| Step | File | What to do |
|------|------|-----------|
| 1 | `api/services/agent_registry.py` | Add function dict to `DANEEL_FUNCTIONS` |
| 2a | `api/services/agent_brain.py` | If `_builtin:` handler: implement + register in `_BUILTIN_HANDLERS` |
| 2b | `api/services/<module>.py` | If external handler: implement in own service file |
| 3 | `api/services/agent_brain.py` | Add formatting case in `_format_result()` |

## Self-Awareness Rules

When Daneel does NOT understand:
- **DO:** List his 5 capabilities: "I handle expense authorization, budget monitoring, duplicate detection, data health, and reprocessing. For receipts, try @Andrew."
- **DON'T:** Fall into free_chat and generate unverified financial claims

When Daneel cannot authorize:
- **DO:** Explain which rule blocked it: "Cannot authorize -- missing receipt (Rule R2). Notified [bookkeeper] to upload the file."
- **DO:** Show the full decision trail: "Authorized via R1+R2+R3+R4+R5. Confidence: high."

When it's another agent's domain:
- **DO:** "Receipts and invoices are Andrew's domain. He'll take good care of that. Try @Andrew."
- **DON'T:** Attempt OCR or receipt processing
