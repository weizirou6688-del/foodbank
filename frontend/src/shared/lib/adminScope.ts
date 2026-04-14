import type { User } from '@/shared/types/auth'

type AdminScopeKind = 'platform' | 'local' | 'unknown'

export interface AdminScopeMeta {
  scopeKind: AdminScopeKind
  isPlatformAdmin: boolean
  isLocalFoodBankAdmin: boolean
  roleLabel: string
  viewingLabel: string
  foodBankId: number | null
  foodBankName: string | null
}

export interface AdminFoodBankScopeState {
  scopeKey: string
  effectiveFoodBankId: number | null
  hasFixedFoodBank: boolean
  canChooseFoodBank: boolean
  isFoodBankSelectionRequired: boolean
}

function normalizeFoodBankId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function resolveAdminTargetFoodBankId(
  scope: AdminScopeMeta,
  preferredFoodBankId?: number | null,
  fallbackFoodBankId?: number | null,
) {
  return (
    normalizeFoodBankId(preferredFoodBankId)
    ?? scope.foodBankId
    ?? normalizeFoodBankId(fallbackFoodBankId)
  )
}

export function isAdminFoodBankSelectionRequired(
  scope: AdminScopeMeta,
  foodBankId?: number | null,
) {
  return scope.isPlatformAdmin && resolveAdminTargetFoodBankId(scope, foodBankId) == null
}

export function getAdminFoodBankScopeState(
  scope: AdminScopeMeta,
  selectedFoodBankId: number | null,
): AdminFoodBankScopeState {
  const effectiveFoodBankId = resolveAdminTargetFoodBankId(scope, selectedFoodBankId)
  const hasFixedFoodBank = scope.foodBankId != null
  const canChooseFoodBank = scope.isPlatformAdmin && !hasFixedFoodBank

  return {
    scopeKey: `${scope.scopeKind}:${effectiveFoodBankId ?? 'none'}`,
    effectiveFoodBankId,
    hasFixedFoodBank,
    canChooseFoodBank,
    isFoodBankSelectionRequired: canChooseFoodBank && effectiveFoodBankId == null,
  }
}

export function getAdminScopeMeta(user: User | null | undefined): AdminScopeMeta {
  const foodBankId = normalizeFoodBankId(user?.food_bank_id)
  const foodBankName =
    typeof user?.food_bank_name === 'string' && user.food_bank_name.trim()
      ? user.food_bank_name.trim()
      : foodBankId != null
        ? `Food Bank #${foodBankId}`
        : null

  if (user?.role === 'admin' && foodBankId != null) {
    return {
      scopeKind: 'local',
      isPlatformAdmin: false,
      isLocalFoodBankAdmin: true,
      roleLabel: `${foodBankName} Local Admin`,
      viewingLabel: `Viewing: ${foodBankName} only`,
      foodBankId,
      foodBankName,
    }
  }

  if (user?.role === 'admin') {
    return {
      scopeKind: 'platform',
      isPlatformAdmin: true,
      isLocalFoodBankAdmin: false,
      roleLabel: 'Platform Admin',
      viewingLabel: 'Viewing: Platform-wide data',
      foodBankId: null,
      foodBankName: null,
    }
  }

  return {
    scopeKind: 'unknown',
    isPlatformAdmin: false,
    isLocalFoodBankAdmin: false,
    roleLabel: 'Guest',
    viewingLabel: 'Viewing: Role unavailable',
    foodBankId: null,
    foodBankName: null,
  }
}
