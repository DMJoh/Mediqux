import { createContext, useContext, useEffect } from 'react'

export const PageHeaderContext = createContext(() => {})

/**
 * Lets a page declare its title/subtitle/icon/primary-action once; AppShell renders
 * it into the persistent topbar. Keeps "what page am I on" in exactly one place
 * instead of pages rendering their own duplicate heading.
 *
 * `action` and `icon` are intentionally left out of the effect's dependency list —
 * pages typically pass a freshly-created element on every render, which would
 * otherwise re-fire the effect (and re-render AppShell) on every keystroke. Neither
 * carries its own changing state (icon is decorative, action's handlers close over
 * stable state setters), so this is safe in practice.
 */
export function usePageHeader({ title, subtitle, action, icon }) {
  const setHeader = useContext(PageHeaderContext)

  useEffect(() => {
    setHeader({ title, subtitle, action, icon })
    return () => setHeader({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, setHeader])
}
