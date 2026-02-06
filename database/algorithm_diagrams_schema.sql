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
