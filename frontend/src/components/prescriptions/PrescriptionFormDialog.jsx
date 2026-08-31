import { useMemo, useState } from 'react'
import { useAppointments, useMedications } from '../../lib/queries'
import { formatDate } from '../../lib/format'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'

const FREQUENCIES = [
  'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
  'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours',
  'As needed', 'Before meals', 'After meals', 'At bedtime',
]

const EMPTY_FORM = {
  appointment_id: '',
  medication_id: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
  status: 'active',
}

function toForm(prescription) {
  if (!prescription) return EMPTY_FORM
  return {
    appointment_id: prescription.appointment_id || '',
    medication_id: prescription.medication_id || '',
    dosage: prescription.dosage || '',
    frequency: prescription.frequency || '',
    duration: prescription.duration || '',
    instructions: prescription.instructions || '',
    status: prescription.status || 'active',
  }
}

/** Shared add/edit form for prescriptions — used from the list page (add) and the detail
 * page (edit). Prescriptions link to a patient/doctor only via appointment_id (no direct
 * patient_id/doctor_id column), so the appointment picker is the primary "who is this
 * for" selector, matching the legacy UI's model. */
export function PrescriptionFormDialog({ open, onOpenChange, prescription, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(prescription))
  const [errors, setErrors] = useState({})
  const { data: appointments } = useAppointments()
  const { data: medications } = useMedications()

  const sortedAppointments = useMemo(
    () => [...(appointments ?? [])].sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date)),
    [appointments],
  )

  const selectedAppointment = (appointments ?? []).find((a) => a.id === form.appointment_id)

  function validate() {
    const next = {}
    if (!form.appointment_id) next.appointment_id = 'Please select an appointment'
    if (!form.medication_id) next.medication_id = 'Please select a medication'
    if (!form.dosage.trim()) next.dosage = 'Dosage is required'
    if (!form.frequency) next.frequency = 'Please select a frequency'
    if (!form.duration.trim()) next.duration = 'Duration is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      appointment_id: form.appointment_id,
      medication_id: form.medication_id,
      dosage: form.dosage.trim(),
      frequency: form.frequency,
      duration: form.duration.trim(),
      instructions: form.instructions.trim() || null,
      status: form.status,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={prescription ? 'Edit prescription' : 'Add prescription'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Appointment" htmlFor="appointment_id" required error={errors.appointment_id}>
          <Select
            id="appointment_id"
            value={form.appointment_id}
            error={errors.appointment_id}
            onChange={(e) => setForm((f) => ({ ...f, appointment_id: e.target.value }))}
          >
            <option value="">Select appointment</option>
            {sortedAppointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.patient_first_name} {a.patient_last_name} - {formatDate(a.appointment_date)}
                {a.type ? ` (${a.type})` : ''}
              </option>
            ))}
          </Select>
          {selectedAppointment && (
            <p className="text-xs text-muted">
              Patient: {selectedAppointment.patient_first_name} {selectedAppointment.patient_last_name}
              {selectedAppointment.doctor_first_name && (
                <>
                  {' '}
                  · Doctor: Dr. {selectedAppointment.doctor_first_name} {selectedAppointment.doctor_last_name}
                </>
              )}
            </p>
          )}
        </Field>

        <Field label="Medication" htmlFor="medication_id" required error={errors.medication_id}>
          <Select
            id="medication_id"
            value={form.medication_id}
            error={errors.medication_id}
            onChange={(e) => setForm((f) => ({ ...f, medication_id: e.target.value }))}
          >
            <option value="">Select medication</option>
            {(medications ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.generic_name ? ` (${m.generic_name})` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dosage" htmlFor="dosage" required error={errors.dosage}>
            <TextInput
              id="dosage"
              placeholder="e.g. 500mg"
              value={form.dosage}
              error={errors.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            />
          </Field>
          <Field label="Frequency" htmlFor="frequency" required error={errors.frequency}>
            <Select id="frequency" value={form.frequency} error={errors.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}>
              <option value="">Select frequency</option>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Duration" htmlFor="duration" required error={errors.duration}>
            <TextInput
              id="duration"
              placeholder="e.g. 7 days"
              value={form.duration}
              error={errors.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
            />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </Field>
        </div>

        <Field label="Special instructions" htmlFor="instructions">
          <Textarea
            id="instructions"
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            placeholder="Enter special instructions for the patient…"
          />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : prescription ? 'Update prescription' : 'Save prescription'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
