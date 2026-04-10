import { AdminInlineActionButton, AdminInlineActions } from './AdminActionPrimitives'

interface AdminPackageActionButtonsProps {
  onEdit?: () => void
  onOpenPackTab?: () => void
}

export default function AdminPackageActionButtons({
  onEdit,
  onOpenPackTab,
}: AdminPackageActionButtonsProps) {
  return (
    <AdminInlineActions>
      <AdminInlineActionButton onClick={onEdit}>Edit</AdminInlineActionButton>
      <AdminInlineActionButton onClick={onOpenPackTab}>Go to Pack</AdminInlineActionButton>
    </AdminInlineActions>
  )
}
