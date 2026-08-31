import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Pencil, Trash2, Search, Globe } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { useToast } from '../components/ui/Toast'
import { InstitutionFormDialog } from '../components/institutions/InstitutionFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('institutions', '/institutions')

function doctorCount(institution) {
  return Number(institution.doctor_count) || 0
}

export default function Institutions() {
  const navigate = useNavigate()
  const { data: institutions, isLoading } = useList()
  const createInstitution = useCreate()
  const updateInstitution = useUpdate()
  const deleteInstitution = useDelete()
  const notify = useToast()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Institutions',
    subtitle: 'Hospitals, clinics, labs, and pharmacies on file',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add institution
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return institutions ?? []
    return (institutions ?? []).filter(
      (i) =>
        i.name?.toLowerCase().includes(term) ||
        i.address?.toLowerCase().includes(term) ||
        i.phone?.includes(term) ||
        i.email?.toLowerCase().includes(term),
    )
  }, [institutions, search])

  async function handleAdd(payload) {
    try {
      await createInstitution.mutateAsync(payload)
      notify('Institution added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save institution', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateInstitution.mutateAsync({ id: editTarget.id, data: payload })
      notify('Institution updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save institution', 'error')
    }
  }

  function requestDelete(institution) {
    if (doctorCount(institution) > 0) {
      notify(
        `Can't delete "${institution.name}": it has ${doctorCount(institution)} associated doctor(s). Remove those associations first.`,
        'error',
      )
      return
    }
    setDeleteTarget(institution)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteInstitution.mutateAsync(deleteTarget.id)
      notify('Institution deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete institution', 'error')
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
            placeholder="Search by name, address, phone, or email…"
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
            Institution list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No institutions found"
            description={institutions?.length ? 'Try a different search.' : 'Add your first institution to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((i) => (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/institutions/${i.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/institutions/${i.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{i.name}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {i.type && <Badge>{i.type}</Badge>}
                      <span className="text-xs text-muted">
                        {doctorCount(i)} doctor{doctorCount(i) === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
                      {i.phone && (
                        <a href={`tel:${i.phone}`} onClick={(e) => e.stopPropagation()} className="w-fit text-glow-b">
                          {i.phone}
                        </a>
                      )}
                      {i.email && (
                        <a href={`mailto:${i.email}`} onClick={(e) => e.stopPropagation()} className="w-fit truncate text-glow-b">
                          {i.email}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(i)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDelete(i)
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
                    <th className="px-5 py-2.5 font-semibold">Type</th>
                    <th className="px-5 py-2.5 font-semibold">Address</th>
                    <th className="px-5 py-2.5 font-semibold">Contact</th>
                    <th className="px-5 py-2.5 font-semibold">Doctors</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/institutions/${i.id}`} className="font-semibold text-text hover:text-glow-b">
                          {i.name}
                        </Link>
                        {i.website && (
                          <a
                            href={i.website}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-xs text-muted-2 hover:text-glow-b"
                          >
                            <Globe size={11} /> Website
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3">{i.type ? <Badge>{i.type}</Badge> : '-'}</td>
                      <td className="px-5 py-3 text-muted">{i.address || 'Not provided'}</td>
                      <td className="px-5 py-3">
                        {i.phone && (
                          <a href={`tel:${i.phone}`} className="block text-glow-b hover:underline">
                            {i.phone}
                          </a>
                        )}
                        {i.email && (
                          <a href={`mailto:${i.email}`} className="block text-glow-b hover:underline">
                            {i.email}
                          </a>
                        )}
                        {!i.phone && !i.email && <span className="text-muted-2">Not provided</span>}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {doctorCount(i)} doctor{doctorCount(i) === 1 ? '' : 's'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(i)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => requestDelete(i)}>
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

      <InstitutionFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        institution={null}
        onSubmit={handleAdd}
        saving={createInstitution.isPending}
      />

      <InstitutionFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        institution={editTarget}
        onSubmit={handleEdit}
        saving={updateInstitution.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete institution"
        description={deleteTarget && `Delete "${deleteTarget.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteInstitution.isPending}
      />
    </div>
  )
}
