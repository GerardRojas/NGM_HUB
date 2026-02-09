-- ================================================================
-- Rename Arturito Settings -> Agent Settings in role_permissions
-- ================================================================
-- Updates the display name and URL so the sidebar and permissions
-- system recognise the renamed page.
-- The module_key remains 'arturito_settings' to avoid code breakage.
-- ================================================================

UPDATE role_permissions
SET module_name = 'Agent Settings',
    module_url  = 'agents-settings.html'
WHERE module_key = 'arturito_settings';

-- Verify
SELECT r.rol_name, rp.module_key, rp.module_name, rp.module_url
FROM role_permissions rp
JOIN rols r ON r.rol_id = rp.rol_id
WHERE rp.module_key = 'arturito_settings'
ORDER BY r.rol_name;
