-- ============================================================================
-- NGM HUB - Budget Alerts System Schema
-- ============================================================================
-- Sistema de alertas automaticas cuando los gastos se acercan al presupuesto
-- o cuando se gasta en categorias sin presupuesto asignado.
--
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BUDGET ALERT SETTINGS
-- ----------------------------------------------------------------------------
-- Configuracion global y por proyecto para las alertas de presupuesto

CREATE TABLE IF NOT EXISTS budget_alert_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope: NULL = global settings, project_id = project-specific override
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,

    -- Alert triggers (percentages 0-100)
    warning_threshold INTEGER DEFAULT 80,      -- Alert when actuals reach X% of budget
    critical_threshold INTEGER DEFAULT 95,     -- Critical alert at X% of budget
    overspend_alert BOOLEAN DEFAULT TRUE,      -- Alert when over budget
    no_budget_alert BOOLEAN DEFAULT TRUE,      -- Alert for expenses without budget

    -- Notification settings
    is_enabled BOOLEAN DEFAULT TRUE,           -- Master switch for alerts
    check_frequency_minutes INTEGER DEFAULT 60, -- How often to check (default: hourly)

    -- Quiet hours (don't send notifications during these hours)
    quiet_start_hour INTEGER DEFAULT 22,       -- 10 PM
    quiet_end_hour INTEGER DEFAULT 7,          -- 7 AM

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),

    -- Only one global setting (project_id = NULL) allowed
    UNIQUE(project_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_budget_alert_settings_project ON budget_alert_settings(project_id);

-- ----------------------------------------------------------------------------
-- BUDGET ALERT RECIPIENTS
-- ----------------------------------------------------------------------------
-- Usuarios que reciben alertas de presupuesto

CREATE TABLE IF NOT EXISTS budget_alert_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to settings (NULL = applies to global settings)
    settings_id UUID REFERENCES budget_alert_settings(id) ON DELETE CASCADE,

    -- Recipient
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- What types of alerts they receive
    receive_warning BOOLEAN DEFAULT TRUE,      -- Warning threshold alerts
    receive_critical BOOLEAN DEFAULT TRUE,     -- Critical threshold alerts
    receive_overspend BOOLEAN DEFAULT TRUE,    -- Over budget alerts
    receive_no_budget BOOLEAN DEFAULT TRUE,    -- No budget alerts

    -- Notification channels
    notify_push BOOLEAN DEFAULT TRUE,          -- Firebase push notification
    notify_dashboard BOOLEAN DEFAULT TRUE,     -- In-app dashboard notification
    notify_email BOOLEAN DEFAULT FALSE,        -- Email notification (future)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One entry per user per settings scope
    UNIQUE(settings_id, user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_budget_alert_recipients_user ON budget_alert_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_recipients_settings ON budget_alert_recipients(settings_id);

-- ----------------------------------------------------------------------------
-- BUDGET ALERTS LOG
-- ----------------------------------------------------------------------------
-- Historial de alertas enviadas (evita duplicados y permite tracking)

CREATE TABLE IF NOT EXISTS budget_alerts_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What triggered the alert
    project_id UUID REFERENCES projects(project_id),
    account_id UUID,                           -- Budget category/account
    account_name VARCHAR(255),                 -- Denormalized for history

    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'warning',           -- Approaching budget limit
        'critical',          -- Near budget limit
        'overspend',         -- Over budget
        'no_budget'          -- Expense without budget
    )),

    -- Financial data at time of alert
    budget_amount DECIMAL(12,2),
    actual_amount DECIMAL(12,2),
    percentage_used DECIMAL(5,2),              -- e.g., 85.50%
    expense_amount DECIMAL(12,2),              -- Amount that triggered alert (for no_budget)

    -- Message
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Recipients notified
    recipients_notified JSONB,                 -- Array of user_ids notified
    notification_channels JSONB,               -- {push: true, dashboard: true, email: false}

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    read_by UUID REFERENCES users(user_id),

    -- Deduplication key (to avoid sending same alert repeatedly)
    -- Format: project_id:account_id:alert_type:date
    dedup_key VARCHAR(255),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate alerts on same day for same issue
    UNIQUE(dedup_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_alerts_log_project ON budget_alerts_log(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_log_type ON budget_alerts_log(alert_type);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_log_created ON budget_alerts_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_log_unread ON budget_alerts_log(is_read) WHERE is_read = FALSE;

-- ----------------------------------------------------------------------------
-- DASHBOARD NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
-- Notificaciones in-app para el dashboard (general purpose)

CREATE TABLE IF NOT EXISTS dashboard_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'bell',           -- Icon name for UI
    color VARCHAR(20) DEFAULT 'warning',       -- warning, danger, info, success

    -- Link/action
    action_url VARCHAR(255),                   -- URL to navigate to
    action_data JSONB,                         -- Additional data for the action

    -- Source
    source_type VARCHAR(50),                   -- budget_alert, mention, task, etc.
    source_id UUID,                            -- Reference to source record

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ                     -- Optional expiration
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_user ON dashboard_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_unread ON dashboard_notifications(user_id, is_read)
    WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_dashboard_notifications_created ON dashboard_notifications(created_at DESC);

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_budget_alert_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_budget_alert_settings_updated ON budget_alert_settings;
CREATE TRIGGER trigger_budget_alert_settings_updated
    BEFORE UPDATE ON budget_alert_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_alert_settings_timestamp();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

ALTER TABLE budget_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for budget_alert_settings (admins and managers can view/edit)
DROP POLICY IF EXISTS "Admins can manage alert settings" ON budget_alert_settings;
CREATE POLICY "Admins can manage alert settings" ON budget_alert_settings
    FOR ALL USING (true);  -- Will be restricted by role check in API

-- Policies for budget_alert_recipients
DROP POLICY IF EXISTS "Users can view their recipient settings" ON budget_alert_recipients;
CREATE POLICY "Users can view their recipient settings" ON budget_alert_recipients
    FOR SELECT USING (user_id = auth.uid() OR true);  -- Admins can see all

-- Policies for budget_alerts_log
DROP POLICY IF EXISTS "Users can view alerts" ON budget_alerts_log;
CREATE POLICY "Users can view alerts" ON budget_alerts_log
    FOR SELECT USING (true);

-- Policies for dashboard_notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON dashboard_notifications;
CREATE POLICY "Users can view their notifications" ON dashboard_notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their notifications" ON dashboard_notifications;
CREATE POLICY "Users can update their notifications" ON dashboard_notifications
    FOR UPDATE USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- REALTIME (Optional)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'dashboard_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_notifications;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- DEFAULT SETTINGS
-- ----------------------------------------------------------------------------
-- Insert default global settings if they don't exist

INSERT INTO budget_alert_settings (
    project_id,
    warning_threshold,
    critical_threshold,
    overspend_alert,
    no_budget_alert,
    is_enabled,
    check_frequency_minutes
)
VALUES (
    NULL,  -- Global settings
    80,    -- Warning at 80%
    95,    -- Critical at 95%
    TRUE,
    TRUE,
    TRUE,
    60     -- Check every hour
)
ON CONFLICT (project_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify tables were created:

SELECT
    'budget_alert_settings' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alert_settings') as exists
UNION ALL
SELECT
    'budget_alert_recipients',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alert_recipients')
UNION ALL
SELECT
    'budget_alerts_log',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alerts_log')
UNION ALL
SELECT
    'dashboard_notifications',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dashboard_notifications');
