-- Link inventory items to library books
-- Allows tracking textbooks and other book-like items across both systems

-- Add book_id FK to school_inventory (a specific inventory item can reference a library book)
ALTER TABLE school_inventory ADD COLUMN IF NOT EXISTS book_id UUID DEFAULT NULL;

-- Add inventory tracking to library_books (see how many copies are in inventory)
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS inventory_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS inventory_location TEXT DEFAULT NULL;

-- Index for cross-referencing
CREATE INDEX IF NOT EXISTS idx_school_inventory_book_id ON school_inventory(book_id);

-- View: unified asset list (library books + inventory items)
CREATE OR REPLACE VIEW unified_assets AS
SELECT
    b.book_id AS asset_id,
    b.school_id,
    b.title AS name,
    'book' AS source_type,
    b.author AS source_subtype,
    b.isbn AS identifier,
    b.category,
    b.genre,
    b.barcode,
    b.shelf_location AS location,
    b.total_quantity AS quantity,
    b.available_quantity AS available,
    b.description
FROM library_books b
UNION ALL
SELECT
    i.item_id AS asset_id,
    i.school_id,
    i.name,
    i.barcode_format AS source_type,
    i.category AS source_subtype,
    i.barcode AS identifier,
    i.category,
    NULL AS genre,
    i.barcode,
    i.location,
    i.quantity,
    i.quantity AS available,
    i.notes AS description
FROM school_inventory i
WHERE i.book_id IS NULL;
