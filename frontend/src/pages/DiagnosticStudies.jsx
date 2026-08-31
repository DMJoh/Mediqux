import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Scan, Plus, Pencil, Trash2, Search, Paperclip, X } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDate } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { DiagnosticStudyFormDialog } from '../components/diagnostic-studies/DiagnosticStudyFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('diagnostic-studies', '/diagnostic-studies')

function doctorName(doctor) {
  if (!doctor) return null
  return `Dr. ${doctor.first_name} ${doctor.last_name}`
}

export default function DiagnosticStudies() {
  const navigate = useNavigate()
  const { data: studies, isLoading } = useList()
  const createStudy = useCreate()
  const updateStudy = useUpdate()
  const deleteStudy = useDelete()
  const notify = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Exact patient_id filter, distinct from the free-text search box — used when
  // linked to from a patient's own detail page ("View all diagnostic studies").
  const patientFilterId = searchParams.get('patient') || ''
  const patientFilterName = useMemo(() => {
    const match = (studies ?? []).find((s) => s.patient_id === patientFilterId)
    return match ? `${match.patient_first_name} ${match.patient_last_name}` : null
  }, [studies, patientFilterId])

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
    title: 'Diagnostic Studies',
    subtitle: 'Imaging and scan records, with optional attachments',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add study
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (studies ?? [])
      .filter((s) => !patientFilterId || s.patient_id === patientFilterId)
      .filter(
        (s) =>
          !term ||
          s.patient_first_name?.toLowerCase().includes(term) ||
          s.patient_last_name?.toLowerCase().includes(term) ||
          s.study_type?.toLowerCase().includes(term) ||
          s.body_region?.toLowerCase().includes(term) ||
          s.findings?.toLowerCase().includes(term) ||
          s.conclusion?.toLowerCase().includes(term),
      )
      .sort((a, b) => new Date(b.study_date) - new Date(a.study_date))
  }, [studies, search, patientFilterId])

  async function handleAdd(formData) {
    try {
      await createStudy.mutateAsync(formData)
      notify('Diagnostic study added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save diagnostic study', 'error')
    }
  }

  async function handleEdit(formData) {
    if (!editTarget) return
    try {
      await updateStudy.mutateAsync({ id: editTarget.id, data: formData })
      notify('Diagnostic study updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save diagnostic study', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteStudy.mutateAsync(deleteTarget.id)
      notify('Diagnostic study deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete diagnostic study', 'error')
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
            placeholder="Search by patient, study type, body region, or findings…"
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
            Study list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Scan}
            title="No diagnostic studies found"
            description={studies?.length ? 'Try a different search.' : 'Add your first diagnostic study to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/diagnostic-studies/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/diagnostic-studies/${s.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">
                      {s.patient_first_name} {s.patient_last_name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{s.study_type}</Badge>
                      {s.body_region && <span className="text-xs text-muted">{s.body_region}</span>}
                      {s.attachment_path && <Paperclip size={13} className="text-muted" />}
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-muted">{formatDate(s.study_date)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(s)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(s)
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
                    <th className="px-5 py-2.5 font-semibold">Study</th>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-5 py-2.5 font-semibold">Ordering physician</th>
                    <th className="px-5 py-2.5 font-semibold">Performing physician</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/diagnostic-studies/${s.id}`} className="font-semibold text-text hover:text-glow-b">
                          {s.patient_first_name} {s.patient_last_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge>{s.study_type}</Badge>
                          {s.attachment_path && <Paperclip size={13} className="text-muted" />}
                        </div>
                        {s.body_region && <div className="mt-0.5 text-xs text-muted">{s.body_region}</div>}
                      </td>
                      <td className="px-5 py-3 font-mono text-muted">{formatDate(s.study_date)}</td>
                      <td className="px-5 py-3 text-muted">{doctorName(s.ordering_physician) || 'Not specified'}</td>
                      <td className="px-5 py-3 text-muted">{doctorName(s.performing_physician) || 'Not specified'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(s)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => setDeleteTarget(s)}>
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

      <DiagnosticStudyFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        study={null}
        onSubmit={handleAdd}
        saving={createStudy.isPending}
      />

      <DiagnosticStudyFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        study={editTarget}
        onSubmit={handleEdit}
        saving={updateStudy.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete diagnostic study"
        description={deleteTarget && `Delete this ${deleteTarget.study_type} study? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteStudy.isPending}
      />
    </div>
  )
}
