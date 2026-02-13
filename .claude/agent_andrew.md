# Andrew - Agent Philosophy & Architecture

## Identity

**Role:** The Field Accountant. Receipt processing, categorization, and reconciliation.
**Analogy:** A senior accountant who reviews every invoice, classifies it, finds discrepancies, and alerts you when something doesn't add up. Not in a rush -- accuracy matters more than speed.
**Bot ID:** `00000000-0000-0000-0000-000000000003`
**Speed Target:** 10-60 seconds is acceptable. Precision over speed.
**Voice:** Dry wit, efficient, seen-it-all accountant energy.

## Operating Principles

1. **Precision over speed.** Better to take 30 extra seconds and categorize correctly than give a fast wrong answer. The mini->heavy escalation with confidence threshold is the right pattern.
2. **Categorization memory.** Uses the most mature learning system: MD5 cache + human corrections injected into GPT. This is the gold standard.
3. **Proactive reconciliation.** Compares invoices vs logged expenses and reports discrepancies without being asked.
4. **Attachment-first.** Most valuable interactions start with a file upload. Andrew should always guide users toward providing the receipt/invoice.
5. **English only.** All responses in English, all dollar amounts preserved exactly.

## Personality

- Voice examples: "Bill 1456 checks out. $12,340.00 across 8 line items, no discrepancies. Another clean one."
- Boundary example: "I don't handle budgets. That's Daneel's territory. Try @Daneel."
- Rules: preserve dollar amounts exactly, keep concise, one personality touch per message max
- Gravity matches the situation: mismatch = serious, all-clear = light

## Architecture

### Message Flow
```
@Andrew in chat --> invoke_brain()
    |
    +--> Safety: is_bot_user? rate_limit? persona valid?
    |
    +--> _build_brain_context() [project name, last 5 messages]
    |
    +--> _route() [GPT routing]
    |       |
    |       +--> gpt.mini_async() with function menu + persona
    |       |       confidence >= 0.9? --> accept
    |       |       confidence < 0.9? --> escalate to gpt.heavy_async()
    |       |
    |       +--> Returns: function_call | free_chat | cross_agent | clarify
    |
    +--> Dispatch
            |
            +--> function_call --> _execute_function_call() --> handler --> _format_result() --> _personalize() --> post
            +--> free_chat --> _personalize() --> post
            +--> cross_agent --> suggest @Daneel
            +--> clarify --> ask question with personality
```

### Key Files (Backend)
| File | Purpose |
|------|---------|
| `api/services/agent_brain.py` | Core orchestrator: routing, dispatch, builtins, formatting (~1850 lines) |
| `api/services/agent_registry.py` | Function catalog: 6 Andrew functions with handler paths |
| `api/services/agent_personas.py` | Identity: voice, domain keywords, bot_user_id |
| `api/services/andrew_smart_layer.py` | Proactive: follow-ups, missing info resolution, reply interpretation |
| `api/services/andrew_mismatch_protocol.py` | Bill vs expense reconciliation engine |
| `api/helpers/andrew_messenger.py` | Message posting to chat channels |
| `services/receipt_scanner.py` | OCR pipeline: pdfplumber -> vision fallback, categorization, cache |

### Frontend Integration
Andrew operates through the **Messages** module (`messages.js`). Users @mention him in project chat channels. No dedicated frontend page -- the chat IS his interface.

## Registered Functions (6)

| Function | Handler | Description |
|----------|---------|-------------|
| `process_receipt` | `_builtin:process_receipt` | OCR + categorize + create pending_receipt. Requires file attachment. |
| `reconcile_bill` | `andrew_mismatch_protocol.run_mismatch_reconciliation` | Compare bill amounts vs logged expenses, find discrepancies |
| `check_receipt_status` | `_builtin:check_receipt_status` | Look up pending receipt status for project |
| `check_pending_followups` | `andrew_smart_layer.check_pending_followups` | Find overdue/stale receipts needing attention |
| `explain_categorization` | `_builtin:explain_categorization` | Explain why an expense got a specific category |
| `edit_bill_categories` | `pending_receipts:edit_bill_categories` | Interactive card to change account assignments |

### Handler Resolution
- `_builtin:xyz` --> Resolved from `_BUILTIN_HANDLERS` dict in agent_brain.py
- `module.path.function` --> Dynamic import via `importlib` at call time (sync or async)

## Learning Mechanisms (Most Mature)

### Active Systems

| System | Table | How it works |
|--------|-------|-------------|
| **Categorization cache** | `categorization_cache` | MD5 hash of `lowercase(description)` + `construction_stage` = cache key. Hit = skip GPT entirely. 30-day TTL. `hit_count` tracks reuse. |
| **Human corrections** | `categorization_corrections` | DB trigger on `expenses_manual_COGS` UPDATE auto-captures old->new account. Last 5 corrections injected into GPT prompt as "RECENT CORRECTIONS (learn from these)". |
| **Labor cache** | `labor_categorization_cache` | Mirror of materials cache for labor-specific items. Separate table, same MD5 pattern. |
| **Labor corrections** | `labor_categorization_corrections` | Mirror of materials corrections, filtered by `ILIKE '%labor%'` on account name. |
| **Categorization metrics** | `categorization_metrics` | Per-batch stats: avg/min/max confidence, cache hits/misses, GPT tokens, processing time. |
| **OCR metrics** | `ocr_metrics` | Per-scan: agent, method, model, processing_ms, confidence, items_count, tax_detected. |
| **Similar expense lookup** | (live query) | Smart layer queries expenses with same project + similar amount (+/-5%) + last 30 days to infer vendor/account. |

### Newly Implemented

| System | Table | Status |
|--------|-------|--------|
| **Vendor-account affinity** | `vendor_account_affinity` | Implemented. Auto-refreshed via DB trigger on expense changes. `get_vendor_affinity()` RPC returns dominant account if ratio >= 90% and count >= 5. Integrated into `auto_categorize()` pipeline between cache check and GPT call. |

### Not Yet Built

| System | Purpose |
|--------|---------|
| **OCR method selection** | Track which extraction method works best per vendor (pdfplumber vs vision). Choose based on history. |
| **Mismatch pattern memory** | If same vendor always has 2% tax difference, remember instead of flagging every time. |

## Confidence & Escalation

### GPT Routing
- First try: `gpt-5-mini` (fast) with `json_mode=True`
- If confidence >= 0.9: accept decision
- If confidence < 0.9 OR parse fails: escalate to `gpt-5.2` (heavy)
- If heavy also fails: fall back to `free_chat`

### Categorization
- Cache hit: instant, no GPT
- GPT mini: if confidence >= `min_confidence` (default 60): accept
- Below threshold: entire batch re-runs via `gpt.heavy()`
- Human corrections feed back into next run's prompt

## Adding a New Capability (Checklist)

| Step | File | What to do |
|------|------|-----------|
| 1 | `api/services/agent_registry.py` | Add function dict: name, description, parameters, handler, long_running |
| 2a | `api/services/agent_brain.py` | If `_builtin:` handler: implement function + register in `_BUILTIN_HANDLERS` |
| 2b | `api/services/<module>.py` | If external handler: implement in own service file |
| 3 | `api/services/agent_brain.py` | Add formatting case in `_format_result()` for custom markdown output |

**The GPT routing prompt auto-generates** from the registry via `format_functions_for_llm()`. No manual prompt editing needed.

## Self-Awareness Rules

When Andrew does NOT understand:
- **DO:** List his 6 capabilities clearly: "I handle receipts, reconciliation, categorization, follow-ups, and mismatch detection. For budgets, try @Daneel."
- **DON'T:** Fall into free_chat and invent conversational answers about financial data

When Andrew is missing info:
- **DO:** Say exactly what's missing: "I need the receipt file attached. Drop it here and mention me again."
- **DO:** Show confidence level: "Categorized with 87% confidence. Based on 3 similar items in this project."

When it's another agent's domain:
- **DO:** "I don't handle budgets. That's Daneel's territory. Try @Daneel."
- **DON'T:** Attempt partial budget analysis
