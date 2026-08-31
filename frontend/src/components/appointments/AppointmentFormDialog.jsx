import { useState } from 'react'
import { usePatients, useDoctors, useInstitutions } from '../../lib/queries'
import { toDatetimeLocal } from '../../lib/format'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'

const TYPES = ['Consultation', 'Follow-up', 'Emergency', 'Routine Check-up', 'Specialist Referral', 'Diagnostic', 'Treatment', 'Other']

const EMPTY_FORM = {
  patient_id: '',
  doctor_id: '',
  institution_id: '',
  appointment_date: '',
  type: '',
  status: 'scheduled',
  notes: '',
  diagnosis: '',
}

function toForm(appointment) {
  if (!appointment) return EMPTY_FORM
  return {
    patient_id: appointment.patient_id || '',
    doctor_id: appointment.doctor_id || '',
    institution_id: appointment.institution_id || '',
    appointment_date: toDatetimeLocal(appointment.appointment_date),
    type: appointment.type || '',
    status: appointment.status || 'scheduled',
    notes: appointment.notes || '',
    diagnosis: appointment.diagnosis || '',
  }
}

/** Shared add/edit form for appointments — used from the list page (add) and the detail page (edit).
 * PUT has no server-side defaults or required-field checks (unlike POST), so payload always
 * includes patient_id/appointment_date/status in full to avoid a 500 from a null NOT NULL column. */
export function AppointmentFormDialog({ open, onOpenChange, appointment, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(appointment))
  const [errors, setErrors] = useState({})
  const { data: patients } = usePatients()
  const { data: doctors } = useDoctors()
  const { data: institutions } = useInstitutions()

  function validate() {
    const next = {}
    if (!form.patient_id) next.patient_id = 'Please select a patient'
    if (!form.appointment_date) next.appointment_date = 'Please select a date and time'
    if (form.appointment_date && !appointment && form.status === 'scheduled') {
      if (new Date(form.appointment_date) < new Date()) {
        next.appointment_date = 'Cannot schedule an appointment in the past'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      institution_id: form.institution_id || null,
      appointment_date: new Date(form.appointment_date).toISOString(),
      type: form.type || null,
      status: form.status,
      notes: form.notes.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={appointment ? 'Edit appointment' : 'Schedule appointment'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Patient" htmlFor="patient_id" required error={errors.patient_id}>
          <Select id="patient_id" value={form.patient_id} error={errors.patient_id} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}>
            <option value="">Select patient</option>
            {(patients ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Doctor" htmlFor="doctor_id">
            <Select id="doctor_id" value={form.doctor_id} onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value }))}>
              <option value="">Not specified</option>
              {(doctors ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                  {d.specialty ? ` - ${d.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Institution" htmlFor="institution_id">
            <Select id="institution_id" value={form.institution_id} onChange={(e) => setForm((f) => ({ ...f, institution_id: e.target.value }))}>
              <option value="">Not specified</option>
              {(institutions ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.type ? ` (${i.type})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date & time" htmlFor="appointment_date" required error={errors.appointment_date}>
            <TextInput
              id="appointment_date"
              type="datetime-local"
              value={form.appointment_date}
              error={errors.appointment_date}
              onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))}
            />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="">Select type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Status" htmlFor="status">
          <Select id="status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes or instructions…" />
        </Field>

        {form.status === 'completed' && (
          <Field label="Diagnosis" htmlFor="diagnosis">
            <Textarea id="diagnosis" value={form.diagnosis} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} />
          </Field>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : appointment ? 'Update appointment' : 'Save appointment'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
