1️⃣ Purpose

Implement CBC learning hierarchy: learning areas → strands → sub-strands → competencies → performance levels.

Enable student assessment tracking.

Generate term-wise and yearly reports with analytics & trends.

Integrate disciplinary and special needs info where relevant.

Ensure production-ready, normalized schema and Supabase-ready logic.

2️⃣ CBC Hierarchy Tables & Relationships
Table	Description	Key Columns
learning_areas	Main CBC learning areas	learning_area_id PK, name, description
strands	Subsections of learning areas	strand_id PK, learning_area_id FK, name, description
sub_strands	Subsections of strands	sub_strand_id PK, strand_id FK, name, description
competencies	Skills/competencies	competency_id PK, sub_strand_id FK, name, description
performance_levels	CBC performance descriptors	level_id PK, name (Below Expectation / Approaching / Meeting / Exceeding), description

Notes:

Each assessment links to a competency.

Reports will aggregate competencies → sub-strands → strands → learning area.

3️⃣ Assessment Tables
Table	Description	Key Columns
assessments	Individual student assessments	assessment_id PK, student_id FK, competency_id FK, score (numeric), level_id FK, term, academic_year, remarks, assessed_by FK, date
assessment_templates	Predefined assessment items per competency	template_id PK, competency_id FK, name, max_score, description
report_cards	Term/year summary reports	report_id PK, student_id FK, term, academic_year, generated_at, pdf_url, analytics_json
analytics	Derived metrics for trends	id PK, student_id FK, learning_area_id FK, term, academic_year, average_score, performance_level, trend

Notes:

analytics_json in report_cards stores visualization-ready data (charts, trends).

Trend calculation = compare current term score vs previous term per learning area.

4️⃣ Assessment Logic

Assign assessment template to student → links competency_id → sub_strand → strand → learning_area.

Teacher enters score per competency.

Map score to performance level:

Example: Below Expectation (<50%), Approaching (50–64%), Meeting (65–79%), Exceeding (≥80%)

Term-wise aggregation: average per sub-strand, strand, learning area

Yearly aggregation: averages across terms + trend detection

Include special needs adjustments if flagged in user_profiles.special_needs_id

5️⃣ Report Card Generation

Term-wise PDF reports include:

Learner bio-data

Attendance summary

Competency performance

Teacher remarks

Head teacher remarks

Co-curricular achievements

Analytics charts & trends

Yearly PDF reports aggregate all three terms, include trend analysis per learning area.

Downloadable & printable in-app (Supabase storage for PDFs, links in report_cards.pdf_url).

6️⃣ Analytics & Trends

Table: analytics

Metrics calculated per student per learning area:

Average score

Current performance level

Trend vs previous term/year (improving, stable, declining)

Visualizations:

Line charts: performance over terms

Radar charts: competencies per learning area

Summary table: Below Expectation → Exceeding

AI Instructions:

Generate analytics JSON for frontend charting.

Ensure responsive and modern dashboard design.

7️⃣ AI Implementation Instructions

Build all CBC hierarchy tables (learning areas → competencies).

Implement assessments, assessment_templates, report_cards, analytics.

Include foreign keys & constraints for referential integrity.

Create term-wise and yearly aggregation queries/functions for reporting.

Map scores → performance levels dynamically.

Include special needs and disciplinary context in assessments if needed.

Ensure PDF generation links to Supabase storage.

Include concise Claude .md summary documenting:

Tables and relationships

Aggregation logic

Performance level mapping

Reporting templates

Trend calculation

Maintain production-ready approach (no mock data).

Ensure modular design; split tables or logic into submodules if the file exceeds token limits.