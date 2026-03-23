'use client';

import useSWR from 'swr';

export interface ReferenceClass {
  classId: string;
  name: string;
  stream?: string | null;
  gradeId?: string | null;
  gradeName?: string;
  gradeLevel?: number | null;
  studentCount?: number;
}

export interface ReferenceLevel {
  gradeId: string;
  name: string;
  gradeLevel?: number | null;
}

export interface ReferenceAcademicYear {
  id: string;
  year: string;
  isActive?: boolean;
}

export interface ReferenceTerm {
  id: string;
  name: string;
  academicYearId: string;
  isActive?: boolean;
}

export interface ReferenceLearningArea {
  learningAreaId: string;
  name: string;
  isCore?: boolean;
}

interface ReferenceDataResponse {
  classes: ReferenceClass[];
  levels: ReferenceLevel[];
  academicYears: ReferenceAcademicYear[];
  activeYear: ReferenceAcademicYear | null;
  activeTerm: ReferenceTerm | null;
  termsByYear: Record<string, ReferenceTerm[]>;
  learningAreas: ReferenceLearningArea[];
}

interface ApiResponse<T> {
  data?: T;
}

interface UseReferenceDataOptions {
  enabled?: boolean;
  includeLearningAreas?: boolean;
}

const EMPTY_REFERENCE_DATA: ReferenceDataResponse = {
  classes: [],
  levels: [],
  academicYears: [],
  activeYear: null,
  activeTerm: null,
  termsByYear: {},
  learningAreas: [],
};

export function useReferenceData(options: UseReferenceDataOptions = {}) {
  const { enabled = true, includeLearningAreas = false } = options;
  const endpoint = enabled
    ? `/api/settings/reference-data${includeLearningAreas ? '?includeLearningAreas=true' : ''}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ReferenceDataResponse>>(
    endpoint,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  );

  const referenceData = data?.data ?? EMPTY_REFERENCE_DATA;

  return {
    ...referenceData,
    error,
    isLoading,
    mutate,
  };
}
