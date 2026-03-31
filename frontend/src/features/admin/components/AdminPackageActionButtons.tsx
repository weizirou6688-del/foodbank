interface AdminPackageActionButtonsProps {
  onEdit?: () => void
  onOpenPackTab?: () => void
}

export default function AdminPackageActionButtons({
  onEdit,
  onOpenPackTab,
}: AdminPackageActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <button onClick={onEdit} className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">Edit</button>
      <button onClick={onOpenPackTab} className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">Go to Pack</button>
    </div>
  )
}
