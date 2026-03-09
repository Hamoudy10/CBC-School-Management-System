export interface DashboardActivityItem {
  id: string;
  type: 'payment' | 'attendance' | 'assessment' | 'enrollment' | 'discipline';
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'warning' | 'error' | 'info';
  amount?: number;
}

export interface DashboardMetrics {
  students: {
    total: number;
    active: number;
    newThisTerm: number;
  };
  staff: {
    total: number;
    teachers: number;
    onLeave: number;
  };
  finance: {
    totalExpected: number;
    totalCollected: number;
    collectionRate: number;
    pendingPayments: number;
  };
  attendance: {
    todayPresent: number;
    todayAbsent: number;
    todayLate: number;
    todayRate: number;
  };
  assessments: {
    totalCompleted: number;
    pendingEntry: number;
    averageScore: number;
  };
  discipline: {
    openCases: number;
    thisMonth: number;
  };
  recentActivity: DashboardActivityItem[];
}

export function createEmptyDashboardMetrics(): DashboardMetrics {
  return {
    students: { total: 0, active: 0, newThisTerm: 0 },
    staff: { total: 0, teachers: 0, onLeave: 0 },
    finance: {
      totalExpected: 0,
      totalCollected: 0,
      collectionRate: 0,
      pendingPayments: 0,
    },
    attendance: {
      todayPresent: 0,
      todayAbsent: 0,
      todayLate: 0,
      todayRate: 0,
    },
    assessments: {
      totalCompleted: 0,
      pendingEntry: 0,
      averageScore: 0,
    },
    discipline: { openCases: 0, thisMonth: 0 },
    recentActivity: [],
  };
}
