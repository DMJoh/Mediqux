import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Pill, Pencil, Trash2 } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { MedicationFormDialog } from '../components/medications/MedicationFormDialog'
import { IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('medications', '/medications')

function usageCount(medication) {
  return (Number(medication?.prescription_count) || 0) + (Number(medication?.patient_medication_count) || 0)
}

export default function MedicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: medication, isLoading } = useOne(id)
  const updateMedication = useUpdate()
  const deleteMedication = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updateMedication.mutateAsync({ id, data: payload })
      notify('Medication updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save medication', 'error')
    }
  }

  function requestDelete() {
    const count = usageCount(medication)
    if (count > 0) {
      notify(`Can't delete: referenced in ${count} prescription/patient record(s). Remove those references first.`, 'error')
      return
    }
    setDeleteOpen(true)
  }

  async function handleDelete() {
    try {
      await deleteMedication.mutateAsync(id)
      notify('Medication deleted')
      navigate('/medications')
    } catch (err) {
      notify(err.message || 'Failed to delete medication', 'error')
    }
  }

  usePageHeader({
    title: medication?.name,
    icon: medication && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <Pill size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit medication" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete medication" onClick={requestDelete} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!medication) return <div className="text-sm text-muted">Medication not found.</div>

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/medications') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Generic name</dt>
          <dd className="col-span-2">{medication.generic_name || 'Not set'}</dd>

          <dt className="font-semibold text-muted">Dosage forms</dt>
          <dd className="col-span-2">
            {(medication.dosage_forms ?? []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {medication.dosage_forms.map((f) => (
                  <Badge key={f}>{f}</Badge>
                ))}
              </div>
            ) : (
              'Not set'
            )}
          </dd>

          <dt className="font-semibold text-muted">Strengths</dt>
          <dd className="col-span-2">{(medication.strengths ?? []).join(', ') || 'Not set'}</dd>

          <dt className="font-semibold text-muted">Active ingredients</dt>
          <dd className="col-span-2">
            {(medication.active_ingredients ?? []).length ? (
              <ul className="flex flex-col gap-0.5">
                {medication.active_ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.name}
                    {ing.dosage ? ` - ${ing.dosage}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              'Not set'
            )}
          </dd>

          <dt className="font-semibold text-muted">Manufacturer</dt>
          <dd className="col-span-2">{medication.manufacturer || 'Not provided'}</dd>

          {medication.description && (
            <>
              <dt className="font-semibold text-muted">Description</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{medication.description}</dd>
            </>
          )}

          <dt className="font-semibold text-muted">Usage</dt>
          <dd className="col-span-2 text-muted">
            {usageCount(medication)} prescription/patient record(s)
            {Number(medication.prescription_count) > 0 && (
              <Link to={`/prescriptions?q=${encodeURIComponent(medication.name)}`} className="ml-2 text-glow-b hover:underline">
                View prescriptions
              </Link>
            )}
          </dd>

          {medication.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(medication.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <MedicationFormDialog
        key={editOpen ? medication.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        medication={medication}
        onSubmit={handleUpdate}
        saving={updateMedication.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete medication"
        description={`Delete "${medication.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteMedication.isPending}
      />
    </div>
  )
}
