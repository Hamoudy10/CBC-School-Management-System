-- Create school_inventory table for inventory management
CREATE TABLE IF NOT EXISTS school_inventory (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    quantity INTEGER NOT NULL DEFAULT 1,
    condition TEXT DEFAULT NULL,
    location TEXT DEFAULT NULL,
    assigned_to TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_inventory_school_id ON school_inventory(school_id);
CREATE INDEX IF NOT EXISTS idx_school_inventory_category ON school_inventory(category);

-- Enable RLS
ALTER TABLE school_inventory ENABLE ROW LEVEL SECURITY;

-- School staff can view their school's inventory
CREATE POLICY "School staff can view inventory"
    ON school_inventory FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid())
    );

-- School staff can insert inventory items
CREATE POLICY "School staff can insert inventory"
    ON school_inventory FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid())
    );

-- School staff can update inventory items
CREATE POLICY "School staff can update inventory"
    ON school_inventory FOR UPDATE
    USING (
        auth.role() = 'authenticated'
        AND school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid())
    );
