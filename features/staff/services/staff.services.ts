// features/staff/services/staff.service.ts
// ============================================================
// Staff CRUD Service — Server-side Only
// All operations go through Supabase with RLS enforcement
// Handles: Staff CRUD, Leave Management, Subject Assignments
// ============================================================

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from '@/lib/supabase/server';
import { canManageRole } from '@/lib/auth/permissions';
import type { AuthUser } from '@/types/auth';
import type { RoleName } from '@/types/roles';
import type {
  Staff,
  StaffListItem,
  StaffDetail,
  StaffWithUser,
  StaffLeave,
  StaffLeaveWithDetails,
  TeacherSubjectAssignment,
  TeacherSubjectAssignmentWithDetails,
  PaginatedResponse,
} from '../types';
import type {
  CreateStaffInput,
  UpdateStaffInput,
  StaffListFiltersInput,
  CreateLeaveInput,
  UpdateLeaveStatusInput,
  LeaveListFiltersInput,
  CreateAssignmentInput,
} from '../validators/staff.schema';

// ============================================================
// LIST STAFF (paginated, filtered, sorted)
// ============================================================
export async function listStaff(
  filters: StaffListFiltersInput,
  currentUser: AuthUser
): Promise<PaginatedResponse<StaffListItem>> {
  const supabase = await createSupabaseServerClient();

  const {
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    position,
    status,
    contractType,
    schoolId,
  } = filters;
  const offset = (page - 1) * pageSize;

  // Build query with user join
  let query = supabase
    .from('staff')
    .select(
      `
      staff_id,
      user_id,
      tsc_number,
      position,
      employment_date,
      contract_type,
      status,
      created_at,
      users!inner (
        email,
        first_name,
        last_name,
        phone,
        gender,
        roles!inner (
          name
        )
      )
    `,
      { count: 'exact' }
    );

  // School scoping (non-super-admin only sees own school)
  if (currentUser.role !== 'super_admin') {
    query = query.eq('school_id', currentUser.schoolId!);
  } else if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  // Filters
  if (search) {
    query = query.or(
      `users.first_name.ilike.%${search}%,users.last_name.ilike.%${search}%,users.email.ilike.%${search}%,tsc_number.ilike.%${search}%`
    );
  }
  if (position) {
    query = query.eq('position', position);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  // Sorting — handle user fields vs staff fields
  const userSortFields = ['first_name', 'last_name'];
  if (userSortFields.includes(sortBy)) {
    query = query.order(sortBy, {
      ascending: sortOrder === 'asc',
      foreignTable: 'users',
    });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  // Pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list staff: ${error.message}`);
  }

  // Map to StaffListItem
  const staff: StaffListItem[] = (data || []).map((row: any) => ({
    staffId: row.staff_id,
    userId: row.user_id,
    firstName: row.users?.first_name,
    lastName: row.users?.last_name,
    email: row.users?.email,
    phone: row.users?.phone,
    gender: row.users?.gender,
    tscNumber: row.tsc_number,
    position: row.position,
    contractType: row.contract_type,
    status: row.status,
    employmentDate: row.employment_date,
    roleName: row.users?.roles?.name,
    createdAt: row.created_at,
  }));

  const total = count || 0;

  return {
    data: staff,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET SINGLE STAFF BY ID
// ============================================================
export async function getStaffById(
  staffId: string,
  currentUser: AuthUser
): Promise<StaffWithUser | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      staff_id,
      school_id,
      user_id,
      tsc_number,
      position,
      employment_date,
      contract_type,
      qualification,
      status,
      created_at,
      updated_at,
      created_by,
      users!inner (
        email,
        first_name,
        last_name,
        middle_name,
        phone,
        gender,
        roles!inner (
          name
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .single();

  if (error || !data) return null;

  // School scoping check (defense in depth)
  if (
    currentUser.role !== 'super_admin' &&
    data.school_id !== currentUser.schoolId
  ) {
    return null;
  }

  return {
    staffId: data.staff_id,
    schoolId: data.school_id,
    userId: data.user_id,
    tscNumber: data.tsc_number,
    position: data.position,
    employmentDate: data.employment_date,
    contractType: data.contract_type,
    qualification: data.qualification,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    email: (data.users as any)?.email,
    firstName: (data.users as any)?.first_name,
    lastName: (data.users as any)?.last_name,
    middleName: (data.users as any)?.middle_name,
    phone: (data.users as any)?.phone,
    gender: (data.users as any)?.gender,
    roleName: (data.users as any)?.roles?.name,
  };
}

// ============================================================
// GET STAFF DETAIL (with profile and summary counts)
// ============================================================
export async function getStaffDetail(
  staffId: string,
  currentUser: AuthUser
): Promise<StaffDetail | null> {
  const supabase = await createSupabaseServerClient();

  // Get staff with user and profile
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      staff_id,
      school_id,
      user_id,
      tsc_number,
      position,
      employment_date,
      contract_type,
      qualification,
      status,
      created_at,
      updated_at,
      created_by,
      users!inner (
        email,
        first_name,
        last_name,
        middle_name,
        phone,
        gender,
        roles!inner (
          name
        ),
        user_profiles (
          photo_url,
          date_of_birth,
          national_id,
          address,
          emergency_contact_name,
          emergency_contact_phone
        )
      )
    `
    )
    .eq('staff_id', staffId)
    .single();

  if (error || !data) return null;

  // School scoping check
  if (
    currentUser.role !== 'super_admin' &&
    data.school_id !== currentUser.schoolId
  ) {
    return null;
  }

  // Count active leaves
  const { count: activeLeaves } = await supabase
    .from('staff_leaves')
    .select('leave_id', { count: 'exact', head: true })
    .eq('staff_id', staffId)
    .eq('status', 'approved')
    .gte('end_date', new Date().toISOString().split('T')[0]);

  // Count subject assignments
  const { count: subjectAssignments } = await supabase
    .from('teacher_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', staffId)
    .eq('is_active', true);

  const user = data.users as any;
  const profile = user?.user_profiles?.[0] || {};

  return {
    staffId: data.staff_id,
    schoolId: data.school_id,
    userId: data.user_id,
    tscNumber: data.tsc_number,
    position: data.position,
    employmentDate: data.employment_date,
    contractType: data.contract_type,
    qualification: data.qualification,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    email: user?.email,
    firstName: user?.first_name,
    lastName: user?.last_name,
    middleName: user?.middle_name,
    phone: user?.phone,
    gender: user?.gender,
    roleName: user?.roles?.name,
    photoUrl: profile.photo_url,
    dateOfBirth: profile.date_of_birth,
    nationalId: profile.national_id,
    address: profile.address,
    emergencyContactName: profile.emergency_contact_name,
    emergencyContactPhone: profile.emergency_contact_phone,
    activeLeaves: activeLeaves || 0,
    subjectAssignments: subjectAssignments || 0,
  };
}

// ============================================================
// CREATE STAFF (creates user + staff record)
// ============================================================
export async function createStaff(
  payload: CreateStaffInput,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string; staffId?: string }> {
  // Step 1: Validate role assignment (escalation prevention)
  const targetRoleName = await getRoleNameById(payload.roleId);
  if (!targetRoleName) {
    return { success: false, message: 'Invalid role specified.' };
  }

  // Only allow staff-eligible roles
  const staffRoles: RoleName[] = [
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'subject_teacher',
    'finance_officer',
    'bursar',
    'librarian',
    'ict_admin',
  ];

  if (!staffRoles.includes(targetRoleName)) {
    return {
      success: false,
      message: 'Selected role is not valid for staff members.',
    };
  }

  if (!canManageRole(currentUser.role, targetRoleName)) {
    return {
      success: false,
      message: 'Cannot create staff with a role equal to or higher than your own.',
    };
  }

  const schoolId = currentUser.schoolId!;

  // Step 2: School scoping check
  if (currentUser.role !== 'super_admin' && !schoolId) {
    return {
      success: false,
      message: 'School context required to create staff.',
    };
  }

  const adminClient = await createSupabaseAdminClient();

  // Step 3: Check duplicate email
  const { data: existingUser } = await adminClient
    .from('users')
    .select('user_id')
    .eq('email', payload.email)
    .maybeSingle();

  if (existingUser) {
    return {
      success: false,
      message: 'A user with this email already exists.',
    };
  }

  // Step 4: Check duplicate TSC number (if provided)
  if (payload.tscNumber) {
    const { data: existingTsc } = await adminClient
      .from('staff')
      .select('staff_id')
      .eq('school_id', schoolId)
      .eq('tsc_number', payload.tscNumber)
      .maybeSingle();

    if (existingTsc) {
      return {
        success: false,
        message: 'A staff member with this TSC number already exists.',
      };
    }
  }

  // Step 5: Create Supabase auth user
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: false,
      user_metadata: {
        first_name: payload.firstName,
        last_name: payload.lastName,
      },
    });

  if (authError || !authData.user) {
    return {
      success: false,
      message: `Auth creation failed: ${authError?.message || 'Unknown error'}`,
    };
  }

  const userId = authData.user.id;

  // Step 6: Create users table record
  const { error: userInsertError } = await adminClient.from('users').insert({
    user_id: userId,
    school_id: schoolId,
    role_id: payload.roleId,
    email: payload.email,
    first_name: payload.firstName,
    last_name: payload.lastName,
    middle_name: payload.middleName || null,
    phone: payload.phone || null,
    gender: payload.gender || null,
    status: 'active',
    email_verified: false,
    created_by: currentUser.id,
  });

  if (userInsertError) {
    // Rollback auth user
    await adminClient.auth.admin.deleteUser(userId);
    return {
      success: false,
      message: `User creation failed: ${userInsertError.message}`,
    };
  }

  // Step 7: Create user_profiles record
  await adminClient.from('user_profiles').insert({
    user_id: userId,
    school_id: schoolId,
  });

  // Step 8: Create staff record
  const { data: staffData, error: staffInsertError } = await adminClient
    .from('staff')
    .insert({
      school_id: schoolId,
      user_id: userId,
      tsc_number: payload.tscNumber || null,
      position: payload.position,
      employment_date: payload.employmentDate || null,
      contract_type: payload.contractType || null,
      qualification: payload.qualification || null,
      status: 'active',
      created_by: currentUser.id,
    })
    .select('staff_id')
    .single();

  if (staffInsertError || !staffData) {
    // Rollback user and auth
    await adminClient.from('user_profiles').delete().eq('user_id', userId);
    await adminClient.from('users').delete().eq('user_id', userId);
    await adminClient.auth.admin.deleteUser(userId);
    return {
      success: false,
      message: `Staff creation failed: ${staffInsertError?.message || 'Unknown error'}`,
    };
  }

  return {
    success: true,
    message: 'Staff member created successfully.',
    staffId: staffData.staff_id,
  };
}

// ============================================================
// UPDATE STAFF
// ============================================================
export async function updateStaff(
  staffId: string,
  payload: UpdateStaffInput,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Get existing staff record
  const existingStaff = await getStaffById(staffId, currentUser);
  if (!existingStaff) {
    return { success: false, message: 'Staff member not found.' };
  }

  // Check if user can manage this staff member's role
  if (!canManageRole(currentUser.role, existingStaff.roleName as RoleName)) {
    return {
      success: false,
      message: 'Cannot modify a staff member with a role equal to or higher than your own.',
    };
  }

  // Role change validation
  if (payload.roleId) {
    const newRoleName = await getRoleNameById(payload.roleId);
    if (!newRoleName) {
      return { success: false, message: 'Invalid role specified.' };
    }
    if (!canManageRole(currentUser.role, newRoleName)) {
      return {
        success: false,
        message: 'Cannot assign a role equal to or higher than your own.',
      };
    }
  }

  // Check duplicate TSC number (if changing)
  if (payload.tscNumber && payload.tscNumber !== existingStaff.tscNumber) {
    const { data: existingTsc } = await supabase
      .from('staff')
      .select('staff_id')
      .eq('school_id', existingStaff.schoolId)
      .eq('tsc_number', payload.tscNumber)
      .neq('staff_id', staffId)
      .maybeSingle();

    if (existingTsc) {
      return {
        success: false,
        message: 'A staff member with this TSC number already exists.',
      };
    }
  }

  // Build user update object
  const userUpdate: Record<string, any> = {
    updated_by: currentUser.id,
  };

  if (payload.firstName !== undefined) userUpdate.first_name = payload.firstName;
  if (payload.lastName !== undefined) userUpdate.last_name = payload.lastName;
  if (payload.middleName !== undefined) userUpdate.middle_name = payload.middleName;
  if (payload.phone !== undefined) userUpdate.phone = payload.phone;
  if (payload.gender !== undefined) userUpdate.gender = payload.gender;
  if (payload.roleId !== undefined) userUpdate.role_id = payload.roleId;

  // Update users table if needed
  if (Object.keys(userUpdate).length > 1) {
    const { error: userError } = await supabase
      .from('users')
      .update(userUpdate)
      .eq('user_id', existingStaff.userId);

    if (userError) {
      return { success: false, message: `User update failed: ${userError.message}` };
    }
  }

  // Build staff update object
  const staffUpdate: Record<string, any> = {};

  if (payload.tscNumber !== undefined) staffUpdate.tsc_number = payload.tscNumber;
  if (payload.position !== undefined) staffUpdate.position = payload.position;
  if (payload.employmentDate !== undefined) staffUpdate.employment_date = payload.employmentDate;
  if (payload.contractType !== undefined) staffUpdate.contract_type = payload.contractType;
  if (payload.qualification !== undefined) staffUpdate.qualification = payload.qualification;
  if (payload.status !== undefined) staffUpdate.status = payload.status;

  // Update staff table if needed
  if (Object.keys(staffUpdate).length > 0) {
    const { error: staffError } = await supabase
      .from('staff')
      .update(staffUpdate)
      .eq('staff_id', staffId);

    if (staffError) {
      return { success: false, message: `Staff update failed: ${staffError.message}` };
    }
  }

  return { success: true, message: 'Staff member updated successfully.' };
}

// ============================================================
// DEACTIVATE STAFF (soft delete)
// ============================================================
export async function deactivateStaff(
  staffId: string,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Get existing staff record
  const existingStaff = await getStaffById(staffId, currentUser);
  if (!existingStaff) {
    return { success: false, message: 'Staff member not found.' };
  }

  // Cannot deactivate self
  if (existingStaff.userId === currentUser.id) {
    return {
      success: false,
      message: 'You cannot deactivate your own account.',
    };
  }

  // Check if user can manage this staff member's role
  if (!canManageRole(currentUser.role, existingStaff.roleName as RoleName)) {
    return {
      success: false,
      message: 'Cannot deactivate a staff member with a role equal to or higher than your own.',
    };
  }

  // Deactivate staff record
  const { error: staffError } = await supabase
    .from('staff')
    .update({ status: 'inactive' })
    .eq('staff_id', staffId);

  if (staffError) {
    return { success: false, message: `Deactivation failed: ${staffError.message}` };
  }

  // Deactivate user record
  const { error: userError } = await supabase
    .from('users')
    .update({
      status: 'inactive',
      updated_by: currentUser.id,
    })
    .eq('user_id', existingStaff.userId);

  if (userError) {
    return { success: false, message: `User deactivation failed: ${userError.message}` };
  }

  // Deactivate all subject assignments
  await supabase
    .from('teacher_subjects')
    .update({ is_active: false })
    .eq('teacher_id', staffId);

  return { success: true, message: 'Staff member deactivated successfully.' };
}

// ============================================================
// CREATE LEAVE REQUEST
// ============================================================
export async function createLeave(
  staffId: string,
  payload: CreateLeaveInput,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string; leaveId?: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify staff exists and user has access
  const staff = await getStaffById(staffId, currentUser);
  if (!staff) {
    return { success: false, message: 'Staff member not found.' };
  }

  // Self-request or admin request
  const isSelfRequest = staff.userId === currentUser.id;
  const isAdmin = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
  ].includes(currentUser.role);

  if (!isSelfRequest && !isAdmin) {
    return {
      success: false,
      message: 'You can only submit leave requests for yourself.',
    };
  }

  // Check for overlapping approved leaves
  const { data: overlapping } = await supabase
    .from('staff_leaves')
    .select('leave_id')
    .eq('staff_id', staffId)
    .eq('status', 'approved')
    .or(
      `and(start_date.lte.${payload.endDate},end_date.gte.${payload.startDate})`
    )
    .maybeSingle();

  if (overlapping) {
    return {
      success: false,
      message: 'There is already an approved leave overlapping these dates.',
    };
  }

  // Create leave request
  const { data: leave, error } = await supabase
    .from('staff_leaves')
    .insert({
      school_id: staff.schoolId,
      staff_id: staffId,
      leave_type: payload.leaveType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      reason: payload.reason || null,
      status: 'pending',
    })
    .select('leave_id')
    .single();

  if (error || !leave) {
    return {
      success: false,
      message: `Failed to create leave request: ${error?.message || 'Unknown error'}`,
    };
  }

  return {
    success: true,
    message: 'Leave request submitted successfully.',
    leaveId: leave.leave_id,
  };
}

// ============================================================
// UPDATE LEAVE STATUS (approve/reject/cancel)
// ============================================================
export async function updateLeaveStatus(
  leaveId: string,
  payload: UpdateLeaveStatusInput,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Get leave record
  const { data: leave, error: fetchError } = await supabase
    .from('staff_leaves')
    .select('*, staff!inner(user_id, school_id)')
    .eq('leave_id', leaveId)
    .single();

  if (fetchError || !leave) {
    return { success: false, message: 'Leave request not found.' };
  }

  // School scoping check
  if (
    currentUser.role !== 'super_admin' &&
    (leave.staff as any).school_id !== currentUser.schoolId
  ) {
    return { success: false, message: 'Leave request not found.' };
  }

  const isOwnLeave = (leave.staff as any).user_id === currentUser.id;
  const isAdmin = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
  ].includes(currentUser.role);

  // Cancellation can be done by self or admin
  if (payload.status === 'cancelled') {
    if (!isOwnLeave && !isAdmin) {
      return {
        success: false,
        message: 'You can only cancel your own leave requests.',
      };
    }
  } else {
    // Approval/rejection requires admin
    if (!isAdmin) {
      return {
        success: false,
        message: 'Only administrators can approve or reject leave requests.',
      };
    }
  }

  // Cannot change status of already processed leave (except to cancel)
  if (
    leave.status !== 'pending' &&
    !(leave.status === 'approved' && payload.status === 'cancelled')
  ) {
    return {
      success: false,
      message: `Cannot change status of ${leave.status} leave request.`,
    };
  }

  // Update leave status
  const updateData: Record<string, any> = {
    status: payload.status,
  };

  if (payload.status === 'approved' || payload.status === 'rejected') {
    updateData.approved_by = currentUser.id;
    updateData.approved_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('staff_leaves')
    .update(updateData)
    .eq('leave_id', leaveId);

  if (updateError) {
    return {
      success: false,
      message: `Failed to update leave status: ${updateError.message}`,
    };
  }

  const statusVerb =
    payload.status === 'approved'
      ? 'approved'
      : payload.status === 'rejected'
        ? 'rejected'
        : 'cancelled';

  return {
    success: true,
    message: `Leave request ${statusVerb} successfully.`,
  };
}

// ============================================================
// LIST LEAVES (for a staff member or all staff)
// ============================================================
export async function listLeaves(
  filters: LeaveListFiltersInput,
  currentUser: AuthUser
): Promise<PaginatedResponse<StaffLeaveWithDetails>> {
  const supabase = await createSupabaseServerClient();

  const { page, pageSize, staffId, leaveType, status, startDate, endDate } =
    filters;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('staff_leaves')
    .select(
      `
      leave_id,
      school_id,
      staff_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      approved_by,
      approved_at,
      created_at,
      staff!inner (
        users!inner (
          first_name,
          last_name
        )
      ),
      approver:users!staff_leaves_approved_by_fkey (
        first_name,
        last_name
      )
    `,
      { count: 'exact' }
    );

  // School scoping
  if (currentUser.role !== 'super_admin') {
    query = query.eq('school_id', currentUser.schoolId!);
  }

  // Filters
  if (staffId) {
    query = query.eq('staff_id', staffId);
  }
  if (leaveType) {
    query = query.eq('leave_type', leaveType);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (startDate) {
    query = query.gte('start_date', startDate);
  }
  if (endDate) {
    query = query.lte('end_date', endDate);
  }

  // Sorting and pagination
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list leaves: ${error.message}`);
  }

  const leaves: StaffLeaveWithDetails[] = (data || []).map((row: any) => {
    const start = new Date(row.start_date);
    const end = new Date(row.end_date);
    const durationDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const staffUser = row.staff?.users;
    const approverUser = row.approver;

    return {
      leaveId: row.leave_id,
      schoolId: row.school_id,
      staffId: row.staff_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      staffName: staffUser
        ? `${staffUser.first_name} ${staffUser.last_name}`
        : 'Unknown',
      approverName: approverUser
        ? `${approverUser.first_name} ${approverUser.last_name}`
        : null,
      durationDays,
    };
  });

  const total = count || 0;

  return {
    data: leaves,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// CREATE SUBJECT ASSIGNMENT
// ============================================================
export async function createAssignment(
  staffId: string,
  payload: CreateAssignmentInput,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string; assignmentId?: string }> {
  const supabase = await createSupabaseServerClient();

  // Verify staff exists
  const staff = await getStaffById(staffId, currentUser);
  if (!staff) {
    return { success: false, message: 'Staff member not found.' };
  }

  // Only teachers can be assigned subjects
  const teacherPositions = ['class_teacher', 'subject_teacher', 'principal', 'deputy_principal'];
  if (!teacherPositions.includes(staff.position)) {
    return {
      success: false,
      message: 'Only teaching staff can be assigned subjects.',
    };
  }

  // Check for duplicate assignment
  const { data: existing } = await supabase
    .from('teacher_subjects')
    .select('id')
    .eq('teacher_id', staffId)
    .eq('learning_area_id', payload.learningAreaId)
    .eq('class_id', payload.classId)
    .eq('academic_year_id', payload.academicYearId)
    .eq('term_id', payload.termId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: 'This assignment already exists.',
    };
  }

  // Create assignment
  const { data: assignment, error } = await supabase
    .from('teacher_subjects')
    .insert({
      school_id: staff.schoolId,
      teacher_id: staffId,
      learning_area_id: payload.learningAreaId,
      class_id: payload.classId,
      academic_year_id: payload.academicYearId,
      term_id: payload.termId,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !assignment) {
    return {
      success: false,
      message: `Failed to create assignment: ${error?.message || 'Unknown error'}`,
    };
  }

  return {
    success: true,
    message: 'Subject assignment created successfully.',
    assignmentId: assignment.id,
  };
}

// ============================================================
// LIST SUBJECT ASSIGNMENTS (for a teacher)
// ============================================================
export async function listAssignments(
  staffId: string,
  currentUser: AuthUser
): Promise<TeacherSubjectAssignmentWithDetails[]> {
  const supabase = await createSupabaseServerClient();

  // Verify staff exists
  const staff = await getStaffById(staffId, currentUser);
  if (!staff) {
    return [];
  }

  const { data, error } = await supabase
    .from('teacher_subjects')
    .select(
      `
      id,
      school_id,
      teacher_id,
      learning_area_id,
      class_id,
      academic_year_id,
      term_id,
      is_active,
      created_at,
      learning_areas!inner (
        name
      ),
      classes!inner (
        name
      ),
      terms!inner (
        name
      ),
      academic_years!inner (
        year
      ),
      staff!inner (
        users!inner (
          first_name,
          last_name
        )
      )
    `
    )
    .eq('teacher_id', staffId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list assignments: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    teacherId: row.teacher_id,
    learningAreaId: row.learning_area_id,
    classId: row.class_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    teacherName: `${row.staff?.users?.first_name} ${row.staff?.users?.last_name}`,
    learningAreaName: row.learning_areas?.name,
    className: row.classes?.name,
    termName: row.terms?.name,
    academicYear: row.academic_years?.year,
  }));
}

// ============================================================
// DELETE SUBJECT ASSIGNMENT
// ============================================================
export async function deleteAssignment(
  assignmentId: string,
  currentUser: AuthUser
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Get assignment
  const { data: assignment, error: fetchError } = await supabase
    .from('teacher_subjects')
    .select('id, school_id')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    return { success: false, message: 'Assignment not found.' };
  }

  // School scoping check
  if (
    currentUser.role !== 'super_admin' &&
    assignment.school_id !== currentUser.schoolId
  ) {
    return { success: false, message: 'Assignment not found.' };
  }

  // Soft delete (set inactive)
  const { error: updateError } = await supabase
    .from('teacher_subjects')
    .update({ is_active: false })
    .eq('id', assignmentId);

  if (updateError) {
    return {
      success: false,
      message: `Failed to delete assignment: ${updateError.message}`,
    };
  }

  return { success: true, message: 'Assignment removed successfully.' };
}

// ============================================================
// INTERNAL: Get role name by ID
// ============================================================
async function getRoleNameById(roleId: string): Promise<RoleName | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('roles')
    .select('name')
    .eq('role_id', roleId)
    .single();

  if (error || !data) return null;
  return data.name as RoleName;
}