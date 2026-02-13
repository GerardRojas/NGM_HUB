# Messages Module - Architecture Reference

## Module Overview
Chat system with project-based channels, custom channels, direct messages, threads, @mentions, reactions, file attachments, receipt processing flows, and real-time updates via Supabase.

## Files
- messages.html - Page structure, 3-column layout (~860 lines)
- assets/js/messages.js - All logic, monolithic IIFE (~5215 lines)
- assets/css/messages_styles.css - All styles, msg- prefix convention

## HTML Structure (messages.html)
3-column layout: channels sidebar | chat area | thread panel

### Key DOM IDs
| ID | Purpose |
|----|---------|
| projectChannels | Project channel list container |
| groupChannels | Group channel list container |
| directMessages | DM list container |
| channelSearchInput | Channel sidebar search |
| messagesContainer | Scrollable messages viewport |
| messagesList | Messages render target |
| emptyState | No-channel-selected state |
| chatLoading | Loading spinner |
| messageInput | Chat textarea |
| btnSendMessage | Send button |
| typingIndicator | Typing status bar |
| attachmentsPreview | File preview before send |
| replyPreview | Reply-to preview bar |
| mentionDropdown | @mention autocomplete |
| threadPanel | Thread side panel |
| threadOriginal / threadReplies | Thread content areas |
| threadInput / btnSendThreadReply | Thread reply input |
| newChannelModal | Create channel modal |
| channelInfoModal | Channel details modal |
| searchMessagesModal | Message search modal |
| manageProjectChannelsModal | Project channels admin |
| mentionsView / mentionsList | @mentions inbox view |
| sidebarOverlay | Mobile sidebar backdrop |

## JavaScript Architecture

### Pattern
Monolithic IIFE (function(){ ... })() -- same pattern as expenses and process_manager.

### State Object (~43-64)
    state = {
      currentUser, users[], projects[], channels[], currentChannel,
      messages[], replyingTo, attachments[], typingUsers (Set),
      supabaseClient, messageSubscription, typingSubscription,
      lastTypingBroadcast, renderDebounceTimer,
      activeCheckFlow,      // { receiptId, state } - check/payroll flow
      activeDuplicateFlow,  // { receiptId } - duplicate confirmation
      activeReceiptFlow,    // { receiptId, state, awaitingText } - receipt flow
      _accountsCache,       // { data, fetchedAt } - 10min TTL
      _accountsFetching,    // dedup flag
      unreadCounts          // { channel_key: count }
    }

### 3-Phase Initialization (~215-292)
1. PHASE 1 - Load from localStorage cache instantly, render channels, setup events
2. PHASE 2 - Parallel API fetch (loadCurrentUser, loadUsers, loadProjects, loadChannels, loadUnreadCounts), then ensureGroupChannels
3. PHASE 3 - Re-render only if data changed vs cache, apply unread badges, init Supabase realtime

### Local Cache System (~100-144)
- Keys: ngm_cache_users, ngm_cache_projects, ngm_cache_channels, ngm_cache_current_user, ngm_last_channel
- TTL: 5 minutes (CACHE_TTL = 300000ms)
- Expired data still returned for instant display; fresh data replaces shortly after

### DOM References (~149-210)
Cached once in cacheDOMReferences() into const DOM = {} object.

## Channel System

### Channel Types (~89-97)
| Constant | Value | Description |
|----------|-------|-------------|
| PROJECT_GENERAL | project_general | Default project channel |
| PROJECT_ACCOUNTING | project_accounting | Expense discussions |
| PROJECT_RECEIPTS | project_receipts | Receipt upload + processing |
| CUSTOM | custom | User-created channels |
| DIRECT | direct | 1-on-1 DMs |
| GROUP | group | Group channels (Payroll, etc.) |

### Channel Rendering (~561-931)
- renderChannels() ~561 - Orchestrator: calls renderGroups, renderProjectChannels, renderDirectMessages
- renderProjectChannels() - Groups channels by project, shows color dots
- Project color picker: per-project color saved to localStorage, click dot to change

### Channel Selection (~1004-1101)
- selectChannel() ~1004 - Main entry point
- Race condition guard: channelRequestId counter, stale responses discarded (~1001-1055)
- Scans loaded messages for active bot flows (check, duplicate, receipt) (~1060-1082)
- Resets pagination state, subscribes to realtime, scrolls to bottom

## Message Rendering

### Two-Path Pipeline (~1223-1322)
1. Fast path (incremental append) ~1249: New messages appended at end via DocumentFragment, no innerHTML rebuild. Adds .msg-message--new CSS class for entrance animation.
2. Full rebuild ~1290: Used on channel switch, message mutation, temp->real replacement. Uses _renderCache for memoized HTML per message ID + content hash.

### Render Control
- renderMessages() ~1208 - Public API, delegates to debouncedRenderMessages()
- debouncedRenderMessages() ~76 - Uses requestAnimationFrame for batching
- _markFullRebuild() ~1218 - Sets flag + clears render cache, forces full rebuild path
- _renderCache (Map) ~68 - Maps msg.id -> { html, contentHash, showButtons }
- _msgContentHash() ~70 - Lightweight hash of fields that affect rendered HTML

### renderMessage() (~1363-1707)
Builds HTML for a single message. Handles:
- Bot agent detection and styling (Arturito, Daneel, Andrew)
- CSS classes: msg-message--own, msg-message--sending, msg-message--failed, msg-message--bot, msg-message--bot-{css}
- Receipt status tags
- Bot action buttons (duplicate flow, check flow, receipt flow, user confirmation cards)
- Interactive category selection cards with select dropdowns
- Attachments rendering (images, files, receipt thumbnails)
- Reactions bar, Action buttons (react, reply, thread, delete), Thread count indicator

### Bot Agent Registry (~1350-1355)
    BOT_AGENTS = {
      ...-0001: { name: Arturito, css: arturito },
      ...-0002: { name: Daneel, css: daneel },
      ...-0003: { name: Andrew, css: andrew },
    }

### Content Formatting (~1796-1919)
- formatMessageContent() ~1796 - Cached via _formatCache (Map, max 500 entries)
- _formatMessageContentUncached() ~1814 - Splits into text blocks vs markdown table blocks
- _renderMarkdownTable() ~1852 - Pipe-delimited markdown to table HTML
- _formatTextBlock() ~1881 - Pipeline: escapeHtml -> @mentions -> markdown links -> URLs -> bold -> italic -> code -> newlines

## Realtime and Polling

### Supabase Subscription (~3673-3778)
- initSupabaseRealtime() ~3673 - Creates Supabase client
- subscribeToChannel() ~3698 - Two subscriptions per channel:
  1. postgres_changes INSERT on messages table (no filter, client-side filtering by channel_key)
  2. Presence channel for typing indicators
- Subscribes to ALL inserts (generated channel_key column incompatible with Supabase filters)
- Cross-channel unread: increments unreadCounts[msgKey] for messages in other channels

### Smart Polling Fallback (~3787-3827)
- startMessagePolling() ~3787 - setInterval at 4s, fetches last 15 messages
- stopMessagePolling() ~3822 - Clears interval
- Auto-stops when realtime status = SUBSCRIBED
- Auto-starts when status = CLOSED or CHANNEL_ERROR
- Skips when document.hidden (tab not visible)

### handleNewMessage() (~3829-3906)
1. Dedup by real ID
2. For own messages: replace temp message (optimistic update completion)
3. Mark channel as read while viewing
4. Append to state.messages, render (uses fast-path incremental)
5. Auto-scroll if user was near bottom (within 150px from end)
6. Track active bot flows from message metadata
7. Toast notification for messages from others

## Pagination (~464-556)

- MESSAGES_PAGE_SIZE = 50 (~464)
- _hasMoreMessages, _loadingMore, _currentOffset - tracking state
- loadMessages() ~469 - API call with limit + offset params
- loadOlderMessages() ~499 - Triggered on scroll-up (within 80px from top)
  - Increments _currentOffset by page size
  - Deduplicates, sorts ascending by created_at
  - Restores scroll position via rAF after prepend
- Reset on channel switch (~1090-1091)

## Reactions System (~2608-2731)

### SVG Emojis (~2608-2620)
10 custom SVG emojis: thumbsup, thumbsdown, heart, fire, star, check, clap, eyes, rocket, laugh

### toggleReaction() (~2629-2681)
- Optimistic local update (add/remove user from reactions array)
- Targeted DOM update: finds .msg-reactions container, replaces outerHTML (no full re-render)
- Falls back to full rebuild if DOM element not found
- API: POST /messages/{id}/reactions with { emoji, action: add|remove }

### showEmojiPicker() (~2684-2731)
- Creates floating picker, positions relative to action button
- One-shot click listener for outside-click dismiss

## Receipt / Expense Integration

### Receipt Upload Flow (~2943-3060)
- isReceiptsChannel() ~2948 - Check if current channel is project_receipts
- isPayrollChannel() ~2952 - Check if group channel named Payroll
- uploadReceiptToPending() ~2961 - POST to /pending-receipts/upload with FormData
- processReceiptNow() ~3038 - POST to /pending-receipts/{id}/agent-process
- File limits: receipts 20MB (images + PDF), regular 10MB

### Interactive Category Card (~2068-2140)
- _getAccounts() ~2068 - Fetches accounts with 10-min cache, dedup via _accountsFetching flag
- _populateCategorySelects() ~2102 - Post-render hook, populates select dropdowns grouped by AccountCategory
- Pre-selects data-suggested-id or data-current-id attributes

### Active Bot Flows (3 concurrent)
| Flow | State key | Metadata flags |
|------|-----------|----------------|
| Check/Payroll | activeCheckFlow | check_flow_active, check_flow_state |
| Duplicate | activeDuplicateFlow | duplicate_flow_active, duplicate_flow_state |
| Receipt | activeReceiptFlow | receipt_flow_active, receipt_flow_state |

### Text Interception
- _getCheckFlowAction() - Detects yes/no/split/date responses during active check flow
- _getDuplicateFlowAction() - Detects yes/no during duplicate confirmation
- _getReceiptFlowAction() - Detects responses during receipt split flow

### @Andrew Bill Action (~2142-2164)
- _getAndrewBillAction() ~2146 - Regex: @Andrew + bill|factura|invoice + number
- _forwardToAndrewReconcile() ~2158 - POST to /andrew/reconcile-bill

## Bot Mentions (~2528-2603)

### @Mention Input (~2528-2543)
- handleMentionInput() - Detects @ before cursor, shows dropdown
- showMentionDropdown() ~2545 - Filters users + bot mentionables (Andrew, Daneel)
- insertMention() ~2582 - Replaces @query with @Username in textarea

### Bot Mentionables (~2547-2549)
    Andrew: 00000000-0000-0000-0000-000000000003
    Daneel: 00000000-0000-0000-0000-000000000002

## Key Functions

| Function | Line | Description |
|----------|------|-------------|
| init() | ~215 | 3-phase initialization |
| selectChannel() | ~1004 | Channel selection with race guard |
| renderMessagesInternal() | ~1224 | Two-path render (fast + full) |
| renderMessage() | ~1363 | Single message HTML builder |
| formatMessageContent() | ~1796 | Cached content formatting |
| sendMessage() | ~2407 | Send with optimistic UI + flow detection |
| toggleReaction() | ~2629 | Optimistic reaction + targeted DOM update |
| deleteMessage() | ~2737 | Soft delete with optimistic revert |
| clearConversation() | ~2775 | Admin-only bulk clear |
| openThread() | ~2827 | Thread panel with race guard |
| loadOlderMessages() | ~499 | Scroll-up pagination |
| searchMessages() | ~3349 | Search with highlight |
| subscribeToChannel() | ~3698 | Realtime + typing subscription |
| handleNewMessage() | ~3829 | New message processing pipeline |
| setupEventListeners() | ~4066 | All delegated event handlers |
| _getAccounts() | ~2068 | Cached accounts for category picker |
| _populateCategorySelects() | ~2102 | Post-render dropdown population |
| showMentionsView() | ~5099 | @mentions inbox overlay |
| loadMentionsBadge() | ~5155 | Unread mentions count |

## Performance Optimizations

1. localStorage cache - Instant render from cached users/projects/channels on page load
2. Incremental DOM - Fast path appends new messages via DocumentFragment (no innerHTML rebuild)
3. Render cache - _renderCache (Map) memoizes rendered HTML per message ID + content hash
4. Format cache - _formatCache (Map, max 500) memoizes formatMessageContent() output
5. rAF debounce - requestAnimationFrame instead of setTimeout for render batching
6. Targeted DOM - Reactions update only .msg-reactions container, not full message list
7. Smart polling - Stops when realtime SUBSCRIBED, restarts on disconnect
8. Race guards - channelRequestId and threadRequestId counters discard stale responses
9. CSS containment - contain: layout style on container, will-change: scroll-position
10. escapeHtml - String .replace() chain instead of createElement(div) per call

## API Endpoints

### Messages
- GET /messages?channel_type={}&limit={}&offset={} + project_id or channel_id
- POST /messages - Send message
- PATCH /messages/{id}/delete - Soft delete
- POST /messages/{id}/reactions - Add/remove reaction
- GET /messages/{id}/thread - Thread replies
- POST /messages/{id}/thread - Send thread reply
- GET /messages/search?q={}&channel_type={}&project_id|channel_id={}
- POST /messages/channel/clear - Admin clear conversation

### Channels
- GET /messages/channels - List all channels
- POST /messages/channels - Create channel
- DELETE /messages/channels/{id} - Delete channel
- PATCH /messages/channels/{id} - Update channel

### Unread / Mentions
- GET /messages/unread-counts - All channel unread counts
- POST /messages/mark-read - Mark channel as read
- GET /messages/mentions - User mentions
- GET /messages/mentions/count - Unread mentions badge count

### Receipts
- POST /pending-receipts/upload - Upload receipt file
- POST /pending-receipts/{id}/agent-process - Trigger OCR processing
- POST /pending-receipts/{id}/receipt-action - Bot flow action dispatch
- POST /pending-receipts/{id}/check-action - Check flow action dispatch
- POST /pending-receipts/{id}/duplicate-action - Duplicate flow action
- GET /pending-receipts/project/{id} - List pending receipts
- POST /andrew/reconcile-bill - @Andrew bill reconciliation

### Other
- GET /auth/me - Current user
- GET /users - All users
- GET /projects - All projects
- GET /accounts - Chart of accounts (for category picker)

## CSS Class Conventions
All classes use msg- prefix:
- Layout: msg-channels-sidebar, msg-chat-area, msg-thread-panel
- Channels: msg-channel-item, msg-channel-section, msg-project-group
- Messages: msg-message, msg-message--own, msg-message--bot, msg-message--bot-andrew
- Actions: msg-bot-actions, msg-bot-action-btn, msg-emoji-picker
- Receipts: msg-receipt-progress, msg-cat-card, msg-cat-select
- State: msg-message--sending, msg-message--failed, msg-message--new

## Exported API (~5203-5214)
    window.MessagesModule = {
      state, selectChannel, sendMessage, searchMessages,
      openSearchModal, updateReceiptStatusInMessages,
      showMentionsView, hideMentionsView, loadMentions, loadMentionsBadge
    }

## Key Differences from Other Modules
- Monolithic IIFE (same as expenses/process_manager, unlike modular pipeline)
- Real-time via Supabase postgres_changes (like pipeline, unlike expenses)
- Optimistic UI with temp message IDs (temp-*) replaced on server confirm
- 3 concurrent bot flows tracked simultaneously (check, duplicate, receipt)
- Interactive cards in messages (category select dropdowns, action buttons)
- Incremental DOM fast path for append-only scenarios (unique to messages)
