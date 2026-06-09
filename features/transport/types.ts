export interface TransportVehicle {
  vehicleId: string;
  schoolId: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  capacity: number;
  driverName: string | null;
  driverPhone: string | null;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface TransportRoute {
  routeId: string;
  schoolId: string;
  name: string;
  description: string | null;
  zone: string | null;
  vehicleId: string | null;
  vehicleName?: string;
  isActive: boolean;
}

export interface TransportAssignment {
  assignmentId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  className?: string;
  routeId: string;
  routeName?: string;
  pickupPoint: string;
  dropoffPoint: string;
  fee: number | null;
  isActive: boolean;
}
