-- Add missing read_status column to message_recipients
-- The column is expected by the communication module but may be missing in some deployments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'read_status'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN read_status BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Also ensure other expected columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'message_recipients' AND column_name = 'deleted'
    ) THEN
        ALTER TABLE message_recipients ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
