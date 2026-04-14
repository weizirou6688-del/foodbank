import { useEffect, useMemo, useState } from 'react'
import { AdminActionGroup, AdminButton } from './chrome'
import { packageDescriptionFallbacks } from './adminFoodManagement.constants'
import {
  AdminSummaryCard,
  ConfigurableAdminCardSection,
  type FoodBankOption,
} from './sectionBits'
import { matchesSearch, normalizeSearch } from './rules'
import type { NameThresholdTarget, PackageRow } from './adminFoodManagement.types'

interface AdminPackagesSectionProps {
  packageRows: PackageRow[]
  isLoadingData: boolean
  onAddPackage: () => void
  onEditPackage: (target: NameThresholdTarget) => void
  onOpenPackTab: (packageId: number) => void
  foodBankOptions?: FoodBankOption[]
  selectedFoodBankId?: number | null
  onFoodBankChange?: (foodBankId: number | null) => void
  searchDisabled?: boolean
  searchPlaceholder?: string
  searchScopeKey?: string
  emptyStateMessage?: string | null
  sectionError?: string
  heading?: string
  addButtonLabel?: string
}

export function AdminPackagesSection({ packageRows, isLoadingData, onAddPackage, onEditPackage, onOpenPackTab, foodBankOptions, selectedFoodBankId, onFoodBankChange, searchDisabled = false, searchPlaceholder = 'Search food packages', searchScopeKey = '', emptyStateMessage = null, sectionError = '', heading = 'Food Package List', addButtonLabel = 'New Package' }: AdminPackagesSectionProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    setSearch('')
  }, [searchScopeKey])

  const filteredPackages = useMemo(() => {
    const needle = normalizeSearch(search)
    return packageRows.filter((pkg) => matchesSearch(needle, pkg.name, pkg.category, ...pkg.contents))
  }, [packageRows, search])

  return (
    <ConfigurableAdminCardSection
      errorMessage={sectionError}
      title={heading}
      search={{ value: search, onChange: setSearch, placeholder: searchPlaceholder, disabled: searchDisabled }}
      toolbarAction={{ id: 'new-package-btn', label: `+ ${addButtonLabel}`, onClick: onAddPackage }}
      filters={foodBankOptions ? [{ type: 'food-bank', id: 'package-food-bank-filter', foodBankOptions, selectedFoodBankId, onFoodBankChange }] : undefined}
      gridId="package-card-grid"
      gridVariant="compact"
      items={emptyStateMessage ? [] : filteredPackages}
      emptyStateTitle={emptyStateMessage ?? (isLoadingData ? 'Loading packages...' : 'No food packages found')}
      emptyStateTone={emptyStateMessage ? 'warning' : 'default'}
      renderCard={(pkg) => (
        <AdminSummaryCard
          key={pkg.key}
          data-package-id={pkg.id}
          title={pkg.name}
          description={
            packageDescriptionFallbacks[pkg.category as keyof typeof packageDescriptionFallbacks] ??
            'Standard food support package.'
          }
          meta={
            <div className="admin-package-meta-row">
              <span>Pack stock: {pkg.stock}</span>
              <span>Threshold: {pkg.threshold}</span>
            </div>
          }
          actions={
            <AdminActionGroup variant="card">
              <AdminButton size="sm" className="packing-btn" onClick={() => onOpenPackTab(pkg.id)}>
                Packing
              </AdminButton>
              <AdminButton
                tone="secondary"
                size="sm"
                className="edit-package-btn"
                onClick={() =>
                  onEditPackage({
                    id: pkg.id,
                    name: pkg.name,
                    threshold: pkg.threshold,
                  })
                }
              >
                Edit
              </AdminButton>
            </AdminActionGroup>
          }
        >
          <div className="admin-package-contents-list">
            {pkg.contents.length > 0 ? (
              pkg.contents.map((content) => {
                const [label, quantityLabel = ''] = content.split(/\s+x/i)
                return (
                  <div key={`${pkg.id}-${content}`} className="admin-package-content-row">
                    <span>{label}</span>
                    <span>{quantityLabel ? `x${quantityLabel}` : ''}</span>
                  </div>
                )
              })
            ) : (
              <div className="admin-summary-card-muted">No contents configured</div>
            )}
          </div>
        </AdminSummaryCard>
      )}
    />
  )
}