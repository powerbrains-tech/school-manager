export const ROLES = ['admin', 'teacher', 'staff'] as const

export type UserRole = (typeof ROLES)[number]
export type Permission = 'read' | 'edit' | 'delete'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['read', 'edit', 'delete'],
  teacher: ['read', 'edit'],
  staff: ['read'],
}

export function isUserRole(value: string | undefined | null): value is UserRole {
  return value === 'admin' || value === 'teacher' || value === 'staff'
}

export function hasPermission(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function getPathPermission(pathname: string): Permission | null {
  const routePermissions: Array<{ prefix: string; permission: Permission }> = [
    { prefix: '/dashboard', permission: 'read' },
    { prefix: '/students', permission: 'read' },
    { prefix: '/student', permission: 'read' },
    { prefix: '/scan', permission: 'edit' },
    { prefix: '/class-scan', permission: 'edit' },
    { prefix: '/register', permission: 'edit' },
    { prefix: '/admin', permission: 'edit' },
  ]

  const matched = routePermissions.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  return matched?.permission ?? null
}
