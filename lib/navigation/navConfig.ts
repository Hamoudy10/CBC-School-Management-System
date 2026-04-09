import type { ModuleName } from '@/types/roles';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Building2,
  BookOpen,
  ClipboardCheck,
  FileText,
  CheckCircle2,
  CalendarDays,
  Banknote,
  ShieldAlert,
  MessageSquare,
  BarChart3,
  Library,
  UserCog,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module: ModuleName;
  category?: 'core' | 'academic' | 'admin' | 'support';
}

export const NAV_ITEMS: NavItem[] = [
  // Core
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard', category: 'core' },

  // Academic
  { label: 'Students', href: '/students', icon: GraduationCap, module: 'students', category: 'academic' },
  { label: 'Staff', href: '/staff', icon: Users, module: 'teachers', category: 'academic' },
  { label: 'Classes', href: '/classes', icon: Building2, module: 'classes', category: 'academic' },
  { label: 'Academics', href: '/academics', icon: BookOpen, module: 'academics', category: 'academic' },
  { label: 'Assessments', href: '/assessments', icon: ClipboardCheck, module: 'assessments', category: 'academic' },
  { label: 'Exam Bank', href: '/exams', icon: FileText, module: 'exams', category: 'academic' },
  { label: 'Attendance', href: '/attendance', icon: CheckCircle2, module: 'attendance', category: 'academic' },
  { label: 'Timetable', href: '/timetable', icon: CalendarDays, module: 'timetable', category: 'academic' },

  // Admin
  { label: 'Finance', href: '/finance', icon: Banknote, module: 'finance', category: 'admin' },
  { label: 'Discipline', href: '/discipline', icon: ShieldAlert, module: 'compliance', category: 'admin' },
  { label: 'Communication', href: '/communication', icon: MessageSquare, module: 'communication', category: 'admin' },
  { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports', category: 'admin' },

  // Support
  { label: 'Library', href: '/library', icon: Library, module: 'library', category: 'support' },
  { label: 'Users', href: '/users', icon: UserCog, module: 'users', category: 'support' },
  { label: 'Settings', href: '/settings', icon: Settings, module: 'settings', category: 'support' },
];

const CATEGORY_ORDER = ['core', 'academic', 'admin', 'support'] as const;

export function getNavCategories(items: NavItem[]): { label: string; items: NavItem[] }[] {
  const groups = new Map<string, NavItem[]>();

  for (const item of items) {
    const cat = item.category ?? 'support';
    if (!groups.has(cat)) {groups.set(cat, []);}
    groups.get(cat)!.push(item);
  }

  return CATEGORY_ORDER
    .filter((cat) => groups.has(cat))
    .map((cat) => ({
      label: cat === 'core' ? '' : cat.charAt(0).toUpperCase() + cat.slice(1),
      items: groups.get(cat) ?? [],
    }));
}

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
