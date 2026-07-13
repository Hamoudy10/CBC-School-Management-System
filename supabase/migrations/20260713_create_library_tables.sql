-- Core library tables
CREATE TABLE IF NOT EXISTS library_books (
    book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    isbn TEXT DEFAULT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    publisher TEXT DEFAULT NULL,
    year INTEGER DEFAULT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 1,
    available_quantity INTEGER NOT NULL DEFAULT 1,
    category TEXT DEFAULT NULL,
    genre TEXT DEFAULT NULL,
    barcode TEXT DEFAULT NULL,
    shelf_location TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    cover_url TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_books_school ON library_books(school_id);
CREATE INDEX IF NOT EXISTS idx_library_books_barcode ON library_books(barcode);
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS library_borrowing (
    borrow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(book_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ DEFAULT NULL,
    condition TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_borrowing_school ON library_borrowing(school_id);
CREATE INDEX IF NOT EXISTS idx_library_borrowing_book ON library_borrowing(book_id);
CREATE INDEX IF NOT EXISTS idx_library_borrowing_user ON library_borrowing(user_id);
ALTER TABLE library_borrowing ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "School staff can manage library books"
    ON library_books FOR ALL
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));

CREATE POLICY "School staff can manage borrowing"
    ON library_borrowing FOR ALL
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));

-- Function to increment available quantity on return
CREATE OR REPLACE FUNCTION increment_book_available(p_book_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE library_books SET available_quantity = available_quantity + 1 WHERE book_id = p_book_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
