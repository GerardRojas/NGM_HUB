# Agent @Mention Diagnostic Log

## Date: 2026-02-21
## Issue: Agents (Andrew, Daneel) show in @mention dropdown but never respond

---

## 1. DIAGNOSTIC: Root Cause Analysis

### Chain of execution traced:

```
Frontend (messages.js)
  1. User types @Andrew in textarea
  2. insertMention() produces "@Andrew " in content
  3. sendMessage() POSTs to /messages with content: "@Andrew whatever"

Backend (messages.py)
  4. create_message() inserts message to DB
  5. is_bot_user(user_id) check - passes for human users
  6. _detect_agent_mentions() runs regex @(Andrew|Daneel)\b
  7. BackgroundTask: _run_agent_brain() queued

Backend (agent_brain.py)
  8. invoke_brain() called
  9. GPT-5-mini routing call
  10. Dispatch to handler (function_call / free_chat / etc.)
  11. _post_response() posts via messenger
  12. Supabase Realtime broadcasts to frontend
```

### Issues found:

| # | Issue | Severity | Location | Fix Applied |
|---|-------|----------|----------|-------------|
| 1 | `_run_agent_brain` error handler only logs, never posts feedback to channel | CRITICAL | messages.py:374 | Added error recovery that posts error message to channel |
| 2 | No immediate ack for non-receipt mentions | MEDIUM | messages.py:340 | Now logs every step for diagnosis |
| 3 | Daneel messenger missing `channel_id` support | HIGH | daneel_messenger.py:53 | Added `channel_id` parameter (parity with Andrew) |
| 4 | `_post_response` skips Daneel in non-project channels | HIGH | agent_brain.py:2084 | Updated to accept channel_id |
| 5 | Mention dropdown items have default white button background | LOW | messages_styles.css:1417 | Added `background: transparent; border: none;` |
| 6 | No knowledge context (user/company) in agent prompts | MEDIUM | agent_brain.py | Integrated modular company_knowledge.py |

### Most likely cause of "never responds":
The BackgroundTask `_run_agent_brain` catches ALL exceptions at line 374 and only
logs them. If `invoke_brain` raises (e.g., import error, GPT API failure, missing
env var), the user sees NOTHING. No error message, no feedback. Complete silence.

**Fix**: Added error recovery that posts a visible error message to the channel
when any exception occurs, so the user always gets feedback.

---

## 2. CHANGES MADE

### Frontend Changes

#### `assets/css/messages_styles.css`
- **`.msg-mention-item`**: Added `background: transparent; border: none; color: inherit; font: inherit; text-align: left; width: 100%;`
- Reason: `<button>` elements have browser default white/light background. The dropdown items are rendered as buttons but lacked CSS reset.

### Backend Changes

#### `api/routers/messages.py` - `_run_agent_brain()`
- Added comprehensive step-by-step logging:
  - `_run_agent_brain START` with agent, user, project, channel
  - `Importing agent_brain...` / `agent_brain imported OK`
  - `_run_agent_brain COMPLETE`
- Added `_post_to_channel()` helper function for posting as either agent
- Added error recovery: on ANY exception, posts error message to the channel
- Kept existing receipt ack for Andrew + attachments

#### `api/helpers/daneel_messenger.py` - `post_daneel_message()`
- Added `channel_id` parameter (was missing, Andrew already had it)
- Updated routing logic: `channel_id` > `project_id` > warning
- Updated logging to show target (channel or project)
- `project_id` changed from required to optional (default None)

#### `api/services/agent_brain.py` - `invoke_brain()`
- Added knowledge context loading step (1b) between context build and GPT routing
- Knowledge context appended to system prompt (non-blocking, fails gracefully)
- Updated `_post_response()` to pass `channel_id` to Daneel messenger
- Updated `_route()` to append knowledge context to system prompt

#### `api/services/company_knowledge.py` (NEW FILE)
- Modular knowledge system with 4 independent modules:
  1. **user_profile**: Who is talking (name, role, seniority) - ALWAYS loaded
  2. **company_profile**: Static company info (name, industry, location) - ALWAYS loaded
  3. **project_context**: Current project details (name, client, status) - when project_id present
  4. **team_roster**: Key people on the project - Daneel only
- Each module returns <200 tokens to keep prompt lean
- In-memory cache with 10-min TTL, max 100 entries
- `build_knowledge_context()` selects modules based on agent + context
- `clear_knowledge_cache()` for cleanup

#### `api/main.py`
- Added `company_knowledge._cache` to `_purge_stale_caches()` loop
- Added `company_knowledge._cache` to debug memory endpoint

---

## 3. ARCHITECTURE: Modular Knowledge System

```
                    build_knowledge_context()
                              |
              +---------------+---------------+
              |               |               |
         user_profile    company_profile  project_context
         (DB fetch)      (static const)   (DB fetch)
              |                               |
              +--- always loaded ---+   +---- if project_id ----+
                                    |   |
                                    v   v
                              knowledge string
                              (~200-400 tokens)
                                    |
                                    v
                          Appended to routing prompt
                          (after ## Context section)
```

### Module selection per agent:
- **Andrew**: user_profile, company_profile, project_context
- **Daneel**: user_profile, company_profile, project_context, team_roster

### Design decisions:
1. **Modules are functions, not classes** - Simple, no overhead
2. **Cache is per-module-key** - e.g., `user:uuid`, `project:uuid`
3. **Fails gracefully** - Any module failure is logged and skipped
4. **Appended AFTER routing prompt** - Doesn't interfere with routing instructions
5. **Static company profile** - No DB call needed, always available
6. **Team roster only for Daneel** - He needs to know who can authorize

---

## 4. DEBUGGING GUIDE

### To verify agents respond after these fixes:

1. **Check backend logs** for these lines when @mentioning:
   ```
   [Messages] Agent mention detected: @Andrew by user German
   [Messages] _run_agent_brain START | agent=andrew user=German ...
   [Messages] Importing agent_brain...
   [Messages] agent_brain imported OK, calling invoke_brain...
   [AgentBrain:andrew] Knowledge context loaded (245 chars)
   [GPT:mini_async] gpt-5-mini 1234ms OK
   [AgentBrain:andrew] Routed in 1234ms | action=free_chat ...
   [AndrewMessenger] Message posted OK | id=... | project=...
   [Messages] _run_agent_brain COMPLETE | agent=andrew
   ```

2. **If you see** `Agent brain error`: Check the full traceback in logs

3. **If you see** `_run_agent_brain START` but no COMPLETE: Brain is hanging (GPT timeout?)

4. **If you DON'T see** `_run_agent_brain START`: BackgroundTask isn't executing

5. **Common fixes**:
   - Verify `OPENAI_API_KEY` is set in environment
   - Verify `gpt-5-mini` model is accessible
   - Check Supabase service role key is valid
   - Ensure bot users exist in `users` table

---

## 5. ATTENTION SESSIONS (Natural Conversation Flow)

### Problem
Each message required a new @mention to trigger the agent. Unnatural.

### Solution: Attention Sessions
When a user @mentions an agent, a session is created. Follow-up messages
from that user in the same channel are automatically routed to the agent.

```
User: @Andrew check my pending receipts     ← @mention creates session
Andrew: You have 3 pending: #456, #457, #458

User: Process the first one                 ← NO @mention, session routes it
Andrew: Processing #456...

User: What about the second?                ← still in session (3 remaining)
Andrew: #457 is from Home Depot...

User: thanks                                ← closing signal, session ends
Andrew: Anytime.
```

### Session lifecycle
- **Created**: when @mention detected → `start_session()`
- **Extended**: each follow-up resets the 5-min inactivity timer
- **Consumed**: each follow-up decrements remaining count (max 5)
- **Ended**: timeout (5 min), max messages reached, closing signal,
  or user @mentions a DIFFERENT agent

### Closing signals
`ok`, `thanks`, `got it`, `perfect`, `that's all`, etc.
The message still routes (agent can say goodbye), then session ends.

### Follow-up routing differences
- **More context**: 20 recent messages (vs 10 for @mentions)
- **No cooldown**: Session already rate-limits
- **GPT hint**: System prompt tells GPT this is a continuation

### Architecture
```
create_message()
  ├─ _detect_agent_mentions()    ← explicit @mention?
  │   ├─ YES: start_session() + BackgroundTask(_run_agent_brain)
  │   └─ NO:  check attention session...
  │           ├─ Session active: consume_session() + BackgroundTask (is_followup=True)
  │           └─ No session: normal message (no agent involvement)
  │
  └─ _run_agent_brain(is_followup=True)
      └─ invoke_brain(is_followup=True)
          ├─ Skip cooldown
          ├─ Fetch 20 messages (vs 10)
          └─ Add "FOLLOW-UP" hint to routing prompt
```

### Files
- `api/services/agent_attention.py` — Session store + lifecycle
- `api/routers/messages.py` — Integration into create_message flow
- `api/services/agent_brain.py` — Follow-up routing adjustments
- `api/main.py` — Session cleanup in memory management loop

---

## 6. REALTIME DELIVERY FIX (Hybrid Polling)

### Problem
Agent responses were being inserted into the DB via `service_role` key but not
delivered to the frontend. Supabase Realtime subscription reported "SUBSCRIBED"
which disabled polling entirely. If realtime wasn't actually delivering events
for bot-inserted messages (RLS, service_role vs anon key), **zero delivery
mechanism was active**.

### Solution: Hybrid Polling
Instead of stopping polling when realtime connects, switch to a slower
"safety-net" poll (12s) that catches anything realtime misses.

```
                        subscribeToChannel()
                              |
              +---------------+---------------+
              |                               |
    Realtime connects?                   3s timeout
         YES                                NO
          |                                  |
    startSafetyPolling()           startMessagePolling()
    (12s fixed interval)           (4s with backoff to 30s)
          |                                  |
          +---------> _pollTick() <----------+
                         |
                  handleNewMessage()
                  (dedup by msg.id)
```

### Key changes in `messages.js`:
1. **`POLL_SAFETY_MS = 12000`** — New constant for safety-net interval
2. **`startSafetyPolling()`** — New function: slow fixed poll when realtime is up
3. **`"SUBSCRIBED"` handler** — Calls `startSafetyPolling()` instead of `stopMessagePolling()`
4. **`_pollTick()`** — No longer bails when `realtimeConnected` is true
5. **`_scheduleNextPoll()`** — Uses `POLL_SAFETY_MS` when realtime is up, `pollIntervalMs` when down
6. **`visibilitychange` listener** — Instant poll when tab becomes visible again

### No memory leak risk:
- Only ONE timer active at a time (cleared before setting new)
- `stopMessagePolling()` clears both timers on channel switch
- `handleNewMessage()` deduplicates by `message.id`
- Subscriptions cleaned up on channel switch

---

## 7. FILES MODIFIED

| File | Repo | Type |
|------|------|------|
| `assets/css/messages_styles.css` | Frontend | CSS fix |
| `assets/js/messages.js` | Frontend | Hybrid polling for realtime delivery |
| `api/routers/messages.py` | Backend | Error recovery + attention sessions |
| `api/helpers/daneel_messenger.py` | Backend | channel_id support |
| `api/services/agent_brain.py` | Backend | Knowledge + follow-up routing |
| `api/services/company_knowledge.py` | Backend | NEW - Knowledge modules |
| `api/services/agent_attention.py` | Backend | NEW - Attention sessions |
| `api/main.py` | Backend | Cache cleanup + debug endpoint |
