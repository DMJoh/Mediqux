export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {Icon && <Icon size={28} className="mb-1 text-muted-2" />}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
    </div>
  )
}
