import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Scan, Pencil, Trash2, Eye } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { api } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { DiagnosticStudyFormDialog } from '../components/diagnostic-studies/DiagnosticStudyFormDialog'
import { IconButton, Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('diagnostic-studies', '/diagnostic-studies')

export default function DiagnosticStudyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: study, isLoading } = useOne(id)
  const updateStudy = useUpdate()
  const deleteStudy = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)

  async function handleUpdate(formData) {
    try {
      await updateStudy.mutateAsync({ id, data: formData })
      notify('Diagnostic study updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save diagnostic study', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteStudy.mutateAsync(id)
      notify('Diagnostic study deleted')
      navigate('/diagnostic-studies')
    } catch (err) {
      notify(err.message || 'Failed to delete diagnostic study', 'error')
    }
  }

  async function handleView() {
    setFileBusy(true)
    try {
      const { blob } = await api.getBlob(`/diagnostic-studies/${id}/view`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      notify(err.message || 'Failed to open attachment', 'error')
    } finally {
      setFileBusy(false)
    }
  }

  usePageHeader({
    title: study?.study_type,
    icon: study && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <Scan size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit diagnostic study" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete diagnostic study" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!study) return <div className="text-sm text-muted">Diagnostic study not found.</div>

  const samePerformer = study.performing_physician && study.ordering_physician && study.performing_physician.id === study.ordering_physician.id

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/diagnostic-studies') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Patient</dt>
          <dd className="col-span-2">
            <Link to={`/patients/${study.patient_id}`} className="text-glow-b hover:underline">
              {study.patient_first_name} {study.patient_last_name}
            </Link>
          </dd>

          <dt className="font-semibold text-muted">Study type</dt>
          <dd className="col-span-2">
            <Badge>{study.study_type}</Badge>
          </dd>

          <dt className="font-semibold text-muted">Body region</dt>
          <dd className="col-span-2">{study.body_region || 'Not specified'}</dd>

          <dt className="font-semibold text-muted">Study date</dt>
          <dd className="col-span-2">{formatDate(study.study_date)}</dd>

          <dt className="font-semibold text-muted">Ordering physician</dt>
          <dd className="col-span-2">
            {study.ordering_physician ? (
              <Link to={`/doctors/${study.ordering_physician.id}`} className="text-glow-b hover:underline">
                Dr. {study.ordering_physician.first_name} {study.ordering_physician.last_name}
              </Link>
            ) : (
              'Not specified'
            )}
          </dd>

          <dt className="font-semibold text-muted">Performing physician</dt>
          <dd className="col-span-2">
            {study.performing_physician ? (
              samePerformer ? (
                'Same as ordering physician'
              ) : (
                <Link to={`/doctors/${study.performing_physician.id}`} className="text-glow-b hover:underline">
                  Dr. {study.performing_physician.first_name} {study.performing_physician.last_name}
                </Link>
              )
            ) : (
              'Not specified'
            )}
          </dd>

          <dt className="font-semibold text-muted">Institution</dt>
          <dd className="col-span-2">
            {study.institution ? (
              <Link to={`/institutions/${study.institution.id}`} className="text-glow-b hover:underline">
                {study.institution.name}
              </Link>
            ) : (
              'Not specified'
            )}
          </dd>

          {study.clinical_indication && (
            <>
              <dt className="font-semibold text-muted">Clinical indication</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{study.clinical_indication}</dd>
            </>
          )}

          {study.findings && (
            <>
              <dt className="font-semibold text-muted">Findings</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{study.findings}</dd>
            </>
          )}

          {study.conclusion && (
            <>
              <dt className="font-semibold text-muted">Conclusion</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{study.conclusion}</dd>
            </>
          )}

          {study.notes && (
            <>
              <dt className="font-semibold text-muted">Notes</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{study.notes}</dd>
            </>
          )}

          {study.attachment_path && (
            <>
              <dt className="font-semibold text-muted">Attachment</dt>
              <dd className="col-span-2">
                <Button variant="ghost" onClick={handleView} disabled={fileBusy}>
                  <Eye size={14} /> View {study.attachment_original_name ? `(${study.attachment_original_name})` : ''}
                </Button>
              </dd>
            </>
          )}

          {study.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(study.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <DiagnosticStudyFormDialog
        key={editOpen ? study.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        study={study}
        onSubmit={handleUpdate}
        saving={updateStudy.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete diagnostic study"
        description={`Delete this ${study.study_type} study? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteStudy.isPending}
      />
    </div>
  )
}
