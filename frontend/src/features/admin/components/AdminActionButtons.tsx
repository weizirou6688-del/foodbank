import { AdminInlineActionButton, AdminInlineActions } from './AdminActionPrimitives'

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
    <AdminInlineActions>
      <AdminInlineActionButton onClick={onEdit}>Edit</AdminInlineActionButton>
      <AdminInlineActionButton onClick={onIn}>In</AdminInlineActionButton>
      <AdminInlineActionButton onClick={onOut} tone="danger">
        Out
      </AdminInlineActionButton>
      {onDelete && (
        <AdminInlineActionButton onClick={onDelete}>
          Delete
        </AdminInlineActionButton>
      )}
    </AdminInlineActions>
  )
}
