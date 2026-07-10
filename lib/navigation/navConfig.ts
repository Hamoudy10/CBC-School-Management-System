import type { ModuleName, RoleName } from '@/types/roles';
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
  LineChart,
  Library,
  UserCog,
  Settings,
  Sparkles,
  Brain,
  LayoutGrid,
  Bus,
  Package,
  FolderOpen,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module: ModuleName;
  category?: 'core' | 'academic' | 'admin' | 'support';
  roles?: RoleName[];
}

const SYS = ["super_admin", "school_admin"] as RoleName[];
const LEAD = ["principal", "deputy_principal"] as RoleName[];
const TEACH = ["teacher", "class_teacher", "subject_teacher"] as RoleName[];
const FIN = ["finance_officer", "bursar"] as RoleName[];
const PARENT = ["parent"] as RoleName[];
const STUDENT = ["student"] as RoleName[];
const LIB = ["librarian"] as RoleName[];
const ICT = ["ict_admin"] as RoleName[];

export const NAV_ITEMS: NavItem[] = [
  // Core — everyone sees Dashboard
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard', category: 'core' },

  // Academic
  { label: 'Students', href: '/students', icon: GraduationCap, module: 'students', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH, ...FIN, ...LIB, ...ICT] },
  { label: 'Staff', href: '/staff', icon: Users, module: 'teachers', category: 'academic', roles: [...SYS, ...LEAD, ...ICT] },
  { label: 'Classes', href: '/classes', icon: Building2, module: 'classes', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH, ...ICT] },
  { label: 'Academics', href: '/academics', icon: BookOpen, module: 'academics', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'CBC Copilot', href: '/cbc-copilot', icon: Sparkles, module: 'academics', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Teacher AI', href: '/teacher-ai', icon: Brain, module: 'assessments', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'AI Grading', href: '/ai-tools/grading', icon: ClipboardCheck, module: 'assessments', category: 'academic', roles: [...SYS, ...TEACH] },
  { label: 'AI Lesson Planner', href: '/ai-tools/lesson-planner', icon: BookOpen, module: 'academics', category: 'academic', roles: [...SYS, ...TEACH] },
  { label: 'Assessments', href: '/assessments', icon: ClipboardCheck, module: 'assessments', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Portfolio', href: '/assessments/portfolio', icon: FolderOpen, module: 'assessments', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Extracurricular', href: '/extracurricular', icon: Trophy, module: 'academics', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Exam Bank', href: '/exams', icon: FileText, module: 'exams', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH, ...ICT] },
  { label: 'Exam Seating', href: '/exams/seating', icon: LayoutGrid, module: 'exams', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH, ...ICT] },
  { label: 'Transport', href: '/transport', icon: Bus, module: 'timetable', category: 'support', roles: [...SYS, ...LEAD, ...TEACH, ...PARENT, ...STUDENT] },
  { label: 'Inventory', href: '/inventory', icon: Package, module: 'library', category: 'support', roles: [...SYS, ...LIB] },
  { label: 'Attendance', href: '/attendance', icon: CheckCircle2, module: 'attendance', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Timetable', href: '/timetable', icon: CalendarDays, module: 'timetable', category: 'academic', roles: [...SYS, ...LEAD, ...TEACH, ...PARENT, ...STUDENT] },

  // Admin
  { label: 'Finance', href: '/finance', icon: Banknote, module: 'finance', category: 'admin', roles: [...SYS, ...LEAD, ...FIN] },
  { label: 'Fee Structures', href: '/finance/fee-structures', icon: FileText, module: 'finance', category: 'admin', roles: [...SYS, ...FIN] },
  { label: 'Admissions', href: '/admissions', icon: Users, module: 'students', category: 'admin', roles: [...SYS, ...LEAD] },
  { label: 'Discipline', href: '/discipline', icon: ShieldAlert, module: 'compliance', category: 'admin', roles: [...SYS, ...LEAD, ...TEACH] },
  { label: 'Communication', href: '/communication', icon: MessageSquare, module: 'communication', category: 'admin', roles: [...SYS, ...LEAD, ...TEACH, ...FIN, ...LIB, ...ICT, ...PARENT] },
  { label: 'Parent Portal', href: '/parent', icon: Users, module: 'communication', category: 'core', roles: PARENT },
  { label: 'Parent Engagement', href: '/parent/engagement', icon: MessageSquare, module: 'communication', category: 'core', roles: PARENT },
  { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports', category: 'admin', roles: [...SYS, ...LEAD, ...TEACH, ...FIN, ...PARENT] },
  { label: 'Analytics AI', href: '/analytics', icon: LineChart, module: 'analytics', category: 'admin', roles: [...SYS, ...LEAD, ...TEACH, ...FIN] },
  { label: 'Predictive Analytics', href: '/analytics/predictive', icon: LineChart, module: 'analytics', category: 'admin', roles: [...SYS, ...LEAD] },
  { label: 'AI Data Query', href: '/analytics/nl-query', icon: MessageSquare, module: 'analytics', category: 'admin', roles: [...SYS, ...LEAD, ...TEACH] },

  // Support
  { label: 'Library', href: '/library', icon: Library, module: 'library', category: 'support', roles: [...SYS, ...LIB, ...STUDENT] },
  { label: 'Users', href: '/users', icon: UserCog, module: 'users', category: 'support', roles: [...SYS, ...ICT] },
  { label: 'Settings', href: '/settings', icon: Settings, module: 'settings', category: 'support', roles: [...SYS, ...ICT] },
  { label: 'AI Assistant', href: '/ai-agent', icon: Brain, module: 'dashboard', category: 'core' },
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
  { prefix: '/cbc-copilot', module: 'academics' },
  { prefix: '/teacher-ai', module: 'assessments' },
  { prefix: '/assessments', module: 'assessments' },
  { prefix: '/extracurricular', module: 'academics' },
  { prefix: '/exams', module: 'exams' },
  { prefix: '/transport', module: 'timetable' },
  { prefix: '/inventory', module: 'library' },
  { prefix: '/attendance', module: 'attendance' },
  { prefix: '/timetable', module: 'timetable' },
  { prefix: '/finance', module: 'finance' },
  { prefix: '/admissions', module: 'students' },
  { prefix: '/discipline', module: 'compliance' },
  { prefix: '/parent', module: 'communication' },
  { prefix: '/communication', module: 'communication' },
  { prefix: '/reports', module: 'reports' },
  { prefix: '/library', module: 'library' },
  { prefix: '/users', module: 'users' },
  { prefix: '/settings', module: 'settings' },
  { prefix: '/analytics', module: 'analytics' },
  { prefix: '/ai-tools', module: 'assessments' },
  { prefix: '/compliance', module: 'compliance' },
];

export function getModuleForPath(pathname: string): ModuleName | null {
  const match = ROUTE_MODULES.find((route) =>
    pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );
  return match?.module ?? null;
}
