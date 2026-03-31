interface AdminActionButtonsProps {
  onEdit?: () => void
  onIn?: () => void
  onOut?: () => void
  onDelete?: () => void
}

export default function AdminActionButtons({
  onEdit,
  onIn,
  onOut,
  onDelete,
}: AdminActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <button onClick={onEdit} className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">Edit</button>
      <button onClick={onIn} className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent">In</button>
      <button onClick={onOut} className="px-3 py-1.5 border-[1.5px] border-[#E63946] text-[#E63946] rounded-full text-xs font-medium hover:bg-[#E63946]/5 bg-transparent">Out</button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="px-3 py-1.5 border-[1.5px] border-[#E8E8E8] rounded-full text-xs font-medium text-[#1A1A1A] hover:bg-gray-50 bg-transparent"
        >
          Delete
        </button>
      )}
    </div>
  )
}
