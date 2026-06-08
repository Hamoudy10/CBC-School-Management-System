-- Fee prediction analytics logs
CREATE TABLE IF NOT EXISTS fee_prediction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(student_id) ON DELETE CASCADE,
  risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_score DECIMAL(5,2) NOT NULL,
  factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fee_prediction_school ON fee_prediction_logs(school_id);
CREATE INDEX idx_fee_prediction_student ON fee_prediction_logs(student_id);

ALTER TABLE fee_prediction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_prediction_school_isolation" ON fee_prediction_logs
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));

-- Curriculum alignment check logs
CREATE TABLE IF NOT EXISTS alignment_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  lesson_plan_title VARCHAR(200),
  overall_score DECIMAL(5,2),
  aligned_competencies JSONB DEFAULT '[]',
  missing_competencies JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alignment_check_school ON alignment_check_logs(school_id);

ALTER TABLE alignment_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alignment_check_school_isolation" ON alignment_check_logs
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));
