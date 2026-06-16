#!/usr/bin/env node
// scripts/check-schema-drift.mjs
// ============================================================
// Schema drift detection script.
// Scans the codebase for `.from('table')` references and
// compares them against the canonical schema map.
// Run: node scripts/check-schema-drift.mjs
// ============================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, extname } from 'path';

// ============================================================
// Canonical Schema Map
// ============================================================
// Tables known to exist in the canonical database.
// New tables added by migrations should be added here.
const CANONICAL_TABLES = new Set([
  // Core
  'schools',
  'roles',
  'users',
  'user_profiles',
  'students',
  'student_classes',
  'guardians',
  'classes',
  'grades',
  'class_levels',
  'learning_areas',
  'strands',
  'sub_strands',
  'competencies',
  'performance_levels',
  'academic_years',
  'terms',

  // Staff
  'staff',
  'staff_leaves',
  'staff_status_history',
  'teacher_subjects',

  // Assessments & Reports
  'assessments',
  'assessment_aggregates',
  'assessment_templates',
  'report_cards',
  'generated_reports',
  'report_requests',

  // Attendance
  'attendance',

  // Finance
  'fee_structures',
  'student_fees',
  'payments',
  'mpesa_c2b_transactions',
  'mpesa_stk_requests',
  'fee_exemptions',

  // Parent / Guardian
  'student_guardians',
  'parent_consents',

  // Timetable
  'timetable_slots',
  'bell_times',

  // Disciplinary
  'disciplinary_records',

  // Communication
  'messages',
  'message_recipients',
  'announcements',
  'broadcast_messages',
  'notifications',

  // Exams
  'exam_bank',
  'exam_sets',

  // New module tables (added by missing_module_tables_migration.sql)
  'subjects',
  'student_subjects',
  'grading_scales',
  'promotion_rules',

  // AI Agent
  'ai_agent_sessions',
  'ai_agent_messages',
  'ai_agent_actions',
  'ai_agent_tool_catalog',
  'user_roles',           // used by AI agent tools
  'timetable_entries',     // used by AI agent tools
  'fee_waivers',           // used by AI agent tools
  'ai_logs',
  'ai_cache',

  // Analytics / Pipeline
  'analytics_snapshots',
  'student_risk_scores',

  // System / Audit
  'audit_logs',

  // Migrations
  'jobs',
  'term_locks',
  'special_needs',

  // Settings
  'school_settings',

  // Other Features
  'admission_applications',
  'student_portfolios',
  'offline_sync_queue',
  'offline_metadata',
  'sms_logs',
  'chatbot_sessions',
  'fee_prediction_logs',
  'alignment_check_logs',
  'exam_rooms',
  'exam_seating_plans',
  'exam_seating_assignments',
  'clubs',
  'club_memberships',
  'sport_teams',
  'team_members',
  'library_books',
  'library_borrowing',
  'school_inventory',
  'transport_vehicles',
  'transport_routes',
  'transport_assignments',
]);

// Known bad table names that should never appear in .from()
const BANNED_TABLES = new Map([
  ['attendance_records', 'use "attendance" instead'],
  ['fee_payments', 'use "payments" instead'],
  ['student_parents', 'use "student_guardians" instead'],
  ['assessment_results', 'use "assessments" instead'],
  ['discipline_records', 'use "disciplinary_records" instead'],
  ['timetable_entries', 'use "timetable_slots" instead'],
  ['user_roles', 'use roles on users table instead'],
  ['fee_waivers', 'use "fee_exemptions" instead'],

  ['user_roles', 'verify this is the correct table name'],
]);

// Known bad column references in code (only flag DB-side usage, not output mapping)
const BANNED_PATTERNS = [
  { pattern: /\.eq\('id',\s*user\.school_id\)/g, hint: 'use .eq("school_id", ...) instead of .eq("id", ...)' },
  { pattern: /paid_at/g, hint: 'use payment_date instead of paid_at' },
  { pattern: /\.select\([^)]*receipt_no[^)]*\)/g, hint: 'use receipt_number instead of receipt_no in DB selects' },
  { pattern: /\.select\([^)]*admission_no[^)]*\)/g, hint: 'use admission_number instead of admission_no in DB selects' },
  { pattern: /\.eq\(['"]admission_no['"]/g, hint: 'use admission_number instead of admission_no in DB queries' },
  { pattern: /\.from\('attendance_records'\)/g, hint: 'use attendance instead of attendance_records' },
  { pattern: /\.from\('fee_payments'\)/g, hint: 'use payments instead of fee_payments' },
  { pattern: /\.from\('student_parents'\)/g, hint: 'use student_guardians instead of student_parents' },
  { pattern: /REFERENCES\s+schools\(id\)/g, hint: 'use schools(school_id) instead of schools(id)' },
  { pattern: /REFERENCES\s+students\(id\)/g, hint: 'use students(student_id) instead of students(id)' },
  { pattern: /REFERENCES\s+users\(id\)/g, hint: 'use users(user_id) instead of users(id)' },
  { pattern: /REFERENCES\s+staff\(id\)/g, hint: 'use staff(staff_id) instead of staff(id)' },
  { pattern: /REFERENCES\s+learning_areas\(id\)/g, hint: 'use learning_areas(learning_area_id) instead of learning_areas(id)' },
];

// Source directories to scan (relative to project root)
const SCAN_DIRS = [
  'app',
  'features',
  'lib',
  'components',
];

// File patterns to include
const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.sql', '.mjs'];

// ============================================================
// Helpers
// ============================================================

function getAllFiles(dir) {
  const root = resolve(dir);
  if (!existsSync(root)) return [];
  const files = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('node_modules') && !entry.name.startsWith('.') && entry.name !== '.next') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (['.ts', '.tsx', '.sql', '.mjs'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  };
  walk(root);
  return files;
}

function extractFromClauses(content) {
  const regex = /\.from\(['"]([a-z_]+)['"]\)/g;
  const tables = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    tables.push(match[1]);
  }
  return tables;
}

// ============================================================
// Main
// ============================================================

const projectRoot = resolve(import.meta.dirname, '..');
let issues = 0;

console.log('\n\x1b[1m=== Schema Drift Checker ===\x1b[0m\n');

// Collect all files
let allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles = allFiles.concat(getAllFiles(join(projectRoot, dir)));
}
console.log(`Scanning ${allFiles.length} files across [${SCAN_DIRS.join(', ')}]...\n`);

// Track tables found vs canonical
const foundTables = new Map(); // table -> files[]

for (const filePath of allFiles) {
  const content = readFileSync(filePath, 'utf8');
  const tables = extractFromClauses(content);

  for (const table of tables) {
    if (!foundTables.has(table)) {
      foundTables.set(table, []);
    }
    foundTables.get(table).push(filePath);
  }
}

// Check for unknown tables
const unknownTables = [];
for (const [table, files] of foundTables) {
  if (!CANONICAL_TABLES.has(table)) {
    unknownTables.push({ table, files });
  }
}

if (unknownTables.length > 0) {
  console.log('\x1b[33m⚠ Unknown tables found in .from() calls:\x1b[0m');
  for (const { table, files } of unknownTables) {
    const uniqueFiles = [...new Set(files)];
    console.log(`  \x1b[31m✗ ${table}\x1b[0m`);
    for (const f of uniqueFiles.slice(0, 5)) {
      console.log(`      ${relative(projectRoot, f)}`);
    }
    if (uniqueFiles.length > 5) {
      console.log(`      ... and ${uniqueFiles.length - 5} more`);
    }
    issues++;
  }
  console.log('');
} else {
  console.log('\x1b[32m✓ All .from() references use known canonical tables\x1b[0m\n');
}

// Check for banned tables
console.log('Checking for banned table names...');
let bannedFound = 0;
for (const filePath of allFiles) {
  const content = readFileSync(filePath, 'utf8');
  for (const [banned, hint] of BANNED_TABLES) {
    const regex = new RegExp(`\\.from\\(['"\`]${banned}['"\`]\\)`, 'g');
    if (regex.test(content)) {
      console.log(`  \x1b[31m✗ ${banned} in ${relative(projectRoot, filePath)}\x1b[0m`);
      console.log(`      Hint: ${hint}`);
      bannedFound++;
      issues++;
    }
  }
}
if (bannedFound === 0) {
  console.log('\x1b[32m✓ No banned table names found\x1b[0m\n');
}

// Check for banned patterns
console.log('Checking for banned column/pattern references...');
let patternFound = 0;
for (const filePath of allFiles) {
  const content = readFileSync(filePath, 'utf8');
  for (const { pattern, hint } of BANNED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`  \x1b[31m✗ Matched in ${relative(projectRoot, filePath)}\x1b[0m`);
      console.log(`      Hint: ${hint}`);
      patternFound += matches.length;
      issues++;
    }
  }
}
if (patternFound === 0) {
  console.log('\x1b[32m✓ No banned column/pattern references found\x1b[0m\n');
}

// Summary
console.log('\x1b[1m=== Summary ===\x1b[0m');
if (issues === 0) {
  console.log('\x1b[32m✓ No schema drift issues detected.\x1b[0m\n');
} else {
  console.log(`\x1b[31m✗ ${issues} schema drift issue(s) detected.\x1b[0m\n`);
}

process.exit(issues > 0 ? 1 : 0);
