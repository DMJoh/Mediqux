import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Stethoscope, Pencil, Trash2, Building2 } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { DoctorFormDialog } from '../components/doctors/DoctorFormDialog'
import { IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('doctors', '/doctors')

export default function DoctorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: doctor, isLoading } = useOne(id)
  const updateDoctor = useUpdate()
  const deleteDoctor = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updateDoctor.mutateAsync({ id, data: payload })
      notify('Doctor updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save doctor', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteDoctor.mutateAsync(id)
      notify('Doctor deleted')
      navigate('/doctors')
    } catch (err) {
      notify(err.message || 'Failed to delete doctor', 'error')
    }
  }

  usePageHeader({
    title: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : undefined,
    icon: doctor && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <Stethoscope size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit doctor" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete doctor" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!doctor) return <div className="text-sm text-muted">Doctor not found.</div>

  const institutions = doctor.institutions ?? []

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/doctors') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Specialty</dt>
          <dd className="col-span-2">{doctor.specialty ?? 'Not specified'}</dd>

          <dt className="font-semibold text-muted">License number</dt>
          <dd className="col-span-2 font-mono">{doctor.license_number || 'Not provided'}</dd>

          <dt className="font-semibold text-muted">Phone</dt>
          <dd className="col-span-2">
            {doctor.phone ? (
              <a href={`tel:${doctor.phone}`} className="text-glow-b hover:underline">
                {doctor.phone}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          <dt className="font-semibold text-muted">Email</dt>
          <dd className="col-span-2">
            {doctor.email ? (
              <a href={`mailto:${doctor.email}`} className="text-glow-b hover:underline">
                {doctor.email}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          {doctor.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(doctor.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Institutions <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{institutions.length}</span>
          </h2>
        </div>
        {institutions.length ? (
          <div className="divide-y divide-glass-border">
            {institutions.map((i) => (
              <Link
                key={i.id}
                to={`/institutions/${i.id}`}
                className="flex items-center gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b"
              >
                <Building2 size={15} className="shrink-0 text-muted" />
                <span className="font-medium">{i.name}</span>
                {i.type && <span className="text-muted"> - {i.type}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">Not associated with any institution yet.</p>
        )}
      </div>

      <DoctorFormDialog
        key={editOpen ? doctor.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        doctor={doctor}
        onSubmit={handleUpdate}
        saving={updateDoctor.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete doctor"
        description={`Delete "Dr. ${doctor.first_name} ${doctor.last_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteDoctor.isPending}
      />
    </div>
  )
}
