-- Create admission_applications table for public admission forms
CREATE TABLE IF NOT EXISTS admission_applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    grade_applying_for TEXT NOT NULL,
    previous_school TEXT DEFAULT NULL,
    parent_name TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    parent_email TEXT DEFAULT NULL,
    parent_id_number TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    notes TEXT DEFAULT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    reviewed_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Index for school lookup
CREATE INDEX IF NOT EXISTS idx_admission_applications_school_id ON admission_applications(school_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_admission_applications_status ON admission_applications(status);

-- Enable RLS
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- Public can insert (the apply form)
CREATE POLICY "Anyone can submit an application"
    ON admission_applications FOR INSERT
    WITH CHECK (true);

-- Authenticated users from the school can view their own school's applications
CREATE POLICY "School staff can view applications"
    ON admission_applications FOR SELECT
    USING (
        auth.role() = 'authenticated' 
        AND school_id IN (
            SELECT school_id FROM users WHERE id = auth.uid()
        )
    );
