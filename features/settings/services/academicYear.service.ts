// features/settings/services/academicYear.service.ts
// Academic year and term management

import { createClient } from "@/lib/supabase/client";
import type { AcademicYear, AcademicTerm } from "../types";
import type {
  CreateAcademicYearInput,
  CreateTermInput,
} from "../validators/settings.schema";

const supabase = createClient();

// ============================================================
// ACADEMIC YEARS
// ============================================================

export async function getAcademicYears(
  schoolId: string,
): Promise<{ success: boolean; data: AcademicYear[]; message?: string }> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("school_id", schoolId)
    .order("year", { ascending: false });

  if (error) {
    return { success: false, data: [], message: error.message };
  }

  return { success: true, data: (data || []) as AcademicYear[] };
}

export async function getActiveAcademicYear(
  schoolId: string,
): Promise<{ success: boolean; data?: AcademicYear; message?: string }> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as AcademicYear };
}

export async function createAcademicYear(
  input: CreateAcademicYearInput,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  // Check for duplicate year
  const { data: existing } = await supabase
    .from("academic_years")
    .select("academic_year_id")
    .eq("year", input.year)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: `Academic year ${input.year} already exists`,
    };
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      year: input.year,
      start_date: input.start_date,
      end_date: input.end_date,
      is_active: false,
      school_id: schoolId,
    })
    .select("academic_year_id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    id: data.academic_year_id,
    message: `Academic year ${input.year} created`,
  };
}

export async function setActiveAcademicYear(
  yearId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  // Deactivate all years
  const { error: deactivateError } = await supabase
    .from("academic_years")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId);

  if (deactivateError) {
    return { success: false, message: deactivateError.message };
  }

  // Activate selected year
  const { error: activateError } = await supabase
    .from("academic_years")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("academic_year_id", yearId)
    .eq("school_id", schoolId);

  if (activateError) {
    return { success: false, message: activateError.message };
  }

  return { success: true, message: "Active academic year updated" };
}

// ============================================================
// TERMS
// ============================================================

export async function getTerms(
  academicYearId: string,
  schoolId: string,
): Promise<{ success: boolean; data: AcademicTerm[]; message?: string }> {
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId)
    .order("name");

  if (error) {
    return { success: false, data: [], message: error.message };
  }

  return { success: true, data: (data || []) as AcademicTerm[] };
}

export async function getActiveTerm(
  schoolId: string,
): Promise<{ success: boolean; data?: AcademicTerm; message?: string }> {
  const { data, error } = await supabase
    .from("terms")
    .select(
      `
      *,
      academic_year:academic_years(year, is_active)
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as unknown as AcademicTerm };
}

export async function createTerm(
  input: CreateTermInput,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  // Verify academic year exists
  const { data: year } = await supabase
    .from("academic_years")
    .select("academic_year_id")
    .eq("academic_year_id", input.academic_year_id)
    .eq("school_id", schoolId)
    .single();

  if (!year) {
    return { success: false, message: "Academic year not found" };
  }

  // Check for duplicate term
  const { data: existing } = await supabase
    .from("terms")
    .select("term_id")
    .eq("academic_year_id", input.academic_year_id)
    .eq("name", input.name)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: `${input.name} already exists for this academic year`,
    };
  }

  const { data, error } = await supabase
    .from("terms")
    .insert({
      academic_year_id: input.academic_year_id,
      name: input.name,
      start_date: input.start_date,
      end_date: input.end_date,
      is_active: false,
      school_id: schoolId,
    })
    .select("term_id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.term_id, message: `${input.name} created` };
}

export async function setActiveTerm(
  termId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  // Get the term to find its academic year
  const { data: term } = await supabase
    .from("terms")
    .select("academic_year_id")
    .eq("term_id", termId)
    .eq("school_id", schoolId)
    .single();

  if (!term) {
    return { success: false, message: "Term not found" };
  }

  // Deactivate all terms for this school
  const { error: deactivateError } = await supabase
    .from("terms")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId);

  if (deactivateError) {
    return { success: false, message: deactivateError.message };
  }

  // Activate selected term
  const { error: activateError } = await supabase
    .from("terms")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("term_id", termId)
    .eq("school_id", schoolId);

  if (activateError) {
    return { success: false, message: activateError.message };
  }

  // Also activate the associated academic year
  await setActiveAcademicYear(term.academic_year_id, schoolId);

  return { success: true, message: "Active term updated" };
}
