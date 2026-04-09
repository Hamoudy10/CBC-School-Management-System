-- Migration: Create missing module tables
-- Created: 2026-04-09
-- Purpose: Add subjects, student_subjects, grading_scales, and promotion_rules tables
-- ============================================================

-- ─── Subjects Table ─────────────────────────────────────────────────────────────
-- CBC subjects that map to learning areas
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE,
    description TEXT,
    learning_area_id UUID REFERENCES learning_areas(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES users(id),
    CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id)
);

CREATE INDEX idx_subjects_school_id ON subjects(school_id);
CREATE INDEX idx_subjects_learning_area_id ON subjects(learning_area_id);
CREATE INDEX idx_subjects_code ON subjects(code);

-- ─── Student Subjects Table ─────────────────────────────────────────────────────
-- Maps students to their enrolled subjects per term
CREATE TABLE IF NOT EXISTS student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id),
    term_id UUID REFERENCES terms(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT student_subjects_unique UNIQUE (student_id, subject_id, academic_year_id, term_id)
);

CREATE INDEX idx_student_subjects_school_id ON student_subjects(school_id);
CREATE INDEX idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX idx_student_subjects_subject_id ON student_subjects(subject_id);
CREATE INDEX idx_student_subjects_teacher_id ON student_subjects(teacher_id);

-- ─── Grading Scales Table ───────────────────────────────────────────────────────
-- Configurable grading scales per school (CBC 4-point, percentage, etc.)
CREATE TABLE IF NOT EXISTS grading_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    grade_label VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES users(id),
    CONSTRAINT grading_scales_no_overlap CHECK (min_score <= max_score)
);

CREATE INDEX idx_grading_scales_school_id ON grading_scales(school_id);
CREATE INDEX idx_grading_scales_active ON grading_scales(school_id, is_active);

-- ─── Promotion Rules Table ──────────────────────────────────────────────────────
-- Rules that determine student promotion between grades/classes
CREATE TABLE IF NOT EXISTS promotion_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    minimum_average DECIMAL(5,2),
    minimum_attendance_percentage DECIMAL(5,2),
    max_failing_subjects INTEGER DEFAULT 0,
    allow_conditional_promotion BOOLEAN DEFAULT false,
    conditional_remarks_template TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_promotion_rules_school_id ON promotion_rules(school_id);
CREATE INDEX idx_promotion_rules_active ON promotion_rules(school_id, is_active);

-- ─── Seed Default Grading Scales (CBC 4-Point) ─────────────────────────────────
INSERT INTO grading_scales (id, school_id, name, min_score, max_score, grade_label, description, is_active)
SELECT
    gen_random_uuid(),
    s.id,
    'CBC 4-Point Scale',
    3.5, 4.0,
    'Exceeding Expectation',
    'Learner consistently exceeds competency expectations',
    true
FROM schools s
ON CONFLICT DO NOTHING;

INSERT INTO grading_scales (school_id, name, min_score, max_score, grade_label, description, is_active)
SELECT
    s.id,
    'CBC 4-Point Scale',
    3.0, 3.49,
    'Meeting Expectation',
    'Learner meets competency expectations',
    true
FROM schools s
ON CONFLICT DO NOTHING;

INSERT INTO grading_scales (school_id, name, min_score, max_score, grade_label, description, is_active)
SELECT
    s.id,
    'CBC 4-Point Scale',
    2.0, 2.99,
    'Approaching Expectation',
    'Learner is approaching competency expectations',
    true
FROM schools s
ON CONFLICT DO NOTHING;

INSERT INTO grading_scales (school_id, name, min_score, max_score, grade_label, description, is_active)
SELECT
    s.id,
    'CBC 4-Point Scale',
    1.0, 1.99,
    'Below Expectation',
    'Learner is below competency expectations',
    true
FROM schools s
ON CONFLICT DO NOTHING;

-- ─── Seed Default Promotion Rule ────────────────────────────────────────────────
INSERT INTO promotion_rules (school_id, name, description, minimum_average, minimum_attendance_percentage, allow_conditional_promotion, is_active)
SELECT
    s.id,
    'Standard CBC Promotion',
    'Student must achieve minimum average of 2.5 (Approaching) with 80% attendance',
    2.5,
    80.0,
    true,
    true
FROM schools s
ON CONFLICT DO NOTHING;
