import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, FileText, Pill, CalendarDays, Plus } from 'lucide-react'
import {
  usePatients,
  useDoctors,
  useUpcomingAppointments,
  useRecentAppointments,
  bucketByMonth,
} from '../lib/queries'
import { createResourceHooks } from '../lib/resource'
import { useAuth } from '../lib/auth'
import { usePageHeader } from '../lib/pageHeader'
import { useMeasuredWidth } from '../lib/useMeasuredWidth'
import { useToast } from '../components/ui/Toast'
import { PatientFormDialog } from '../components/patients/PatientFormDialog'

const { useCreate: useCreatePatient } = createResourceHooks('patients', '/patients')

const CHART_MONTHS = 12

function daysUntil(dateStr) {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = Math.ceil((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86_400_000)
  return diff
}

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function AppointmentsChart({ buckets }) {
  const gradId = useId()
  const strokeId = useId()
  const glowId = useId()
  const [wrapRef, measuredWidth] = useMeasuredWidth()
  const h = 130
  // viewBox width tracks the container's real rendered pixels, so the coordinate
  // system matches the screen 1:1 instead of a fixed box getting stretched to fit
  // (that stretching is what was making the line look "pressed and extended").
  const w = measuredWidth || 460
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const stepX = w / (buckets.length - 1)
  const yFor = (count) => h - 10 - (count / max) * (h - 30)
  const points = buckets.map((b, i) => ({ ...b, x: i * stepX, y: yFor(b.count) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`
  const total = buckets.reduce((sum, b) => sum + b.count, 0)

  return (
    <div ref={wrapRef} className="px-5 pt-4 pb-3.5">
      <div className="font-mono text-[0.63rem] font-semibold uppercase tracking-[0.09em] text-muted-2">
        Total logged
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[1.7rem] font-bold tracking-tight">{total}</span>
        <span className="text-[0.78rem] text-muted">across recent visits</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={`Appointments per month: ${buckets.map((b) => `${b.label} ${b.count}`).join(', ')}`}
        className="mt-1"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-glow-b)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-glow-a)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-glow-b)" />
            <stop offset="100%" stopColor="var(--color-glow-a)" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
          {[10, 45, 80, 115].map((y) => (
            <line key={y} x1="0" y1={y} x2={w} y2={y} />
          ))}
        </g>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={`url(#${strokeId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} />
        {points.map((p, i) => {
          const isLast = i === points.length - 1
          return (
            <g key={p.label + i} className="group cursor-pointer" tabIndex={0}>
              <title>{`${p.label} · ${p.count} appointment${p.count === 1 ? '' : 's'}`}</title>
              <line
                x1={p.x} y1="0" x2={p.x} y2={h}
                stroke={isLast ? 'var(--color-glow-a)' : 'var(--color-glow-b)'}
                strokeWidth="1"
                className="opacity-0 transition-opacity group-hover:opacity-55 group-focus-visible:opacity-55"
              />
              <circle
                cx={p.x} cy={p.y}
                r={isLast ? 5.5 : 4}
                fill={isLast ? 'var(--color-glow-a)' : '#fff'}
                stroke={isLast ? '#fff' : 'none'}
                strokeWidth={isLast ? 2 : 0}
                className="transition-[r] group-hover:r-6 group-focus-visible:r-6"
              />
            </g>
          )
        })}
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[0.68rem] text-muted-2">
        {buckets.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  usePageHeader({ title: 'Dashboard', subtitle: `Welcome back${user?.firstName ? `, ${user.firstName}` : ''}` })
  const { data: patients } = usePatients()
  const { data: doctors } = useDoctors()
  const { data: upcoming } = useUpcomingAppointments()
  const { data: recentAppointments } = useRecentAppointments(CHART_MONTHS)
  const createPatient = useCreatePatient()
  const notify = useToast()
  const [addPatientOpen, setAddPatientOpen] = useState(false)

  async function handleAddPatient(payload) {
    try {
      await createPatient.mutateAsync(payload)
      notify('Patient added')
      setAddPatientOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save patient', 'error')
    }
  }

  const buckets = useMemo(() => bucketByMonth(recentAppointments, CHART_MONTHS), [recentAppointments])
  const nextAppointment = upcoming?.[0]

  const recentActivity = useMemo(() => {
    const now = new Date()
    return (recentAppointments ?? [])
      .filter((a) => new Date(a.appointment_date) <= now)
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
      .slice(0, 3)
  }, [recentAppointments])

  const rosterWithNext = useMemo(() => {
    if (!patients) return []
    return patients.slice(0, 4).map((p) => {
      const next = upcoming?.find(
        (a) => a.patient_first_name === p.first_name && a.patient_last_name === p.last_name,
      )
      return { ...p, next }
    })
  }, [patients, upcoming])

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[20px]" aria-labelledby="roster-heading">
        <div className="flex items-center justify-between px-5 py-3.75 border-b border-glass-border">
          <h2 id="roster-heading" className="text-[0.9rem] font-bold">
            Your patients
          </h2>
          <Link to="/patients" className="text-[0.76rem] font-semibold text-white/80 hover:text-white no-underline">
            View all →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto p-4">
          {rosterWithNext.map((p) => (
            <Link
              key={p.id}
              to={`/patients/${p.id}`}
              className="w-42 shrink-0 rounded-2xl border border-glass-border bg-glass-2 p-3.5 no-underline text-inherit hover:border-glow-b"
            >
              <div className="glow-gradient mb-2.5 flex h-9.5 w-9.5 items-center justify-center rounded-full text-[0.78rem] font-bold text-white shadow-[0_0_14px_color-mix(in_srgb,var(--color-glow-a)_55%,transparent)]">
                {initials(p.first_name, p.last_name)}
              </div>
              <div className="text-[0.88rem] font-bold">
                {p.first_name} {p.last_name}
              </div>
              <div className="mt-0.5 text-[0.74rem] text-muted">{p.gender}</div>
              <div className={`mt-2 text-[0.7rem] ${p.next ? 'font-semibold text-glow-b' : 'text-muted-2'}`}>
                {p.next
                  ? `Next: ${new Date(p.next.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'No upcoming appt'}
              </div>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setAddPatientOpen(true)}
            className="flex w-42 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-glass-border p-3.5 text-muted hover:border-glow-b hover:text-white"
          >
            <Plus size={18} />
            <span className="text-[0.78rem] font-semibold">Add patient</span>
          </button>
        </div>
      </section>

      <PatientFormDialog
        key={addPatientOpen ? 'add' : 'closed'}
        open={addPatientOpen}
        onOpenChange={setAddPatientOpen}
        patient={null}
        onSubmit={handleAddPatient}
        saving={createPatient.isPending}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="glass rounded-[20px]" aria-labelledby="chart-heading">
          <div className="px-5 py-3.75 border-b border-glass-border">
            <h2 id="chart-heading" className="text-[0.9rem] font-bold">
              Appointments, last {CHART_MONTHS} months
            </h2>
          </div>
          <AppointmentsChart buckets={buckets} />
        </section>

        <div className="flex flex-col gap-3">
          <div className="glass rounded-[20px] p-4 flex items-center gap-3">
            <div className="glow-gradient flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_0_14px_color-mix(in_srgb,var(--color-glow-a)_50%,transparent)]">
              <CalendarDays size={16} />
            </div>
            <div>
              {nextAppointment ? (
                <>
                  <div className="glow-text font-display text-[1.5rem] font-bold">
                    {daysUntil(nextAppointment.appointment_date)} days
                  </div>
                  <div className="text-[0.74rem] text-muted">
                    Until {nextAppointment.patient_first_name}&rsquo;s {nextAppointment.type?.toLowerCase() ?? 'visit'}
                  </div>
                </>
              ) : (
                <>
                  <div className="glow-text font-display text-[1.5rem] font-bold">No appointments</div>
                  <div className="text-[0.74rem] text-muted">Nothing scheduled right now</div>
                </>
              )}
            </div>
          </div>
          <div className="glass rounded-[20px] p-4 flex items-center gap-3">
            <div className="glow-gradient flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_0_14px_color-mix(in_srgb,var(--color-glow-a)_50%,transparent)]">
              <Users size={16} />
            </div>
            <div>
              <div className="font-display text-[1.2rem] font-bold">{patients?.length ?? '-'}</div>
              <div className="text-[0.74rem] text-muted">Patients</div>
            </div>
          </div>
          <div className="glass rounded-[20px] p-4 flex items-center gap-3">
            <div className="glow-gradient flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_0_14px_color-mix(in_srgb,var(--color-glow-a)_50%,transparent)]">
              <Pill size={16} />
            </div>
            <div>
              <div className="font-display text-[1.2rem] font-bold">{doctors?.length ?? '-'}</div>
              <div className="text-[0.74rem] text-muted">Doctors</div>
            </div>
          </div>
        </div>
      </div>

      <section className="glass rounded-[20px]" aria-labelledby="activity-heading">
        <div className="flex items-center justify-between px-5 py-3.75 border-b border-glass-border">
          <h2 id="activity-heading" className="text-[0.9rem] font-bold">
            Recent activity
          </h2>
        </div>
        <div className="px-5 py-1">
          {recentActivity.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-glass-border py-3 last:border-none">
              <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[9px] border border-glass-border bg-white/8 text-white">
                <FileText size={14} />
              </div>
              <div>
                <div className="text-[0.85rem]">
                  {a.type} completed for{' '}
                  <strong>
                    {a.patient_first_name} {a.patient_last_name}
                  </strong>
                </div>
                <div className="font-mono text-[0.72rem] text-muted-2">
                  {new Date(a.appointment_date).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {!recentActivity.length && <p className="py-4 text-sm text-muted">No recent activity yet.</p>}
        </div>
      </section>
    </div>
  )
}
