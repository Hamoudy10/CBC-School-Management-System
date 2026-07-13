-- Make receiver_id nullable since the system uses message_recipients for multi-recipient support
ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN receiver_id SET DEFAULT NULL;
