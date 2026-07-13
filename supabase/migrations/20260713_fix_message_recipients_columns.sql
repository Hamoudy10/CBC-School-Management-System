-- Ensure message_recipients has all required columns
-- This table is used by the communication module for internal messaging

DO $$
BEGIN
    -- Primary keys and relationships
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'school_id'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN school_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
        ALTER TABLE message_recipients ALTER COLUMN school_id DROP DEFAULT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'read_status'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN read_status BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'deleted'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'recipient_type'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN recipient_type TEXT DEFAULT 'user';
    END IF;
END $$;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient_id ON message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_school_id ON message_recipients(school_id);
