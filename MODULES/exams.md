# Exam Bank Module

## Purpose
- Allow teachers to create, upload, and reuse exams (exam, CAT, mock, past paper).
- Schedule exams to classes by term and academic year.

## Core Data Model
- `exam_bank`: stored exam metadata, optional file content, type, and subject.
- `exam_sets`: scheduled usage of an exam for a class/date/term/year.

## Architecture and Data Flow
- Teacher creates or uploads exam to `exam_bank`.
- Exams can be searched by subject, type, term, and year.
- An exam is scheduled by creating `exam_sets`.
- Files stored in Supabase Storage; DB stores `file_url`, `file_name`, `file_type`.

## API Surface
- `GET /api/exams` with filters and pagination.
- `POST /api/exams` for create/upload metadata.
- `GET /api/exams/sets` to list scheduled exams.
- `POST /api/exams/sets` to schedule an exam.

## UI Structure
- Tabbed flow: Create/Upload → Exam Bank → Set Exams.
- Drag‑and‑drop upload with validation.
- Search and filters by subject, term, year, type.
- Exam preview modal and schedule dialog.

## Security and RBAC
- Access allowed for teacher and admin roles only.
- `school_id` enforced on all queries and inserts.
- File uploads restricted to allowed MIME types and size limits.

## Constraints and Rules
- `exam_type` constrained to `exam`, `cat`, `mock`, `past_paper`.
- Unique scheduling to avoid duplicate class/date conflicts.

## Improvement Ideas
- Full‑text search on exam content.
- Versioning for updated exams.
- Question bank support for auto‑generated exams.
