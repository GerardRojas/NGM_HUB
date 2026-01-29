-- ═══════════════════════════════════════════════════════════════════════════
--  NGM HUB — Messages Module DIAGNOSTIC
-- ═══════════════════════════════════════════════════════════════════════════
--  Este script SOLO VERIFICA qué existe y qué falta.
--  NO MODIFICA NADA en la base de datos.
--
--  Ejecuta esto en Supabase SQL Editor para ver el reporte.
-- ═══════════════════════════════════════════════════════════════════════════

-- Crear tabla temporal para el reporte
DROP TABLE IF EXISTS _diagnostic_report;
CREATE TEMP TABLE _diagnostic_report (
    category TEXT,
    item TEXT,
    status TEXT,
    details TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VERIFICAR TABLAS REQUERIDAS
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla: channels
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'channels',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Stores custom channels and direct message conversations';

-- Tabla: channel_members
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'channel_members',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channel_members' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Tracks which users belong to which channels';

-- Tabla: messages
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'messages',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Stores all chat messages';

-- Tabla: message_reactions
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'message_reactions',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_reactions' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Stores emoji reactions on messages';

-- Tabla: message_attachments
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'message_attachments',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_attachments' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Stores file attachments for messages';

-- Tabla: message_mentions
INSERT INTO _diagnostic_report
SELECT
    'TABLE',
    'message_mentions',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_mentions' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING'
    END,
    'Tracks @mentions for notifications';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VERIFICAR TABLAS DEPENDIENTES (users, projects)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO _diagnostic_report
SELECT
    'DEPENDENCY',
    'users',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING - Required for messages'
    END,
    'Referenced by channels, messages, reactions, mentions';

INSERT INTO _diagnostic_report
SELECT
    'DEPENDENCY',
    'projects',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public')
         THEN '✅ EXISTS'
         ELSE '❌ MISSING - Required for project channels'
    END,
    'Referenced by messages for project channels';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFICAR COLUMNAS CLAVE EN MESSAGES (si la tabla existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
        -- Verificar columnas críticas
        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'messages.channel_type',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'channel_type')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'Required for channel routing';

        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'messages.channel_id',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'channel_id')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'For custom/direct channels';

        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'messages.project_id',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'project_id')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'For project channels';

        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'messages.channel_key',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'channel_key')
                 THEN '✅ EXISTS'
                 ELSE '⚠️ MISSING (optional generated column)'
            END,
            'Composite key for lookups';

        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'messages.thread_count',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'thread_count')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'For threading support';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFICAR COLUMNAS EN CHANNELS (si existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels' AND table_schema = 'public') THEN
        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'channels.type',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'type')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'custom or direct';

        INSERT INTO _diagnostic_report
        SELECT
            'COLUMN',
            'channels.created_by',
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channels' AND column_name = 'created_by')
                 THEN '✅ EXISTS'
                 ELSE '❌ MISSING'
            END,
            'FK to users';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICAR ÍNDICES IMPORTANTES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO _diagnostic_report
SELECT
    'INDEX',
    'idx_messages_channel_key',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_channel_key')
         THEN '✅ EXISTS'
         ELSE '⚠️ MISSING (recommended for performance)'
    END,
    'For fast channel message lookups';

INSERT INTO _diagnostic_report
SELECT
    'INDEX',
    'idx_messages_content_search',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_content_search')
         THEN '✅ EXISTS'
         ELSE '⚠️ MISSING (recommended for search)'
    END,
    'Full-text search on messages';

INSERT INTO _diagnostic_report
SELECT
    'INDEX',
    'idx_channel_members_user',
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_channel_members_user')
         THEN '✅ EXISTS'
         ELSE '⚠️ MISSING (recommended)'
    END,
    'For user channel lookups';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERIFICAR FUNCIONES Y TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO _diagnostic_report
SELECT
    'FUNCTION',
    'update_thread_count()',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_thread_count')
         THEN '✅ EXISTS'
         ELSE '⚠️ MISSING (for thread counting)'
    END,
    'Increments thread_count on parent message';

INSERT INTO _diagnostic_report
SELECT
    'TRIGGER',
    'trigger_update_thread_count',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_thread_count')
         THEN '✅ EXISTS'
         ELSE '⚠️ MISSING'
    END,
    'Auto-update thread count on message insert';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VERIFICAR RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO _diagnostic_report
SELECT
    'RLS',
    'channels RLS enabled',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'channels'
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN '✅ ENABLED'
      ELSE '⚠️ DISABLED'
    END,
    'Row Level Security for channels table';

INSERT INTO _diagnostic_report
SELECT
    'RLS',
    'messages RLS enabled',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'messages'
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN '✅ ENABLED'
      ELSE '⚠️ DISABLED'
    END,
    'Row Level Security for messages table';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. VERIFICAR REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO _diagnostic_report
SELECT
    'REALTIME',
    'messages in supabase_realtime',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'messages'
    ) THEN '✅ ENABLED'
      ELSE '⚠️ NOT ENABLED (optional for live updates)'
    END,
    'Real-time subscriptions for messages';

INSERT INTO _diagnostic_report
SELECT
    'REALTIME',
    'message_reactions in supabase_realtime',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'message_reactions'
    ) THEN '✅ ENABLED'
      ELSE '⚠️ NOT ENABLED (optional)'
    END,
    'Real-time subscriptions for reactions';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CONTAR REGISTROS EXISTENTES (si las tablas existen)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    cnt INTEGER;
BEGIN
    -- Count channels
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO cnt FROM channels;
        INSERT INTO _diagnostic_report VALUES ('DATA', 'channels count', cnt::text || ' rows', 'Existing custom/direct channels');
    END IF;

    -- Count messages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO cnt FROM messages;
        INSERT INTO _diagnostic_report VALUES ('DATA', 'messages count', cnt::text || ' rows', 'Total messages in system');
    END IF;

    -- Count users (dependency)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO cnt FROM users;
        INSERT INTO _diagnostic_report VALUES ('DATA', 'users count', cnt::text || ' rows', 'Available users for messaging');
    END IF;

    -- Count projects (dependency)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO cnt FROM projects;
        INSERT INTO _diagnostic_report VALUES ('DATA', 'projects count', cnt::text || ' rows', 'Available projects for channels');
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MOSTRAR REPORTE FINAL
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
    '═══════════════════════════════════════════════════════════════' AS "═══════════════ MESSAGES DIAGNOSTIC REPORT ═══════════════";

SELECT
    category AS "Category",
    item AS "Item",
    status AS "Status",
    details AS "Details"
FROM _diagnostic_report
ORDER BY
    CASE category
        WHEN 'TABLE' THEN 1
        WHEN 'DEPENDENCY' THEN 2
        WHEN 'COLUMN' THEN 3
        WHEN 'INDEX' THEN 4
        WHEN 'FUNCTION' THEN 5
        WHEN 'TRIGGER' THEN 6
        WHEN 'RLS' THEN 7
        WHEN 'REALTIME' THEN 8
        WHEN 'DATA' THEN 9
        ELSE 10
    END,
    item;

-- ═══════════════════════════════════════════════════════════════════════════
-- RESUMEN
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
    '═══════════════════════════════════════════════════════════════' AS "═══════════════════ SUMMARY ═══════════════════";

SELECT
    (SELECT COUNT(*) FROM _diagnostic_report WHERE status LIKE '✅%') AS "✅ OK",
    (SELECT COUNT(*) FROM _diagnostic_report WHERE status LIKE '❌%') AS "❌ Missing (Critical)",
    (SELECT COUNT(*) FROM _diagnostic_report WHERE status LIKE '⚠️%') AS "⚠️ Missing (Optional)";

-- Mensaje final
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM _diagnostic_report WHERE status LIKE '❌%') > 0
        THEN '❌ ACCIÓN REQUERIDA: Ejecuta messages_schema.sql para crear las tablas faltantes'
        WHEN (SELECT COUNT(*) FROM _diagnostic_report WHERE status LIKE '⚠️%') > 0
        THEN '⚠️ OPCIONAL: Algunas mejoras opcionales no están aplicadas'
        ELSE '✅ TODO OK: El módulo de mensajes está completamente configurado'
    END AS "Resultado";

-- Limpiar
DROP TABLE IF EXISTS _diagnostic_report;
