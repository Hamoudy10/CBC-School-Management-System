import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { SmartSearchResult, SmartSearchColumn } from '../types';
import type { SmartSearchInput } from '../validators/smart-search.schema';

const searchOutputSchema = z.object({
  interpretation: z.string().min(1),
  summary: z.string().min(1),
  queryType: z.enum(['student_list', 'assessment_summary', 'attendance_report', 'fee_analysis', 'general']),
  filters: z.record(z.unknown()),
  aggregations: z.array(z.string()).optional(),
});

export async function smartSearch(
  input: SmartSearchInput,
  user: AuthUser,
): Promise<SmartSearchResult> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  const { data: schoolInfo } = await supabase
    .from('schools')
    .select('name, term_name, academic_year')
    .eq('school_id', schoolId)
    .single();

  const schemaContext = {
    school: schoolInfo,
    tables: {
      students: 'students(student_id, first_name, last_name, admission_number, class_id, status)',
      classes: 'classes(class_id, name, grade_level, stream)',
      learning_areas: 'learning_areas(learning_area_id, name, code)',
      assessment_aggregates: 'assessment_aggregates(average_score, overall_level, term_id, student_id, learning_area_id)',
      attendance: 'attendance(student_id, date, status: present/absent/late, class_id)',
      student_fees: 'student_fees(id, student_id, amount_due, balance, status)',
      payments: 'payments(amount_paid, payment_date, receipt_number, payment_method)',
    },
    performanceLevels: {
      exceeding: 'above 80%',
      meeting: '60-80%',
      approaching: '40-59%',
      below_expectation: 'below 40%',
    },
  };

  try {
    const ai = await generateGroqCompletion<z.infer<typeof searchOutputSchema>>({
      system: `You are a smart school data analyst. Given a natural language query and the database schema, interpret the query and return structured search parameters.
Available tables: ${Object.values(schemaContext.tables).join(', ')}
Performance levels: ${JSON.stringify(schemaContext.performanceLevels)}

Return JSON with:
- interpretation: what the user wants in plain English
- summary: a brief summary of findings (placeholder is fine)
- queryType: the type of data needed
- filters: key-value pairs to filter by
- aggregations: any calculations needed`,
      prompt: `School: ${schoolInfo?.name ?? 'Unknown'} (Term: ${schoolInfo?.term_name ?? 'N/A'}, Year: ${schoolInfo?.academic_year ?? 'N/A'})
User query: "${input.query}"
Scope: ${input.scope}

Interpret this query and return the structured search parameters.`,
      responseFormat: 'json',
      temperature: 0.1,
      responseSchema: searchOutputSchema,
      requestLabel: `smart-search.${input.scope}`,
      cache: { schoolId: `${schoolId}_search` },
    });

    const parsed = searchOutputSchema.parse(ai.data);
    let queryData: Record<string, unknown>[] = [];
    let columns: SmartSearchColumn[] = [];

    let dbQuery = supabase;
    if (parsed.queryType === 'student_list' || parsed.queryType === 'general') {
      const { data: students } = await supabase
        .from('students')
        .select('first_name, last_name, admission_number, classes!inner(name, grade_level), status')
        .eq('school_id', schoolId)
        .limit(20);

      if (students) {
        queryData = students as unknown as Record<string, unknown>[];
        columns = [
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'admission_number', label: 'Adm No' },
          { key: 'classes.name', label: 'Class' },
          { key: 'status', label: 'Status' },
        ];
      }
    }

    const dataRows = queryData.map((row) => {
      const flat: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            flat[subKey] = subValue;
          }
        } else {
          flat[key] = value;
        }
      }
      return flat;
    });

    return {
      query: input.query,
      interpretation: parsed.interpretation,
      summary: parsed.summary || `Found ${queryData.length} results matching your query.`,
      data: dataRows,
      columns,
      totalResults: dataRows.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Search failed');
  }
}
