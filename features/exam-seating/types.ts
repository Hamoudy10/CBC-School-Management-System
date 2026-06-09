export interface ExamRoom {
  roomId: string;
  schoolId: string;
  name: string;
  capacity: number;
  building: string | null;
  floor: string | null;
  isActive: boolean;
}

export interface SeatingPlan {
  planId: string;
  schoolId: string;
  examSetId: string;
  examSetName?: string;
  className?: string;
  totalStudents: number;
  totalRooms: number;
  createdAt: string;
}

export interface SeatingAssignment {
  assignmentId: string;
  planId: string;
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  roomId: string;
  roomName?: string;
  seatNumber: number;
  rowNumber: number;
  columnNumber: number;
}

export interface SeatingChart {
  plan: SeatingPlan;
  rooms: {
    room: ExamRoom;
    columns: number;
    rows: number;
    assignments: SeatingAssignment[];
  }[];
  unassigned: { studentId: string; studentName: string }[];
}
