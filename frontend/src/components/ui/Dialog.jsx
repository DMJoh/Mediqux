import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export function Dialog({ open, onOpenChange, title, description, children, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[rise_0.2s_ease-out]" />
        <RadixDialog.Content
          className={`glass fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)] ${widths[size]}`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-display text-lg font-bold">{title}</RadixDialog.Title>
              <RadixDialog.Description className={description ? 'mt-1 text-sm text-muted' : 'sr-only'}>
                {description || title}
              </RadixDialog.Description>
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-glass-border bg-white/6 text-muted hover:text-white"
            >
              <X size={15} />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
