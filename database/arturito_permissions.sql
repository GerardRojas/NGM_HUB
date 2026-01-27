-- ═══════════════════════════════════════════════════════════════════════════
--  NGM HUB — Arturito & Messages Module Permissions
-- ═══════════════════════════════════════════════════════════════════════════
--  Run this in your Supabase SQL Editor to add Arturito and Messages
--  to the permissions matrix for ALL roles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- ADD ARTURITO MODULE TO ALL ROLES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO role_permissions (rol_id, module_key, module_name, module_url, can_view, can_edit, can_delete)
SELECT
    r.rol_id,
    'arturito' AS module_key,
    'Arturito' AS module_name,
    'arturito.html' AS module_url,
    TRUE AS can_view,
    TRUE AS can_edit,
    TRUE AS can_delete
FROM rols r
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.rol_id = r.rol_id AND rp.module_key = 'arturito'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADD MESSAGES MODULE TO ALL ROLES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO role_permissions (rol_id, module_key, module_name, module_url, can_view, can_edit, can_delete)
SELECT
    r.rol_id,
    'messages' AS module_key,
    'Messages' AS module_name,
    'messages.html' AS module_url,
    TRUE AS can_view,
    TRUE AS can_edit,
    TRUE AS can_delete
FROM rols r
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.rol_id = r.rol_id AND rp.module_key = 'messages'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY INSERTION
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    r.rol_name,
    rp.module_key,
    rp.module_name,
    rp.can_view,
    rp.can_edit,
    rp.can_delete
FROM role_permissions rp
JOIN rols r ON r.rol_id = rp.rol_id
WHERE rp.module_key IN ('arturito', 'messages')
ORDER BY r.rol_name, rp.module_key;
