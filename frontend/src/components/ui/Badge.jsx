const DOT_COLORS = {
  male: 'bg-[#4f8ef7]',
  female: 'bg-[#e6659a]',
  scheduled: 'bg-glow-b',
  completed: 'bg-good',
  cancelled: 'bg-red-400',
  active: 'bg-good',
  discontinued: 'bg-red-400',
  normal: 'bg-good',
  critical: 'bg-red-400',
  // Distinct from the "low"/"high" condition-severity tones above (green/red) —
  // an out-of-range lab value is a caution, not necessarily good or severe.
  'lab-low': 'bg-amber-400',
  'lab-high': 'bg-amber-400',
  low: 'bg-good',
  medium: 'bg-amber-400',
  high: 'bg-red-400',
  default: 'bg-muted-2',
}

export function Badge({ children, tone = 'default' }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-glass-2 px-2.5 py-1 text-xs font-semibold text-muted">
      <span className={`h-1.25 w-1.25 rounded-full ${DOT_COLORS[tone] ?? DOT_COLORS.default}`} />
      {children}
    </span>
  )
}
