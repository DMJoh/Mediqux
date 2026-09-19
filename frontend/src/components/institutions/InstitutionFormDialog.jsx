import { useState } from 'react'
import { isValidPhone, isValidEmail, isValidWebsite } from '../../lib/format'
import { useFieldValidation } from '../../lib/useFieldValidation'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select } from '../ui/Field'
import { Button } from '../ui/Button'

const TYPES = ['Hospital', 'Clinic', 'Laboratory', 'Pharmacy', 'Diagnostic Center', 'Nursing Home', 'Other']

const EMPTY_FORM = { name: '', type: '', address: '', phone: '', email: '', website: '' }

function toForm(institution) {
  if (!institution) return EMPTY_FORM
  return {
    name: institution.name || '',
    type: institution.type || '',
    address: institution.address || '',
    phone: institution.phone || '',
    email: institution.email || '',
    website: institution.website || '',
  }
}

function computeErrors(f) {
  const next = {}
  if (!f.name.trim()) next.name = 'Institution name is required'
  if (!isValidEmail(f.email.trim())) next.email = 'Please enter a valid email address'
  if (!isValidPhone(f.phone.trim())) next.phone = 'Phone number can only contain numbers, +, spaces, and hyphens'
  if (!isValidWebsite(f.website.trim())) next.website = 'Website must start with http:// or https://'
  return next
}

/** Shared add/edit form for institutions — used from the list page (add) and the detail page (edit). */
export function InstitutionFormDialog({ open, onOpenChange, institution, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(institution))

  const { errors, touch, guardSubmit } = useFieldValidation(form, computeErrors)

  function handleSubmit(e) {
    e.preventDefault()
    if (guardSubmit()) return
    onSubmit({
      name: form.name.trim(),
      type: form.type || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
    })
  }

  let submitLabel = institution ? 'Update institution' : 'Save institution'
  if (saving) submitLabel = 'Saving…'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={institution ? 'Edit institution' : 'Add new institution'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={errors.name}>
            <TextInput
              id="name"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => touch('name')}
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

        <Field label="Address" htmlFor="address">
          <TextInput id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>

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

        <Field label="Website" htmlFor="website" error={errors.website}>
          <TextInput
            id="website"
            placeholder="https://"
            value={form.website}
            error={errors.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            onBlur={() => touch('website')}
          />
        </Field>

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
