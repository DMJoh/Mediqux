import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDate, formatTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('appointments', '/appointments')

function statusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function Appointments() {
  const navigate = useNavigate()
  const { data: appointments, isLoading } = useList()
  const createAppointment = useCreate()
  const updateAppointment = useUpdate()
  const deleteAppointment = useDelete()
  const notify = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Exact patient_id filter, distinct from the free-text search box — used when
  // linked to from a patient's own detail page ("View all appointments").
  const patientFilterId = searchParams.get('patient') || ''
  const patientFilterName = useMemo(() => {
    const match = (appointments ?? []).find((a) => a.patient_id === patientFilterId)
    return match ? `${match.patient_first_name} ${match.patient_last_name}` : null
  }, [appointments, patientFilterId])

  function clearPatientFilter() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('patient')
      return next
    })
  }

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Appointments',
    subtitle: 'Every visit, scheduled or past',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Schedule appointment
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (appointments ?? [])
      .filter((a) => !patientFilterId || a.patient_id === patientFilterId)
      .filter(
        (a) =>
          !term ||
          a.patient_first_name?.toLowerCase().includes(term) ||
          a.patient_last_name?.toLowerCase().includes(term) ||
          a.doctor_first_name?.toLowerCase().includes(term) ||
          a.doctor_last_name?.toLowerCase().includes(term) ||
          a.institution_name?.toLowerCase().includes(term) ||
          a.type?.toLowerCase().includes(term) ||
          a.notes?.toLowerCase().includes(term),
      )
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
  }, [appointments, search, patientFilterId])

  async function handleAdd(payload) {
    try {
      await createAppointment.mutateAsync(payload)
      notify('Appointment scheduled')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save appointment', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateAppointment.mutateAsync({ id: editTarget.id, data: payload })
      notify('Appointment updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save appointment', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteAppointment.mutateAsync(deleteTarget.id)
      notify('Appointment deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete appointment', 'error')
    }
  }

  return (
    <div>
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-[16px] p-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-[10px] border border-glass-border bg-white/6 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, doctor, institution, or type…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-sm font-semibold text-muted hover:text-white">
            Clear
          </button>
        )}
        {patientFilterId && (
          <span className="flex items-center gap-1.5 rounded-full bg-glass-2 px-3 py-1.5 text-xs font-semibold text-muted">
            Patient: {patientFilterName ?? '…'}
            <button onClick={clearPatientFilter} aria-label="Clear patient filter" className="text-muted-2 hover:text-white">
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Appointment list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No appointments found"
            description={appointments?.length ? 'Try a different search.' : 'Schedule your first appointment to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/appointments/${a.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/appointments/${a.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold text-text">{formatDate(a.appointment_date)}</span>
                      <span className="font-mono text-xs text-muted">{formatTime(a.appointment_date)}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-medium">
                      {a.patient_first_name} {a.patient_last_name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.status}>{statusLabel(a.status)}</Badge>
                      {a.type && <span className="text-xs text-muted">{a.type}</span>}
                    </div>
                    {a.doctor_first_name && (
                      <div className="mt-1.5 text-xs text-muted">
                        Dr. {a.doctor_first_name} {a.doctor_last_name}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(a)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(a)
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-glass-border bg-white/3 text-left font-mono text-[0.68rem] uppercase tracking-wide text-muted-2">
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-5 py-2.5 font-semibold">Patient</th>
                    <th className="px-5 py-2.5 font-semibold">Doctor</th>
                    <th className="px-5 py-2.5 font-semibold">Institution</th>
                    <th className="px-5 py-2.5 font-semibold">Type</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/appointments/${a.id}`} className="font-mono font-semibold text-text hover:text-glow-b">
                          {formatDate(a.appointment_date)}
                        </Link>
                        <div className="font-mono text-xs text-muted">{formatTime(a.appointment_date)}</div>
                      </td>
                      <td className="px-5 py-3">
                        {a.patient_first_name} {a.patient_last_name}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {a.doctor_first_name ? (
                          <>
                            Dr. {a.doctor_first_name} {a.doctor_last_name}
                          </>
                        ) : (
                          'Not assigned'
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted">{a.institution_name || 'Not specified'}</td>
                      <td className="px-5 py-3 text-muted">{a.type || 'General'}</td>
                      <td className="px-5 py-3">
                        <Badge tone={a.status}>{statusLabel(a.status)}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(a)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => setDeleteTarget(a)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AppointmentFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        appointment={null}
        onSubmit={handleAdd}
        saving={createAppointment.isPending}
      />

      <AppointmentFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        appointment={editTarget}
        onSubmit={handleEdit}
        saving={updateAppointment.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete appointment"
        description={deleteTarget && `Delete the appointment on ${formatDate(deleteTarget.appointment_date)}? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteAppointment.isPending}
      />
    </div>
  )
}
