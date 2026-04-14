import { AlertCircle, Plus, X } from '@/shared/ui/InlineIcons'
export interface SupermarketLowStockItem {
  id: number
  name: string
  currentStock: number
  threshold: number
  unit?: string
}
interface LowStockModalProps {
  isOpen: boolean
  onClose: () => void
  items: SupermarketLowStockItem[]
  isLoading: boolean
  openRequestItemIds?: number[]
  onAddToForm: (item: SupermarketLowStockItem) => void
  onDismissItem: (itemId: number) => void
}
export function LowStockModal({
  isOpen,
  onClose,
  items,
  isLoading,
  openRequestItemIds = [],
  onAddToForm,
  onDismissItem,
}: LowStockModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20">
      <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
          <h2 className="text-[24px] font-bold" style={{ color: '#EF4444' }}>
            Low stock items
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 transition-colors hover:bg-gray-100"
            style={{ color: '#6B7280' }}
          >
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[500px] space-y-3 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="py-8 text-center text-[14px]" style={{ color: '#6B7280' }}>
              Loading low stock items...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="py-8 text-center text-[14px]" style={{ color: '#6B7280' }}>
              No low stock items right now.
            </div>
          )}
          {!isLoading &&
            items.map((item) => (
              <div key={item.id}>
                {openRequestItemIds.includes(item.id) ? (
                  <div className="mb-2 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[13px] text-[#92400E]">
                    A restock request for this item is already open.
                  </div>
                ) : null}
              <div
                className="flex items-center justify-between rounded-lg p-4"
                style={{ backgroundColor: '#F2F4F3' }}
              >
                <div>
                  <h3 className="mb-1 text-[16px] font-medium" style={{ color: '#1A1A1A' }}>
                    {item.name}
                  </h3>
                  <p className="text-[14px]" style={{ color: '#6B7280' }}>
                    Current stock: <span style={{ color: '#EF4444' }}>{item.currentStock}</span>
                    {item.unit ? ` ${item.unit}` : ''} (below {item.threshold}
                    {item.unit ? ` ${item.unit}` : ' units'})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddToForm(item)}
                    className="rounded-md p-2 transition-colors"
                    style={openRequestItemIds.includes(item.id) ? { backgroundColor: '#A3A3A3', color: '#FFFFFF', cursor: 'not-allowed' } : { backgroundColor: '#22C55E', color: '#FFFFFF' }}
                    title={openRequestItemIds.includes(item.id) ? 'This item already has an open restock request' : 'Add this inventory item to the form'}
                    disabled={openRequestItemIds.includes(item.id)}
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissItem(item.id)}
                    className="rounded-md p-2 transition-colors"
                    style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                    title="Hide this item from the current page"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              </div>
            ))}
        </div>
        <div
          className="border-t px-6 py-4"
          style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
        >
          <p className="text-center text-[13px]" style={{ color: '#6B7280' }}>
            Click + to add a linked low-stock item to the request form. Dismiss only hides an item on this page and does not change the database.
          </p>
        </div>
      </div>
    </div>
  )
}
interface LowStockBannerProps {
  items: SupermarketLowStockItem[]
  onViewFullList: () => void
  onDismiss: () => void
}
export function LowStockBanner({ items, onViewFullList, onDismiss }: LowStockBannerProps) {
  if (items.length === 0) return null
  return (
    <div
      className="mb-6 rounded-lg border-2 px-6 py-4"
      style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <AlertCircle size={22} className="shrink-0" style={{ color: '#DC2626' }} />
          <div>
            <h3 className="text-[16px] font-medium" style={{ color: '#DC2626' }}>
              Restock needed: Items running low at your local food bank
            </h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onViewFullList}
            className="rounded-md px-6 py-2.5 text-[15px] font-bold transition-colors"
            style={{ backgroundColor: '#F5A623', color: '#1A1A1A' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = '#D4870A'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = '#F5A623'
            }}
          >
            View Full List
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 text-[15px] font-medium transition-colors hover:underline"
            style={{ color: '#1A1A1A' }}
          >
            Dismiss Alert
          </button>
        </div>
      </div>
    </div>
  )
}

