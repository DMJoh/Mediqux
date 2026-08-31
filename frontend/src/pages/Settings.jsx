import { useState } from 'react'
import { Check } from 'lucide-react'
import { ACCENTS, getStoredAccent, setAccent } from '../lib/accent'
import { usePageHeader } from '../lib/pageHeader'

export default function Settings() {
  const [accent, setAccentState] = useState(getStoredAccent)

  usePageHeader({
    title: 'Settings',
    subtitle: 'Personal preferences for this account',
  })

  function choose(id) {
    setAccent(id)
    setAccentState(id)
  }

  return (
    <div>
      <div className="glass rounded-[20px] p-6">
        <h2 className="text-[0.9rem] font-bold">Appearance</h2>
        <p className="mt-1 text-sm text-muted">Pick an accent color. Applies everywhere — buttons, active nav, highlights.</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ACCENTS.map((opt) => {
            const selected = accent === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.id)}
                className={`flex items-center gap-3 rounded-[14px] border p-4 text-left transition-colors ${
                  selected ? 'border-glow-b bg-white/6' : 'border-glass-border hover:bg-white/3'
                }`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: `linear-gradient(135deg, ${opt.a}, ${opt.b})` }}
                >
                  {selected && <Check size={16} />}
                </span>
                <span className="text-sm font-semibold text-text">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
