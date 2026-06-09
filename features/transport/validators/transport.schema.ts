import { z } from 'zod';

export const createVehicleSchema = z.object({
  registrationNumber: z.string().min(1).max(50),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  capacity: z.number().int().min(1).max(100),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(20).optional(),
  status: z.enum(['active', 'maintenance', 'inactive']).default('active'),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const createRouteSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  zone: z.string().max(100).optional(),
  vehicleId: z.string().uuid().optional(),
});

export const assignStudentSchema = z.object({
  studentId: z.string().uuid(),
  routeId: z.string().uuid(),
  pickupPoint: z.string().min(1).max(200),
  dropoffPoint: z.string().min(1).max(200),
  fee: z.number().positive().optional(),
});
