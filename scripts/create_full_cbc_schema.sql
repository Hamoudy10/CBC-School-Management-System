-- ============================================================
-- FULL CBC Academic Structure — Complete Implementation
-- Run in Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- Creates ALL tables needed for Scheme Import feature
-- ============================================================

-- 1. Schools
-- ============================================================
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'primary',
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'School administrator — full access'),
  ('teacher', 'Teacher — academic access'),
  ('principal', 'School principal — oversight access'),
  ('student', 'Student — limited access'),
  ('parent', 'Parent/guardian — read access'),
  ('finance', 'Finance officer — billing access')
ON CONFLICT (name) DO NOTHING;

-- 3. User Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- auth.users.id (or your auth system)
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 4. Academic Years
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g., "2024", "2024-2025"
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- 5. Terms
-- ============================================================
CREATE TABLE IF NOT EXISTS terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g., "Term 1", "Term 2"
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, academic_year_id, name)
);

-- 6. Classes
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Grade 4", "Grade 5A"
  stream VARCHAR(50), -- e.g., "East", "West" (optional)
  grade_level VARCHAR(50), -- e.g., "Grade 4"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name, stream)
);

-- 7. Learning Areas
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_core BOOLEAN DEFAULT true,
  applicable_grades TEXT[], -- e.g., '{"Grade 4", "Grade 5", "Grade 6"}'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(school_id, name)
);

-- 8. Strands
-- ============================================================
CREATE TABLE IF NOT EXISTS strands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_area_id UUID NOT NULL REFERENCES learning_areas(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(learning_area_id, name)
);

-- 9. Sub-Strands
-- ============================================================
CREATE TABLE IF NOT EXISTS sub_strands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strand_id UUID NOT NULL REFERENCES strands(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(strand_id, name)
);

-- 10. Competencies
-- ============================================================
CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_strand_id UUID NOT NULL REFERENCES sub_strands(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  term VARCHAR(50), -- e.g., "Term 1", "Term 2"
  academic_year VARCHAR(50), -- e.g., "2024"
  assessment_type VARCHAR(50) DEFAULT 'observation',
  domain VARCHAR(50), -- cognitive, psychomotor, affective
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT chk_competency_domain CHECK (domain IN ('cognitive', 'psychomotor', 'affective', NULL))
);

-- 11. Performance Levels
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(10) UNIQUE,
  description TEXT,
  min_score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed CBC performance levels
INSERT INTO performance_levels (code, name, description, min_score, max_score, order_index, is_active)
VALUES
  ('EE', 'Exceeding Expectations', 'Learner consistently demonstrates mastery beyond expected level', 80, 100, 1, true),
  ('ME', 'Meeting Expectations', 'Learner consistently demonstrates mastery at expected level', 65, 79, 2, true),
  ('AP', 'Approaching Expectations', 'Learner demonstrates partial mastery, approaching expected level', 50, 64, 3, true),
  ('BE', 'Below Expectations', 'Learner has not yet demonstrated mastery at expected level', 0, 49, 4, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_school ON user_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_school ON academic_years(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_school ON terms(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_academic_year ON terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_learning_areas_school ON learning_areas(school_id);
CREATE INDEX IF NOT EXISTS idx_strands_learning_area ON strands(learning_area_id);
CREATE INDEX IF NOT EXISTS idx_strands_school ON strands(school_id);
CREATE INDEX IF NOT EXISTS idx_sub_strands_strand ON sub_strands(strand_id);
CREATE INDEX IF NOT EXISTS idx_sub_strands_school ON sub_strands(school_id);
CREATE INDEX IF NOT EXISTS idx_competencies_sub_strand ON competencies(sub_strand_id);
CREATE INDEX IF NOT EXISTS idx_competencies_school ON competencies(school_id);
CREATE INDEX IF NOT EXISTS idx_competencies_term ON competencies(term);
CREATE INDEX IF NOT EXISTS idx_competencies_academic_year ON competencies(academic_year);
CREATE INDEX IF NOT EXISTS idx_competencies_domain ON competencies(domain);
CREATE INDEX IF NOT EXISTS idx_performance_levels_school ON performance_levels(school_id);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_academic_years_updated_at ON academic_years;
CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_terms_updated_at ON terms;
CREATE TRIGGER update_terms_updated_at BEFORE UPDATE ON terms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_learning_areas_updated_at ON learning_areas;
CREATE TRIGGER update_learning_areas_updated_at BEFORE UPDATE ON learning_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strands_updated_at ON strands;
CREATE TRIGGER update_strands_updated_at BEFORE UPDATE ON strands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sub_strands_updated_at ON sub_strands;
CREATE TRIGGER update_sub_strands_updated_at BEFORE UPDATE ON sub_strands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competencies_updated_at ON competencies;
CREATE TRIGGER update_competencies_updated_at BEFORE UPDATE ON competencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_levels_updated_at ON performance_levels;
CREATE TRIGGER update_performance_levels_updated_at BEFORE UPDATE ON performance_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to be idempotent — safe for re-runs)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Admins can manage user profiles" ON user_profiles;
  DROP POLICY IF EXISTS "School members can view academic_years" ON academic_years;
  DROP POLICY IF EXISTS "Admins/teachers can manage academic_years" ON academic_years;
  DROP POLICY IF EXISTS "School members can view terms" ON terms;
  DROP POLICY IF EXISTS "Admins/teachers can manage terms" ON terms;
  DROP POLICY IF EXISTS "School members can view classes" ON classes;
  DROP POLICY IF EXISTS "Admins/teachers can manage classes" ON classes;
  DROP POLICY IF EXISTS "School members can view learning_areas" ON learning_areas;
  DROP POLICY IF EXISTS "Admins/teachers can manage learning_areas" ON learning_areas;
  DROP POLICY IF EXISTS "School members can view strands" ON strands;
  DROP POLICY IF EXISTS "Admins/teachers can manage strands" ON strands;
  DROP POLICY IF EXISTS "School members can view sub_strands" ON sub_strands;
  DROP POLICY IF EXISTS "Admins/teachers can manage sub_strands" ON sub_strands;
  DROP POLICY IF EXISTS "School members can view competencies" ON competencies;
  DROP POLICY IF EXISTS "Admins/teachers can manage competencies" ON competencies;
  DROP POLICY IF EXISTS "School members can view performance_levels" ON performance_levels;
  DROP POLICY IF EXISTS "Admins can manage performance_levels" ON performance_levels;
END $$;

-- Schools: authenticated users can view
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);

-- User profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.name IN ('admin', 'principal')));
CREATE POLICY "Admins can manage user profiles" ON user_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.name IN ('admin', 'principal')));

-- Academic years
CREATE POLICY "School members can view academic_years" ON academic_years FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage academic_years" ON academic_years FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Terms
CREATE POLICY "School members can view terms" ON terms FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage terms" ON terms FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Classes
CREATE POLICY "School members can view classes" ON classes FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage classes" ON classes FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Learning areas
CREATE POLICY "School members can view learning_areas" ON learning_areas FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage learning_areas" ON learning_areas FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Strands
CREATE POLICY "School members can view strands" ON strands FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage strands" ON strands FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Sub-strands
CREATE POLICY "School members can view sub_strands" ON sub_strands FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage sub_strands" ON sub_strands FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Competencies
CREATE POLICY "School members can view competencies" ON competencies FOR SELECT
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins/teachers can manage competencies" ON competencies FOR ALL
  USING (school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'teacher', 'principal'))));

-- Performance levels
CREATE POLICY "School members can view performance_levels" ON performance_levels FOR SELECT
  USING (school_id IS NULL OR school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage performance_levels" ON performance_levels FOR ALL
  USING ((school_id IS NULL OR school_id IN (SELECT school_id FROM user_profiles WHERE user_id = auth.uid())) AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'principal'))));

-- ============================================================
-- Verification — shows all tables and row counts
-- ============================================================
SELECT 'schools' AS table_name, COUNT(*) AS rows FROM schools
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'academic_years', COUNT(*) FROM academic_years
UNION ALL SELECT 'terms', COUNT(*) FROM terms
UNION ALL SELECT 'classes', COUNT(*) FROM classes
UNION ALL SELECT 'learning_areas', COUNT(*) FROM learning_areas
UNION ALL SELECT 'strands', COUNT(*) FROM strands
UNION ALL SELECT 'sub_strands', COUNT(*) FROM sub_strands
UNION ALL SELECT 'competencies', COUNT(*) FROM competencies
UNION ALL SELECT 'performance_levels', COUNT(*) FROM performance_levels
ORDER BY table_name;
