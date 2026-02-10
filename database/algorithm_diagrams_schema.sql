-- ============================================
-- Algorithm Diagrams Table
-- Biblioteca de diagramas para nodos algorithm
-- ============================================

CREATE TABLE IF NOT EXISTS algorithm_diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- "IRIS Receipt Scanner", "ATLAS Categorizer"
    codename TEXT,                         -- "IRIS", "ATLAS" (para matching)
    description TEXT,                      -- Descripcion del algoritmo
    version TEXT DEFAULT '1.0',
    spec JSONB,                            -- El spec declarativo original
    diagram JSONB NOT NULL,                -- { nodes: [], edges: [] }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index para busqueda por codename
CREATE INDEX IF NOT EXISTS idx_algorithm_diagrams_codename ON algorithm_diagrams(codename);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_algorithm_diagrams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_algorithm_diagrams_updated
    BEFORE UPDATE ON algorithm_diagrams
    FOR EACH ROW
    EXECUTE FUNCTION update_algorithm_diagrams_timestamp();

-- RLS Policies
ALTER TABLE algorithm_diagrams ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer
CREATE POLICY "algorithm_diagrams_select_policy" ON algorithm_diagrams
    FOR SELECT USING (true);

-- Solo usuarios autenticados pueden insertar/actualizar
CREATE POLICY "algorithm_diagrams_insert_policy" ON algorithm_diagrams
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "algorithm_diagrams_update_policy" ON algorithm_diagrams
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================
-- Clean existing records for re-insert
-- ============================================
DELETE FROM algorithm_diagrams WHERE codename IN ('IRIS', 'ATLAS', 'ARTURITO', 'ANDREW', 'DANEEL', 'DANEEL_AUTH');

-- ============================================
-- IRIS Receipt Scanner v4.0
-- Service: services/receipt_scanner.py
-- Dual-mode OCR with correction pass
-- ============================================

INSERT INTO algorithm_diagrams (name, codename, description, version, spec, diagram) VALUES
(
    'IRIS Receipt Scanner',
    'IRIS',
    'Dual-mode receipt scanner. Fast mode: pdfplumber text extraction with GPT-4o-mini fallback. Heavy mode: direct GPT-4o vision. Includes validation correction pass for mismatched totals and DB-backed vendor/type/payment resolution.',
    '4.0',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "Image/PDF" },
            { "id": "mode", "type": "decision", "label": "Mode?", "from": "input" },
            { "id": "try_text", "type": "process", "label": "Text Extract", "from": "mode", "branch": "Fast", "tool": "pdfplumber" },
            { "id": "vision_ocr", "type": "process", "label": "Vision OCR", "from": "mode", "branch": "Heavy", "tool": "gpt-4o" },
            { "id": "has_text", "type": "decision", "label": "Has Text?", "from": "try_text" },
            { "id": "text_parse", "type": "process", "label": "Text Parse", "from": "has_text", "branch": "Yes", "tool": "gpt-4o-mini" },
            { "id": "ocr_fallback", "type": "process", "label": "OCR Fallback", "from": "has_text", "branch": "No", "tool": "gpt-4o-mini" },
            { "id": "parse", "type": "process", "label": "Parse JSON", "from": ["text_parse", "ocr_fallback", "vision_ocr"], "tool": "json" },
            { "id": "db_lookup", "type": "process", "label": "Resolve Vendor/Type/Payment", "from": "parse", "tool": "supabase" },
            { "id": "validate", "type": "decision", "label": "Totals Match?", "from": "db_lookup" },
            { "id": "correction", "type": "process", "label": "Correction Pass", "from": "validate", "branch": "No", "tool": "gpt-4o" },
            { "id": "revalidate", "type": "decision", "label": "Fixed?", "from": "correction" },
            { "id": "escalate", "type": "output", "label": "Bookkeeping Escalation", "from": "revalidate", "branch": "No" },
            { "id": "output", "type": "output", "label": "Structured Data", "from": ["validate", "revalidate"] }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "Image/PDF", "x": 250, "y": 40, "type": "input" },
            { "id": "mode", "label": "Mode?", "x": 250, "y": 130, "type": "decision" },
            { "id": "try_text", "label": "Text Extract", "x": 100, "y": 230, "type": "process", "tool": "pdfplumber" },
            { "id": "vision_ocr", "label": "Vision OCR", "x": 400, "y": 230, "type": "process", "tool": "gpt-4o" },
            { "id": "has_text", "label": "Has Text?", "x": 100, "y": 330, "type": "decision" },
            { "id": "text_parse", "label": "Text Parse", "x": 30, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "ocr_fallback", "label": "OCR Fallback", "x": 170, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "parse", "label": "Parse JSON", "x": 250, "y": 530, "type": "process", "tool": "json" },
            { "id": "db_lookup", "label": "Resolve Vendor/Type", "x": 250, "y": 620, "type": "process", "tool": "supabase" },
            { "id": "validate", "label": "Totals Match?", "x": 250, "y": 710, "type": "decision" },
            { "id": "output", "label": "Structured Data", "x": 150, "y": 810, "type": "output" },
            { "id": "correction", "label": "Correction Pass", "x": 420, "y": 810, "type": "process", "tool": "gpt-4o" },
            { "id": "revalidate", "label": "Fixed?", "x": 420, "y": 900, "type": "decision" },
            { "id": "escalate", "label": "Bookkeeping Escalation", "x": 520, "y": 990, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "mode" },
            { "from": "mode", "to": "try_text", "label": "Fast" },
            { "from": "mode", "to": "vision_ocr", "label": "Heavy" },
            { "from": "try_text", "to": "has_text" },
            { "from": "has_text", "to": "text_parse", "label": "Yes" },
            { "from": "has_text", "to": "ocr_fallback", "label": "No" },
            { "from": "text_parse", "to": "parse" },
            { "from": "ocr_fallback", "to": "parse" },
            { "from": "vision_ocr", "to": "parse" },
            { "from": "parse", "to": "db_lookup" },
            { "from": "db_lookup", "to": "validate" },
            { "from": "validate", "to": "output", "label": "Yes" },
            { "from": "validate", "to": "correction", "label": "No" },
            { "from": "correction", "to": "revalidate" },
            { "from": "revalidate", "to": "output", "label": "Yes" },
            { "from": "revalidate", "to": "escalate", "label": "No" }
        ]
    }'::jsonb
),

-- ============================================
-- ATLAS Expense Categorizer v2.0
-- Service: services/receipt_scanner.py (auto_categorize)
-- Stage-aware GPT categorization
-- ============================================

(
    'ATLAS Expense Categorizer',
    'ATLAS',
    'Stage-aware expense categorization. Loads non-labor accounts from DB, builds construction-context prompt with power-tool detection and confidence scoring, uses GPT-4o for analysis.',
    '2.0',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "Expenses + Stage" },
            { "id": "load_accounts", "type": "process", "label": "Load Non-Labor Accounts", "from": "input", "tool": "supabase" },
            { "id": "build_prompt", "type": "process", "label": "Build Stage-Aware Prompt", "from": "load_accounts" },
            { "id": "gpt", "type": "process", "label": "GPT-4o Categorize", "from": "build_prompt", "tool": "gpt-4o" },
            { "id": "parse", "type": "process", "label": "Parse + Validate JSON", "from": "gpt", "tool": "json" },
            { "id": "confidence", "type": "decision", "label": "Confidence?", "from": "parse" },
            { "id": "apply", "type": "output", "label": "Categorization", "from": "confidence", "branch": ">= min" },
            { "id": "warning", "type": "output", "label": "Low Confidence + Suggest", "from": "confidence", "branch": "< min" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "Expenses + Stage", "x": 200, "y": 40, "type": "input" },
            { "id": "load_accounts", "label": "Load Non-Labor Accounts", "x": 200, "y": 130, "type": "process", "tool": "supabase" },
            { "id": "build_prompt", "label": "Build Stage-Aware Prompt", "x": 200, "y": 220, "type": "process" },
            { "id": "gpt", "label": "GPT-4o Categorize", "x": 200, "y": 310, "type": "process", "tool": "gpt-4o" },
            { "id": "parse", "label": "Parse + Validate", "x": 200, "y": 400, "type": "process", "tool": "json" },
            { "id": "confidence", "label": "Confidence?", "x": 200, "y": 490, "type": "decision" },
            { "id": "apply", "label": "Categorization", "x": 100, "y": 580, "type": "output" },
            { "id": "warning", "label": "Low Confidence", "x": 300, "y": 580, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "load_accounts" },
            { "from": "load_accounts", "to": "build_prompt" },
            { "from": "build_prompt", "to": "gpt" },
            { "from": "gpt", "to": "parse" },
            { "from": "parse", "to": "confidence" },
            { "from": "confidence", "to": "apply", "label": ">= min" },
            { "from": "confidence", "to": "warning", "label": "< min" }
        ]
    }'::jsonb
),

-- ============================================
-- ARTURITO AI Assistant v3.0
-- Frontend: assets/js/arturito_widget.js
-- Backend: api/routers/arturito.py + services/arturito/
-- Hybrid NLU: frontend OBVIOS + GPT classify + backend regex + GPT fallback
-- ============================================

(
    'ARTURITO AI Assistant',
    'ARTURITO',
    'Hybrid AI assistant with dual-layer NLU. Frontend: instant OBVIOS regex matching + GPT-4o-mini intent classification. Backend: slash commands, local regex NLU, GPT fallback, permission/role checks, 17+ intent handlers, and OpenAI Assistants API with thread memory and personality levels.',
    '3.0',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "User Message" },
            { "id": "obvios", "type": "decision", "label": "OBVIOS Match?", "from": "input" },
            { "id": "local_action", "type": "process", "label": "Local Action", "from": "obvios", "branch": "Yes", "tool": "regex" },
            { "id": "interpret", "type": "process", "label": "GPT Classify Intent", "from": "obvios", "branch": "No", "tool": "gpt-4o-mini" },
            { "id": "frontend_route", "type": "decision", "label": "Frontend Route?", "from": "interpret" },
            { "id": "copilot", "type": "process", "label": "Copilot Handler", "from": "frontend_route", "branch": "Copilot", "tool": "page-handlers" },
            { "id": "navigate", "type": "process", "label": "Navigate / Modal", "from": "frontend_route", "branch": "Navigate", "tool": "browser" },
            { "id": "backend", "type": "process", "label": "Backend /web-chat", "from": "frontend_route", "branch": "Chat" },
            { "id": "slash", "type": "decision", "label": "Slash Cmd?", "from": "backend" },
            { "id": "slash_handler", "type": "process", "label": "Slash Router", "from": "slash", "branch": "Yes", "tool": "command-map" },
            { "id": "nlu", "type": "process", "label": "NLU Interpret", "from": "slash", "branch": "No", "tool": "regex + gpt-4o-mini" },
            { "id": "permission", "type": "decision", "label": "Allowed?", "from": "nlu" },
            { "id": "denied", "type": "output", "label": "Permission Denied", "from": "permission", "branch": "No" },
            { "id": "intent_router", "type": "decision", "label": "Intent Type?", "from": "permission", "branch": "Yes" },
            { "id": "handler", "type": "process", "label": "Intent Handler", "from": "intent_router", "branch": "Handler", "tool": "supabase" },
            { "id": "assistants", "type": "process", "label": "Assistants API", "from": "intent_router", "branch": "Chat", "tool": "openai-threads" },
            { "id": "response", "type": "output", "label": "Bot Response", "from": ["local_action", "copilot", "navigate", "slash_handler", "denied", "handler", "assistants"] }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "User Message", "x": 300, "y": 40, "type": "input" },
            { "id": "obvios", "label": "OBVIOS Match?", "x": 300, "y": 130, "type": "decision" },
            { "id": "local_action", "label": "Local Action", "x": 500, "y": 130, "type": "process", "tool": "regex" },
            { "id": "interpret", "label": "GPT Classify", "x": 300, "y": 230, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "frontend_route", "label": "Frontend Route?", "x": 300, "y": 330, "type": "decision" },
            { "id": "copilot", "label": "Copilot Handler", "x": 100, "y": 430, "type": "process", "tool": "page-handlers" },
            { "id": "navigate", "label": "Navigate/Modal", "x": 500, "y": 430, "type": "process", "tool": "browser" },
            { "id": "backend", "label": "/web-chat", "x": 300, "y": 430, "type": "process" },
            { "id": "slash", "label": "Slash Cmd?", "x": 300, "y": 530, "type": "decision" },
            { "id": "slash_handler", "label": "Slash Router", "x": 500, "y": 530, "type": "process", "tool": "command-map" },
            { "id": "nlu", "label": "NLU Interpret", "x": 300, "y": 630, "type": "process", "tool": "regex+gpt" },
            { "id": "permission", "label": "Allowed?", "x": 300, "y": 730, "type": "decision" },
            { "id": "denied", "label": "Denied", "x": 500, "y": 730, "type": "output" },
            { "id": "intent_router", "label": "Intent Type?", "x": 300, "y": 830, "type": "decision" },
            { "id": "handler", "label": "Intent Handler", "x": 150, "y": 930, "type": "process", "tool": "supabase" },
            { "id": "assistants", "label": "Assistants API", "x": 450, "y": 930, "type": "process", "tool": "openai-threads" },
            { "id": "response", "label": "Bot Response", "x": 300, "y": 1040, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "obvios" },
            { "from": "obvios", "to": "local_action", "label": "Yes" },
            { "from": "obvios", "to": "interpret", "label": "No" },
            { "from": "interpret", "to": "frontend_route" },
            { "from": "frontend_route", "to": "copilot", "label": "Copilot" },
            { "from": "frontend_route", "to": "navigate", "label": "Navigate" },
            { "from": "frontend_route", "to": "backend", "label": "Chat" },
            { "from": "backend", "to": "slash" },
            { "from": "slash", "to": "slash_handler", "label": "Yes" },
            { "from": "slash", "to": "nlu", "label": "No" },
            { "from": "nlu", "to": "permission" },
            { "from": "permission", "to": "denied", "label": "No" },
            { "from": "permission", "to": "intent_router", "label": "Yes" },
            { "from": "intent_router", "to": "handler", "label": "Handler" },
            { "from": "intent_router", "to": "assistants", "label": "Chat" },
            { "from": "local_action", "to": "response" },
            { "from": "copilot", "to": "response" },
            { "from": "navigate", "to": "response" },
            { "from": "slash_handler", "to": "response" },
            { "from": "denied", "to": "response" },
            { "from": "handler", "to": "response" },
            { "from": "assistants", "to": "response" }
        ]
    }'::jsonb
),

-- ============================================
-- ANDREW Bookkeeper Agent v2.0
-- Router: api/routers/pending_receipts.py
-- Receipt pipeline + conversational check flow
-- ============================================

(
    'ANDREW Bookkeeper Agent',
    'ANDREW',
    'Automated bookkeeper agent. Receipt pipeline: upload, split reuse detection, auto check detection (filename heuristic), IRIS OCR, validation correction pass, filename hint cross-validation, vendor/type resolution, ATLAS categorization, low-confidence correction flow, item-level split with cross-project notifications. Check pipeline: conversational labor check processing via Payroll channel with labor-only categorization.',
    '2.0',
    '{
        "flow": [
            { "id": "upload", "type": "input", "label": "File Uploaded to Channel" },
            { "id": "store_hash", "type": "process", "label": "Store + SHA-256 Hash", "from": "upload", "tool": "supabase-storage" },
            { "id": "split_reuse", "type": "decision", "label": "Split Reuse?", "from": "store_hash" },
            { "id": "load_prev", "type": "process", "label": "Load Previous Scan", "from": "split_reuse", "branch": "Yes", "tool": "supabase" },

            { "id": "is_check", "type": "decision", "label": "Check? (img + filename)", "from": "split_reuse", "branch": "No" },
            { "id": "check_flow", "type": "output", "label": "Route to Check Flow", "from": "is_check", "branch": "Yes" },

            { "id": "ocr", "type": "process", "label": "IRIS OCR Scan", "from": "is_check", "branch": "No", "tool": "gpt-4o" },
            { "id": "totals_ok", "type": "decision", "label": "Totals Match?", "from": "ocr" },
            { "id": "correction", "type": "process", "label": "Correction Pass", "from": "totals_ok", "branch": "No", "tool": "gpt-4o" },

            { "id": "hint", "type": "process", "label": "Filename Hint Validate", "from": ["totals_ok", "correction"], "tool": "bill-hint-parser" },
            { "id": "resolve", "type": "process", "label": "Resolve Vendor/Type/Payment", "from": "hint", "tool": "supabase" },
            { "id": "categorize", "type": "process", "label": "Categorize (ATLAS)", "from": "resolve", "tool": "gpt-4o" },

            { "id": "low_conf", "type": "decision", "label": "Low Confidence?", "from": "categorize" },
            { "id": "ask_corrections", "type": "process", "label": "Ask Bookkeeping Corrections", "from": "low_conf", "branch": "Yes", "tool": "andrew-bot" },

            { "id": "build_msg", "type": "process", "label": "Build Item List + Summary", "from": ["low_conf", "ask_corrections", "load_prev"] },
            { "id": "post", "type": "process", "label": "Post Message + Buttons", "from": "build_msg", "tool": "andrew-bot" },
            { "id": "user_choice", "type": "decision", "label": "User Choice?", "from": "post" },

            { "id": "cancel", "type": "output", "label": "Cancelled", "from": "user_choice", "branch": "Cancel" },

            { "id": "create_all", "type": "process", "label": "Create All Expenses", "from": "user_choice", "branch": "All This Project", "tool": "supabase" },

            { "id": "assign_flow", "type": "process", "label": "Show Assignment Prompt", "from": "user_choice", "branch": "Assign Items" },
            { "id": "parse_assign", "type": "process", "label": "Parse Assignment Text", "from": "assign_flow", "tool": "regex" },
            { "id": "resolve_proj", "type": "process", "label": "Resolve Projects", "from": "parse_assign", "tool": "supabase" },
            { "id": "create_split", "type": "process", "label": "Create Split Expenses", "from": "resolve_proj", "tool": "supabase" },
            { "id": "split_notify", "type": "process", "label": "Split Notifications", "from": "create_split", "tool": "andrew-bot" },

            { "id": "budget", "type": "process", "label": "Trigger Budget Check", "from": ["create_all", "split_notify"], "tool": "daneel" },
            { "id": "done", "type": "output", "label": "Receipt Completed", "from": "budget" },

            { "id": "cf_start", "type": "process", "label": "Route to Payroll", "from": "check_flow", "tool": "andrew-bot" },
            { "id": "cf_number", "type": "process", "label": "Ask Check Number", "from": "cf_start" },
            { "id": "cf_split", "type": "decision", "label": "Split?", "from": "cf_number" },
            { "id": "cf_vendor", "type": "process", "label": "Ask Vendor + Amount", "from": "cf_split", "branch": "No" },
            { "id": "cf_entries", "type": "process", "label": "Collect Split Entries", "from": "cf_split", "branch": "Yes" },
            { "id": "cf_date", "type": "process", "label": "Ask Date", "from": ["cf_vendor", "cf_entries"] },
            { "id": "cf_cat", "type": "process", "label": "Categorize (Labor Only)", "from": "cf_date", "tool": "gpt-4o" },
            { "id": "cf_conf", "type": "decision", "label": "Confidence OK?", "from": "cf_cat" },
            { "id": "cf_ask_book", "type": "process", "label": "Ask Bookkeeping", "from": "cf_conf", "branch": "No", "tool": "andrew-bot" },
            { "id": "cf_confirm", "type": "decision", "label": "Confirm?", "from": ["cf_conf", "cf_ask_book"] },
            { "id": "cf_create", "type": "process", "label": "Create Check Expenses", "from": "cf_confirm", "branch": "Yes", "tool": "supabase" },
            { "id": "cf_cancel", "type": "output", "label": "Cancelled", "from": "cf_confirm", "branch": "No" },
            { "id": "cf_done", "type": "output", "label": "Check Completed", "from": "cf_create" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "upload", "label": "File Uploaded", "x": 300, "y": 40, "type": "input" },
            { "id": "store_hash", "label": "Store + Hash", "x": 300, "y": 120, "type": "process", "tool": "supabase-storage" },
            { "id": "split_reuse", "label": "Split Reuse?", "x": 300, "y": 210, "type": "decision" },
            { "id": "load_prev", "label": "Load Prev Data", "x": 80, "y": 310, "type": "process", "tool": "supabase" },
            { "id": "is_check", "label": "Check?", "x": 420, "y": 310, "type": "decision" },
            { "id": "check_flow", "label": "Check Flow", "x": 580, "y": 310, "type": "output" },

            { "id": "ocr", "label": "IRIS OCR", "x": 300, "y": 410, "type": "process", "tool": "gpt-4o" },
            { "id": "totals_ok", "label": "Totals OK?", "x": 300, "y": 500, "type": "decision" },
            { "id": "correction", "label": "Correction Pass", "x": 480, "y": 500, "type": "process", "tool": "gpt-4o" },

            { "id": "hint", "label": "Filename Hint", "x": 300, "y": 590, "type": "process", "tool": "bill-hint-parser" },
            { "id": "resolve", "label": "Resolve Vendor/Type", "x": 300, "y": 680, "type": "process", "tool": "supabase" },
            { "id": "categorize", "label": "Categorize (ATLAS)", "x": 300, "y": 770, "type": "process", "tool": "gpt-4o" },

            { "id": "low_conf", "label": "Low Confidence?", "x": 300, "y": 860, "type": "decision" },
            { "id": "ask_corrections", "label": "Ask Corrections", "x": 500, "y": 860, "type": "process", "tool": "andrew-bot" },

            { "id": "build_msg", "label": "Build Item List", "x": 300, "y": 960, "type": "process" },
            { "id": "post", "label": "Post Summary", "x": 300, "y": 1050, "type": "process", "tool": "andrew-bot" },
            { "id": "user_choice", "label": "User Choice?", "x": 300, "y": 1140, "type": "decision" },

            { "id": "cancel", "label": "Cancelled", "x": 520, "y": 1140, "type": "output" },
            { "id": "create_all", "label": "Create All $", "x": 100, "y": 1240, "type": "process", "tool": "supabase" },

            { "id": "assign_flow", "label": "Assignment Prompt", "x": 350, "y": 1240, "type": "process" },
            { "id": "parse_assign", "label": "Parse Text", "x": 350, "y": 1330, "type": "process", "tool": "regex" },
            { "id": "resolve_proj", "label": "Resolve Projects", "x": 350, "y": 1420, "type": "process", "tool": "supabase" },
            { "id": "create_split", "label": "Create Split $", "x": 350, "y": 1510, "type": "process", "tool": "supabase" },
            { "id": "split_notify", "label": "Notifications", "x": 350, "y": 1600, "type": "process", "tool": "andrew-bot" },

            { "id": "budget", "label": "Budget Check", "x": 250, "y": 1700, "type": "process", "tool": "daneel" },
            { "id": "done", "label": "Completed", "x": 250, "y": 1790, "type": "output" },

            { "id": "cf_start", "label": "Route to Payroll", "x": 750, "y": 410, "type": "process", "tool": "andrew-bot" },
            { "id": "cf_number", "label": "Ask Check #", "x": 750, "y": 500, "type": "process" },
            { "id": "cf_split", "label": "Split?", "x": 750, "y": 590, "type": "decision" },
            { "id": "cf_vendor", "label": "Ask Vendor+Amt", "x": 650, "y": 680, "type": "process" },
            { "id": "cf_entries", "label": "Collect Entries", "x": 850, "y": 680, "type": "process" },
            { "id": "cf_date", "label": "Ask Date", "x": 750, "y": 770, "type": "process" },
            { "id": "cf_cat", "label": "Categorize (Labor)", "x": 750, "y": 860, "type": "process", "tool": "gpt-4o" },
            { "id": "cf_conf", "label": "Confidence OK?", "x": 750, "y": 950, "type": "decision" },
            { "id": "cf_ask_book", "label": "Ask Bookkeeping", "x": 900, "y": 950, "type": "process", "tool": "andrew-bot" },
            { "id": "cf_confirm", "label": "Confirm?", "x": 750, "y": 1050, "type": "decision" },
            { "id": "cf_create", "label": "Create Check $", "x": 650, "y": 1150, "type": "process", "tool": "supabase" },
            { "id": "cf_cancel", "label": "Cancelled", "x": 870, "y": 1150, "type": "output" },
            { "id": "cf_done", "label": "Check Done", "x": 650, "y": 1240, "type": "output" }
        ],
        "edges": [
            { "from": "upload", "to": "store_hash" },
            { "from": "store_hash", "to": "split_reuse" },
            { "from": "split_reuse", "to": "load_prev", "label": "Yes" },
            { "from": "split_reuse", "to": "is_check", "label": "No" },
            { "from": "is_check", "to": "check_flow", "label": "Yes" },
            { "from": "is_check", "to": "ocr", "label": "No" },
            { "from": "load_prev", "to": "build_msg" },

            { "from": "ocr", "to": "totals_ok" },
            { "from": "totals_ok", "to": "hint", "label": "Yes" },
            { "from": "totals_ok", "to": "correction", "label": "No" },
            { "from": "correction", "to": "hint" },
            { "from": "hint", "to": "resolve" },
            { "from": "resolve", "to": "categorize" },
            { "from": "categorize", "to": "low_conf" },
            { "from": "low_conf", "to": "build_msg", "label": "No" },
            { "from": "low_conf", "to": "ask_corrections", "label": "Yes" },
            { "from": "ask_corrections", "to": "build_msg" },

            { "from": "build_msg", "to": "post" },
            { "from": "post", "to": "user_choice" },
            { "from": "user_choice", "to": "cancel", "label": "Cancel" },
            { "from": "user_choice", "to": "create_all", "label": "All" },
            { "from": "user_choice", "to": "assign_flow", "label": "Assign" },

            { "from": "create_all", "to": "budget" },
            { "from": "assign_flow", "to": "parse_assign" },
            { "from": "parse_assign", "to": "resolve_proj" },
            { "from": "resolve_proj", "to": "create_split" },
            { "from": "create_split", "to": "split_notify" },
            { "from": "split_notify", "to": "budget" },
            { "from": "budget", "to": "done" },

            { "from": "check_flow", "to": "cf_start" },
            { "from": "cf_start", "to": "cf_number" },
            { "from": "cf_number", "to": "cf_split" },
            { "from": "cf_split", "to": "cf_vendor", "label": "No" },
            { "from": "cf_split", "to": "cf_entries", "label": "Yes" },
            { "from": "cf_vendor", "to": "cf_date" },
            { "from": "cf_entries", "to": "cf_date" },
            { "from": "cf_date", "to": "cf_cat" },
            { "from": "cf_cat", "to": "cf_conf" },
            { "from": "cf_conf", "to": "cf_confirm", "label": "Yes" },
            { "from": "cf_conf", "to": "cf_ask_book", "label": "No" },
            { "from": "cf_ask_book", "to": "cf_confirm" },
            { "from": "cf_confirm", "to": "cf_create", "label": "Yes" },
            { "from": "cf_confirm", "to": "cf_cancel", "label": "No" },
            { "from": "cf_create", "to": "cf_done" }
        ]
    }'::jsonb
),

-- ============================================
-- DANEEL Budget Monitor v1.1
-- Service: api/services/budget_monitor.py
-- Event-driven budget vs actuals alerting
-- ============================================

(
    'DANEEL Budget Monitor',
    'DANEEL',
    'Event-driven budget monitoring agent. Triggers on expense authorization, compares budget vs actuals per account, sends threshold alerts (warning >=80%, critical >=95%, overspend >=100%), deduplicates, notifies via Firebase push and Daneel bot channel messages.',
    '1.1',
    '{
        "flow": [
            { "id": "trigger", "type": "input", "label": "Expense Authorized" },
            { "id": "load", "type": "process", "label": "Load Project + Settings", "from": "trigger", "tool": "supabase" },
            { "id": "enabled", "type": "decision", "label": "Enabled?", "from": "load" },
            { "id": "skip", "type": "output", "label": "Skip (disabled)", "from": "enabled", "branch": "No" },
            { "id": "recipients", "type": "process", "label": "Load Recipients", "from": "enabled", "branch": "Yes", "tool": "supabase" },
            { "id": "has_recip", "type": "decision", "label": "Recipients?", "from": "recipients" },
            { "id": "no_recip", "type": "output", "label": "Skip (none)", "from": "has_recip", "branch": "No" },
            { "id": "budgets", "type": "process", "label": "Get Budgets", "from": "has_recip", "branch": "Yes", "tool": "supabase" },
            { "id": "actuals", "type": "process", "label": "Get Actuals", "from": "budgets", "tool": "supabase" },
            { "id": "compare", "type": "process", "label": "Budget vs Actuals", "from": "actuals" },
            { "id": "threshold", "type": "decision", "label": "Threshold?", "from": "compare" },
            { "id": "ok", "type": "output", "label": "No Alert", "from": "threshold", "branch": "<80%" },
            { "id": "alert", "type": "process", "label": "Build Alert", "from": "threshold", "branch": ">=80%" },
            { "id": "dedup", "type": "decision", "label": "Already Sent?", "from": "alert" },
            { "id": "dup_skip", "type": "output", "label": "Skip (dedup)", "from": "dedup", "branch": "Yes" },
            { "id": "notify", "type": "process", "label": "Push Notify", "from": "dedup", "branch": "No", "tool": "firebase" },
            { "id": "log", "type": "process", "label": "Save Alert Log", "from": "notify", "tool": "supabase" },
            { "id": "post", "type": "process", "label": "Post to Channel", "from": "log", "tool": "daneel-bot" },
            { "id": "done", "type": "output", "label": "Alert Delivered", "from": "post" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "trigger", "label": "Expense Authorized", "x": 300, "y": 40, "type": "input" },
            { "id": "load", "label": "Load Project+Settings", "x": 300, "y": 130, "type": "process", "tool": "supabase" },
            { "id": "enabled", "label": "Enabled?", "x": 300, "y": 220, "type": "decision" },
            { "id": "skip", "label": "Skip", "x": 500, "y": 220, "type": "output" },
            { "id": "recipients", "label": "Load Recipients", "x": 300, "y": 310, "type": "process", "tool": "supabase" },
            { "id": "has_recip", "label": "Recipients?", "x": 300, "y": 400, "type": "decision" },
            { "id": "no_recip", "label": "Skip", "x": 500, "y": 400, "type": "output" },
            { "id": "budgets", "label": "Get Budgets", "x": 200, "y": 490, "type": "process", "tool": "supabase" },
            { "id": "actuals", "label": "Get Actuals", "x": 400, "y": 490, "type": "process", "tool": "supabase" },
            { "id": "compare", "label": "Budget vs Actuals", "x": 300, "y": 580, "type": "process" },
            { "id": "threshold", "label": "Threshold?", "x": 300, "y": 670, "type": "decision" },
            { "id": "ok", "label": "No Alert", "x": 500, "y": 670, "type": "output" },
            { "id": "alert", "label": "Build Alert", "x": 300, "y": 760, "type": "process" },
            { "id": "dedup", "label": "Already Sent?", "x": 300, "y": 850, "type": "decision" },
            { "id": "dup_skip", "label": "Skip", "x": 500, "y": 850, "type": "output" },
            { "id": "notify", "label": "Push Notify", "x": 300, "y": 940, "type": "process", "tool": "firebase" },
            { "id": "log", "label": "Save Alert Log", "x": 300, "y": 1030, "type": "process", "tool": "supabase" },
            { "id": "post", "label": "Post to Channel", "x": 300, "y": 1120, "type": "process", "tool": "daneel-bot" },
            { "id": "done", "label": "Alert Delivered", "x": 300, "y": 1210, "type": "output" }
        ],
        "edges": [
            { "from": "trigger", "to": "load" },
            { "from": "load", "to": "enabled" },
            { "from": "enabled", "to": "skip", "label": "No" },
            { "from": "enabled", "to": "recipients", "label": "Yes" },
            { "from": "recipients", "to": "has_recip" },
            { "from": "has_recip", "to": "no_recip", "label": "No" },
            { "from": "has_recip", "to": "budgets", "label": "Yes" },
            { "from": "has_recip", "to": "actuals", "label": "Yes" },
            { "from": "budgets", "to": "compare" },
            { "from": "actuals", "to": "compare" },
            { "from": "compare", "to": "threshold" },
            { "from": "threshold", "to": "ok", "label": "<80%" },
            { "from": "threshold", "to": "alert", "label": ">=80%" },
            { "from": "alert", "to": "dedup" },
            { "from": "dedup", "to": "dup_skip", "label": "Yes" },
            { "from": "dedup", "to": "notify", "label": "No" },
            { "from": "notify", "to": "log" },
            { "from": "log", "to": "post" },
            { "from": "post", "to": "done" }
        ]
    }'::jsonb
),

-- ============================================
-- DANEEL Auto-Authorization v1.0
-- Service: api/services/daneel_auto_auth.py
-- Rule-based expense auto-auth with GPT fallback
-- ============================================

(
    'DANEEL Auto-Authorization',
    'DANEEL_AUTH',
    'Rule-based expense auto-authorization engine. Multi-phase: health check (required fields), bill hint cross-validation (filename amount mismatch detection), duplicate detection rules R1-R9 (amount tolerance, date matching, receipt hash comparison, labor/check awareness), optional GPT-4o-mini fallback for ambiguous cases, GPT batch review before final authorization. Posts batch auth reports, missing info requests, and escalation messages to project channels.',
    '1.0',
    '{
        "flow": [
            { "id": "trigger", "type": "input", "label": "Expense Created/Updated" },
            { "id": "config", "type": "process", "label": "Load Config + Lookups", "from": "trigger", "tool": "supabase" },
            { "id": "enabled", "type": "decision", "label": "Enabled?", "from": "config" },
            { "id": "skip", "type": "output", "label": "Skip (disabled)", "from": "enabled", "branch": "No" },
            { "id": "fetch", "type": "process", "label": "Fetch Pending Expenses", "from": "enabled", "branch": "Yes", "tool": "supabase" },

            { "id": "health", "type": "process", "label": "Health Check", "from": "fetch" },
            { "id": "missing", "type": "decision", "label": "Missing Fields?", "from": "health" },
            { "id": "track_missing", "type": "process", "label": "Track + Request Info", "from": "missing", "branch": "Yes", "tool": "daneel-bot" },

            { "id": "hint", "type": "process", "label": "Bill Hint Validate", "from": "missing", "branch": "No", "tool": "bill-hint-parser" },
            { "id": "hint_ok", "type": "decision", "label": "Amount Match?", "from": "hint" },
            { "id": "hint_esc", "type": "process", "label": "Escalate Mismatch", "from": "hint_ok", "branch": "No" },

            { "id": "dup_rules", "type": "process", "label": "Duplicate Rules R1-R9", "from": "hint_ok", "branch": "Yes", "tool": "supabase" },
            { "id": "verdict", "type": "decision", "label": "Verdict?", "from": "dup_rules" },
            { "id": "is_dup", "type": "output", "label": "Mark Duplicate", "from": "verdict", "branch": "Duplicate" },
            { "id": "ambiguous", "type": "process", "label": "GPT Resolve", "from": "verdict", "branch": "Ambiguous", "tool": "gpt-4o-mini" },

            { "id": "candidate", "type": "process", "label": "Auth Candidate", "from": ["verdict", "ambiguous"] },
            { "id": "batch_review", "type": "process", "label": "GPT Batch Review", "from": "candidate", "tool": "gpt-4o-mini" },
            { "id": "approved", "type": "decision", "label": "Approved?", "from": "batch_review" },

            { "id": "escalate", "type": "process", "label": "Escalate to Human", "from": ["approved", "hint_esc", "ambiguous"] },
            { "id": "authorize", "type": "process", "label": "Authorize Expense", "from": "approved", "branch": "Yes", "tool": "supabase" },
            { "id": "budget_trigger", "type": "process", "label": "Trigger Budget Check", "from": "authorize", "tool": "daneel" },

            { "id": "messages", "type": "process", "label": "Post Messages", "from": ["authorize", "track_missing", "escalate"], "tool": "daneel-bot" },
            { "id": "done", "type": "output", "label": "Done", "from": "messages" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "trigger", "label": "Expense Created", "x": 300, "y": 40, "type": "input" },
            { "id": "config", "label": "Load Config", "x": 300, "y": 130, "type": "process", "tool": "supabase" },
            { "id": "enabled", "label": "Enabled?", "x": 300, "y": 220, "type": "decision" },
            { "id": "skip", "label": "Skip", "x": 500, "y": 220, "type": "output" },
            { "id": "fetch", "label": "Fetch Pending", "x": 300, "y": 310, "type": "process", "tool": "supabase" },

            { "id": "health", "label": "Health Check", "x": 300, "y": 400, "type": "process" },
            { "id": "missing", "label": "Missing Fields?", "x": 300, "y": 490, "type": "decision" },
            { "id": "track_missing", "label": "Track + Request", "x": 520, "y": 490, "type": "process", "tool": "daneel-bot" },

            { "id": "hint", "label": "Bill Hint Validate", "x": 300, "y": 580, "type": "process", "tool": "bill-hint-parser" },
            { "id": "hint_ok", "label": "Amount Match?", "x": 300, "y": 670, "type": "decision" },
            { "id": "hint_esc", "label": "Escalate Mismatch", "x": 520, "y": 670, "type": "process" },

            { "id": "dup_rules", "label": "Dup Rules R1-R9", "x": 300, "y": 760, "type": "process", "tool": "supabase" },
            { "id": "verdict", "label": "Verdict?", "x": 300, "y": 850, "type": "decision" },
            { "id": "is_dup", "label": "Duplicate", "x": 100, "y": 850, "type": "output" },
            { "id": "ambiguous", "label": "GPT Resolve", "x": 520, "y": 850, "type": "process", "tool": "gpt-4o-mini" },

            { "id": "candidate", "label": "Auth Candidate", "x": 300, "y": 940, "type": "process" },
            { "id": "batch_review", "label": "GPT Batch Review", "x": 300, "y": 1030, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "approved", "label": "Approved?", "x": 300, "y": 1120, "type": "decision" },

            { "id": "escalate", "label": "Escalate", "x": 520, "y": 1120, "type": "process" },
            { "id": "authorize", "label": "Authorize", "x": 150, "y": 1210, "type": "process", "tool": "supabase" },
            { "id": "budget_trigger", "label": "Budget Check", "x": 150, "y": 1300, "type": "process", "tool": "daneel" },

            { "id": "messages", "label": "Post Messages", "x": 300, "y": 1400, "type": "process", "tool": "daneel-bot" },
            { "id": "done", "label": "Done", "x": 300, "y": 1490, "type": "output" }
        ],
        "edges": [
            { "from": "trigger", "to": "config" },
            { "from": "config", "to": "enabled" },
            { "from": "enabled", "to": "skip", "label": "No" },
            { "from": "enabled", "to": "fetch", "label": "Yes" },
            { "from": "fetch", "to": "health" },

            { "from": "health", "to": "missing" },
            { "from": "missing", "to": "track_missing", "label": "Yes" },
            { "from": "missing", "to": "hint", "label": "No" },

            { "from": "hint", "to": "hint_ok" },
            { "from": "hint_ok", "to": "hint_esc", "label": "No" },
            { "from": "hint_ok", "to": "dup_rules", "label": "Yes" },

            { "from": "dup_rules", "to": "verdict" },
            { "from": "verdict", "to": "is_dup", "label": "Duplicate" },
            { "from": "verdict", "to": "ambiguous", "label": "Ambiguous" },
            { "from": "verdict", "to": "candidate", "label": "Clear" },
            { "from": "ambiguous", "to": "candidate" },

            { "from": "candidate", "to": "batch_review" },
            { "from": "batch_review", "to": "approved" },
            { "from": "approved", "to": "authorize", "label": "Yes" },
            { "from": "approved", "to": "escalate", "label": "No" },
            { "from": "hint_esc", "to": "escalate" },

            { "from": "authorize", "to": "budget_trigger" },
            { "from": "budget_trigger", "to": "messages" },
            { "from": "track_missing", "to": "messages" },
            { "from": "escalate", "to": "messages" },
            { "from": "messages", "to": "done" }
        ]
    }'::jsonb
);
