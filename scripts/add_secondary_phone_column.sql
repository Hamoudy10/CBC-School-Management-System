-- Add secondary_phone column to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(50);
