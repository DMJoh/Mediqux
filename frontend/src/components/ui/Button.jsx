const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-opacity disabled:opacity-50'
const variants = {
  primary: 'glow-gradient text-white px-4 py-2.5',
  ghost: 'border border-glass-border bg-white/6 text-text px-4 py-2.5 hover:border-glow-b',
  danger: 'border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-2.5 hover:bg-red-500/15',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />
}

export function IconButton({ label, className = '', ...props }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-white/8 hover:text-white ${className}`}
    />
  )
}
