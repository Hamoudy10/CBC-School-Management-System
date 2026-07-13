-- ============================================================
-- Library Management Enhancements
-- Adds: categories, reservations, fines, book requests, barcodes
-- ============================================================

-- 1. Book Categories
CREATE TABLE IF NOT EXISTS book_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_categories_school_id ON book_categories(school_id);
ALTER TABLE book_categories ENABLE ROW LEVEL SECURITY;

-- 2. Library Reservations (holds)
CREATE TABLE IF NOT EXISTS library_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES library_books(book_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    fulfilled_at TIMESTAMPTZ DEFAULT NULL,
    notified BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_library_reservations_book ON library_reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_library_reservations_user ON library_reservations(user_id);
ALTER TABLE library_reservations ENABLE ROW LEVEL SECURITY;

-- 3. Library Fines
CREATE TABLE IF NOT EXISTS library_fines (
    fine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    borrow_id UUID REFERENCES library_borrowing(borrow_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT 'overdue',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ DEFAULT NULL,
    waived_by UUID DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_library_fines_user ON library_fines(user_id);
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;

-- 4. Book Requests
CREATE TABLE IF NOT EXISTS book_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT DEFAULT NULL,
    isbn TEXT DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ordered', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NULL,
    reviewed_by UUID DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_book_requests_school ON book_requests(school_id);
ALTER TABLE book_requests ENABLE ROW LEVEL SECURITY;

-- 5. Add barcode column to school_inventory
ALTER TABLE school_inventory ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT NULL;
ALTER TABLE school_inventory ADD COLUMN IF NOT EXISTS barcode_format TEXT DEFAULT NULL;

-- 6. Add barcode and genre columns to library_books
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT NULL;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT NULL;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS shelf_location TEXT DEFAULT NULL;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Book Categories
CREATE POLICY "School staff can manage categories"
    ON book_categories FOR ALL
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));

-- Reservations
CREATE POLICY "Users can view their school's reservations"
    ON library_reservations FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));
CREATE POLICY "Users can create reservations"
    ON library_reservations FOR INSERT
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their school's reservations"
    ON library_reservations FOR UPDATE
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));

-- Fines
CREATE POLICY "School staff can manage fines"
    ON library_fines FOR ALL
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()))
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));

-- Book Requests
CREATE POLICY "Users can view their school's book requests"
    ON book_requests FOR SELECT
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));
CREATE POLICY "Users can create book requests"
    ON book_requests FOR INSERT
    WITH CHECK (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their school's book requests"
    ON book_requests FOR UPDATE
    USING (school_id IN (SELECT school_id FROM users WHERE user_id = auth.uid()));
