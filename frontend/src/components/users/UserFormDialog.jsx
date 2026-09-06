import { useState } from 'react'
import { isValidEmail } from '../../lib/format'
import { usePatients } from '../../lib/queries'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, MultiSelect } from '../ui/Field'
import { Button } from '../ui/Button'

const ROLES = ['admin', 'user']

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  role: 'user',
  patient_ids: [],
  is_active: 'true',
}

function toForm(user) {
  if (!user) return EMPTY_FORM
  return {
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    email: user.email || '',
    password: '',
    role: user.role || 'user',
    patient_ids: (user.patients ?? []).map((p) => p.id),
    is_active: user.is_active === false ? 'false' : 'true',
  }
}

/** Shared add/edit form for users — used from the list page only (this domain has no
 * detail page, since the backend has no GET /users/:id endpoint; the list response
 * already carries every field this form needs). Password is only ever set here on
 * create — PUT /users/:id doesn't accept a password field at all, changing an existing
 * user's password goes through the separate ResetPasswordDialog / reset-password route. */
export function UserFormDialog({ open, onOpenChange, user, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(user))
  const [errors, setErrors] = useState({})
  const { data: patients } = usePatients()

  function validate() {
    const next = {}
    if (!form.first_name.trim()) next.first_name = 'First name is required'
    if (!form.last_name.trim()) next.last_name = 'Last name is required'
    if (!form.username.trim()) next.username = 'Username is required'
    if (!form.email.trim() || !isValidEmail(form.email.trim())) next.email = 'Please enter a valid email address'
    if (!user && form.password.length < 6) next.password = 'Password must be at least 6 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      firstName: form.first_name.trim(),
      lastName: form.last_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      patientIds: form.role === 'admin' ? [] : form.patient_ids,
    }
    if (!user) payload.password = form.password
    if (user) payload.isActive = form.is_active === 'true'
    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={user ? 'Edit user' : 'Add user'}>
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
          <Field label="Username" htmlFor="username" required error={errors.username}>
            <TextInput
              id="username"
              value={form.username}
              error={errors.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
          </Field>
          <Field label="Email" htmlFor="email" required error={errors.email}>
            <TextInput
              id="email"
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
        </div>

        {!user && (
          <Field label="Password" htmlFor="password" required error={errors.password}>
            <TextInput
              id="password"
              type="password"
              value={form.password}
              error={errors.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Minimum 6 characters"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="role" required>
            <Select
              id="role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, patient_ids: e.target.value === 'admin' ? [] : f.patient_ids }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          {user && (
            <Field label="Status" htmlFor="is_active">
              <Select id="is_active" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
          )}
        </div>

        {form.role !== 'admin' && (
          <Field label="Patient access" htmlFor="patient_ids">
            <MultiSelect
              options={(patients ?? []).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))}
              value={form.patient_ids}
              onChange={(ids) => setForm((f) => ({ ...f, patient_ids: ids }))}
              emptyLabel="No patients on file yet. Add one from the Patients page first."
            />
          </Field>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : user ? 'Update user' : 'Save user'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
