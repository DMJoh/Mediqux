import { useState } from 'react'
import { isValidPhone, isValidEmail } from '../../lib/format'
import { useFieldValidation } from '../../lib/useFieldValidation'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

function toForm(patient) {
  if (!patient) return EMPTY_FORM
  return {
    first_name: patient.first_name || '',
    last_name: patient.last_name || '',
    date_of_birth: patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '',
    gender: patient.gender || '',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    emergency_contact_name: patient.emergency_contact_name || '',
    emergency_contact_phone: patient.emergency_contact_phone || '',
  }
}

function computeErrors(f) {
  const next = {}
  if (!f.first_name.trim()) next.first_name = 'First name is required'
  if (!f.last_name.trim()) next.last_name = 'Last name is required'
  if (!isValidEmail(f.email.trim())) next.email = 'Please enter a valid email address'
  if (!isValidPhone(f.phone.trim())) next.phone = 'Phone number can only contain numbers, +, spaces, and hyphens'
  if (!isValidPhone(f.emergency_contact_phone.trim()))
    next.emergency_contact_phone = 'Phone number can only contain numbers, +, spaces, and hyphens'
  return next
}

/**
 * Shared add/edit form for patients — used from the list page (add) and the patient detail page (edit).
 * Render with `key={open ? patient?.id ?? 'add' : 'closed'}` at the call site so the form remounts
 * (and resets) each time it opens, instead of syncing state from props in an effect.
 */
export function PatientFormDialog({ open, onOpenChange, patient, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(patient))

  const { errors, touch, guardSubmit } = useFieldValidation(form, computeErrors)

  function handleSubmit(e) {
    e.preventDefault()
    if (guardSubmit()) return
    onSubmit({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    })
  }

  const submitLabel = saving ? 'Saving…' : patient ? 'Update patient' : 'Save patient'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={patient ? 'Edit patient' : 'Add new patient'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name" required error={errors.first_name}>
            <TextInput
              id="first_name"
              value={form.first_name}
              error={errors.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              onBlur={() => touch('first_name')}
            />
          </Field>
          <Field label="Last name" htmlFor="last_name" required error={errors.last_name}>
            <TextInput
              id="last_name"
              value={form.last_name}
              error={errors.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              onBlur={() => touch('last_name')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="date_of_birth">
            <TextInput
              id="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
            />
          </Field>
          <Field label="Gender" htmlFor="gender">
            <Select id="gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Not specified</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <TextInput
              id="phone"
              value={form.phone}
              error={errors.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              onBlur={() => touch('phone')}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              onBlur={() => touch('email')}
            />
          </Field>
        </div>

        <Field label="Address" htmlFor="address">
          <Textarea id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Emergency contact name" htmlFor="ec_name">
            <TextInput
              id="ec_name"
              value={form.emergency_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
            />
          </Field>
          <Field label="Emergency contact phone" htmlFor="ec_phone" error={errors.emergency_contact_phone}>
            <TextInput
              id="ec_phone"
              value={form.emergency_contact_phone}
              error={errors.emergency_contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
              onBlur={() => touch('emergency_contact_phone')}
            />
          </Field>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
