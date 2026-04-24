-- Upgrade 5: Offline-First Architecture Database Additions
-- School Management System - AI-Powered CBC School Operating System
-- This migration adds tables required for Upgrade 5: Offline-First Architecture

-- Create offline_sync_queue table to track pending local operations
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL, -- Name of the table being synced
    record_id UUID NOT NULL, -- ID of the record in the target table
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB, -- The data to be synced (for INSERT/UPDATE) or null (for DELETE)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempted_at TIMESTAMP WITH TIME ZONE,
    succeeded_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    error_message TEXT,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 10), -- 1=lowest, 10=highest
    processed BOOLEAN DEFAULT FALSE
);

-- Create offline_metadata table to track sync state per user/device
CREATE TABLE IF NOT EXISTS offline_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL, -- Unique device identifier
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    last_sync TIMESTAMP WITH TIME ZONE, -- Last successful sync timestamp
    sync_in_progress BOOLEAN DEFAULT FALSE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one metadata record per user/device/school combination
    CONSTRAINT unique_user_device_school UNIQUE (user_id, device_id, school_id)
);

-- Create indexes for better query performance

-- Indexes for offline_sync_queue
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user_id ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_school_id ON offline_sync_queue(school_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_table_name ON offline_sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_record_id ON offline_sync_queue(record_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_operation_type ON offline_sync_queue(operation_type);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_processed ON offline_sync_queue(processed);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_priority ON offline_sync_queue(priority);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_created_at ON offline_sync_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_processed_priority ON offline_sync_queue(processed, priority DESC);

-- Indexes for offline_metadata
CREATE INDEX IF NOT EXISTS idx_offline_metadata_user_id ON offline_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_metadata_device_id ON offline_metadata(device_id);
CREATE INDEX IF NOT EXISTS idx_offline_metadata_school_id ON offline_metadata(school_id);
CREATE INDEX IF NOT EXISTS idx_offline_metadata_last_sync ON offline_metadata(last_sync);
CREATE INDEX IF NOT EXISTS idx_offline_metadata_sync_in_progress ON offline_metadata(sync_in_progress);

-- Add helpful comments to tables and columns
COMMENT ON TABLE offline_sync_queue IS 'Queue of local operations waiting to be synchronized with the server';
COMMENT ON COLUMN offline_sync_queue.table_name IS 'Name of the table being synced (students, attendance, assessments, etc.)';
COMMENT ON COLUMN offline_sync_queue.record_id IS 'ID of the record in the target table';
COMMENT ON COLUMN offline_sync_queue.operation_type IS 'Type of operation: INSERT, UPDATE, or DELETE';
COMMENT ON COLUMN offline_sync_queue.payload IS 'JSON data for INSERT/UPDATE operations, NULL for DELETE';
COMMENT ON COLUMN offline_sync_queue.retry_count IS 'Number of times this operation has been attempted';
COMMENT ON COLUMN offline_sync_queue.max_retries IS 'Maximum number of retry attempts before giving up';
COMMENT ON COLUMN offline_sync_queue.error_message IS 'Error message if the operation failed';
COMMENT ON COLUMN offline_sync_queue.priority IS 'Priority level (1-10) for processing order';
COMMENT ON COLUMN offline_sync_queue.processed IS 'Whether this operation has been successfully processed';

COMMENT ON TABLE offline_metadata IS 'Tracks synchronization state for each user/device combination';
COMMENT ON COLUMN offline_metadata.device_id IS 'Unique identifier for the user\'s device';
COMMENT ON COLUMN offline_metadata.last_sync IS 'Timestamp of the last successful synchronization';
COMMENT ON COLUMN offline_metadata.sync_in_progress IS 'Whether a sync operation is currently in progress';
COMMENT ON COLUMN offline_metadata.last_error IS 'Error message from the last failed sync attempt';

-- Updated trigger function to automatically update the updated_at column (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    END IF;
END $$;

-- Create triggers to automatically update updated_at column for offline_metadata
DROP TRIGGER IF EXISTS update_offline_metadata_updated_at ON offline_metadata;
CREATE TRIGGER update_offline_metadata_updated_at
    BEFORE UPDATE ON offline_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial helpful comments about the purpose of these tables
COMMENT ON TABLE offline_sync_queue IS 'Queue for offline-first synchronization - stores local changes waiting to be sent to server';
COMMENT ON TABLE offline_metadata IS 'Tracks device sync state to enable efficient incremental syncs and conflict detection';