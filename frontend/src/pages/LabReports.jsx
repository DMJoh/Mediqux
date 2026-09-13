import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Pencil, Trash2, Search, FileText, X } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { LabReportFormDialog } from '../components/lab-reports/LabReportFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('lab-reports', '/test-results')

function isAbnormal(report) {
  return (report.lab_values ?? []).some((v) => v.status?.toLowerCase() !== 'normal')
}

function abnormalCount(report) {
  return (report.lab_values ?? []).filter((v) => v.status?.toLowerCase() !== 'normal').length
}

export default function LabReports() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: reports, isLoading } = useList()
  const createReport = useCreate()
  const updateReport = useUpdate()
  const deleteReport = useDelete()
  const notify = useToast()

  // /test-results/upload and /test-results/:id/lab-values aren't standard CRUD
  // endpoints, so they're wired up as their own mutations rather than through
  // createResourceHooks — both invalidate the same 'lab-reports' list query.
  const uploadReport = useMutation({
    mutationFn: (formData) => api.post('/test-results/upload', formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lab-reports'] }),
  })
  const attachLabValues = useMutation({
    mutationFn: ({ id, labValues }) => api.post(`/test-results/${id}/lab-values`, { lab_values: labValues }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lab-reports'] }),
  })

  const [searchParams, setSearchParams] = useSearchParams()

  // Exact patient_id filter, distinct from the free-text search box — used when
  // linked to from a patient's own detail page ("View all lab reports").
  const patientFilterId = searchParams.get('patient') || ''
  const patientFilterName = useMemo(() => {
    const match = (reports ?? []).find((r) => r.patient_id === patientFilterId)
    return match ? `${match.patient_first_name} ${match.patient_last_name}` : null
  }, [reports, patientFilterId])

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
    title: 'Lab Reports',
    subtitle: 'Test results, on file or attached as PDF',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add lab report
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (reports ?? [])
      .filter((r) => !patientFilterId || r.patient_id === patientFilterId)
      .filter(
        (r) =>
          !term ||
          r.patient_first_name?.toLowerCase().includes(term) ||
          r.patient_last_name?.toLowerCase().includes(term) ||
          r.test_name?.toLowerCase().includes(term) ||
          r.test_type?.toLowerCase().includes(term) ||
          (r.lab_values ?? []).some((v) => v.parameter_name?.toLowerCase().includes(term)),
      )
      .sort((a, b) => new Date(b.test_date) - new Date(a.test_date))
  }, [reports, search, patientFilterId])

  async function handleAdd(payload) {
    try {
      if (payload.file) {
        const formData = new FormData()
        formData.append('patientId', payload.fields.patient_id)
        if (payload.fields.appointment_id) formData.append('appointmentId', payload.fields.appointment_id)
        formData.append('testName', payload.fields.test_name)
        formData.append('testType', payload.fields.test_type)
        formData.append('testDate', payload.fields.test_date)
        if (payload.fields.institution_id) formData.append('institutionId', payload.fields.institution_id)
        if (payload.fields.performed_by_id) formData.append('performedById', payload.fields.performed_by_id)
        formData.append('pdfFile', payload.file)
        const created = await uploadReport.mutateAsync(formData)
        if (payload.labValues.length) {
          await attachLabValues.mutateAsync({ id: created.id, labValues: payload.labValues })
        }
      } else {
        await createReport.mutateAsync({ ...payload.fields, lab_values: payload.labValues })
      }
      notify('Lab report added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save lab report', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateReport.mutateAsync({ id: editTarget.id, data: { ...payload.fields, lab_values: payload.labValues } })
      notify('Lab report updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save lab report', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteReport.mutateAsync(deleteTarget.id)
      notify('Lab report deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete lab report', 'error')
    }
  }

  function keyValues(report) {
    const values = report.lab_values ?? []
    const shown = values.slice(0, 2).map((v) => `${v.parameter_name}: ${v.value}${v.unit ? ` ${v.unit}` : ''}`)
    const rest = values.length - shown.length
    return { shown, rest }
  }

  const adding = createReport.isPending || uploadReport.isPending || attachLabValues.isPending

  return (
    <div>
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-[16px] p-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-[10px] border border-glass-border bg-white/6 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, test name, type, or parameter…"
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
            Lab report list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No lab reports found"
            description={reports?.length ? 'Try a different search.' : 'Add your first lab report to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/lab-reports/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/lab-reports/${r.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{r.test_name}</div>
                    <div className="mt-1 truncate text-sm text-muted">
                      {r.patient_first_name} {r.patient_last_name}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{r.test_type}</Badge>
                      {isAbnormal(r) ? <Badge tone="critical">Abnormal ({abnormalCount(r)})</Badge> : <Badge tone="normal">Normal</Badge>}
                      {r.pdf_file_path && <FileText size={13} className="text-muted" />}
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-muted">{formatDate(r.test_date)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(r)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(r)
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
                    <th className="px-5 py-2.5 font-semibold">Test</th>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-5 py-2.5 font-semibold">Key values</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const { shown, rest } = keyValues(r)
                    return (
                      <tr key={r.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                        <td className="px-5 py-3">
                          <Link to={`/lab-reports/${r.id}`} className="font-semibold text-text hover:text-glow-b">
                            {r.patient_first_name} {r.patient_last_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span>{r.test_name}</span>
                            {r.pdf_file_path && <FileText size={13} className="text-muted" />}
                          </div>
                          <Badge>{r.test_type}</Badge>
                        </td>
                        <td className="px-5 py-3 font-mono text-muted">{formatDate(r.test_date)}</td>
                        <td className="max-w-64 truncate px-5 py-3 text-muted">
                          {shown.length ? shown.join(', ') : 'No values recorded'}
                          {rest > 0 && ` +${rest} more`}
                        </td>
                        <td className="px-5 py-3">
                          {isAbnormal(r) ? <Badge tone="critical">Abnormal ({abnormalCount(r)})</Badge> : <Badge tone="normal">Normal</Badge>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <IconButton label="Edit" onClick={() => setEditTarget(r)}>
                              <Pencil size={14} />
                            </IconButton>
                            <IconButton label="Delete" onClick={() => setDeleteTarget(r)}>
                              <Trash2 size={14} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <LabReportFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        report={null}
        reports={reports}
        onSubmit={handleAdd}
        saving={adding}
      />

      <LabReportFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        report={editTarget}
        reports={reports}
        onSubmit={handleEdit}
        saving={updateReport.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete lab report"
        description={deleteTarget && `Delete "${deleteTarget.test_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteReport.isPending}
      />
    </div>
  )
}
