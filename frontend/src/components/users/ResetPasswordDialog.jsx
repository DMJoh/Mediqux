import { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput } from '../ui/Field'
import { Button } from '../ui/Button'

/** Admin resetting another user's password — separate from UserFormDialog since the
 * backend exposes it as its own endpoint (PUT /users/:id/reset-password), not part of
 * the general update route. Unlike the legacy page, this adds a confirm field since
 * there's no "current password" check backing this up. */
export function ResetPasswordDialog({ open, onOpenChange, user, onSubmit, saving }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState({})

  function computeErrors(pw, cf) {
    const next = {}
    if (pw.length < 6) next.password = 'Password must be at least 6 characters'
    else if (pw !== cf) next.confirm = 'Passwords do not match'
    return next
  }

  const allErrors = computeErrors(password, confirm)
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => touched[k]))

  function touch(field) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (Object.keys(allErrors).length > 0) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(allErrors).map((k) => [k, true])) }))
      return
    }
    onSubmit(password)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset password"
      description={user ? `Set a new password for ${user.first_name} ${user.last_name} (${user.username}).` : undefined}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="New password" htmlFor="newPassword" required error={errors.password}>
          <TextInput
            id="newPassword"
            type="password"
            value={password}
            error={errors.password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => touch('password')}
            placeholder="Minimum 6 characters"
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirm}>
          <TextInput
            id="confirmPassword"
            type="password"
            value={confirm}
            error={errors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => touch('confirm')}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Reset password'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
