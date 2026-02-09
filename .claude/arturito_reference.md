# Arturito (AI Assistant) - Architecture Reference

## Files (~6800 lines total)
- `arturito.html` - Full-page chat interface (~389 lines)
- `agents-settings.html` - Agent settings (Arturito permissions, Receipt Agent, Daneel, analytics)
- `assets/js/arturito.js` - Core chat logic (~1279 lines)
- `assets/js/arturito_widget.js` - Floating widget + copilot (~2080 lines)
- `assets/js/arturito_analytics.js` - Error/command analytics (~236 lines)
- `assets/css/arturito_styles.css` - Chat page styles (~876 lines)
- `assets/css/arturito_widget.css` - Widget styles (~646 lines)
- `database/arturito_permissions.sql` - Permission schema (~80 lines)

## Two Interfaces

### 1. Full-Page Chat (arturito.html + arturito.js)
- Dedicated chat page with message bubbles, typing indicator
- OpenAI Assistants API for conversation memory
- Personality control: `"sarcasmo 1-5"` or `"personalidad 1-5"`
- Session persistence via localStorage
- iOS-optimized (visualViewport API, keyboard handling)
- Loading overlay with min 800ms display

### 2. Floating Widget (arturito_widget.js + arturito_widget.css)
- Chat bubble embedded on any page (dashboard, expenses, pipeline, etc.)
- Copilot mode: context-aware help per module
- Skips loading on dedicated arturito.html to avoid conflicts
- Page-specific copilot handler registry

## Core: arturito.js (~1279 lines)

### State
- `currentUser`, `sessionId`, `conversationHistory[]`
- `assistantId`, `threadId` (OpenAI Assistants API)
- `personalityLevel` (1-5 sarcasm scale)

### Key Functions
- `initChat()` - Auth + load conversation
- `sendMessage(text)` - Send to OpenAI API
- `renderMessage(role, content)` - Display in chat
- `handleCommand(text)` - Process special commands (personality, sarcasmo)
- `createThread()` / `addMessageToThread()` / `runAssistant()` - OpenAI Assistants API calls
- `saveSession()` / `loadSession()` - localStorage persistence

### API Integration (OpenAI)
- Uses Assistants API (not raw completions)
- Thread-based conversation memory
- Routed through backend proxy: `/api/arturito/chat`

## Widget: arturito_widget.js (~2080 lines)

### Copilot Capabilities
Cross-module actions the widget can execute:
- **Navigation** - Open any module/section
- **Expenses** - Filter by bill#, vendor, account, payment method, status
- **Pipeline** - List tasks, search, view details
- **Projects** - List, search, view details
- **Team** - Contact lookup, team structure
- **Search/Summary** - Expense summaries, active filter display

### Copilot Handler Registry
Each page registers handlers the widget can call:
```
// Example: expenses page registers these
arturitoFilterBy(column, value)
arturitoClearAllFilters()
arturitoClearFilter(column)
arturitoSearch(term)
```

### Embedded Knowledge Base
Built-in help docs (bilingual EN/ES) covering all modules:
- Expenses Engine (receipt scanning, OCR, QBO sync, filters)
- Dashboard (tasks, mentions, notifications)
- Pipeline Manager (workflow, status, approvals)
- Projects (creation, budgeting, team assignment)
- Vendors, Accounts, Estimator Suite, Team, Messages

## Settings & Analytics (agents-settings.html + arturito_analytics.js)

### Access Control
- Restricted to CEO, COO, KD COO roles
- Permission matrix visualization (color-coded: Read, Create, Update, Delete, Notification, Navigation)

### Analytics Dashboard
- Command tracking and error rates
- Failed command statistics (configurable period, default 30 days)
- Top pages, top errors, command failure analysis

## Key Patterns
- **Backend proxy** for OpenAI calls (never direct from frontend)
- **Widget skips** arturito.html page (avoids double-loading)
- **Bilingual** - responds in user's language (EN/ES detection)
- **Mobile-first** - iOS keyboard handling, viewport adjustments
- **Session management** - threadId persisted for conversation continuity
