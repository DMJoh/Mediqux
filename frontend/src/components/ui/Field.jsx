import { Children, isValidElement } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

const inputClasses =
  'w-full rounded-[10px] border bg-white/6 px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-glow-b'

function fieldBorder(error) {
  return error ? 'border-red-500/50' : 'border-glass-border'
}

export function Field({ label, htmlFor, error, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function TextInput({ error, className = '', ...props }) {
  return <input {...props} className={`${inputClasses} ${fieldBorder(error)} ${className}`} />
}

export function Textarea({ error, className = '', rows = 3, ...props }) {
  return <textarea {...props} rows={rows} className={`${inputClasses} ${fieldBorder(error)} ${className} resize-y`} />
}

/** A checkbox-list picker for "select several of these" fields (e.g. a doctor's
 * institutions) — a native multi-select has the same unreadable-popup problem as a
 * single one, plus a clunky ctrl/cmd-click selection model, so this uses real
 * checkboxes in a scrollable list instead. */
export function MultiSelect({ options, value = [], onChange, error, className = '', emptyLabel = 'Nothing to choose from yet.' }) {
  function toggle(optValue) {
    onChange(value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue])
  }

  return (
    <div className={`max-h-44 overflow-y-auto rounded-[10px] border ${fieldBorder(error)} bg-white/6 p-1 ${className}`}>
      {options.length === 0 && <p className="px-2.5 py-2 text-sm text-muted-2">{emptyLabel}</p>}
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-sm hover:bg-white/6"
        >
          <input
            type="checkbox"
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="h-4 w-4 rounded accent-glow-b"
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

// Radix Select won't allow an item with value="" (used by native <select> for a
// blank/"not specified" choice), so it's swapped for this sentinel internally and
// translated back at the edges — callers keep using value="" like a native select.
const EMPTY_VALUE = '__unset__'

/**
 * A drop-in replacement for a native <select> (same value/onChange/<option> children
 * API) — but a browser's native option popup can only be hinted at with color-scheme,
 * never actually styled, so it kept rendering as an unreadable OS-themed list. This
 * builds the popup ourselves with Radix Select, matching the rest of the UI exactly.
 */
export function Select({ value, onChange, error, className = '', children, id, disabled }) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => ({ value: child.props.value ?? '', label: child.props.children }))

  return (
    <RadixSelect.Root
      value={value === '' || value == null ? EMPTY_VALUE : value}
      onValueChange={(v) => onChange?.({ target: { value: v === EMPTY_VALUE ? '' : v } })}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id}
        className={`${inputClasses} ${fieldBorder(error)} ${className} flex items-center justify-between gap-2 data-[placeholder]:text-muted-2`}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <ChevronDown size={15} className="text-muted" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="glass z-50 overflow-hidden rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          style={{ width: 'var(--radix-select-trigger-width)', maxHeight: 'var(--radix-select-content-available-height)' }}
        >
          <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-muted">
            <ChevronUp size={14} />
          </RadixSelect.ScrollUpButton>
          {/* Radix reports how much room is actually available (flipping above the
              trigger near the bottom of the screen, per collisionPadding) via this
              custom property — without capping height to it, a long list like
              Conditions' 18 categories just renders past the viewport edge. */}
          <RadixSelect.Viewport
            className="max-h-[inherit] overflow-y-auto p-1"
            style={{ maxHeight: 'var(--radix-select-content-available-height)' }}
          >
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value || EMPTY_VALUE}
                value={opt.value === '' ? EMPTY_VALUE : opt.value}
                className="relative flex cursor-pointer items-center rounded-[8px] py-2 pl-3 pr-8 text-sm text-text outline-none data-[highlighted]:bg-white/8"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check size={14} className="text-glow-b" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-muted">
            <ChevronDown size={14} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
