import { createContext, useCallback, useContext, useState } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)
let idSeq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const notify = useCallback((message, variant = 'success') => {
    const id = idSeq++
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className={`glass flex items-start gap-2.5 rounded-[12px] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] data-[state=open]:animate-[rise_0.3s_ease-out] ${
              t.variant === 'error' ? 'border-red-500/30' : 'border-good/25'
            }`}
          >
            {t.variant === 'error' ? (
              <XCircle size={17} className="mt-0.5 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-good" />
            )}
            <RadixToast.Description className="flex-1 text-sm">{t.message}</RadixToast.Description>
            <RadixToast.Close aria-label="Dismiss" className="text-muted hover:text-white">
              <X size={15} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
