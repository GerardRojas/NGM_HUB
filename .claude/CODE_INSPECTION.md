# CODE INSPECTION FRAMEWORK - NGM HUB

## Inspection Criteria (apply to every module)

### C1 - Critical Errors
- [ ] Unhandled exceptions / missing try-catch
- [ ] Race conditions (async without await, concurrent DOM mutations)
- [ ] Memory leaks (listeners never removed, intervals never cleared)
- [ ] Security: exposed tokens, missing auth headers, XSS vectors, SQL injection
- [ ] Data loss: overwriting without confirmation, silent failures on save

### C2 - Dead Code & Garbage
- [ ] Unreachable code (after return, inside `if(false)`)
- [ ] Commented-out blocks (>3 lines)
- [ ] `console.log` / `console.debug` left in production
- [ ] Unused variables, functions, imports
- [ ] Duplicate function definitions (same logic, different names)
- [ ] Empty event handlers or stub functions that do nothing

### C3 - Redundancies
- [ ] Same API call made multiple times (no caching)
- [ ] Duplicate DOM queries (`document.querySelector` for same element)
- [ ] Copy-paste code blocks (>5 lines identical)
- [ ] Re-implementation of utility already available (e.g. escapeHtml, getAuthHeaders)
- [ ] Multiple fetch wrappers doing the same thing

### C4 - Logic Bugs
- [ ] Type coercion issues (`==` instead of `===`, string vs number IDs)
- [ ] Off-by-one errors in loops/pagination
- [ ] Missing null/undefined checks before property access
- [ ] Wrong variable scope (var vs let/const in loops)
- [ ] Event listeners attached multiple times (no dedup)

### C5 - Performance
- [ ] DOM manipulation inside loops (should batch)
- [ ] Heavy operations on scroll/resize without debounce
- [ ] Large innerHTML replacements when targeted update suffices
- [ ] Synchronous operations that block UI
- [ ] Unnecessary re-renders or re-fetches

### C6 - API/Backend Specific
- [ ] Missing error responses (bare `except: pass`)
- [ ] N+1 query patterns
- [ ] Missing auth middleware on protected endpoints
- [ ] Inconsistent response format (some return data, some return message)
- [ ] Hardcoded values that should be config

---

## Module Priority & Assignment

### TIER 1 - Critical (largest, most user-facing, most bugs likely)

| # | Module | Frontend | Backend | Lines | Status |
|---|--------|----------|---------|-------|--------|
| 1 | **Expenses** | expenses.js (11.3K) | expenses.py (1.7K), pending_receipts.py (5.7K) | ~18.7K | PENDING |
| 2 | **Process Manager** | process_manager.js (9.8K) | processes.py (356), process_manager.py (208) | ~10.4K | PENDING |
| 3 | **Messages** | messages.js (5.2K) | messages.py (1.3K) | ~6.5K | PENDING |
| 4 | **Pipeline** | pipeline.js + 8 sub-files (~5.5K) | pipeline.py (3.9K) | ~9.4K | PENDING |

### TIER 2 - Important (medium complexity, active use)

| # | Module | Frontend | Backend | Lines | Status |
|---|--------|----------|---------|-------|--------|
| 5 | **Agents (Brain)** | agents-settings.html | agent_brain.py (1.8K), daneel_auto_auth.py (1.8K) | ~3.6K | PENDING |
| 6 | **Estimator** | estimator.js (4.1K), estimator_database.js (3K) | estimator.py (614), concepts.py (664) | ~8.4K | PENDING |
| 7 | **Dashboard** | dashboard.js (1.6K) | (uses multiple endpoints) | ~1.6K | PENDING |
| 8 | **Vault** | vault.js (1.3K) | vault.py (405), vault_service.py (825) | ~2.5K | PENDING |
| 9 | **Budgets** | budgets.js (1.1K), budget_monitor.js (793) | budgets.py (273), budget_alerts.py (824) | ~3K | PENDING |

### TIER 3 - Standard (simpler CRUD, less risk)

| # | Module | Frontend | Backend | Lines | Status |
|---|--------|----------|---------|-------|--------|
| 10 | **Team** | team.js (602), team_orgchart.js (2.1K) | team.py (344) | ~3K | PENDING |
| 11 | **Projects** | projects.js (572) | projects.py (353) | ~925 | PENDING |
| 12 | **Companies** | companies.js (358) | companies.py (161) | ~519 | PENDING |
| 13 | **Accounts/Vendors** | accounts.js (478), vendors.js (484) | accounts.py (176), vendors.py (166) | ~1.3K | PENDING |
| 14 | **Auth/Sidebar** | auth-guard.js (217), sidebar.js (389) | auth.py (275) | ~881 | PENDING |
| 15 | **Arturito** | arturito.js (1.4K), arturito_widget.js (2K) | arturito.py (1.1K) | ~4.5K | PENDING |

---

## Inspection Log Template

When inspecting a module, create a section like this:

### [MODULE_NAME] - Inspection Results
**Inspector**: Agent / Human
**Date**: YYYY-MM-DD
**Status**: IN_PROGRESS | DONE

#### Findings

| ID | Severity | Criteria | File:Line | Description | Fix |
|----|----------|----------|-----------|-------------|-----|
| E1 | CRITICAL | C1 | file.js:123 | Missing await on async call | Added await |
| E2 | MEDIUM | C2 | file.js:456 | 20 lines of commented code | Removed |
| E3 | LOW | C3 | file.js:789 | Duplicate querySelector | Cached in variable |

Severity levels: CRITICAL > HIGH > MEDIUM > LOW

---

## Workflow

### Phase 1 - Live Debugging (Current)
User runs each module, provides browser console + backend logs.
We fix issues in real-time before deep inspection.

### Phase 2 - Deep Inspection (Per Module)
Agent reads entire module file, applies all C1-C6 criteria.
Creates findings table. User reviews and approves fixes.

### Phase 3 - Cross-Module
Check for inconsistencies across modules:
- Different auth patterns
- Different error handling
- Duplicated utilities
- Inconsistent API response formats

---

## Quick Commands for Agents

When assigned a module, the agent should:
1. Read the full file(s)
2. Check every criterion C1-C6
3. Log findings in the table format above
4. Propose fixes (don't auto-apply without approval)
5. Note any cross-module issues found

## Files to SKIP (not worth inspecting)
- `config.js` (47 lines, just constants)
- `main.js` (17 lines, trivial)
- `html_loader.js` (10 lines)
- `mock-projects.js` (10 lines)
- `pipeline_utils.js` (52 lines)
- `__init__.py` (empty)
- `tasks.py` (empty stub)
- `debug_supabase.py` (17 lines, debug only)
- `test_*.py` (test files)
- `pipeline_htmlbackup.html` (backup, not active)
