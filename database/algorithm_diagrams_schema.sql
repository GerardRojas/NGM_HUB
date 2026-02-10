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
-- Insertar diagramas iniciales (IRIS y ATLAS)
-- ============================================

INSERT INTO algorithm_diagrams (name, codename, description, version, spec, diagram) VALUES
(
    'IRIS Receipt Scanner',
    'IRIS',
    'Extraccion inteligente de datos de facturas usando vision AI',
    '3.0',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "Image/PDF" },
            { "id": "format", "type": "decision", "label": "Format?", "from": "input" },
            { "id": "try_text", "type": "process", "label": "Try Text Extract", "from": "format", "branch": "PDF" },
            { "id": "ocr", "type": "process", "label": "OCR Vision", "from": "format", "branch": "Image" },
            { "id": "has_text", "type": "decision", "label": "Has Text?", "from": "try_text" },
            { "id": "text_ok", "type": "process", "label": "Text Ready", "from": "has_text", "branch": "Yes" },
            { "id": "ocr_fallback", "type": "process", "label": "OCR Fallback", "from": "has_text", "branch": "No" },
            { "id": "mode", "type": "decision", "label": "Mode?", "from": ["ocr", "text_ok", "ocr_fallback"] },
            { "id": "fast", "type": "process", "label": "GPT-4o-mini", "from": "mode", "branch": "Fast" },
            { "id": "heavy", "type": "process", "label": "GPT-4o", "from": "mode", "branch": "Heavy" },
            { "id": "parse", "type": "process", "label": "Parse Fields", "from": ["fast", "heavy"] },
            { "id": "output", "type": "output", "label": "vendor, amount, date", "from": "parse" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "Image/PDF", "x": 250, "y": 40, "type": "input" },
            { "id": "mode", "label": "Mode?", "x": 250, "y": 130, "type": "decision" },
            { "id": "try_text", "label": "Text Extract", "x": 100, "y": 230, "type": "process", "tool": "pdfplumber" },
            { "id": "heavy_ocr", "label": "Vision OCR", "x": 400, "y": 230, "type": "process", "tool": "gpt-4o" },
            { "id": "has_text", "label": "Has Text?", "x": 100, "y": 330, "type": "decision" },
            { "id": "fast_parse", "label": "Fast Parse", "x": 30, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "ocr_fallback", "label": "OCR Fallback", "x": 170, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "heavy_parse", "label": "Deep Parse", "x": 400, "y": 330, "type": "process", "tool": "gpt-4o" },
            { "id": "validate", "label": "Validate", "x": 250, "y": 530, "type": "process", "tool": "json-schema" },
            { "id": "output", "label": "structured data", "x": 250, "y": 620, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "mode" },
            { "from": "mode", "to": "try_text", "label": "Fast" },
            { "from": "mode", "to": "heavy_ocr", "label": "Heavy" },
            { "from": "try_text", "to": "has_text" },
            { "from": "has_text", "to": "fast_parse", "label": "Yes" },
            { "from": "has_text", "to": "ocr_fallback", "label": "No" },
            { "from": "heavy_ocr", "to": "heavy_parse" },
            { "from": "fast_parse", "to": "validate" },
            { "from": "ocr_fallback", "to": "validate" },
            { "from": "heavy_parse", "to": "validate" },
            { "from": "validate", "to": "output" }
        ]
    }'::jsonb
),
(
    'ATLAS Expense Categorizer',
    'ATLAS',
    'Categorizacion automatica de gastos usando contexto historico y NLP',
    '1.3',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "Expense Data" },
            { "id": "context", "type": "process", "label": "Load Context", "from": "input" },
            { "id": "mode", "type": "decision", "label": "Mode?", "from": "context" },
            { "id": "standard", "type": "process", "label": "GPT-4o-mini", "from": "mode", "branch": "Standard" },
            { "id": "deep", "type": "process", "label": "GPT-4o", "from": "mode", "branch": "Deep" },
            { "id": "match", "type": "process", "label": "Match History", "from": ["standard", "deep"] },
            { "id": "confidence", "type": "decision", "label": "Confidence?", "from": "match" },
            { "id": "output", "type": "output", "label": "category", "from": "confidence", "branch": ">70%" },
            { "id": "suggestions", "type": "output", "label": "suggestions[]", "from": "confidence", "branch": "<70%" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "expenses + stage", "x": 200, "y": 40, "type": "input" },
            { "id": "load_accounts", "label": "Load Accounts", "x": 200, "y": 130, "type": "process", "tool": "supabase" },
            { "id": "build_prompt", "label": "Build Prompt", "x": 200, "y": 220, "type": "process", "tool": "context-builder" },
            { "id": "gpt", "label": "Analyze", "x": 200, "y": 310, "type": "process", "tool": "gpt-4o" },
            { "id": "parse", "label": "Parse JSON", "x": 200, "y": 400, "type": "process", "tool": "regex" },
            { "id": "validate", "label": "Validate", "x": 200, "y": 490, "type": "process", "tool": "json-schema" },
            { "id": "confidence", "label": "Confidence?", "x": 200, "y": 580, "type": "decision" },
            { "id": "apply", "label": "categorization", "x": 100, "y": 670, "type": "output" },
            { "id": "warning", "label": "warning + suggest", "x": 300, "y": 670, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "load_accounts" },
            { "from": "load_accounts", "to": "build_prompt" },
            { "from": "build_prompt", "to": "gpt" },
            { "from": "gpt", "to": "parse" },
            { "from": "parse", "to": "validate" },
            { "from": "validate", "to": "confidence" },
            { "from": "confidence", "to": "apply", "label": ">60%" },
            { "from": "confidence", "to": "warning", "label": "<60%" }
        ]
    }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- UPDATE para agregar tools a diagramas existentes
-- Ejecutar si ya tienes IRIS/ATLAS sin tools
-- ============================================

UPDATE algorithm_diagrams
SET diagram = '{
    "nodes": [
        { "id": "input", "label": "Image/PDF", "x": 250, "y": 40, "type": "input" },
        { "id": "mode", "label": "Mode?", "x": 250, "y": 130, "type": "decision" },
        { "id": "try_text", "label": "Text Extract", "x": 100, "y": 230, "type": "process", "tool": "pdfplumber" },
        { "id": "heavy_ocr", "label": "Vision OCR", "x": 400, "y": 230, "type": "process", "tool": "gpt-4o" },
        { "id": "has_text", "label": "Has Text?", "x": 100, "y": 330, "type": "decision" },
        { "id": "fast_parse", "label": "Fast Parse", "x": 30, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
        { "id": "ocr_fallback", "label": "OCR Fallback", "x": 170, "y": 430, "type": "process", "tool": "gpt-4o-mini" },
        { "id": "heavy_parse", "label": "Deep Parse", "x": 400, "y": 330, "type": "process", "tool": "gpt-4o" },
        { "id": "validate", "label": "Validate", "x": 250, "y": 530, "type": "process", "tool": "json-schema" },
        { "id": "output", "label": "structured data", "x": 250, "y": 620, "type": "output" }
    ],
    "edges": [
        { "from": "input", "to": "mode" },
        { "from": "mode", "to": "try_text", "label": "Fast" },
        { "from": "mode", "to": "heavy_ocr", "label": "Heavy" },
        { "from": "try_text", "to": "has_text" },
        { "from": "has_text", "to": "fast_parse", "label": "Yes" },
        { "from": "has_text", "to": "ocr_fallback", "label": "No" },
        { "from": "heavy_ocr", "to": "heavy_parse" },
        { "from": "fast_parse", "to": "validate" },
        { "from": "ocr_fallback", "to": "validate" },
        { "from": "heavy_parse", "to": "validate" },
        { "from": "validate", "to": "output" }
    ]
}'::jsonb
WHERE codename = 'IRIS';

UPDATE algorithm_diagrams
SET diagram = '{
    "nodes": [
        { "id": "input", "label": "expenses + stage", "x": 200, "y": 40, "type": "input" },
        { "id": "load_accounts", "label": "Load Accounts", "x": 200, "y": 130, "type": "process", "tool": "supabase" },
        { "id": "build_prompt", "label": "Build Prompt", "x": 200, "y": 220, "type": "process", "tool": "context-builder" },
        { "id": "gpt", "label": "Analyze", "x": 200, "y": 310, "type": "process", "tool": "gpt-4o" },
        { "id": "parse", "label": "Parse JSON", "x": 200, "y": 400, "type": "process", "tool": "regex" },
        { "id": "validate", "label": "Validate", "x": 200, "y": 490, "type": "process", "tool": "json-schema" },
        { "id": "confidence", "label": "Confidence?", "x": 200, "y": 580, "type": "decision" },
        { "id": "apply", "label": "categorization", "x": 100, "y": 670, "type": "output" },
        { "id": "warning", "label": "warning + suggest", "x": 300, "y": 670, "type": "output" }
    ],
    "edges": [
        { "from": "input", "to": "load_accounts" },
        { "from": "load_accounts", "to": "build_prompt" },
        { "from": "build_prompt", "to": "gpt" },
        { "from": "gpt", "to": "parse" },
        { "from": "parse", "to": "validate" },
        { "from": "validate", "to": "confidence" },
        { "from": "confidence", "to": "apply", "label": ">60%" },
        { "from": "confidence", "to": "warning", "label": "<60%" }
    ]
}'::jsonb
WHERE codename = 'ATLAS';

-- ============================================
-- INSERT ARTURITO (AI Assistant)
-- ============================================

INSERT INTO algorithm_diagrams (name, codename, description, version, spec, diagram) VALUES
(
    'ARTURITO AI Assistant',
    'ARTURITO',
    'Asistente AI multimodal con NLU, handlers especializados y memoria conversacional',
    '2.0',
    '{
        "flow": [
            { "id": "input", "type": "input", "label": "user message" },
            { "id": "slash_check", "type": "decision", "label": "Slash Cmd?", "from": "input" },
            { "id": "slash_router", "type": "process", "label": "Slash Router", "from": "slash_check", "branch": "Yes" },
            { "id": "nlu_local", "type": "process", "label": "NLU Local", "from": "slash_check", "branch": "No", "tool": "regex" },
            { "id": "has_match", "type": "decision", "label": "Match?", "from": "nlu_local" },
            { "id": "nlu_gpt", "type": "process", "label": "NLU GPT", "from": "has_match", "branch": "No", "tool": "gpt-4o-mini" },
            { "id": "intent_router", "type": "decision", "label": "Intent?", "from": ["has_match", "nlu_gpt"] },
            { "id": "assistants", "type": "process", "label": "Assistants API", "from": "intent_router", "branch": "Chat", "tool": "openai-threads" },
            { "id": "bva_handler", "type": "process", "label": "BVA Handler", "from": "intent_router", "branch": "BVA", "tool": "supabase" },
            { "id": "copilot", "type": "process", "label": "Copilot", "from": "intent_router", "branch": "Action", "tool": "page-context" },
            { "id": "response", "type": "output", "label": "bot response", "from": ["slash_router", "assistants", "bva_handler", "copilot"] }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "input", "label": "user message", "x": 300, "y": 40, "type": "input" },
            { "id": "slash_check", "label": "Slash?", "x": 300, "y": 130, "type": "decision" },
            { "id": "slash_router", "label": "Slash Router", "x": 480, "y": 130, "type": "process", "tool": "command-map" },
            { "id": "nlu_local", "label": "NLU Local", "x": 150, "y": 220, "type": "process", "tool": "regex" },
            { "id": "has_match", "label": "Match?", "x": 150, "y": 310, "type": "decision" },
            { "id": "nlu_gpt", "label": "NLU GPT", "x": 50, "y": 400, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "intent_router", "label": "Intent?", "x": 250, "y": 400, "type": "decision" },
            { "id": "assistants", "label": "Assistants API", "x": 100, "y": 510, "type": "process", "tool": "openai-threads" },
            { "id": "bva_handler", "label": "BVA Report", "x": 250, "y": 510, "type": "process", "tool": "supabase" },
            { "id": "copilot", "label": "Copilot", "x": 400, "y": 510, "type": "process", "tool": "page-context" },
            { "id": "response", "label": "bot response", "x": 300, "y": 620, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "slash_check" },
            { "from": "slash_check", "to": "slash_router", "label": "Yes" },
            { "from": "slash_check", "to": "nlu_local", "label": "No" },
            { "from": "nlu_local", "to": "has_match" },
            { "from": "has_match", "to": "intent_router", "label": "Yes" },
            { "from": "has_match", "to": "nlu_gpt", "label": "No" },
            { "from": "nlu_gpt", "to": "intent_router" },
            { "from": "intent_router", "to": "assistants", "label": "Chat" },
            { "from": "intent_router", "to": "bva_handler", "label": "BVA" },
            { "from": "intent_router", "to": "copilot", "label": "Action" },
            { "from": "slash_router", "to": "response" },
            { "from": "assistants", "to": "response" },
            { "from": "bva_handler", "to": "response" },
            { "from": "copilot", "to": "response" }
        ]
    }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- INSERT DANEEL (Budget Monitor Agent)
-- ============================================

INSERT INTO algorithm_diagrams (name, codename, description, version, spec, diagram) VALUES
(
    'DANEEL Budget Monitor',
    'DANEEL',
    'Event-driven budget monitoring agent. Triggers on expense authorization, compares budget vs actuals per account, and posts alerts to project accounting channel.',
    '1.0',
    '{
        "flow": [
            { "id": "trigger", "type": "input", "label": "Expense Authorized" },
            { "id": "load_project", "type": "process", "label": "Load Project", "from": "trigger", "tool": "supabase" },
            { "id": "load_settings", "type": "process", "label": "Load Settings", "from": "load_project", "tool": "supabase" },
            { "id": "enabled", "type": "decision", "label": "Enabled?", "from": "load_settings" },
            { "id": "exit_disabled", "type": "output", "label": "skip (disabled)", "from": "enabled", "branch": "No" },
            { "id": "load_recipients", "type": "process", "label": "Load Recipients", "from": "enabled", "branch": "Yes", "tool": "supabase" },
            { "id": "has_recipients", "type": "decision", "label": "Recipients?", "from": "load_recipients" },
            { "id": "exit_no_recip", "type": "output", "label": "skip (none)", "from": "has_recipients", "branch": "No" },
            { "id": "get_budgets", "type": "process", "label": "Get Budgets", "from": "has_recipients", "branch": "Yes", "tool": "supabase" },
            { "id": "get_actuals", "type": "process", "label": "Get Actuals", "from": "get_budgets", "tool": "supabase" },
            { "id": "compare", "type": "process", "label": "Budget vs Actuals", "from": "get_actuals" },
            { "id": "alert_type", "type": "decision", "label": "Threshold?", "from": "compare" },
            { "id": "overspend", "type": "process", "label": "OVERSPEND", "from": "alert_type", "branch": ">=100%" },
            { "id": "critical", "type": "process", "label": "CRITICAL", "from": "alert_type", "branch": ">=95%" },
            { "id": "warning", "type": "process", "label": "WARNING", "from": "alert_type", "branch": ">=80%" },
            { "id": "no_budget", "type": "process", "label": "NO BUDGET", "from": "alert_type", "branch": "No Budget" },
            { "id": "exit_ok", "type": "output", "label": "no alert", "from": "alert_type", "branch": "<80%" },
            { "id": "dedup", "type": "decision", "label": "Already Sent?", "from": ["overspend", "critical", "warning", "no_budget"] },
            { "id": "exit_dup", "type": "output", "label": "skip (dedup)", "from": "dedup", "branch": "Yes" },
            { "id": "notify", "type": "process", "label": "Notify Recipients", "from": "dedup", "branch": "No", "tool": "firebase" },
            { "id": "log", "type": "process", "label": "Save Alert Log", "from": "notify", "tool": "supabase" },
            { "id": "post_channel", "type": "process", "label": "Post to Channel", "from": "log", "tool": "daneel-bot" },
            { "id": "output", "type": "output", "label": "alert delivered", "from": "post_channel" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "trigger", "label": "Expense Authorized", "x": 300, "y": 40, "type": "input" },
            { "id": "load_project", "label": "Load Project", "x": 300, "y": 120, "type": "process", "tool": "supabase" },
            { "id": "load_settings", "label": "Load Settings", "x": 300, "y": 200, "type": "process", "tool": "supabase" },
            { "id": "enabled", "label": "Enabled?", "x": 300, "y": 280, "type": "decision" },
            { "id": "exit_disabled", "label": "skip (disabled)", "x": 500, "y": 280, "type": "output" },
            { "id": "load_recipients", "label": "Load Recipients", "x": 300, "y": 370, "type": "process", "tool": "supabase" },
            { "id": "has_recipients", "label": "Recipients?", "x": 300, "y": 450, "type": "decision" },
            { "id": "exit_no_recip", "label": "skip (none)", "x": 500, "y": 450, "type": "output" },
            { "id": "get_budgets", "label": "Get Budgets", "x": 200, "y": 540, "type": "process", "tool": "budgets_qbo" },
            { "id": "get_actuals", "label": "Get Actuals", "x": 400, "y": 540, "type": "process", "tool": "expenses" },
            { "id": "compare", "label": "Budget vs Actuals", "x": 300, "y": 630, "type": "process" },
            { "id": "alert_type", "label": "Threshold?", "x": 300, "y": 720, "type": "decision" },
            { "id": "overspend", "label": "OVERSPEND", "x": 80, "y": 810, "type": "process" },
            { "id": "critical", "label": "CRITICAL", "x": 220, "y": 810, "type": "process" },
            { "id": "warning", "label": "WARNING", "x": 360, "y": 810, "type": "process" },
            { "id": "no_budget", "label": "NO BUDGET", "x": 500, "y": 810, "type": "process" },
            { "id": "exit_ok", "label": "no alert", "x": 620, "y": 720, "type": "output" },
            { "id": "dedup", "label": "Already Sent?", "x": 300, "y": 900, "type": "decision" },
            { "id": "exit_dup", "label": "skip (dedup)", "x": 500, "y": 900, "type": "output" },
            { "id": "notify", "label": "Notify Recipients", "x": 300, "y": 990, "type": "process", "tool": "firebase" },
            { "id": "log", "label": "Save Alert Log", "x": 300, "y": 1070, "type": "process", "tool": "supabase" },
            { "id": "post_channel", "label": "Post to Channel", "x": 300, "y": 1150, "type": "process", "tool": "daneel-bot" },
            { "id": "output", "label": "alert delivered", "x": 300, "y": 1240, "type": "output" }
        ],
        "edges": [
            { "from": "trigger", "to": "load_project" },
            { "from": "load_project", "to": "load_settings" },
            { "from": "load_settings", "to": "enabled" },
            { "from": "enabled", "to": "exit_disabled", "label": "No" },
            { "from": "enabled", "to": "load_recipients", "label": "Yes" },
            { "from": "load_recipients", "to": "has_recipients" },
            { "from": "has_recipients", "to": "exit_no_recip", "label": "No" },
            { "from": "has_recipients", "to": "get_budgets", "label": "Yes" },
            { "from": "has_recipients", "to": "get_actuals", "label": "Yes" },
            { "from": "get_budgets", "to": "compare" },
            { "from": "get_actuals", "to": "compare" },
            { "from": "compare", "to": "alert_type" },
            { "from": "alert_type", "to": "overspend", "label": ">=100%" },
            { "from": "alert_type", "to": "critical", "label": ">=95%" },
            { "from": "alert_type", "to": "warning", "label": ">=80%" },
            { "from": "alert_type", "to": "no_budget", "label": "No Budget" },
            { "from": "alert_type", "to": "exit_ok", "label": "<80%" },
            { "from": "overspend", "to": "dedup" },
            { "from": "critical", "to": "dedup" },
            { "from": "warning", "to": "dedup" },
            { "from": "no_budget", "to": "dedup" },
            { "from": "dedup", "to": "exit_dup", "label": "Yes" },
            { "from": "dedup", "to": "notify", "label": "No" },
            { "from": "notify", "to": "log" },
            { "from": "log", "to": "post_channel" },
            { "from": "post_channel", "to": "output" }
        ]
    }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- INSERT ANDREW (Bookkeeper Agent)
-- Full pipeline: Upload, Guards, OCR, Categorize,
-- User Decision, Item-Level Split Flow
-- ============================================

INSERT INTO algorithm_diagrams (name, codename, description, version, spec, diagram) VALUES
(
    'ANDREW Bookkeeper Agent',
    'ANDREW',
    'Agente bookkeeper automatizado. Pipeline completo: upload, guards (hash dup, check detect), OCR via IRIS, auto-categorizacion via ATLAS, flujo de decision del usuario con lista numerada de items, y split multi-proyecto con notificaciones cruzadas.',
    '1.0',
    '{
        "flow": [
            { "id": "upload", "type": "input", "label": "File Uploaded to Channel" },
            { "id": "validate", "type": "process", "label": "Validate File Type", "from": "upload" },
            { "id": "store", "type": "process", "label": "Store in Bucket", "from": "validate", "tool": "supabase-storage" },
            { "id": "hash", "type": "process", "label": "Compute SHA-256", "from": "store", "tool": "hashlib" },
            { "id": "hash_dup", "type": "decision", "label": "Hash Duplicate?", "from": "hash" },

            { "id": "was_split", "type": "decision", "label": "Was Split?", "from": "hash_dup", "branch": "Yes" },
            { "id": "load_prev", "type": "process", "label": "Load Previous Scan + Categories", "from": "was_split", "branch": "Yes", "tool": "supabase" },
            { "id": "dup_exit", "type": "output", "label": "Duplicate Warning", "from": "was_split", "branch": "No" },

            { "id": "check_detect", "type": "process", "label": "Detect Document Type", "from": "hash_dup", "branch": "No", "tool": "gpt-4o-mini" },
            { "id": "is_check", "type": "decision", "label": "Is Check?", "from": "check_detect" },
            { "id": "check_exit", "type": "output", "label": "Route to Check Flow", "from": "is_check", "branch": "Yes" },

            { "id": "scan", "type": "process", "label": "Scan Receipt (IRIS)", "from": "is_check", "branch": "No", "tool": "gpt-4o" },
            { "id": "extract", "type": "process", "label": "Extract Line Items + Validate", "from": "scan", "tool": "json-schema" },
            { "id": "resolve_vendor", "type": "process", "label": "Resolve Vendor (DB)", "from": "extract", "tool": "supabase-rpc" },
            { "id": "data_dup", "type": "process", "label": "Check Data Duplicate", "from": "resolve_vendor", "tool": "supabase-rpc" },
            { "id": "categorize", "type": "process", "label": "Auto-Categorize Items (ATLAS)", "from": "data_dup", "tool": "gpt-4o-mini" },
            { "id": "attach_cats", "type": "process", "label": "Attach Categories to Items", "from": "categorize" },
            { "id": "update_db", "type": "process", "label": "Update DB Record", "from": "attach_cats", "tool": "supabase-rpc" },

            { "id": "build_list", "type": "process", "label": "Build Numbered Item List", "from": ["update_db", "load_prev"] },
            { "id": "post_msg", "type": "process", "label": "Post Bot Message + Buttons", "from": "build_list" },
            { "id": "user_choice", "type": "decision", "label": "User Choice?", "from": "post_msg" },

            { "id": "cancelled", "type": "output", "label": "Receipt Cancelled", "from": "user_choice", "branch": "Cancel" },

            { "id": "create_all", "type": "process", "label": "Create All Expenses", "from": "user_choice", "branch": "All This Project", "tool": "supabase-rpc" },
            { "id": "budget_single", "type": "process", "label": "Trigger Budget Check", "from": "create_all", "tool": "daneel" },
            { "id": "done_single", "type": "output", "label": "Receipt Completed", "from": "budget_single" },

            { "id": "show_prompt", "type": "process", "label": "Show Assignment Prompt", "from": "user_choice", "branch": "Assign Items" },
            { "id": "user_text", "type": "input", "label": "User Types Assignments", "from": "show_prompt" },
            { "id": "parse", "type": "process", "label": "Parse Assignment Text", "from": "user_text", "tool": "regex-bilingual" },
            { "id": "parse_valid", "type": "decision", "label": "Parse Valid?", "from": "parse" },
            { "id": "parse_error", "type": "output", "label": "Error: Retry", "from": "parse_valid", "branch": "No" },

            { "id": "resolve_projects", "type": "process", "label": "Resolve Project Names", "from": "parse_valid", "branch": "Yes", "tool": "supabase-rpc" },
            { "id": "all_found", "type": "decision", "label": "All Found?", "from": "resolve_projects" },
            { "id": "proj_error", "type": "output", "label": "Error: Not Found", "from": "all_found", "branch": "No" },

            { "id": "create_this", "type": "process", "label": "Create This Project Expenses", "from": "all_found", "branch": "Yes", "tool": "supabase-rpc" },
            { "id": "create_others", "type": "process", "label": "Create Other Projects Expenses", "from": "create_this", "tool": "supabase-rpc" },
            { "id": "split_notify", "type": "process", "label": "Post Split Notifications", "from": "create_others", "tool": "bot-message" },
            { "id": "budget_all", "type": "process", "label": "Trigger Budget Checks (All)", "from": "split_notify", "tool": "daneel" },
            { "id": "post_summary", "type": "process", "label": "Post Split Summary", "from": "budget_all" },
            { "id": "done_split", "type": "output", "label": "Split Completed", "from": "post_summary" }
        ]
    }'::jsonb,
    '{
        "nodes": [
            { "id": "upload", "label": "File Uploaded", "x": 300, "y": 40, "type": "input" },
            { "id": "validate", "label": "Validate Type", "x": 300, "y": 120, "type": "process" },
            { "id": "store", "label": "Store in Bucket", "x": 300, "y": 200, "type": "process", "tool": "supabase-storage" },
            { "id": "hash", "label": "SHA-256 Hash", "x": 300, "y": 280, "type": "process", "tool": "hashlib" },
            { "id": "hash_dup", "label": "Hash Dup?", "x": 300, "y": 360, "type": "decision" },

            { "id": "was_split", "label": "Was Split?", "x": 100, "y": 460, "type": "decision" },
            { "id": "load_prev", "label": "Load Prev Data", "x": 30, "y": 560, "type": "process", "tool": "supabase" },
            { "id": "dup_exit", "label": "Dup Warning", "x": 200, "y": 560, "type": "output" },

            { "id": "check_detect", "label": "Detect Doc Type", "x": 480, "y": 460, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "is_check", "label": "Is Check?", "x": 480, "y": 560, "type": "decision" },
            { "id": "check_exit", "label": "Check Flow", "x": 630, "y": 560, "type": "output" },

            { "id": "scan", "label": "Scan (IRIS)", "x": 300, "y": 660, "type": "process", "tool": "gpt-4o" },
            { "id": "extract", "label": "Extract + Validate", "x": 300, "y": 740, "type": "process", "tool": "json-schema" },
            { "id": "resolve_vendor", "label": "Resolve Vendor", "x": 300, "y": 820, "type": "process", "tool": "supabase-rpc" },
            { "id": "data_dup", "label": "Data Dup Check", "x": 300, "y": 900, "type": "process", "tool": "supabase-rpc" },
            { "id": "categorize", "label": "Categorize (ATLAS)", "x": 300, "y": 980, "type": "process", "tool": "gpt-4o-mini" },
            { "id": "attach_cats", "label": "Attach Categories", "x": 300, "y": 1060, "type": "process" },
            { "id": "update_db", "label": "Update DB", "x": 300, "y": 1140, "type": "process", "tool": "supabase-rpc" },

            { "id": "build_list", "label": "Build Item List", "x": 260, "y": 1240, "type": "process" },
            { "id": "post_msg", "label": "Post Message", "x": 260, "y": 1320, "type": "process" },
            { "id": "user_choice", "label": "User Choice?", "x": 260, "y": 1400, "type": "decision" },

            { "id": "cancelled", "label": "Cancelled", "x": 510, "y": 1400, "type": "output" },

            { "id": "create_all", "label": "Create All $", "x": 60, "y": 1500, "type": "process", "tool": "supabase-rpc" },
            { "id": "budget_single", "label": "Budget Check", "x": 60, "y": 1580, "type": "process", "tool": "daneel" },
            { "id": "done_single", "label": "Completed", "x": 60, "y": 1660, "type": "output" },

            { "id": "show_prompt", "label": "Show Prompt", "x": 310, "y": 1500, "type": "process" },
            { "id": "user_text", "label": "User Assigns", "x": 310, "y": 1580, "type": "input" },
            { "id": "parse", "label": "Parse Text", "x": 310, "y": 1660, "type": "process", "tool": "regex" },
            { "id": "parse_valid", "label": "Valid?", "x": 310, "y": 1740, "type": "decision" },
            { "id": "parse_error", "label": "Error: Retry", "x": 510, "y": 1740, "type": "output" },

            { "id": "resolve_projects", "label": "Resolve Projects", "x": 310, "y": 1830, "type": "process", "tool": "supabase-rpc" },
            { "id": "all_found", "label": "All Found?", "x": 310, "y": 1910, "type": "decision" },
            { "id": "proj_error", "label": "Not Found", "x": 510, "y": 1910, "type": "output" },

            { "id": "create_this", "label": "This Project $", "x": 310, "y": 2000, "type": "process", "tool": "supabase-rpc" },
            { "id": "create_others", "label": "Other Projects $", "x": 310, "y": 2080, "type": "process", "tool": "supabase-rpc" },
            { "id": "split_notify", "label": "Split Notifications", "x": 310, "y": 2160, "type": "process", "tool": "bot-msg" },
            { "id": "budget_all", "label": "Budget Checks", "x": 310, "y": 2240, "type": "process", "tool": "daneel" },
            { "id": "post_summary", "label": "Post Summary", "x": 310, "y": 2320, "type": "process" },
            { "id": "done_split", "label": "Split Completed", "x": 310, "y": 2400, "type": "output" }
        ],
        "edges": [
            { "from": "upload", "to": "validate" },
            { "from": "validate", "to": "store" },
            { "from": "store", "to": "hash" },
            { "from": "hash", "to": "hash_dup" },

            { "from": "hash_dup", "to": "was_split", "label": "Yes" },
            { "from": "hash_dup", "to": "check_detect", "label": "No" },

            { "from": "was_split", "to": "load_prev", "label": "Yes" },
            { "from": "was_split", "to": "dup_exit", "label": "No" },
            { "from": "load_prev", "to": "build_list" },

            { "from": "check_detect", "to": "is_check" },
            { "from": "is_check", "to": "check_exit", "label": "Yes" },
            { "from": "is_check", "to": "scan", "label": "No" },

            { "from": "scan", "to": "extract" },
            { "from": "extract", "to": "resolve_vendor" },
            { "from": "resolve_vendor", "to": "data_dup" },
            { "from": "data_dup", "to": "categorize" },
            { "from": "categorize", "to": "attach_cats" },
            { "from": "attach_cats", "to": "update_db" },
            { "from": "update_db", "to": "build_list" },

            { "from": "build_list", "to": "post_msg" },
            { "from": "post_msg", "to": "user_choice" },

            { "from": "user_choice", "to": "cancelled", "label": "Cancel" },
            { "from": "user_choice", "to": "create_all", "label": "All" },
            { "from": "user_choice", "to": "show_prompt", "label": "Assign" },

            { "from": "create_all", "to": "budget_single" },
            { "from": "budget_single", "to": "done_single" },

            { "from": "show_prompt", "to": "user_text" },
            { "from": "user_text", "to": "parse" },
            { "from": "parse", "to": "parse_valid" },
            { "from": "parse_valid", "to": "parse_error", "label": "No" },
            { "from": "parse_valid", "to": "resolve_projects", "label": "Yes" },

            { "from": "resolve_projects", "to": "all_found" },
            { "from": "all_found", "to": "proj_error", "label": "No" },
            { "from": "all_found", "to": "create_this", "label": "Yes" },

            { "from": "create_this", "to": "create_others" },
            { "from": "create_others", "to": "split_notify" },
            { "from": "split_notify", "to": "budget_all" },
            { "from": "budget_all", "to": "post_summary" },
            { "from": "post_summary", "to": "done_split" }
        ]
    }'::jsonb
)
ON CONFLICT DO NOTHING;
