export default function ComingSoon({ title }) {
  return (
    <div className="glass flex min-h-64 flex-col items-center justify-center gap-2 rounded-[20px] p-10 text-center">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">
        This section hasn&rsquo;t been rebuilt on the new design yet. It&rsquo;s next up.
      </p>
    </div>
  )
}
