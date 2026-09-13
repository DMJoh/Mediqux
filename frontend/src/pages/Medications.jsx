import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pill, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { useToast } from '../components/ui/Toast'
import { MedicationFormDialog } from '../components/medications/MedicationFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('medications', '/medications')

function usageCount(medication) {
  return (Number(medication.prescription_count) || 0) + (Number(medication.patient_medication_count) || 0)
}

export default function Medications() {
  const navigate = useNavigate()
  const { data: medications, isLoading } = useList()
  const createMedication = useCreate()
  const updateMedication = useUpdate()
  const deleteMedication = useDelete()
  const notify = useToast()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Medications',
    subtitle: 'Every medication on file, with dosage forms and ingredients',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add medication
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return medications ?? []
    return (medications ?? []).filter(
      (m) =>
        m.name?.toLowerCase().includes(term) ||
        m.generic_name?.toLowerCase().includes(term) ||
        m.manufacturer?.toLowerCase().includes(term),
    )
  }, [medications, search])

  async function handleAdd(payload) {
    try {
      await createMedication.mutateAsync(payload)
      notify('Medication added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save medication', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateMedication.mutateAsync({ id: editTarget.id, data: payload })
      notify('Medication updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save medication', 'error')
    }
  }

  function requestDelete(medication) {
    const count = usageCount(medication)
    if (count > 0) {
      notify(
        `Can't delete "${medication.name}": it's referenced in ${count} prescription/patient record(s). Remove those references first.`,
        'error',
      )
      return
    }
    setDeleteTarget(medication)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteMedication.mutateAsync(deleteTarget.id)
      notify('Medication deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete medication', 'error')
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
            placeholder="Search by name, generic name, or manufacturer…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-sm font-semibold text-muted hover:text-white">
            Clear
          </button>
        )}
      </div>

      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Medication list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No medications found"
            description={medications?.length ? 'Try a different search.' : 'Add your first medication to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/medications/${m.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/medications/${m.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{m.name}</div>
                    {m.generic_name && <div className="text-xs text-muted">{m.generic_name}</div>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {(m.dosage_forms ?? []).slice(0, 3).map((f) => (
                        <Badge key={f}>{f}</Badge>
                      ))}
                    </div>
                    <div className="mt-1.5 text-xs text-muted">
                      {usageCount(m)} use{usageCount(m) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(m)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDelete(m)
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
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">Dosage forms</th>
                    <th className="px-5 py-2.5 font-semibold">Strengths</th>
                    <th className="px-5 py-2.5 font-semibold">Manufacturer</th>
                    <th className="px-5 py-2.5 font-semibold">Usage</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/medications/${m.id}`} className="font-semibold text-text hover:text-glow-b">
                          {m.name}
                        </Link>
                        {m.generic_name && <div className="text-xs text-muted">{m.generic_name}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(m.dosage_forms ?? []).length ? (
                            (m.dosage_forms ?? []).map((f) => <Badge key={f}>{f}</Badge>)
                          ) : (
                            <span className="text-muted-2">Not set</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted">{(m.strengths ?? []).join(', ') || 'Not set'}</td>
                      <td className="px-5 py-3 text-muted">{m.manufacturer || 'Not provided'}</td>
                      <td className="px-5 py-3 text-muted">
                        {usageCount(m)} use{usageCount(m) === 1 ? '' : 's'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(m)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => requestDelete(m)}>
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

      <MedicationFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        medication={null}
        onSubmit={handleAdd}
        saving={createMedication.isPending}
      />

      <MedicationFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        medication={editTarget}
        onSubmit={handleEdit}
        saving={updateMedication.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete medication"
        description={deleteTarget && `Delete "${deleteTarget.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteMedication.isPending}
      />
    </div>
  )
}
