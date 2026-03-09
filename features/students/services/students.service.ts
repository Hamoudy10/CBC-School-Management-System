// features/students/services/students.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthUser } from '@/types/auth';
import {
  Student,
  StudentWithDetails,
  StudentGuardian,
  StudentClassHistory,
  CreateStudentInput,
  UpdateStudentInput,
  CreateGuardianInput,
  LinkGuardianInput,
  TransferStudentInput,
  PromoteStudentsInput,
  StudentFilters,
  StudentQueryParams,
  PaginatedStudents,
  StudentStats,
  StudentAttendanceSummary,
  StudentFeeSummary,
  StudentPerformanceSummary,
  StudentImportRow,
  StudentImportResult,
  mapRowToStudent,
  mapStudentToInsert,
  calculateAge,
  getFullName,
} from '../types';

// ─── Constants ───────────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// ─── Error Classes ───────────────────────────────────────────
export class StudentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'StudentError';
  }
}

export class StudentNotFoundError extends StudentError {
  constructor(studentId: string) {
    super(`Student with ID ${studentId} not found`, 'NOT_FOUND', 404);
  }
}

export class DuplicateAdmissionError extends StudentError {
  constructor(admissionNumber: string) {
    super(
      `A student with admission number ${admissionNumber} already exists`,
      'DUPLICATE_ADMISSION',
      409
    );
  }
}

// ─── Service Class ───────────────────────────────────────────
export class StudentsService {
  // ═══════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get a single student by ID with full details
   */
  static async getStudentById(
    studentId: string,
    user: AuthUser
  ): Promise<StudentWithDetails | null> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('students')
      .select(
        `
        *,
        current_class:classes(
          class_id,
          name,
          stream,
          grade:grades(grade_id, name)
        ),
        guardians:student_guardians(
          id,
          student_id,
          guardian_user_id,
          relationship,
          is_primary_contact,
          can_pickup,
          created_at,
          guardian:users(user_id, first_name, last_name, email, phone)
        )
      `
      )
      .eq('student_id', studentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    // Get fee balance
    const feeBalance = await this.getStudentFeeBalance(studentId, user);

    // Get attendance rate for current term
    const attendanceRate = await this.getStudentAttendanceRate(studentId, user);

    return this.mapToStudentWithDetails(data, feeBalance, attendanceRate);
  }

  /**
   * Get paginated list of students with filters
   */
  static async getStudents(
    params: StudentQueryParams,
    user: AuthUser
  ): Promise<PaginatedStudents> {
    const supabase = await createSupabaseServerClient();

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('students')
      .select(
        `
        *,
        current_class:classes(
          class_id,
          name,
          stream,
          grade:grades(grade_id, name)
        )
      `,
        { count: 'exact' }
      );

    // Apply school scoping (RLS handles this, but explicit for safety)
    if (user.schoolId && user.role !== 'super_admin') {
      query = query.eq('school_id', user.schoolId);
    }

    // Apply filters
    if (params.search) {
      const searchTerm = `%${params.search}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},admission_number.ilike.${searchTerm},nemis_number.ilike.${searchTerm}`
      );
    }

    if (params.classId) {
      query = query.eq('current_class_id', params.classId);
    }

    if (params.gradeId) {
      query = query.eq('current_class.grade_id', params.gradeId);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.gender) {
      query = query.eq('gender', params.gender);
    }

    if (params.hasSpecialNeeds !== undefined) {
      query = query.eq('has_special_needs', params.hasSpecialNeeds);
    }

    // Apply sorting
    const sortBy = params.sortBy ?? 'first_name';
    const sortOrder = params.sortOrder ?? 'asc';
    const sortColumn = this.mapSortColumn(sortBy);
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = (await query) as { data: any[] | null; error: any; count: number | null };

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    const students = await Promise.all(
      (data || []).map(async (row: any) => {
        // Get minimal summary data for list view
        return this.mapToStudentWithDetails(row, 0, null);
      })
    );

    return {
      data: students,
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }

  /**
   * Get students by class ID
   */
  static async getStudentsByClass(
    classId: string,
    user: AuthUser
  ): Promise<StudentWithDetails[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('students')
      .select(
        `
        *,
        current_class:classes(
          class_id,
          name,
          stream,
          grade:grades(grade_id, name)
        )
      `
      )
      .eq('current_class_id', classId)
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    return (data || []).map((row) => this.mapToStudentWithDetails(row, 0, null));
  }

  /**
   * Get student statistics for school
   */
  static async getStudentStats(user: AuthUser): Promise<StudentStats> {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId && user.role !== 'super_admin') {
      throw new StudentError('School context required', 'NO_SCHOOL', 403);
    }

    const { data: statusCounts, error: statusError } = (await supabase
      .from('students')
      .select('status')
      .eq('school_id', user.schoolId!)) as { data: any[] | null; error: any };

    if (statusError) {
      throw new StudentError(statusError.message, 'FETCH_ERROR', 500);
    }

    // Get counts by gender
    const { data: genderCounts, error: genderError } = (await supabase
      .from('students')
      .select('gender')
      .eq('school_id', user.schoolId!)
      .eq('status', 'active')) as { data: any[] | null; error: any };

    if (genderError) {
      throw new StudentError(genderError.message, 'FETCH_ERROR', 500);
    }

    // Get counts by grade
    const { data: gradeCounts, error: gradeError } = (await supabase
      .from('students')
      .select(
        `
        current_class:classes!inner(
          grade:grades!inner(grade_id, name)
        )
      `
      )
      .eq('school_id', user.schoolId!)
      .eq('status', 'active')) as { data: any[] | null; error: any };

    if (gradeError) {
      throw new StudentError(gradeError.message, 'FETCH_ERROR', 500);
    }

    // Get special needs count
    const { count: specialNeedsCount, error: snError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', user.schoolId!)
      .eq('status', 'active')
      .eq('has_special_needs', true);

    if (snError) {
      throw new StudentError(snError.message, 'FETCH_ERROR', 500);
    }

    // Get new enrollments this term (would need term context)
    const currentDate = new Date();
    const termStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1);

    const { count: newEnrollments, error: enrollError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', user.schoolId!)
      .gte('enrollment_date', termStart.toISOString().split('T')[0]);

    if (enrollError) {
      throw new StudentError(enrollError.message, 'FETCH_ERROR', 500);
    }

    // Process counts
    const statusMap = {
      active: 0,
      transferred: 0,
      graduated: 0,
      withdrawn: 0,
      suspended: 0,
    };

    for (const row of statusCounts || []) {
      if (row.status in statusMap) {
        statusMap[row.status as keyof typeof statusMap]++;
      }
    }

    const genderMap = { male: 0, female: 0, other: 0 };
    for (const row of genderCounts || []) {
      if (row.gender in genderMap) {
        genderMap[row.gender as keyof typeof genderMap]++;
      }
    }

    // Process grade counts
    const gradeCountMap = new Map<string, { gradeId: string; gradeName: string; count: number }>();
    for (const row of gradeCounts || []) {
      const grade = (row as any).current_class?.grade;
      if (grade) {
        const existing = gradeCountMap.get(grade.grade_id);
        if (existing) {
          existing.count++;
        } else {
          gradeCountMap.set(grade.grade_id, {
            gradeId: grade.grade_id,
            gradeName: grade.name,
            count: 1,
          });
        }
      }
    }

    return {
      total: statusCounts?.length ?? 0,
      active: statusMap.active,
      transferred: statusMap.transferred,
      graduated: statusMap.graduated,
      withdrawn: statusMap.withdrawn,
      suspended: statusMap.suspended,
      byGender: genderMap,
      byGrade: Array.from(gradeCountMap.values()).sort((a, b) =>
        a.gradeName.localeCompare(b.gradeName)
      ),
      withSpecialNeeds: specialNeedsCount ?? 0,
      newEnrollmentsThisTerm: newEnrollments ?? 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a new student
   */
  static async createStudent(
    input: CreateStudentInput,
    user: AuthUser
  ): Promise<StudentWithDetails> {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId && user.role !== 'super_admin') {
      throw new StudentError('School context required', 'NO_SCHOOL', 403);
    }

    const schoolId = user.schoolId!;

    // Generate admission number if not provided
    let admissionNumber = input.admissionNumber;
    if (!admissionNumber) {
      admissionNumber = await this.generateAdmissionNumber(schoolId);
    }

    // Check for duplicate admission number
    const { data: existing } = (await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('admission_number', admissionNumber)
      .single()) as { data: any | null };

    if (existing) {
      throw new DuplicateAdmissionError(admissionNumber);
    }

    // Validate class exists and belongs to school
    const { data: classData, error: classError } = (await supabase
      .from('classes')
      .select('class_id, school_id')
      .eq('class_id', input.classId)
      .single()) as { data: any | null; error: any };

    if (classError || !classData) {
      throw new StudentError('Invalid class ID', 'INVALID_CLASS', 400);
    }

    if (classData.school_id !== schoolId) {
      throw new StudentError('Class does not belong to this school', 'INVALID_CLASS', 400);
    }

    // Prepare insert data
    const insertData = mapStudentToInsert(input, schoolId);
    insertData.admission_number = admissionNumber;
    insertData.created_by = user.id;
    insertData.updated_by = user.id;

    // Insert student
    const { data: studentData, error: insertError } = (await supabase
      .from('students')
      .insert(insertData as any)
      .select(
        `
        *,
        current_class:classes(
          class_id,
          name,
          stream,
          grade:grades(grade_id, name)
        )
      `
      )
      .single()) as { data: any; error: any };

    if (insertError) {
      if (insertError.code === '23505') {
        throw new DuplicateAdmissionError(admissionNumber);
      }
      throw new StudentError(insertError.message, 'CREATE_ERROR', 500);
    }

    // Create guardians if provided
    if (input.guardians && input.guardians.length > 0) {
      for (const guardian of input.guardians) {
        try {
          await this.addGuardian(studentData.student_id, guardian, user);
        } catch (err) {
          console.error('Failed to add guardian:', err);
          // Continue with student creation even if guardian fails
        }
      }
    }

    // Fetch complete student with guardians
    const completeStudent = await this.getStudentById(studentData.student_id, user);

    return completeStudent!;
  }

  /**
   * Generate unique admission number
   */
  static async generateAdmissionNumber(schoolId: string): Promise<string> {
    const supabase = await createSupabaseServerClient();

    const year = new Date().getFullYear();

    // Get count of students enrolled this year
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('enrollment_date', `${year}-01-01`);

    if (error) {
      throw new StudentError(error.message, 'GENERATE_ADMISSION_ERROR', 500);
    }

    const sequence = (count ?? 0) + 1;
    const paddedSequence = sequence.toString().padStart(4, '0');

    return `ADM-${year}-${paddedSequence}`;
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Update student details
   */
  static async updateStudent(
    studentId: string,
    input: UpdateStudentInput,
    user: AuthUser
  ): Promise<StudentWithDetails> {
    const supabase = await createSupabaseServerClient();

    // Verify student exists
    const existing = await this.getStudentById(studentId, user);
    if (!existing) {
      throw new StudentNotFoundError(studentId);
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    if (input.firstName !== undefined) updateData.first_name = input.firstName;
    if (input.lastName !== undefined) updateData.last_name = input.lastName;
    if (input.middleName !== undefined) updateData.middle_name = input.middleName;
    if (input.dateOfBirth !== undefined) updateData.date_of_birth = input.dateOfBirth;
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.currentClassId !== undefined) updateData.current_class_id = input.currentClassId;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.photoUrl !== undefined) updateData.photo_url = input.photoUrl;
    if (input.birthCertificateNo !== undefined)
      updateData.birth_certificate_no = input.birthCertificateNo;
    if (input.nemisNumber !== undefined) updateData.nemis_number = input.nemisNumber;
    if (input.hasSpecialNeeds !== undefined) updateData.has_special_needs = input.hasSpecialNeeds;
    if (input.specialNeedsDetails !== undefined)
      updateData.special_needs_details = input.specialNeedsDetails;
    if (input.medicalInfo !== undefined) updateData.medical_info = input.medicalInfo;

    const { error } = await (supabase.from('students') as any)
      .update(updateData)
      .eq('student_id', studentId);

    if (error) {
      throw new StudentError(error.message, 'UPDATE_ERROR', 500);
    }

    // Fetch updated student
    const updated = await this.getStudentById(studentId, user);
    return updated!;
  }

  /**
   * Transfer student to another class
   */
  static async transferStudent(
    input: TransferStudentInput,
    user: AuthUser
  ): Promise<StudentWithDetails> {
    const supabase = await createSupabaseServerClient();

    // Verify student exists
    const student = await this.getStudentById(input.studentId, user);
    if (!student) {
      throw new StudentNotFoundError(input.studentId);
    }

    // Verify target class exists
    const { data: classData, error: classError } = (await supabase
      .from('classes')
      .select('class_id, school_id, academic_year_id')
      .eq('class_id', input.toClassId)
      .single()) as { data: any | null; error: any };

    if (classError || !classData) {
      throw new StudentError('Invalid target class', 'INVALID_CLASS', 400);
    }

    // Get active term
    const { data: activeTerm } = (await supabase
      .from('terms')
      .select('term_id')
      .eq('school_id', user.schoolId!)
      .eq('is_active', true)
      .single()) as { data: any | null };

    const { error: updateError } = (await supabase
      .from('students')
      .update({
        current_class_id: input.toClassId,
        updated_by: user.id,
      })
      .eq('student_id', input.studentId)) as { error: any };

    if (updateError) {
      throw new StudentError(updateError.message, 'TRANSFER_ERROR', 500);
    }

    // Record in student_classes history
    if (activeTerm) {
      await supabase.from('student_classes').insert({
        school_id: user.schoolId!,
        student_id: input.studentId,
        class_id: input.toClassId,
        academic_year_id: classData.academic_year_id,
        term_id: activeTerm.term_id,
        status: 'active',
      });
    }

    return (await this.getStudentById(input.studentId, user))!;
  }

  /**
   * Bulk promote students to next class
   */
  static async promoteStudents(
    input: PromoteStudentsInput,
    user: AuthUser
  ): Promise<{ promoted: number; failed: string[] }> {
    const supabase = await createSupabaseServerClient();

    const failed: string[] = [];
    let promoted = 0;

    for (const studentId of input.studentIds) {
      try {
        // Update current class
        const { error } = await supabase
          .from('students')
          .update({
            current_class_id: input.toClassId,
            updated_by: user.id,
          })
          .eq('student_id', studentId);

        if (error) {
          failed.push(studentId);
          continue;
        }

        // Record in history
        await supabase.from('student_classes').insert({
          school_id: user.schoolId!,
          student_id: studentId,
          class_id: input.toClassId,
          academic_year_id: input.academicYearId,
          term_id: input.termId,
          status: 'active',
        });

        promoted++;
      } catch (err) {
        failed.push(studentId);
      }
    }

    return { promoted, failed };
  }

  /**
   * Archive/Withdraw student
   */
  static async archiveStudent(
    studentId: string,
    reason: 'withdrawn' | 'transferred' | 'graduated',
    user: AuthUser
  ): Promise<StudentWithDetails> {
    return this.updateStudent(studentId, { status: reason }, user);
  }

  // ═══════════════════════════════════════════════════════════
  // GUARDIAN OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Add guardian to student
   */
  static async addGuardian(
    studentId: string,
    input: CreateGuardianInput,
    user: AuthUser
  ): Promise<StudentGuardian> {
    const supabase = await createSupabaseServerClient();

    let guardianUserId = input.guardianUserId;

    // If no existing user ID, create new user
    if (!guardianUserId && input.email) {
      // Check if user with email exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', input.email)
        .single();

      if (existingUser) {
        guardianUserId = existingUser.user_id;
      } else {
        // Get parent role
        const { data: parentRole } = (await supabase
          .from('roles')
          .select('role_id')
          .eq('name', 'parent')
          .single()) as { data: any | null };

        if (!parentRole) {
          throw new StudentError('Parent role not found', 'ROLE_ERROR', 500);
        }

        // Note: In production, you'd use Supabase Auth to create the user
        // For now, we'll create a user record
        const { data: newUser, error: userError } = (await supabase
          .from('users')
          .insert({
            user_id: crypto.randomUUID(), // Would come from auth.users
            school_id: user.schoolId!,
            role_id: parentRole.role_id,
            email: input.email!,
            first_name: input.firstName!,
            last_name: input.lastName!,
            phone: input.phone,
            status: 'active',
            created_by: user.id,
          })
          .select('user_id')
          .single()) as { data: any; error: any };

        if (userError) {
          throw new StudentError(userError.message, 'CREATE_USER_ERROR', 500);
        }

        guardianUserId = newUser.user_id;
      }
    }

    if (!guardianUserId) {
      throw new StudentError(
        'Guardian user ID or email required',
        'INVALID_INPUT',
        400
      );
    }

    // Get student's school_id
    const { data: student } = (await supabase
      .from('students')
      .select('school_id')
      .eq('student_id', studentId)
      .single()) as { data: any | null };

    if (!student) {
      throw new StudentNotFoundError(studentId);
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from('student_guardians')
      .select('id')
      .eq('student_id', studentId)
      .eq('guardian_user_id', guardianUserId)
      .single();

    if (existingLink) {
      throw new StudentError(
        'Guardian is already linked to this student',
        'DUPLICATE_LINK',
        409
      );
    }

    // If setting as primary, unset other primaries
    if (input.isPrimaryContact) {
      await supabase
        .from('student_guardians')
        .update({ is_primary_contact: false })
        .eq('student_id', studentId);
    }

    // Create link
    const { data, error } = (await supabase
      .from('student_guardians')
      .insert({
        school_id: student.school_id,
        student_id: studentId,
        guardian_user_id: guardianUserId,
        relationship: input.relationship,
        is_primary_contact: input.isPrimaryContact ?? false,
        can_pickup: input.canPickup ?? true,
      })
      .select(
        `
        *,
        guardian:users(user_id, first_name, last_name, email, phone)
      `
      )
      .single()) as { data: any; error: any };

    if (error) {
      throw new StudentError(error.message, 'LINK_ERROR', 500);
    }

    return this.mapToGuardian(data);
  }

  /**
   * Remove guardian from student
   */
  static async removeGuardian(
    studentId: string,
    guardianUserId: string,
    user: AuthUser
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('student_guardians')
      .delete()
      .eq('student_id', studentId)
      .eq('guardian_user_id', guardianUserId);

    if (error) {
      throw new StudentError(error.message, 'UNLINK_ERROR', 500);
    }
  }

  /**
   * Get student's guardians
   */
  static async getStudentGuardians(
    studentId: string,
    user: AuthUser
  ): Promise<StudentGuardian[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_guardians')
      .select(
        `
        *,
        guardian:users(user_id, first_name, last_name, email, phone)
      `
      )
      .eq('student_id', studentId)
      .order('is_primary_contact', { ascending: false });

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    return (data || []).map(this.mapToGuardian);
  }

  // ═══════════════════════════════════════════════════════════
  // HISTORY & SUMMARIES
  // ═══════════════════════════════════════════════════════════

  /**
   * Get student class history
   */
  static async getClassHistory(
    studentId: string,
    user: AuthUser
  ): Promise<StudentClassHistory[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_classes')
      .select(
        `
        *,
        class:classes(name, grade:grades(name)),
        academic_year:academic_years(year),
        term:terms(name)
      `
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    return (data || []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      classId: row.class_id,
      academicYearId: row.academic_year_id,
      termId: row.term_id,
      status: row.status,
      createdAt: row.created_at,
      className: (row as any).class?.name ?? '',
      gradeName: (row as any).class?.grade?.name ?? '',
      academicYear: (row as any).academic_year?.year ?? '',
      termName: (row as any).term?.name ?? '',
    }));
  }

  /**
   * Get student attendance summary
   */
  static async getAttendanceSummary(
    studentId: string,
    termId: string,
    user: AuthUser
  ): Promise<StudentAttendanceSummary> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId)
      .eq('term_id', termId);

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    const records = data || [];
    const totalDays = records.length;
    const presentDays = records.filter((r) => r.status === 'present').length;
    const absentDays = records.filter((r) => r.status === 'absent').length;
    const lateDays = records.filter((r) => r.status === 'late').length;
    const excusedDays = records.filter((r) => r.status === 'excused').length;

    return {
      studentId,
      termId,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      attendanceRate: totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0,
    };
  }

  /**
   * Get student fee summary
   */
  static async getFeeSummary(
    studentId: string,
    academicYearId: string,
    user: AuthUser
  ): Promise<StudentFeeSummary> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_fees')
      .select('amount_due, amount_paid, status')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId);

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    const fees = data || [];
    const totalDue = fees.reduce((sum, f) => sum + Number(f.amount_due), 0);
    const totalPaid = fees.reduce((sum, f) => sum + Number(f.amount_paid), 0);
    const balance = totalDue - totalPaid;

    let status: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
    if (balance <= 0) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    } else if (fees.some((f) => f.status === 'overdue')) {
      status = 'overdue';
    }

    return {
      studentId,
      academicYearId,
      totalDue,
      totalPaid,
      balance,
      status,
    };
  }

  /**
   * Get student performance summary
   */
  static async getPerformanceSummary(
    studentId: string,
    termId: string,
    academicYearId: string,
    user: AuthUser
  ): Promise<StudentPerformanceSummary> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('assessment_aggregates')
      .select(
        `
        *,
        learning_area:learning_areas(learning_area_id, name)
      `
      )
      .eq('student_id', studentId)
      .eq('term_id', termId)
      .eq('academic_year_id', academicYearId);

    if (error) {
      throw new StudentError(error.message, 'FETCH_ERROR', 500);
    }

    const aggregates = data || [];
    const learningAreas = aggregates.map((agg) => ({
      learningAreaId: agg.learning_area_id,
      name: (agg as any).learning_area?.name ?? '',
      averageScore: Number(agg.average_score),
      level: agg.overall_level ?? 'below_expectation',
    }));

    const totalScores = aggregates.reduce((sum, a) => sum + Number(a.average_score), 0);
    const overallAverage = aggregates.length > 0 ? totalScores / aggregates.length : 0;

    let overallLevel: StudentPerformanceSummary['overallLevel'] = 'below_expectation';
    if (overallAverage >= 3.5) overallLevel = 'exceeding';
    else if (overallAverage >= 2.5) overallLevel = 'meeting';
    else if (overallAverage >= 1.5) overallLevel = 'approaching';

    return {
      studentId,
      termId,
      academicYearId,
      overallAverage,
      overallLevel,
      learningAreas,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // BULK IMPORT
  // ═══════════════════════════════════════════════════════════

  /**
   * Bulk import students from parsed data
   */
  static async bulkImport(
    rows: StudentImportRow[],
    classId: string,
    user: AuthUser
  ): Promise<StudentImportResult> {
    const errors: StudentImportResult['errors'] = [];
    const createdStudents: string[] = [];

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.firstName) {
          errors.push({ rowNumber: row.rowNumber, field: 'firstName', message: 'Required' });
          continue;
        }
        if (!row.lastName) {
          errors.push({ rowNumber: row.rowNumber, field: 'lastName', message: 'Required' });
          continue;
        }
        if (!row.dateOfBirth) {
          errors.push({ rowNumber: row.rowNumber, field: 'dateOfBirth', message: 'Required' });
          continue;
        }
        if (!row.gender || !['male', 'female', 'other'].includes(row.gender.toLowerCase())) {
          errors.push({ rowNumber: row.rowNumber, field: 'gender', message: 'Invalid value' });
          continue;
        }

        const input: CreateStudentInput = {
          firstName: row.firstName,
          lastName: row.lastName,
          middleName: row.middleName,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender.toLowerCase() as 'male' | 'female' | 'other',
          admissionNumber: row.admissionNumber,
          classId,
        };

        // Add guardian if provided
        if (row.guardianName && row.guardianPhone) {
          const nameParts = row.guardianName.split(' ');
          input.guardians = [
            {
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(' ') || nameParts[0],
              phone: row.guardianPhone,
              email: row.guardianEmail,
              relationship: (row.guardianRelationship as any) || 'guardian',
              isPrimaryContact: true,
            },
          ];
        }

        const student = await this.createStudent(input, user);
        createdStudents.push(student.studentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ rowNumber: row.rowNumber, field: 'general', message });
      }
    }

    return {
      success: errors.length === 0,
      totalRows: rows.length,
      successCount: createdStudents.length,
      errorCount: errors.length,
      errors,
      createdStudents,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════

  private static async getStudentFeeBalance(
    studentId: string,
    user: AuthUser
  ): Promise<number> {
    try {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase
        .from('student_fees')
        .select('amount_due, amount_paid')
        .eq('student_id', studentId);

      if (!data || data.length === 0) return 0;

      return data.reduce(
        (sum, fee) => sum + (Number(fee.amount_due) - Number(fee.amount_paid)),
        0
      );
    } catch {
      return 0;
    }
  }

  private static async getStudentAttendanceRate(
    studentId: string,
    user: AuthUser
  ): Promise<number | null> {
    try {
      const supabase = await createSupabaseServerClient();

      // Get active term
      const { data: activeTerm } = await supabase
        .from('terms')
        .select('term_id')
        .eq('is_active', true)
        .single();

      if (!activeTerm) return null;

      const { data } = (await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId)
        .eq('term_id', activeTerm.term_id)) as { data: any[] | null };

      if (!data || data.length === 0) return null;

      const present = data.filter(
        (r) => r.status === 'present' || r.status === 'late'
      ).length;

      return (present / data.length) * 100;
    } catch {
      return null;
    }
  }

  private static mapSortColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      admissionNumber: 'admission_number',
      dateOfBirth: 'date_of_birth',
      enrollmentDate: 'enrollment_date',
      status: 'status',
      createdAt: 'created_at',
    };
    return columnMap[sortBy] || 'first_name';
  }

  private static mapToStudentWithDetails(
    row: any,
    feeBalance: number,
    attendanceRate: number | null
  ): StudentWithDetails {
    const student = mapRowToStudent(row);

    return {
      ...student,
      fullName: getFullName(student),
      age: calculateAge(student.dateOfBirth),
      currentClass: row.current_class
        ? {
            classId: row.current_class.class_id,
            name: row.current_class.name,
            gradeName: row.current_class.grade?.name ?? '',
            stream: row.current_class.stream,
          }
        : null,
      guardians: (row.guardians || []).map(this.mapToGuardian),
      feeBalance,
      attendanceRate,
    };
  }

  private static mapToGuardian(row: any): StudentGuardian {
    return {
      id: row.id,
      studentId: row.student_id,
      guardianUserId: row.guardian_user_id,
      relationship: row.relationship,
      isPrimaryContact: row.is_primary_contact,
      canPickup: row.can_pickup,
      createdAt: row.created_at,
      guardian: row.guardian
        ? {
            userId: row.guardian.user_id,
            firstName: row.guardian.first_name,
            lastName: row.guardian.last_name,
            email: row.guardian.email,
            phone: row.guardian.phone,
          }
        : null,
    };
  }
}

// ─── Export Service Instance ─────────────────────────────────
export const studentsService = {
  // Read
  getStudentById: StudentsService.getStudentById.bind(StudentsService),
  getStudents: StudentsService.getStudents.bind(StudentsService),
  getStudentsByClass: StudentsService.getStudentsByClass.bind(StudentsService),
  getStudentStats: StudentsService.getStudentStats.bind(StudentsService),

  // Create
  createStudent: StudentsService.createStudent.bind(StudentsService),
  generateAdmissionNumber: StudentsService.generateAdmissionNumber.bind(StudentsService),

  // Update
  updateStudent: StudentsService.updateStudent.bind(StudentsService),
  transferStudent: StudentsService.transferStudent.bind(StudentsService),
  promoteStudents: StudentsService.promoteStudents.bind(StudentsService),
  archiveStudent: StudentsService.archiveStudent.bind(StudentsService),

  // Guardians
  addGuardian: StudentsService.addGuardian.bind(StudentsService),
  removeGuardian: StudentsService.removeGuardian.bind(StudentsService),
  getStudentGuardians: StudentsService.getStudentGuardians.bind(StudentsService),

  // History & Summaries
  getClassHistory: StudentsService.getClassHistory.bind(StudentsService),
  getAttendanceSummary: StudentsService.getAttendanceSummary.bind(StudentsService),
  getFeeSummary: StudentsService.getFeeSummary.bind(StudentsService),
  getPerformanceSummary: StudentsService.getPerformanceSummary.bind(StudentsService),

  // Bulk
  bulkImport: StudentsService.bulkImport.bind(StudentsService),
};