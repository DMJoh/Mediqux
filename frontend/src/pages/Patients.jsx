import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDate } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { PatientFormDialog } from '../components/patients/PatientFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('patients', '/patients')

function genderTone(gender) {
  if (gender === 'Male') return 'male'
  if (gender === 'Female') return 'female'
  return 'default'
}

export default function Patients() {
  const navigate = useNavigate()
  const { data: patients, isLoading } = useList()
  const createPatient = useCreate()
  const updatePatient = useUpdate()
  const deletePatient = useDelete()
  const notify = useToast()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Patients',
    subtitle: 'Everyone whose records live in Mediqux',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add patient
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return patients ?? []
    return (patients ?? []).filter(
      (p) =>
        p.first_name?.toLowerCase().includes(term) ||
        p.last_name?.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.email?.toLowerCase().includes(term),
    )
  }, [patients, search])

  async function handleAdd(payload) {
    try {
      await createPatient.mutateAsync(payload)
      notify('Patient added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save patient', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updatePatient.mutateAsync({ id: editTarget.id, data: payload })
      notify('Patient updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save patient', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePatient.mutateAsync(deleteTarget.id)
      notify('Patient deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete patient', 'error')
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
            placeholder="Search by name, phone, or email…"
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
            Patient list <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description={patients?.length ? 'Try a different search.' : 'Add your first patient to get started.'}
          />
        ) : (
          <>
            {/* Below sm: a stacked card list — a 6-column table forced into a narrow
                screen just becomes a horizontal-scroll strip, which is a bad mobile
                pattern. Same data, laid out for a thumb instead of a cursor. */}
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/patients/${p.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{p.first_name} {p.last_name}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.gender && <Badge tone={genderTone(p.gender)}>{p.gender}</Badge>}
                      <span className="text-xs text-muted">{formatDate(p.date_of_birth) ?? 'DOB not specified'}</span>
                    </div>
                    {/* Phone/email stop the click from bubbling up to the row, so tapping
                        them dials/emails instead of also navigating to the detail page. */}
                    <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
                      {p.phone && (
                        <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="w-fit text-glow-b">
                          {p.phone}
                        </a>
                      )}
                      {p.email && (
                        <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="w-fit truncate text-glow-b">
                          {p.email}
                        </a>
                      )}
                    </div>
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
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">Date of birth</th>
                    <th className="px-5 py-2.5 font-semibold">Gender</th>
                    <th className="px-5 py-2.5 font-semibold">Phone</th>
                    <th className="px-5 py-2.5 font-semibold">Email</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/patients/${p.id}`} className="font-semibold text-text hover:text-glow-b">
                          {p.first_name} {p.last_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-muted">{formatDate(p.date_of_birth) ?? 'Not specified'}</td>
                      <td className="px-5 py-3">{p.gender ? <Badge tone={genderTone(p.gender)}>{p.gender}</Badge> : '-'}</td>
                      <td className="px-5 py-3">
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} className="text-glow-b hover:underline">
                            {p.phone}
                          </a>
                        ) : (
                          <span className="text-muted-2">Not provided</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {p.email ? (
                          <a href={`mailto:${p.email}`} className="text-glow-b hover:underline">
                            {p.email}
                          </a>
                        ) : (
                          <span className="text-muted-2">Not provided</span>
                        )}
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

      <PatientFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        patient={null}
        onSubmit={handleAdd}
        saving={createPatient.isPending}
      />

      <PatientFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        patient={editTarget}
        onSubmit={handleEdit}
        saving={updatePatient.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete patient"
        description={
          deleteTarget && `Delete "${deleteTarget.first_name} ${deleteTarget.last_name}"? This cannot be undone.`
        }
        onConfirm={handleDelete}
        pending={deletePatient.isPending}
      />
    </div>
  )
}
