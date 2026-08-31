import { useEffect, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  HeartPulse,
  LayoutDashboard,
  Users,
  Building2,
  Stethoscope,
  CalendarDays,
  ClipboardList,
  Pill,
  FileText,
  FlaskConical,
  Activity,
  Bell,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { PageHeaderContext } from '../../lib/pageHeader'
import { useToast } from '../ui/Toast'
import { api, getConnectionStatus, subscribeConnectionStatus } from '../../lib/api'

const IDLE_HEALTH_CHECK_MS = 5 * 60 * 1000

/** Reflects the passive connection tracking in api.js — updates for free off of
 * whatever requests the app is already making, no dedicated poll. */
function useConnectionStatus() {
  return useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus)
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/institutions', label: 'Institutions', icon: Building2 },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/conditions', label: 'Conditions', icon: ClipboardList },
  { to: '/medications', label: 'Medications', icon: Pill },
  { to: '/prescriptions', label: 'Prescriptions', icon: FileText },
]

const RECORD_ITEMS = [
  { to: '/lab-reports', label: 'Lab Reports', icon: FlaskConical },
  { to: '/diagnostic-studies', label: 'Diagnostic Studies', icon: Activity },
]

function navClass(collapsed) {
  return ({ isActive }) =>
    [
      'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] text-sm font-medium transition-colors',
      collapsed ? 'lg:justify-center' : '',
      isActive
        ? 'text-white font-semibold bg-linear-to-r from-glow-a/35 to-glow-b/20 shadow-[inset_0_0_0_1px_var(--color-glow-a)]'
        : 'text-muted hover:text-white',
    ].join(' ')
}

const SIDEBAR_COLLAPSED_KEY = 'mediqux-sidebar-collapsed'

export default function AppShell() {
  const { user, isAdmin, logout } = useAuth()
  const notify = useToast()
  const navigate = useNavigate()

  // A plain logout() leaves ProtectedRoute to redirect to /login, which captures
  // the current page as location.state.from ("come back after logging in") — so
  // the next login would silently land back on whatever page you logged out from.
  // An explicit logout should land on the dashboard instead. Racing ProtectedRoute
  // with our own state-less navigate() doesn't reliably win (its <Navigate> fires
  // from an effect, after this handler's own navigate call, and overwrites it) —
  // so instead this just flags the logout as intentional and lets Login.jsx
  // ignore location.state.from when that flag is set.
  function handleLogout() {
    sessionStorage.setItem('mediqux-intentional-logout', '1')
    logout()
  }
  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : ''
  const [header, setHeader] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')
  const isOnline = useConnectionStatus()
  const closeSidebar = () => setSidebarOpen(false)

  // Covers the idle case (no other requests firing to passively update the status) —
  // sparse enough that it won't show up as meaningful log volume.
  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/health').catch(() => {})
    }, IDLE_HEALTH_CHECK_MS)
    return () => clearInterval(interval)
  }, [])
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  return (
    <div className="relative min-h-screen bg-bg text-text font-body">
      {/* overflow-hidden is scoped to just this background layer, not the page root —
          nesting a position:fixed element (the mobile drawer below) inside an
          overflow-hidden ancestor is a known mobile Safari bug where the fixed element
          gets clipped/repositioned relative to that ancestor instead of the viewport. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          aria-hidden
          className="absolute -inset-1/5 opacity-85 blur-[60px] saturate-150 animate-[breathe_22s_ease-in-out_infinite_alternate]"
          style={{
            background: `
              radial-gradient(38% 32% at 12% 8%, color-mix(in srgb, var(--color-glow-a) 55%, transparent), transparent 70%),
              radial-gradient(34% 30% at 88% 12%, color-mix(in srgb, var(--color-glow-b) 48%, transparent), transparent 70%),
              radial-gradient(46% 40% at 70% 92%, color-mix(in srgb, var(--color-glow-a) 35%, transparent), transparent 70%),
              radial-gradient(30% 26% at 6% 88%, color-mix(in srgb, var(--color-glow-b) 30%, transparent), transparent 70%)`,
          }}
        />
      </div>

      <div className="relative z-1 flex gap-3 p-3 min-h-screen lg:gap-4.5 lg:p-6">
        {/* Sibling of <aside> (not the root) so both compare z-index within the same
            stacking context — the wrapper div's own z-1 previously boxed the sidebar
            into a context the backdrop (rendered at the root) could paint over. */}
        {sidebarOpen && (
          <div aria-hidden onClick={closeSidebar} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
        )}

        <aside
          className={`glass fixed inset-y-3 left-3 z-50 w-64 rounded-[20px] p-3 flex flex-col transition-[transform,width] duration-200 lg:static lg:inset-auto lg:z-auto lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+0.75rem)]'
          } ${collapsed ? 'lg:w-16' : 'lg:w-53'}`}
        >
          <div className={`flex items-center justify-between gap-2.5 px-1.5 pt-1 pb-5 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="flex items-center gap-2.5">
              <span className="glow-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-white shadow-[0_0_16px_color-mix(in_srgb,var(--color-glow-a)_60%,transparent)]">
                <HeartPulse size={15} strokeWidth={2.3} />
              </span>
              <span className={`font-display text-[1.02rem] font-bold tracking-tight ${collapsed ? 'lg:hidden' : ''}`}>
                Mediqux
              </span>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              aria-label="Close menu"
              className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-col gap-0.5" aria-label="Primary">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={closeSidebar} title={label} className={navClass(collapsed)}>
                <Icon size={15} className="shrink-0 opacity-80" />
                <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
              </NavLink>
            ))}

            <div
              className={`px-2.5 pt-3.5 pb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.09em] text-muted-2 ${collapsed ? 'lg:hidden' : ''}`}
            >
              Records
            </div>
            {RECORD_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={closeSidebar} title={label} className={navClass(collapsed)}>
                <Icon size={14} className="shrink-0 opacity-80" />
                <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div
                  className={`px-2.5 pt-3.5 pb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.09em] text-muted-2 ${collapsed ? 'lg:hidden' : ''}`}
                >
                  Admin
                </div>
                <NavLink to="/users" onClick={closeSidebar} title="Users" className={navClass(collapsed)}>
                  <Users size={15} className="shrink-0 opacity-80" />
                  <span className={collapsed ? 'lg:hidden' : ''}>Users</span>
                </NavLink>
              </>
            )}
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={`hidden lg:flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] text-sm font-medium text-muted hover:text-white ${collapsed ? 'lg:justify-center' : ''}`}
          >
            {collapsed ? <ChevronsRight size={15} className="shrink-0 opacity-80" /> : <ChevronsLeft size={15} className="shrink-0 opacity-80" />}
            <span className={collapsed ? 'lg:hidden' : ''}>Collapse menu</span>
          </button>

          <div className="border-t border-glass-border pt-3">
            <div className={`flex items-center gap-1.5 px-1.5 pb-2 ${collapsed ? 'lg:justify-center' : ''}`} title={isOnline ? undefined : "Can't reach the server"}>
              <span
                className={`h-1.75 w-1.75 rounded-full ${
                  isOnline ? 'bg-good shadow-[0_0_8px_var(--color-good)] animate-pulse' : 'bg-red-400 shadow-[0_0_8px_#f87171]'
                }`}
              />
              <span
                className={`text-[0.7rem] font-semibold uppercase tracking-[0.04em] ${isOnline ? 'text-good' : 'text-red-400'} ${collapsed ? 'lg:hidden' : ''}`}
              >
                {isOnline ? 'System online' : 'System offline'}
              </span>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 min-w-0 flex-col gap-4">
          <header className="glass flex min-h-14.5 items-center justify-between gap-4 rounded-[18px] px-3 py-3 lg:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-glass-border bg-white/6 text-muted hover:text-white lg:hidden"
              >
                <Menu size={16} />
              </button>
              {header.icon}
              <div className="min-w-0">
                {header.title && (
                  <h1 className="truncate font-display text-[1.1rem] font-bold tracking-tight">{header.title}</h1>
                )}
                {header.subtitle && <p className="mt-0.5 truncate text-[0.79rem] text-muted">{header.subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {header.action}
              {/* TODO: real notifications (appointment reminders, follow-up due dates, etc.)
                  — needs a design pass on what actually counts as a notification and how it's
                  sourced before building the panel. Toast is a placeholder so the click isn't
                  silently dead in the meantime. */}
              <button
                type="button"
                onClick={() => notify('Notifications are coming soon. Appointment and follow-up reminders are planned.')}
                aria-label="Notifications (coming soon)"
                title="Notifications (coming soon)"
                className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-glass-border bg-white/6 text-muted hover:text-white"
              >
                <Bell size={15} />
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="glow-gradient flex h-8 w-8 items-center justify-center rounded-full text-[0.72rem] font-bold text-white"
                  >
                    {initials || <Users size={14} />}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="glass z-50 w-56 rounded-[14px] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] data-[state=open]:animate-[rise_0.15s_ease-out]"
                  >
                    <div className="px-2.5 py-2">
                      <div className="truncate text-sm font-semibold text-text">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <div className="truncate text-xs text-muted">{user?.email}</div>
                    </div>
                    <DropdownMenu.Separator className="my-1 h-px bg-glass-border" />
                    <DropdownMenu.Item
                      onSelect={() => navigate('/settings')}
                      className="flex cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-white/8"
                    >
                      <SettingsIcon size={15} className="text-muted" />
                      Settings
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handleLogout}
                      className="flex cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-white/8"
                    >
                      <LogOut size={15} className="text-muted" />
                      Log out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <PageHeaderContext.Provider value={setHeader}>
              <Outlet />
            </PageHeaderContext.Provider>
          </main>
        </div>
      </div>
    </div>
  )
}
