-- ═══════════════════════════════════════════════════════════════════════════
--  NGM HUB — Messages Module Schema
-- ═══════════════════════════════════════════════════════════════════════════
--  Run this in your Supabase SQL Editor to create the messages tables
--
--  References:
--    - users.user_id (UUID)
--    - projects.project_id (UUID)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- CHANNELS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores custom channels and direct message conversations
-- Project channels (general, accounting, receipts) are virtual - no entry needed

CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('custom', 'direct')),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_created_by ON channels(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHANNEL MEMBERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks which users belong to which custom/direct channels

CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores all messages across all channel types

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Channel identification (flexible for different channel types)
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN (
        'project_general',
        'project_accounting',
        'project_receipts',
        'custom',
        'direct'
    )),
    channel_id UUID,                                      -- For custom/direct channels
    project_id UUID REFERENCES projects(project_id),      -- For project channels

    -- Composite key for channel lookup
    channel_key VARCHAR(100) GENERATED ALWAYS AS (
        channel_type || ':' || COALESCE(channel_id::text, project_id::text)
    ) STORED,

    -- Message content
    user_id UUID NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL,

    -- Threading
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    thread_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',             -- Bot messages, receipt status, flow state
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_channel_key ON messages(channel_key);
CREATE INDEX IF NOT EXISTS idx_messages_channel_type_project ON messages(channel_type, project_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_type_channel ON messages(channel_type, channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages
    USING GIN (to_tsvector('english', content));

-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGE REACTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores emoji reactions on messages

CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGE ATTACHMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores file attachments for messages

CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),                 -- MIME type
    size INTEGER,                      -- File size in bytes
    url TEXT NOT NULL,                 -- Storage URL
    thumbnail_url TEXT,                -- For images
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGE MENTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks @mentions for notifications

CREATE TABLE IF NOT EXISTS message_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_unread ON message_mentions(user_id) WHERE read_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to update thread count when reply is added
CREATE OR REPLACE FUNCTION update_thread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reply_to_id IS NOT NULL THEN
        UPDATE messages
        SET thread_count = thread_count + 1,
            updated_at = NOW()
        WHERE id = NEW.reply_to_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for thread count
DROP TRIGGER IF EXISTS trigger_update_thread_count ON messages;
CREATE TRIGGER trigger_update_thread_count
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_messages_updated_at ON messages;
CREATE TRIGGER trigger_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_channels_updated_at ON channels;
CREATE TRIGGER trigger_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS for all tables

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view their channels" ON channels;
DROP POLICY IF EXISTS "Users can create channels" ON channels;
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
DROP POLICY IF EXISTS "Channel admins can manage members" ON channel_members;
DROP POLICY IF EXISTS "Users can view messages in their channels" ON messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can add/remove their reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can view attachments" ON message_attachments;
DROP POLICY IF EXISTS "Users can add attachments to their messages" ON message_attachments;
DROP POLICY IF EXISTS "Users can view their mentions" ON message_mentions;
DROP POLICY IF EXISTS "Users can mark their mentions as read" ON message_mentions;

-- Policies for channels (users can see channels they're members of)
CREATE POLICY "Users can view their channels" ON channels
    FOR SELECT USING (
        id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create channels" ON channels
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Policies for channel_members
CREATE POLICY "Users can view channel members" ON channel_members
    FOR SELECT USING (
        channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Channel admins can manage members" ON channel_members
    FOR ALL USING (
        channel_id IN (
            SELECT channel_id FROM channel_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policies for messages (users can see messages in their channels)
CREATE POLICY "Users can view messages in their channels" ON messages
    FOR SELECT USING (
        -- Project channels: all authenticated users can view
        (channel_type LIKE 'project_%' AND project_id IS NOT NULL)
        OR
        -- Custom/direct channels: only members
        (channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid()))
    );

CREATE POLICY "Authenticated users can send messages" ON messages
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policies for reactions
CREATE POLICY "Users can view reactions" ON message_reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can add/remove their reactions" ON message_reactions
    FOR ALL USING (user_id = auth.uid());

-- Policies for attachments
CREATE POLICY "Users can view attachments" ON message_attachments
    FOR SELECT USING (true);

CREATE POLICY "Users can add attachments to their messages" ON message_attachments
    FOR INSERT WITH CHECK (
        message_id IN (SELECT id FROM messages WHERE user_id = auth.uid())
    );

-- Policies for mentions
CREATE POLICY "Users can view their mentions" ON message_mentions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark their mentions as read" ON message_mentions
    FOR UPDATE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable realtime for messages table (ignore if already added)

-- REPLICA IDENTITY FULL is required for Supabase Realtime to send full row
-- data on INSERT/UPDATE/DELETE events (needed for client-side filtering)
ALTER TABLE messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- View for messages with user info and reaction counts
CREATE OR REPLACE VIEW messages_with_details AS
SELECT
    m.*,
    u.user_name,
    u.avatar_color,
    (
        SELECT jsonb_object_agg(emoji, user_ids)
        FROM (
            SELECT emoji, array_agg(user_id) as user_ids
            FROM message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
        ) r
    ) as reactions,
    (
        SELECT jsonb_agg(jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'type', a.type,
            'size', a.size,
            'url', a.url,
            'thumbnail_url', a.thumbnail_url
        ))
        FROM message_attachments a
        WHERE a.message_id = m.id
    ) as attachments
FROM messages m
LEFT JOIN users u ON m.user_id = u.user_id;

-- View for channels with unread counts
CREATE OR REPLACE VIEW channels_with_unread AS
SELECT
    c.*,
    cm.user_id as member_user_id,
    (
        SELECT COUNT(*)
        FROM messages msg
        WHERE msg.channel_id = c.id
        AND msg.created_at > cm.last_read_at
    ) as unread_count
FROM channels c
JOIN channel_members cm ON c.id = cm.channel_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- SAMPLE DATA (Optional - uncomment to add test data)
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- Create a test custom channel (replace user_id with actual UUID)
INSERT INTO channels (name, description, type, created_by)
VALUES ('general-discussion', 'General team discussions', 'custom', 'your-user-uuid')
RETURNING id;

-- Add members to the channel (replace channel_id and user_id with actual UUIDs)
-- INSERT INTO channel_members (channel_id, user_id, role)
-- VALUES
--     ('your-channel-uuid', 'user-uuid-1', 'admin'),
--     ('your-channel-uuid', 'user-uuid-2', 'member');

-- Create a test message (replace project_id and user_id with actual UUIDs)
-- INSERT INTO messages (channel_type, project_id, user_id, content)
-- VALUES ('project_general', 'your-project-uuid', 'your-user-uuid', 'Hello team! This is our first message.');
*/
