import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './Button'

/** Styled replacement for window.confirm() — destructive actions get a proper
 * glass-themed dialog instead of a jarring native browser popup. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Delete', onConfirm, pending }) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[rise_0.2s_ease-out]" />
        <AlertDialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[20px] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <AlertDialog.Title className="font-display text-lg font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted">{description}</AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant="danger" onClick={onConfirm} disabled={pending}>
              {pending ? 'Deleting…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
