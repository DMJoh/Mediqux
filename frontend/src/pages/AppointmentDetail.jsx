import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Pencil, Trash2 } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDateTimeLong, formatTime, formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog'
import { IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('appointments', '/appointments')

function statusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: appointment, isLoading } = useOne(id)
  const updateAppointment = useUpdate()
  const deleteAppointment = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updateAppointment.mutateAsync({ id, data: payload })
      notify('Appointment updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save appointment', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteAppointment.mutateAsync(id)
      notify('Appointment deleted')
      navigate('/appointments')
    } catch (err) {
      notify(err.message || 'Failed to delete appointment', 'error')
    }
  }

  usePageHeader({
    title: appointment ? appointment.type || 'Appointment' : undefined,
    icon: appointment && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <CalendarDays size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit appointment" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete appointment" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!appointment) return <div className="text-sm text-muted">Appointment not found.</div>

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/appointments') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Status</dt>
          <dd className="col-span-2">
            <Badge tone={appointment.status}>{statusLabel(appointment.status)}</Badge>
          </dd>

          <dt className="font-semibold text-muted">Date &amp; time</dt>
          <dd className="col-span-2">
            {formatDateTimeLong(appointment.appointment_date)} at {formatTime(appointment.appointment_date)}
          </dd>

          <dt className="font-semibold text-muted">Patient</dt>
          <dd className="col-span-2">
            <Link to={`/patients/${appointment.patient_id}`} className="text-glow-b hover:underline">
              {appointment.patient_first_name} {appointment.patient_last_name}
            </Link>
          </dd>

          <dt className="font-semibold text-muted">Doctor</dt>
          <dd className="col-span-2">
            {appointment.doctor_id ? (
              <Link to={`/doctors/${appointment.doctor_id}`} className="text-glow-b hover:underline">
                Dr. {appointment.doctor_first_name} {appointment.doctor_last_name}
              </Link>
            ) : (
              'Not assigned'
            )}
            {appointment.doctor_specialty && <span className="text-muted"> - {appointment.doctor_specialty}</span>}
          </dd>

          <dt className="font-semibold text-muted">Institution</dt>
          <dd className="col-span-2">
            {appointment.institution_id ? (
              <Link to={`/institutions/${appointment.institution_id}`} className="text-glow-b hover:underline">
                {appointment.institution_name}
              </Link>
            ) : (
              'Not specified'
            )}
            {appointment.institution_type && <span className="text-muted"> - {appointment.institution_type}</span>}
          </dd>

          {appointment.notes && (
            <>
              <dt className="font-semibold text-muted">Notes</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{appointment.notes}</dd>
            </>
          )}

          {appointment.diagnosis && (
            <>
              <dt className="font-semibold text-muted">Diagnosis</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{appointment.diagnosis}</dd>
            </>
          )}

          {(appointment.patient_phone || appointment.patient_email) && (
            <>
              <dt className="font-semibold text-muted">Patient contact</dt>
              <dd className="col-span-2 flex flex-col gap-0.5">
                {appointment.patient_phone && (
                  <a href={`tel:${appointment.patient_phone}`} className="w-fit text-glow-b hover:underline">
                    {appointment.patient_phone}
                  </a>
                )}
                {appointment.patient_email && (
                  <a href={`mailto:${appointment.patient_email}`} className="w-fit text-glow-b hover:underline">
                    {appointment.patient_email}
                  </a>
                )}
              </dd>
            </>
          )}

          {appointment.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(appointment.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <AppointmentFormDialog
        key={editOpen ? appointment.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        appointment={appointment}
        onSubmit={handleUpdate}
        saving={updateAppointment.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete appointment"
        description="Delete this appointment? This cannot be undone."
        onConfirm={handleDelete}
        pending={deleteAppointment.isPending}
      />
    </div>
  )
}
