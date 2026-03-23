import type { ModuleName } from '@/types/roles';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  module: ModuleName;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', module: 'dashboard' },
  { label: 'Students', href: '/students', icon: '🎓', module: 'students' },
  { label: 'Staff', href: '/staff', icon: '🏫', module: 'teachers' },
  { label: 'Classes', href: '/classes', icon: '🏫', module: 'classes' },
  { label: 'Academics', href: '/academics', icon: '📚', module: 'academics' },
  { label: 'Assessments', href: '/assessments', icon: '📝', module: 'assessments' },
  { label: 'Exam Bank', href: '/exams', icon: '🗂️', module: 'exams' },
  { label: 'Attendance', href: '/attendance', icon: '✅', module: 'attendance' },
  { label: 'Timetable', href: '/timetable', icon: '🗓️', module: 'timetable' },
  { label: 'Finance', href: '/finance', icon: '💰', module: 'finance' },
  { label: 'Discipline', href: '/discipline', icon: '📋', module: 'compliance' },
  { label: 'Communication', href: '/communication', icon: '💬', module: 'communication' },
  { label: 'Reports', href: '/reports', icon: '📊', module: 'reports' },
  { label: 'Library', href: '/library', icon: '📖', module: 'library' },
  { label: 'Users', href: '/users', icon: '👥', module: 'users' },
  { label: 'Settings', href: '/settings', icon: '⚙️', module: 'settings' },
];

const ROUTE_MODULES: { prefix: string; module: ModuleName }[] = [
  { prefix: '/dashboard', module: 'dashboard' },
  { prefix: '/students', module: 'students' },
  { prefix: '/staff', module: 'teachers' },
  { prefix: '/teachers', module: 'teachers' },
  { prefix: '/classes', module: 'classes' },
  { prefix: '/academics', module: 'academics' },
  { prefix: '/assessments', module: 'assessments' },
  { prefix: '/exams', module: 'exams' },
  { prefix: '/attendance', module: 'attendance' },
  { prefix: '/timetable', module: 'timetable' },
  { prefix: '/finance', module: 'finance' },
  { prefix: '/discipline', module: 'compliance' },
  { prefix: '/communication', module: 'communication' },
  { prefix: '/reports', module: 'reports' },
  { prefix: '/library', module: 'library' },
  { prefix: '/users', module: 'users' },
  { prefix: '/settings', module: 'settings' },
  { prefix: '/analytics', module: 'analytics' },
  { prefix: '/compliance', module: 'compliance' },
];

export function getModuleForPath(pathname: string): ModuleName | null {
  const match = ROUTE_MODULES.find((route) =>
    pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );
  return match?.module ?? null;
}
