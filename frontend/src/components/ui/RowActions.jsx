import { Pencil, Trash2 } from 'lucide-react'
import { IconButton } from './Button'

/** Edit/Delete icon-button pair used on every list page's row (mobile card and
 * desktop table alike). Callers don't need stopPropagation on onEdit/onDelete —
 * these buttons are always rendered as a sibling of the row's own click target,
 * never nested inside it, so there's nothing for the click to bubble into. */
export function RowActions({ onEdit, onDelete, className = 'flex shrink-0 gap-1' }) {
  return (
    <div className={className}>
      <IconButton label="Edit" onClick={onEdit}>
        <Pencil size={14} />
      </IconButton>
      <IconButton label="Delete" onClick={onDelete}>
        <Trash2 size={14} />
      </IconButton>
    </div>
  )
}
