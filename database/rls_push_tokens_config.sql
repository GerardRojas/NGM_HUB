-- ============================================================================
-- NGM HUB - RLS Policies for push_tokens and budget_alert_config
-- ============================================================================
-- Security policies to protect tables flagged by Supabase Security Advisor
--
-- IMPORTANT: Run this in Supabase SQL Editor
-- These policies allow backend (service role) to manage data while
-- restricting direct client access appropriately.
-- ============================================================================

-- ============================================================================
-- PUSH_TOKENS TABLE
-- ============================================================================
-- This table stores Firebase Cloud Messaging tokens for push notifications.
-- Users should only be able to see and manage their own tokens.

-- Enable RLS on push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own push tokens
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
CREATE POLICY "Users can view own push tokens" ON push_tokens
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can insert their own push tokens
DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
CREATE POLICY "Users can insert own push tokens" ON push_tokens
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own push tokens
DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
CREATE POLICY "Users can update own push tokens" ON push_tokens
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own push tokens
DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
CREATE POLICY "Users can delete own push tokens" ON push_tokens
    FOR DELETE
    USING (user_id = auth.uid());

-- Policy: Service role bypass (for backend API operations)
-- Note: Service role automatically bypasses RLS, this is just for documentation

-- ============================================================================
-- BUDGET_ALERT_CONFIG TABLE
-- ============================================================================
-- This table stores budget alert configuration settings.
-- Since the backend uses service_role (which bypasses RLS), we can use
-- simple policies that block direct client access while allowing backend ops.

-- Enable RLS on budget_alert_config
ALTER TABLE budget_alert_config ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view alert config
-- (Configuration is not sensitive, users need to see thresholds)
DROP POLICY IF EXISTS "Authenticated users can view alert config" ON budget_alert_config;
CREATE POLICY "Authenticated users can view alert config" ON budget_alert_config
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Block direct INSERT from clients (backend uses service_role)
DROP POLICY IF EXISTS "Service role only insert" ON budget_alert_config;
CREATE POLICY "Service role only insert" ON budget_alert_config
    FOR INSERT
    WITH CHECK (false);

-- Policy: Block direct UPDATE from clients (backend uses service_role)
DROP POLICY IF EXISTS "Service role only update" ON budget_alert_config;
CREATE POLICY "Service role only update" ON budget_alert_config
    FOR UPDATE
    USING (false);

-- Policy: Block direct DELETE from clients (backend uses service_role)
DROP POLICY IF EXISTS "Service role only delete" ON budget_alert_config;
CREATE POLICY "Service role only delete" ON budget_alert_config
    FOR DELETE
    USING (false);

-- ============================================================================
-- ALTERNATIVE: Simpler policies if backend uses service role
-- ============================================================================
-- If your backend ALWAYS uses service role key (which bypasses RLS),
-- and you just want to block direct client access, use these simpler policies:
--
-- For push_tokens (users manage their own):
-- CREATE POLICY "Users manage own tokens" ON push_tokens
--     FOR ALL USING (user_id = auth.uid());
--
-- For budget_alert_config (only backend/service role can access):
-- CREATE POLICY "No direct client access" ON budget_alert_config
--     FOR ALL USING (false);
-- (Service role bypasses this, so backend still works)

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify RLS is enabled:

SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('push_tokens', 'budget_alert_config');

-- Check policies:
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('push_tokens', 'budget_alert_config');
