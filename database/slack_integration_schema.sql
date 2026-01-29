-- ═══════════════════════════════════════════════════════════════════════════
--  NGM HUB — Slack Integration Schema
-- ═══════════════════════════════════════════════════════════════════════════
--  Run this in your Supabase SQL Editor to enable Slack notifications
--
--  References:
--    - users.user_id (UUID)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SLACK USER MAPPINGS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Maps NGM Hub users to their Slack user IDs for direct messaging

CREATE TABLE IF NOT EXISTS slack_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    slack_user_id VARCHAR(50) NOT NULL,           -- Slack member ID (e.g., U01ABC123)
    slack_username VARCHAR(100),                   -- Display name in Slack
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(slack_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_mappings_user ON slack_user_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_mappings_slack_id ON slack_user_mappings(slack_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SLACK WORKSPACE CONFIG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores Slack bot token and workspace info (single workspace for now)

CREATE TABLE IF NOT EXISTS slack_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_name VARCHAR(100),
    bot_token TEXT NOT NULL,                       -- xoxb-... token (encrypted in production)
    notification_channel VARCHAR(50),              -- Optional: default channel for broadcasts
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATION LOG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks sent notifications for debugging and audit

CREATE TABLE IF NOT EXISTS slack_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    slack_user_id VARCHAR(50),
    notification_type VARCHAR(50) DEFAULT 'mention',  -- mention, reply, etc.
    status VARCHAR(20) DEFAULT 'pending',             -- pending, sent, failed
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_log_message ON slack_notification_log(message_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_recipient ON slack_notification_log(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON slack_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON slack_notification_log(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_slack_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_slack_mappings_updated_at ON slack_user_mappings;
CREATE TRIGGER trigger_slack_mappings_updated_at
    BEFORE UPDATE ON slack_user_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_slack_updated_at();

DROP TRIGGER IF EXISTS trigger_slack_config_updated_at ON slack_config;
CREATE TRIGGER trigger_slack_config_updated_at
    BEFORE UPDATE ON slack_config
    FOR EACH ROW
    EXECUTE FUNCTION update_slack_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE slack_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_notification_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Users can view their slack mapping" ON slack_user_mappings;
DROP POLICY IF EXISTS "Users can update their slack mapping" ON slack_user_mappings;
DROP POLICY IF EXISTS "Admins can view slack config" ON slack_config;
DROP POLICY IF EXISTS "Users can view their notification log" ON slack_notification_log;

-- Policies for slack_user_mappings
CREATE POLICY "Users can view their slack mapping" ON slack_user_mappings
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their slack mapping" ON slack_user_mappings
    FOR ALL USING (user_id = auth.uid());

-- Policies for slack_config (admin only via service role)
CREATE POLICY "Admins can view slack config" ON slack_config
    FOR SELECT USING (true);

-- Policies for notification log (users can see their own)
CREATE POLICY "Users can view their notification log" ON slack_notification_log
    FOR SELECT USING (recipient_user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- USAGE NOTES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Create a Slack App at https://api.slack.com/apps
--    - Add Bot Token Scopes: chat:write, users:read, users:read.email
--    - Install to workspace and copy the Bot User OAuth Token
--
-- 2. Insert the bot token into slack_config:
--    INSERT INTO slack_config (workspace_name, bot_token)
--    VALUES ('NGM Workspace', 'xoxb-your-bot-token-here');
--
-- 3. Map users by having them connect via the UI, or manually:
--    INSERT INTO slack_user_mappings (user_id, slack_user_id, slack_username)
--    VALUES ('ngm-user-uuid', 'U01ABC123', 'john.doe');
--
-- ═══════════════════════════════════════════════════════════════════════════
