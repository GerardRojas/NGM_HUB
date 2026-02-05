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
            { "id": "format", "label": "Format?", "x": 250, "y": 110, "type": "decision" },
            { "id": "try_text", "label": "Try Text Extract", "x": 150, "y": 180, "type": "process" },
            { "id": "ocr", "label": "OCR Vision", "x": 350, "y": 180, "type": "process" },
            { "id": "has_text", "label": "Has Text?", "x": 150, "y": 250, "type": "decision" },
            { "id": "text_ok", "label": "Text Ready", "x": 80, "y": 320, "type": "process" },
            { "id": "ocr_fallback", "label": "OCR Fallback", "x": 220, "y": 320, "type": "process" },
            { "id": "mode", "label": "Mode?", "x": 250, "y": 390, "type": "decision" },
            { "id": "fast", "label": "GPT-4o-mini", "x": 150, "y": 460, "type": "process" },
            { "id": "heavy", "label": "GPT-4o", "x": 350, "y": 460, "type": "process" },
            { "id": "parse", "label": "Parse Fields", "x": 250, "y": 530, "type": "process" },
            { "id": "output", "label": "vendor, amount, date", "x": 250, "y": 600, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "format" },
            { "from": "format", "to": "try_text", "label": "PDF" },
            { "from": "format", "to": "ocr", "label": "Image" },
            { "from": "try_text", "to": "has_text" },
            { "from": "has_text", "to": "text_ok", "label": "Yes" },
            { "from": "has_text", "to": "ocr_fallback", "label": "No" },
            { "from": "text_ok", "to": "mode" },
            { "from": "ocr_fallback", "to": "mode" },
            { "from": "ocr", "to": "mode" },
            { "from": "mode", "to": "fast", "label": "Fast" },
            { "from": "mode", "to": "heavy", "label": "Heavy" },
            { "from": "fast", "to": "parse" },
            { "from": "heavy", "to": "parse" },
            { "from": "parse", "to": "output" }
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
            { "id": "input", "label": "Expense Data", "x": 200, "y": 40, "type": "input" },
            { "id": "context", "label": "Load Context", "x": 200, "y": 110, "type": "process" },
            { "id": "mode", "label": "Mode?", "x": 200, "y": 180, "type": "decision" },
            { "id": "standard", "label": "GPT-4o-mini", "x": 100, "y": 260, "type": "process" },
            { "id": "deep", "label": "GPT-4o", "x": 300, "y": 260, "type": "process" },
            { "id": "match", "label": "Match History", "x": 200, "y": 340, "type": "process" },
            { "id": "confidence", "label": "Confidence?", "x": 200, "y": 410, "type": "decision" },
            { "id": "output", "label": "category", "x": 120, "y": 480, "type": "output" },
            { "id": "suggestions", "label": "suggestions[]", "x": 280, "y": 480, "type": "output" }
        ],
        "edges": [
            { "from": "input", "to": "context" },
            { "from": "context", "to": "mode" },
            { "from": "mode", "to": "standard", "label": "Standard" },
            { "from": "mode", "to": "deep", "label": "Deep" },
            { "from": "standard", "to": "match" },
            { "from": "deep", "to": "match" },
            { "from": "match", "to": "confidence" },
            { "from": "confidence", "to": "output", "label": ">70%" },
            { "from": "confidence", "to": "suggestions", "label": "<70%" }
        ]
    }'::jsonb
)
ON CONFLICT DO NOTHING;
