import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDate } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { PrescriptionFormDialog } from '../components/prescriptions/PrescriptionFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('prescriptions', '/prescriptions')

function statusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function Prescriptions() {
  const navigate = useNavigate()
  const { data: prescriptions, isLoading } = useList()
  const createPrescription = useCreate()
  const updatePrescription = useUpdate()
  const deletePrescription = useDelete()
  const notify = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Supports being linked to with a prefilled search (e.g. "View prescriptions"
  // from a medication's detail page), since prescriptions have no dedicated
  // per-medication list view of their own.
  const [search, setSearch] = useState(() => searchParams.get('q') || '')

  // Exact patient_id filter, distinct from the free-text search box above — used
  // when linked to from a patient's own detail page ("View all prescriptions").
  const patientFilterId = searchParams.get('patient') || ''
  const patientFilterName = useMemo(() => {
    const match = (prescriptions ?? []).find((p) => p.patient_id === patientFilterId)
    return match ? `${match.patient_first_name} ${match.patient_last_name}` : null
  }, [prescriptions, patientFilterId])

  function clearPatientFilter() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('patient')
      return next
    })
  }
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Prescriptions',
    subtitle: 'Every prescription tied to an appointment',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add prescription
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (prescriptions ?? [])
      .filter((p) => !patientFilterId || p.patient_id === patientFilterId)
      .filter(
        (p) =>
          !term ||
          p.patient_first_name?.toLowerCase().includes(term) ||
          p.patient_last_name?.toLowerCase().includes(term) ||
          p.medication_name?.toLowerCase().includes(term) ||
          p.dosage?.toLowerCase().includes(term) ||
          p.frequency?.toLowerCase().includes(term),
      )
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
  }, [prescriptions, search, patientFilterId])

  async function handleAdd(payload) {
    try {
      await createPrescription.mutateAsync(payload)
      notify('Prescription added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save prescription', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updatePrescription.mutateAsync({ id: editTarget.id, data: payload })
      notify('Prescription updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save prescription', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePrescription.mutateAsync(deleteTarget.id)
      notify('Prescription deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete prescription', 'error')
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
            placeholder="Search by patient, medication, dosage, or frequency…"
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
            Prescription list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No prescriptions found"
            description={prescriptions?.length ? 'Try a different search.' : 'Add your first prescription to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/prescriptions/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/prescriptions/${p.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{p.medication_name}</div>
                    <div className="mt-1 truncate text-sm text-muted">
                      {p.patient_first_name} {p.patient_last_name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={p.status}>{statusLabel(p.status)}</Badge>
                      <span className="text-xs text-muted">{p.dosage} · {p.frequency}</span>
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-muted">{formatDate(p.appointment_date)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(p)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(p)
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
                    <th className="px-5 py-2.5 font-semibold">Patient</th>
                    <th className="px-5 py-2.5 font-semibold">Medication</th>
                    <th className="px-5 py-2.5 font-semibold">Dosage</th>
                    <th className="px-5 py-2.5 font-semibold">Frequency</th>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/prescriptions/${p.id}`} className="font-semibold text-text hover:text-glow-b">
                          {p.patient_first_name} {p.patient_last_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted">{p.medication_name}</td>
                      <td className="px-5 py-3 text-muted">{p.dosage}</td>
                      <td className="px-5 py-3 text-muted">{p.frequency}</td>
                      <td className="px-5 py-3 font-mono text-muted">{formatDate(p.appointment_date)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={p.status}>{statusLabel(p.status)}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(p)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => setDeleteTarget(p)}>
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

      <PrescriptionFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        prescription={null}
        onSubmit={handleAdd}
        saving={createPrescription.isPending}
      />

      <PrescriptionFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        prescription={editTarget}
        onSubmit={handleEdit}
        saving={updatePrescription.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete prescription"
        description={deleteTarget && `Delete this prescription for ${deleteTarget.medication_name}? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deletePrescription.isPending}
      />
    </div>
  )
}
