import type { User } from '@/shared/types/auth'

export type RestrictedRole = 'admin' | 'supermarket'
export type AllowedRole = RestrictedRole | RestrictedRole[] | null | undefined

export function getCurrentRestrictedRole(user: User | null | undefined): RestrictedRole | null {
  if (user?.role === 'admin' || user?.role === 'supermarket') {
    return user.role
  }

  return null
}

export function hasAllowedRole(user: User | null | undefined, allowedRole?: AllowedRole): boolean {
  if (!allowedRole) {
    return true
  }

  const currentRole = getCurrentRestrictedRole(user)
  if (!currentRole) {
    return false
  }

  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole]
  return allowedRoles.includes(currentRole)
}

export function getPostLoginRedirect(
  user: User | null | undefined,
  redirectTo?: string | null,
  requiredRole?: AllowedRole,
): string | null {
  if (redirectTo && hasAllowedRole(user, requiredRole)) {
    return redirectTo
  }

  const currentRole = getCurrentRestrictedRole(user)
  if (currentRole === 'admin') {
    return '/admin?section=food'
  }

  if (currentRole === 'supermarket') {
    return '/supermarket'
  }

  return null
}
