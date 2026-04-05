import type { User } from '@/shared/types/common'

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

function normalizeFoodBankId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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
