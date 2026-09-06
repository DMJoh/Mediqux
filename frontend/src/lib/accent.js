const ACCENT_KEY = 'mediqux-accent'

// Swatch hexes here are for the picker UI only — the actual color values live in
// index.css (:root[data-accent="..."]) so they apply everywhere via the existing
// --color-glow-a/--color-glow-b tokens, not just wherever this list is imported.
export const ACCENTS = [
  { id: 'magenta-blue', label: 'Aurora (default)', a: '#c026d3', b: '#3b82f6' },
  { id: 'teal-cyan', label: 'Teal', a: '#14b8a6', b: '#22d3ee' },
  { id: 'sunset', label: 'Sunset', a: '#fb923c', b: '#f472b6' },
]

const DEFAULT_ACCENT = 'magenta-blue'

export function getStoredAccent() {
  const id = localStorage.getItem(ACCENT_KEY)
  return ACCENTS.some((a) => a.id === id) ? id : DEFAULT_ACCENT
}

export function applyAccent(id) {
  if (id === DEFAULT_ACCENT) {
    document.documentElement.removeAttribute('data-accent')
  } else {
    document.documentElement.setAttribute('data-accent', id)
  }
}

export function setAccent(id) {
  localStorage.setItem(ACCENT_KEY, id)
  applyAccent(id)
}
