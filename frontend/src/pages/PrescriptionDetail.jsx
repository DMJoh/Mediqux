import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Pencil, Trash2 } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDate, formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { PrescriptionFormDialog } from '../components/prescriptions/PrescriptionFormDialog'
import { IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('prescriptions', '/prescriptions')

function statusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function PrescriptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: prescription, isLoading } = useOne(id)
  const updatePrescription = useUpdate()
  const deletePrescription = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updatePrescription.mutateAsync({ id, data: payload })
      notify('Prescription updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save prescription', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deletePrescription.mutateAsync(id)
      notify('Prescription deleted')
      navigate('/prescriptions')
    } catch (err) {
      notify(err.message || 'Failed to delete prescription', 'error')
    }
  }

  usePageHeader({
    title: prescription?.medication_name,
    icon: prescription && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <FileText size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit prescription" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete prescription" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!prescription) return <div className="text-sm text-muted">Prescription not found.</div>

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/prescriptions') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Patient</dt>
          <dd className="col-span-2">
            {prescription.patient_id ? (
              <Link to={`/patients/${prescription.patient_id}`} className="text-glow-b hover:underline">
                {prescription.patient_first_name} {prescription.patient_last_name}
              </Link>
            ) : (
              `${prescription.patient_first_name ?? ''} ${prescription.patient_last_name ?? ''}`.trim() || 'Not specified'
            )}
          </dd>

          <dt className="font-semibold text-muted">Doctor</dt>
          <dd className="col-span-2">
            {prescription.doctor_first_name ? `Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}` : 'Not assigned'}
          </dd>

          <dt className="font-semibold text-muted">Appointment</dt>
          <dd className="col-span-2">
            <Link to={`/appointments/${prescription.appointment_id}`} className="text-glow-b hover:underline">
              {formatDate(prescription.appointment_date)}
              {prescription.appointment_type ? ` - ${prescription.appointment_type}` : ''}
            </Link>
          </dd>

          <dt className="font-semibold text-muted">Medication</dt>
          <dd className="col-span-2">
            {prescription.medication_id ? (
              <Link to={`/medications/${prescription.medication_id}`} className="text-glow-b hover:underline">
                {prescription.medication_name}
              </Link>
            ) : (
              prescription.medication_name
            )}
            {prescription.medication_generic_name && <span className="text-muted"> ({prescription.medication_generic_name})</span>}
          </dd>

          <dt className="font-semibold text-muted">Dosage</dt>
          <dd className="col-span-2">{prescription.dosage}</dd>

          <dt className="font-semibold text-muted">Frequency</dt>
          <dd className="col-span-2">{prescription.frequency}</dd>

          <dt className="font-semibold text-muted">Duration</dt>
          <dd className="col-span-2">{prescription.duration || 'Not set'}</dd>

          <dt className="font-semibold text-muted">Status</dt>
          <dd className="col-span-2">
            <Badge tone={prescription.status}>{statusLabel(prescription.status)}</Badge>
          </dd>

          {prescription.instructions && (
            <>
              <dt className="font-semibold text-muted">Instructions</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{prescription.instructions}</dd>
            </>
          )}

          {prescription.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(prescription.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <PrescriptionFormDialog
        key={editOpen ? prescription.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        prescription={prescription}
        onSubmit={handleUpdate}
        saving={updatePrescription.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete prescription"
        description={`Delete this prescription for ${prescription.medication_name}? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deletePrescription.isPending}
      />
    </div>
  )
}
