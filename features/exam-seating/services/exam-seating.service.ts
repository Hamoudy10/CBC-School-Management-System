import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { ExamRoom, SeatingPlan, SeatingAssignment, SeatingChart } from '../types';
import type { CreateExamRoomInput, GenerateSeatingPlanInput } from '../validators/exam-seating.schema';

export async function listExamRooms(schoolId: string): Promise<ExamRoom[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('exam_rooms')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');
  return (data ?? []).map(mapRoom);
}

export async function createExamRoom(input: CreateExamRoomInput, schoolId: string): Promise<ExamRoom> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('exam_rooms')
    .insert({ school_id: schoolId, name: input.name, capacity: input.capacity, building: input.building || null, floor: input.floor || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRoom(data);
}

export async function deleteExamRoom(roomId: string, schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from('exam_rooms').update({ is_active: false }).eq('room_id', roomId).eq('school_id', schoolId);
}

export async function generateSeatingPlan(input: GenerateSeatingPlanInput, schoolId: string): Promise<SeatingChart> {
  const supabase = await createSupabaseServerClient();

  const { data: examSet } = await supabase
    .from('exam_sets')
    .select('exam_set_id, name, class_id, classes!inner(name)')
    .eq('exam_set_id', input.examSetId)
    .eq('school_id', schoolId)
    .single();

  if (!examSet) throw new Error('Exam set not found');

  const { data: students } = await supabase
    .from('students')
    .select('student_id, first_name, last_name, admission_number')
    .eq('school_id', schoolId)
    .order('first_name');

  if (!students || students.length === 0) throw new Error('No students found');

  const { data: rooms } = await supabase
    .from('exam_rooms')
    .select('*')
    .in('room_id', input.roomIds)
    .eq('school_id', schoolId);

  if (!rooms || rooms.length === 0) throw new Error('No rooms found');

  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
  if (students.length > totalCapacity) throw new Error(`Not enough capacity: ${students.length} students, ${totalCapacity} seats`);

  const shuffled = input.shuffleStudents ? [...students].sort(() => Math.random() - 0.5) : students;

  const { data: plan } = await supabase
    .from('exam_seating_plans')
    .insert({ school_id: schoolId, exam_set_id: input.examSetId })
    .select()
    .single();

  if (!plan) throw new Error('Failed to create seating plan');

  const assignments: any[] = [];
  let studentIdx = 0;

  const roomsWithLayout = rooms.map((room) => {
    const columns = Math.min(input.seatsPerRow, room.capacity);
    const rows = Math.ceil(room.capacity / columns);

    for (let row = 0; row < rows && studentIdx < students.length; row++) {
      for (let col = 0; col < columns && studentIdx < students.length; col++) {
        const student = shuffled[studentIdx++];
        assignments.push({
          plan_id: plan.plan_id,
          student_id: student.student_id,
          room_id: room.room_id,
          seat_number: row * columns + col + 1,
          row_number: row + 1,
          column_number: col + 1,
        });
      }
    }

    return { room: mapRoom(room), columns, rows, assignments: [] };
  });

  if (assignments.length > 0) {
    const { error: insertError } = await supabase.from('exam_seating_assignments').insert(assignments);
    if (insertError) throw new Error(insertError.message);
  }

  const planSeating: SeatingChart = {
    plan: {
      planId: plan.plan_id,
      schoolId: plan.school_id,
      examSetId: plan.exam_set_id,
      examSetName: examSet.name,
      className: (examSet as any).classes?.name,
      totalStudents: students.length,
      totalRooms: rooms.length,
      createdAt: plan.created_at,
    },
    rooms: roomsWithLayout.map((rwl) => ({
      room: rwl.room,
      columns: rwl.columns,
      rows: rwl.rows,
      assignments: assignments
        .filter((a) => a.room_id === rwl.room.roomId)
        .map((a) => ({
          assignmentId: '',
          planId: a.plan_id,
          studentId: a.student_id,
          studentName: students.find((s) => s.student_id === a.student_id)
            ? `${students.find((s) => s.student_id === a.student_id)!.first_name} ${students.find((s) => s.student_id === a.student_id)!.last_name}`
            : 'Unknown',
          admissionNumber: students.find((s) => s.student_id === a.student_id)?.admission_number ?? '',
          roomId: a.room_id,
          roomName: rwl.room.name,
          seatNumber: a.seat_number,
          rowNumber: a.row_number,
          columnNumber: a.column_number,
        })),
    })),
    unassigned: [],
  };

  return planSeating;
}

export async function getSeatingPlan(planId: string, schoolId: string): Promise<SeatingChart | null> {
  const supabase = await createSupabaseServerClient();

  const { data: plan } = await supabase
    .from('exam_seating_plans')
    .select('*, exam_sets!inner(name, classes!inner(name))')
    .eq('plan_id', planId)
    .eq('school_id', schoolId)
    .single();

  if (!plan) return null;

  const { data: assignments } = await supabase
    .from('exam_seating_assignments')
    .select('*, students!inner(first_name, last_name, admission_number), exam_rooms!inner(name)')
    .eq('plan_id', planId);

  const { data: rooms } = await supabase
    .from('exam_rooms')
    .select('*')
    .eq('school_id', schoolId);

  const roomsWithAssignments = (rooms ?? []).map((room) => {
    const roomAssignments = (assignments ?? []).filter((a) => a.room_id === room.room_id);
    const maxSeat = roomAssignments.reduce((max, a) => Math.max(max, a.seat_number ?? 0), 0);
    const columns = Math.min(4, room.capacity);
    const rows = Math.ceil(room.capacity / columns);

    return {
      room: mapRoom(room),
      columns,
      rows,
      assignments: roomAssignments.map((a) => ({
        assignmentId: a.assignment_id,
        planId: a.plan_id,
        studentId: a.student_id,
        studentName: `${(a.students as any).first_name} ${(a.students as any).last_name}`,
        admissionNumber: (a.students as any).admission_number,
        roomId: a.room_id,
        roomName: (a.exam_rooms as any).name,
        seatNumber: a.seat_number,
        rowNumber: a.row_number,
        columnNumber: a.column_number,
      })),
    };
  });

  return {
    plan: {
      planId: plan.plan_id,
      schoolId: plan.school_id,
      examSetId: plan.exam_set_id,
      examSetName: (plan.exam_sets as any).name,
      className: (plan.exam_sets as any).classes?.name,
      totalStudents: assignments?.length ?? 0,
      totalRooms: roomsWithAssignments.length,
      createdAt: plan.created_at,
    },
    rooms: roomsWithAssignments,
    unassigned: [],
  };
}

function mapRoom(row: any): ExamRoom {
  return {
    roomId: row.room_id,
    schoolId: row.school_id,
    name: row.name,
    capacity: row.capacity,
    building: row.building ?? null,
    floor: row.floor ?? null,
    isActive: row.is_active ?? true,
  };
}
