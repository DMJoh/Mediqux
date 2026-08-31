import { useState } from 'react'
import { isValidPhone, isValidEmail } from '../../lib/format'
import { useAvailableInstitutions } from '../../lib/queries'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, MultiSelect } from '../ui/Field'
import { Button } from '../ui/Button'

const EMPTY_FORM = { first_name: '', last_name: '', specialty: '', license_number: '', phone: '', email: '', institution_ids: [] }

function toForm(doctor) {
  if (!doctor) return EMPTY_FORM
  return {
    first_name: doctor.first_name || '',
    last_name: doctor.last_name || '',
    specialty: doctor.specialty || '',
    license_number: doctor.license_number || '',
    phone: doctor.phone || '',
    email: doctor.email || '',
    institution_ids: (doctor.institutions ?? []).map((i) => i.id),
  }
}

/** Shared add/edit form for doctors — used from the list page (add) and the detail page (edit). */
export function DoctorFormDialog({ open, onOpenChange, doctor, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(doctor))
  const [errors, setErrors] = useState({})
  const { data: availableInstitutions } = useAvailableInstitutions()

  function validate() {
    const next = {}
    if (!form.first_name.trim()) next.first_name = 'First name is required'
    if (!form.last_name.trim()) next.last_name = 'Last name is required'
    if (!isValidEmail(form.email.trim())) next.email = 'Please enter a valid email address with @ symbol'
    if (!isValidPhone(form.phone.trim())) next.phone = 'Phone number can only contain numbers, +, spaces, and hyphens'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      specialty: form.specialty.trim() || null,
      license_number: form.license_number.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      institution_ids: form.institution_ids,
    })
  }

  const institutionOptions = (availableInstitutions ?? []).map((i) => ({
    value: i.id,
    label: `${i.name}${i.type ? ` (${i.type})` : ''}`,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={doctor ? 'Edit doctor' : 'Add new doctor'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name" required error={errors.first_name}>
            <TextInput
              id="first_name"
              value={form.first_name}
              error={errors.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
          </Field>
          <Field label="Last name" htmlFor="last_name" required error={errors.last_name}>
            <TextInput
              id="last_name"
              value={form.last_name}
              error={errors.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Specialty" htmlFor="specialty">
            <TextInput id="specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
          </Field>
          <Field label="License number" htmlFor="license_number">
            <TextInput
              id="license_number"
              value={form.license_number}
              onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <TextInput id="phone" value={form.phone} error={errors.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Institutions" htmlFor="institutions">
          <MultiSelect
            options={institutionOptions}
            value={form.institution_ids}
            onChange={(ids) => setForm((f) => ({ ...f, institution_ids: ids }))}
            emptyLabel="No institutions on file yet. Add one from the Institutions page first."
          />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : doctor ? 'Update doctor' : 'Save doctor'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
