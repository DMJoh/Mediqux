import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Pencil, Trash2, Eye, Download } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { api } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { LabReportFormDialog } from '../components/lab-reports/LabReportFormDialog'
import { IconButton, Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useList, useUpdate, useDelete } = createResourceHooks('lab-reports', '/test-results')

function statusTone(status) {
  const s = (status || '').toLowerCase()
  if (s === 'normal') return 'normal'
  if (s === 'critical') return 'critical'
  if (s === 'low') return 'lab-low'
  if (s === 'high') return 'lab-high'
  return 'default'
}

export default function LabReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: report, isLoading } = useOne(id)
  const { data: reports } = useList()
  const updateReport = useUpdate()
  const deleteReport = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updateReport.mutateAsync({ id, data: { ...payload.fields, lab_values: payload.labValues } })
      notify('Lab report updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save lab report', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteReport.mutateAsync(id)
      notify('Lab report deleted')
      navigate('/lab-reports')
    } catch (err) {
      notify(err.message || 'Failed to delete lab report', 'error')
    }
  }

  async function handleView() {
    setFileBusy(true)
    try {
      const { blob } = await api.getBlob(`/test-results/${id}/view`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      notify(err.message || 'Failed to open PDF', 'error')
    } finally {
      setFileBusy(false)
    }
  }

  async function handleDownload() {
    setFileBusy(true)
    try {
      const { blob, filename } = await api.getBlob(`/test-results/${id}/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      notify(err.message || 'Failed to download PDF', 'error')
    } finally {
      setFileBusy(false)
    }
  }

  usePageHeader({
    title: report?.test_name,
    icon: report && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <FlaskConical size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit lab report" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete lab report" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!report) return <div className="text-sm text-muted">Lab report not found.</div>

  const labValues = report.lab_values ?? []

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/lab-reports') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Patient</dt>
          <dd className="col-span-2">
            <Link to={`/patients/${report.patient_id}`} className="text-glow-b hover:underline">
              {report.patient_first_name} {report.patient_last_name}
            </Link>
          </dd>

          <dt className="font-semibold text-muted">Appointment</dt>
          <dd className="col-span-2">
            {report.appointment_id ? (
              <Link to={`/appointments/${report.appointment_id}`} className="text-glow-b hover:underline">
                {formatDate(report.appointment_date)}
                {report.appointment_type ? ` - ${report.appointment_type}` : ''}
              </Link>
            ) : (
              'Not linked'
            )}
          </dd>

          <dt className="font-semibold text-muted">Test type</dt>
          <dd className="col-span-2">
            <Badge>{report.test_type}</Badge>
          </dd>

          <dt className="font-semibold text-muted">Test date</dt>
          <dd className="col-span-2">{formatDate(report.test_date)}</dd>

          <dt className="font-semibold text-muted">Institution</dt>
          <dd className="col-span-2">
            {report.institution_id ? (
              <Link to={`/institutions/${report.institution_id}`} className="text-glow-b hover:underline">
                {report.institution_name}
              </Link>
            ) : (
              'Not specified'
            )}
          </dd>

          <dt className="font-semibold text-muted">Performed by</dt>
          <dd className="col-span-2">
            {report.performed_by ? (
              <Link to={`/doctors/${report.performed_by.id}`} className="text-glow-b hover:underline">
                Dr. {report.performed_by.first_name} {report.performed_by.last_name}
              </Link>
            ) : (
              'Not specified'
            )}
          </dd>

          {report.pdf_file_path && (
            <>
              <dt className="font-semibold text-muted">PDF report</dt>
              <dd className="col-span-2 flex gap-2">
                <Button variant="ghost" onClick={handleView} disabled={fileBusy}>
                  <Eye size={14} /> View
                </Button>
                <Button variant="ghost" onClick={handleDownload} disabled={fileBusy}>
                  <Download size={14} /> Download
                </Button>
              </dd>
            </>
          )}

          {report.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(report.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="glass mb-4 rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Lab values <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{labValues.length}</span>
          </h2>
        </div>
        {labValues.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-glass-border bg-white/3 text-left font-mono text-[0.68rem] uppercase tracking-wide text-muted-2">
                  <th className="px-5 py-2.5 font-semibold">Parameter</th>
                  <th className="px-5 py-2.5 font-semibold">Value</th>
                  <th className="px-5 py-2.5 font-semibold">Reference range</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {labValues.map((v) => (
                  <tr key={v.id} className="border-b border-glass-border last:border-none">
                    <td className="px-5 py-3 font-medium">{v.parameter_name}</td>
                    <td className="px-5 py-3 font-mono text-muted">
                      {v.value}
                      {v.unit ? ` ${v.unit}` : ''}
                    </td>
                    <td className="px-5 py-3 text-muted">{v.reference_range || 'Not set'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(v.status)}>{v.status || 'Normal'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">No lab values recorded for this report.</p>
        )}
      </div>

      {report.extracted_text && (
        <div className="glass rounded-[20px]">
          <div className="border-b border-glass-border px-5 py-3.75">
            <h2 className="text-[0.9rem] font-bold">Extracted text</h2>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap px-5 py-4 text-xs text-muted">{report.extracted_text}</pre>
        </div>
      )}

      <LabReportFormDialog
        key={editOpen ? report.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        report={report}
        reports={reports}
        onSubmit={handleUpdate}
        saving={updateReport.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete lab report"
        description={`Delete "${report.test_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteReport.isPending}
      />
    </div>
  )
}
