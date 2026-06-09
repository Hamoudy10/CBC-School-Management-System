import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { TransportVehicle, TransportRoute, TransportAssignment } from '../types';

export async function listVehicles(schoolId: string): Promise<TransportVehicle[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('transport_vehicles').select('*').eq('school_id', schoolId).order('registration_number');
  return (data ?? []).map((r) => ({
    vehicleId: r.vehicle_id, schoolId: r.school_id, registrationNumber: r.registration_number,
    make: r.make ?? null, model: r.model ?? null, capacity: r.capacity,
    driverName: r.driver_name ?? null, driverPhone: r.driver_phone ?? null, status: r.status,
  }));
}

export async function createVehicle(input: any, schoolId: string): Promise<TransportVehicle> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('transport_vehicles').insert({
    school_id: schoolId, registration_number: input.registrationNumber,
    make: input.make || null, model: input.model || null, capacity: input.capacity,
    driver_name: input.driverName || null, driver_phone: input.driverPhone || null, status: input.status || 'active',
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listVehicles(schoolId)).find((v) => v.vehicleId === data.vehicle_id)!;
}

export async function listRoutes(schoolId: string): Promise<TransportRoute[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('transport_routes').select('*, transport_vehicles!left(registration_number)').eq('school_id', schoolId).eq('is_active', true).order('name');
  return (data ?? []).map((r: any) => ({
    routeId: r.route_id, schoolId: r.school_id, name: r.name, description: r.description ?? null,
    zone: r.zone ?? null, vehicleId: r.vehicle_id ?? null,
    vehicleName: r.transport_vehicles?.registration_number ?? null, isActive: r.is_active,
  }));
}

export async function createRoute(input: any, schoolId: string): Promise<TransportRoute> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('transport_routes').insert({
    school_id: schoolId, name: input.name, description: input.description || null,
    zone: input.zone || null, vehicle_id: input.vehicleId || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return (await listRoutes(schoolId)).find((r) => r.routeId === data.route_id)!;
}

export async function assignStudent(input: any, schoolId: string): Promise<TransportAssignment> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('transport_assignments').insert({
    school_id: schoolId, student_id: input.studentId, route_id: input.routeId,
    pickup_point: input.pickupPoint, dropoff_point: input.dropoffPoint, fee: input.fee || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapAssignment(data);
}

export async function listAssignments(schoolId: string): Promise<TransportAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('transport_assignments')
    .select('*, students!inner(first_name, last_name), transport_routes!inner(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  return (data ?? []).map((r: any) => ({
    ...mapAssignment(r),
    studentName: `${r.students?.first_name ?? ''} ${r.students?.last_name ?? ''}`.trim(),
    routeName: r.transport_routes?.name ?? '',
  }));
}

function mapAssignment(r: any): TransportAssignment {
  return {
    assignmentId: r.assignment_id, schoolId: r.school_id, studentId: r.student_id,
    routeId: r.route_id, pickupPoint: r.pickup_point, dropoffPoint: r.dropoff_point,
    fee: r.fee ?? null, isActive: r.is_active,
  };
}
