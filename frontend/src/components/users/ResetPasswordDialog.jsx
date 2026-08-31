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
  const [errors, setErrors] = useState({})

  function validate() {
    const next = {}
    if (password.length < 6) next.password = 'Password must be at least 6 characters'
    else if (password !== confirm) next.confirm = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
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
            placeholder="Minimum 6 characters"
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirm}>
          <TextInput id="confirmPassword" type="password" value={confirm} error={errors.confirm} onChange={(e) => setConfirm(e.target.value)} />
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
