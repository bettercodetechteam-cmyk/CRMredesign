export const MODULE_PERMISSIONS = [
  'dashboard',
  'profile',
  'leads',
  'students',
  'fees',
  'batches',
  'expenses',
  'academics',
  'assets',
  'staff',
  'promotional_offers',
  'blogs',
  'user_approvals',
  'access_management',
  'reports',
  'settings',
  'targets',
  'assignments',
  'courses',
  'tasks',
] as const;

export type ModulePermission = (typeof MODULE_PERMISSIONS)[number];

export const DIRECTOR_EMAILS = [
  'cmzicazima@gmail.com',
  'gauravkarewar724@gmail.com',
  'director@zica.edu',
] as const;

export const EMAIL_ROLE_MIGRATION: Record<string, string> = {
  'cmzicazima@gmail.com': 'director',
  'gauravkarewar724@gmail.com': 'director',
  'director@zica.edu': 'director',
  'ahzicazima@gmail.com': 'academic_head',
  'sfzica@gmail.com': 'faculty',
  'cczicazima@gmail.com': 'accounting',
  'gdzicazima@gmail.com': 'digital_marketing',
  'bdmzica@gmail.com': 'bdm',
};

export const ASSIGNABLE_ROLES = [
  'director',
  'academic_head',
  'faculty',
  'accounting',
  'digital_marketing',
  'bdm',
  'centre_head',
  'marketing',
  'admin',
  'employee',
  'designer',
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const BASE: ModulePermission[] = ['dashboard', 'profile'];

const ALL_MODULES: ModulePermission[] = [
  'dashboard',
  'profile',
  'leads',
  'students',
  'fees',
  'batches',
  'expenses',
  'academics',
  'assets',
  'staff',
  'promotional_offers',
  'blogs',
  'user_approvals',
  'access_management',
  'reports',
  'settings',
  'targets',
  'assignments',
  'courses',
  'tasks',
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, ModulePermission[]> = {
  director: ALL_MODULES,
  academic_head: [...BASE, 'students', 'batches', 'academics', 'staff', 'tasks'],
  faculty: [...BASE, 'students', 'batches', 'academics', 'staff', 'tasks'],
  accounting: [
    ...BASE,
    'leads',
    'students',
    'fees',
    'batches',
    'expenses',
    'assets',
    'staff',
    'tasks',
    'promotional_offers',
  ],
  digital_marketing: [...BASE, 'blogs'],
  bdm: [...BASE, 'leads', 'staff', 'tasks', 'promotional_offers'],
  pending: [],
  centre_head: [...BASE, 'leads', 'students', 'fees', 'batches', 'expenses', 'academics', 'assets', 'staff', 'promotional_offers'],
  marketing: [...BASE, 'leads', 'promotional_offers'],
  admin: [...BASE, 'leads', 'students', 'staff'],
  accountant: [...BASE, 'leads', 'students', 'fees', 'batches', 'expenses', 'assets', 'staff', 'promotional_offers'],
  accounts: [...BASE, 'leads', 'students', 'fees', 'batches', 'expenses', 'assets', 'staff', 'promotional_offers'],
  employee: BASE,
  designer: [...BASE, 'blogs'],
  student: BASE,
};

export const MODULE_LABELS: Record<ModulePermission, string> = {
  dashboard: 'Dashboard',
  profile: 'Profile',
  leads: 'Lead Management',
  students: 'Student Management',
  fees: 'Fee Management / Royalty / GST',
  batches: 'Batches Management',
  expenses: 'Expense Management',
  academics: 'Academic Management',
  assets: 'Assets Management',
  staff: 'Staff Management',
  promotional_offers: 'Promotional Offers',
  blogs: 'Blog Management',
  user_approvals: 'User Approvals',
  access_management: 'Access Management',
  reports: 'Reports',
  settings: 'Settings',
  targets: 'Targets',
  assignments: 'Assignments',
  courses: 'Courses',
  tasks: 'Task Management',
};

export const ROUTE_PERMISSION_MAP: Record<string, ModulePermission> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/leads': 'leads',
  '/students': 'students',
  '/enhanced-fee-management': 'fees',
  '/fee-management': 'fees',
  '/fee-alerts': 'fees',
  '/royalty': 'fees',
  '/receipt': 'fees',
  '/batches': 'batches',
  '/courses': 'courses',
  '/expenses': 'expenses',
  '/academics': 'academics',
  '/academics/fees': 'academics',
  '/academics/zima-fees': 'academics',
  '/academics/zica-management': 'academics',
  '/academics/zima-management': 'academics',
  '/academics/other': 'academics',
  '/academics/certificates': 'academics',
  '/assets': 'assets',
  '/staff': 'staff',
  '/promotional-offers': 'promotional_offers',
  '/blogs': 'blogs',
  '/blogs/new': 'blogs',
  '/user-approvals': 'user_approvals',
  '/access-management': 'access_management',
  '/profile': 'profile',
  '/reports': 'reports',
  '/settings': 'settings',
  '/targets': 'targets',
  '/assignments': 'assignments',
  '/tasks': 'tasks',
  '/performance': 'reports',
};

export function normalizeRole(role?: string | null): string {
  const normalized = (role ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'accounts' || normalized === 'accountant') return 'accounting';
  if (normalized === 'senior_faculty') return 'faculty';
  return normalized;
}

export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function isDirectorEmail(email?: string | null): boolean {
  return DIRECTOR_EMAILS.includes(normalizeEmail(email) as (typeof DIRECTOR_EMAILS)[number]);
}

export function isDirectorRole(role?: string | null): boolean {
  return normalizeRole(role) === 'director';
}

export function getRoleDefaultPermissions(role?: string | null): ModulePermission[] {
  const normalized = normalizeRole(role);
  if (isDirectorRole(normalized)) return [...ALL_MODULES];
  return ROLE_DEFAULT_PERMISSIONS[normalized] ?? BASE;
}

export function resolvePermissions(
  role?: string | null,
  granted: ModulePermission[] = [],
  revoked: ModulePermission[] = []
): ModulePermission[] {
  const defaults = getRoleDefaultPermissions(role);
  const set = new Set<ModulePermission>(defaults);
  for (const perm of granted) set.add(perm);
  for (const perm of revoked) set.delete(perm);
  return MODULE_PERMISSIONS.filter((perm) => set.has(perm));
}

export function canAccess(
  permissions: ModulePermission[],
  module: ModulePermission
): boolean {
  return permissions.includes(module);
}

export function getRoutePermission(pathname: string): ModulePermission | null {
  if (ROUTE_PERMISSION_MAP[pathname]) return ROUTE_PERMISSION_MAP[pathname];
  if (pathname.startsWith('/blogs/edit/')) return 'blogs';
  if (pathname.startsWith('/academics/')) return 'academics';
  if (pathname.startsWith('/tasks/')) return 'tasks';
  return null;
}

export function getMigrationRoleForEmail(email?: string | null): string | null {
  return EMAIL_ROLE_MIGRATION[normalizeEmail(email)] ?? null;
}
