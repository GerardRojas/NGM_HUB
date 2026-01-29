-- ============================================================================
-- NGM HUB - Budget Alerts Acknowledgment System
-- ============================================================================
-- Adds acknowledgment workflow for overspend alerts.
-- Alerts remain "pending" until a responsible user reviews and acknowledges.
--
-- Run AFTER budget_alerts_schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADD ACKNOWLEDGMENT FIELDS TO budget_alerts_log
-- ----------------------------------------------------------------------------

ALTER TABLE budget_alerts_log
ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS acknowledgment_note TEXT,
ADD COLUMN IF NOT EXISTS expense_id UUID,                    -- Link to the expense that triggered
ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Alert sent, waiting for review
    'acknowledged', -- Reviewed and accepted with note
    'dismissed',    -- Dismissed (e.g., false positive)
    'resolved'      -- Issue was fixed (budget adjusted or expense corrected)
));

-- Index for pending acknowledgments
CREATE INDEX IF NOT EXISTS idx_budget_alerts_pending_ack
    ON budget_alerts_log(requires_acknowledgment, status)
    WHERE requires_acknowledgment = TRUE AND status = 'pending';

-- Index for expense link
CREATE INDEX IF NOT EXISTS idx_budget_alerts_expense
    ON budget_alerts_log(expense_id)
    WHERE expense_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- BUDGET ACKNOWLEDGMENT ROLES
-- ----------------------------------------------------------------------------
-- Who can acknowledge different types of alerts

CREATE TABLE IF NOT EXISTS budget_alert_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to settings (NULL = global)
    settings_id UUID REFERENCES budget_alert_settings(id) ON DELETE CASCADE,

    -- Alert type this applies to
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'warning',
        'critical',
        'overspend',
        'no_budget',
        'all'  -- Applies to all types
    )),

    -- Who can acknowledge
    role_id UUID REFERENCES rols(rol_id),          -- Role that can acknowledge
    user_id UUID REFERENCES users(user_id),         -- Specific user (overrides role)

    -- Permissions
    can_acknowledge BOOLEAN DEFAULT TRUE,
    can_dismiss BOOLEAN DEFAULT FALSE,              -- Dismiss without note
    can_resolve BOOLEAN DEFAULT FALSE,              -- Mark as resolved

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(settings_id, alert_type, role_id),
    UNIQUE(settings_id, alert_type, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_budget_alert_permissions_role
    ON budget_alert_permissions(role_id);

-- ----------------------------------------------------------------------------
-- ACKNOWLEDGMENT HISTORY (Audit Trail)
-- ----------------------------------------------------------------------------
-- Tracks all actions on budget alerts

CREATE TABLE IF NOT EXISTS budget_alert_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to alert
    alert_id UUID NOT NULL REFERENCES budget_alerts_log(id) ON DELETE CASCADE,

    -- Who performed the action
    user_id UUID NOT NULL REFERENCES users(user_id),

    -- Action details
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'viewed',       -- User viewed the alert
        'acknowledged', -- User acknowledged with note
        'dismissed',    -- User dismissed
        'resolved',     -- User marked as resolved
        'reopened',     -- Alert was reopened
        'note_added',   -- Additional note added
        'escalated'     -- Escalated to higher authority
    )),

    -- Notes and metadata
    note TEXT,
    previous_status VARCHAR(30),
    new_status VARCHAR(30),

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_alert_actions_alert
    ON budget_alert_actions(alert_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_actions_user
    ON budget_alert_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_actions_created
    ON budget_alert_actions(created_at DESC);

-- ----------------------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE budget_alert_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alert_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage alert permissions" ON budget_alert_permissions;
CREATE POLICY "Admins can manage alert permissions" ON budget_alert_permissions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view alert actions" ON budget_alert_actions;
CREATE POLICY "Users can view alert actions" ON budget_alert_actions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create alert actions" ON budget_alert_actions;
CREATE POLICY "Users can create alert actions" ON budget_alert_actions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- UPDATE EXISTING ALERTS
-- ----------------------------------------------------------------------------
-- Set requires_acknowledgment for overspend and no_budget alerts

UPDATE budget_alerts_log
SET requires_acknowledgment = TRUE,
    status = 'pending'
WHERE alert_type IN ('overspend', 'no_budget')
  AND requires_acknowledgment IS NULL;

-- ----------------------------------------------------------------------------
-- DEFAULT PERMISSIONS
-- ----------------------------------------------------------------------------
-- By default, CEO/COO/CFO can acknowledge all alerts

DO $$
DECLARE
    v_settings_id UUID;
    v_role_id UUID;
BEGIN
    -- Get global settings ID
    SELECT id INTO v_settings_id
    FROM budget_alert_settings
    WHERE project_id IS NULL
    LIMIT 1;

    IF v_settings_id IS NULL THEN
        RETURN;
    END IF;

    -- Add permissions for executive roles
    FOR v_role_id IN
        SELECT rol_id FROM rols WHERE rol_name IN ('CEO', 'COO', 'CFO')
    LOOP
        INSERT INTO budget_alert_permissions (
            settings_id, alert_type, role_id,
            can_acknowledge, can_dismiss, can_resolve
        )
        VALUES (
            v_settings_id, 'all', v_role_id,
            TRUE, TRUE, TRUE
        )
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Add acknowledge-only for Accounting Manager
    SELECT rol_id INTO v_role_id FROM rols WHERE rol_name = 'Accounting Manager';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO budget_alert_permissions (
            settings_id, alert_type, role_id,
            can_acknowledge, can_dismiss, can_resolve
        )
        VALUES (
            v_settings_id, 'all', v_role_id,
            TRUE, FALSE, FALSE
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- VIEW: Pending Acknowledgments
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW pending_budget_acknowledgments AS
SELECT
    bal.id,
    bal.project_id,
    p.project_name,
    bal.account_name,
    bal.alert_type,
    bal.budget_amount,
    bal.actual_amount,
    bal.percentage_used,
    bal.title,
    bal.message,
    bal.expense_id,
    bal.created_at,
    bal.status,
    EXTRACT(DAY FROM NOW() - bal.created_at) as days_pending
FROM budget_alerts_log bal
LEFT JOIN projects p ON bal.project_id = p.project_id
WHERE bal.requires_acknowledgment = TRUE
  AND bal.status = 'pending'
ORDER BY bal.created_at ASC;

-- ----------------------------------------------------------------------------
-- FUNCTION: Check if user can acknowledge alert
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_user_acknowledge_alert(
    p_user_id UUID,
    p_alert_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_alert_type VARCHAR(50);
    v_user_role_id UUID;
    v_has_permission BOOLEAN := FALSE;
BEGIN
    -- Get alert type
    SELECT alert_type INTO v_alert_type
    FROM budget_alerts_log
    WHERE id = p_alert_id;

    IF v_alert_type IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get user's role
    SELECT user_rol INTO v_user_role_id
    FROM users
    WHERE user_id = p_user_id;

    -- Check for specific user permission
    SELECT TRUE INTO v_has_permission
    FROM budget_alert_permissions
    WHERE user_id = p_user_id
      AND (alert_type = v_alert_type OR alert_type = 'all')
      AND can_acknowledge = TRUE
    LIMIT 1;

    IF v_has_permission THEN
        RETURN TRUE;
    END IF;

    -- Check for role-based permission
    SELECT TRUE INTO v_has_permission
    FROM budget_alert_permissions
    WHERE role_id = v_user_role_id
      AND (alert_type = v_alert_type OR alert_type = 'all')
      AND can_acknowledge = TRUE
    LIMIT 1;

    RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
    'budget_alert_permissions' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alert_permissions') as exists
UNION ALL
SELECT
    'budget_alert_actions',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alert_actions')
UNION ALL
SELECT
    'pending_budget_acknowledgments (view)',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'pending_budget_acknowledgments');
