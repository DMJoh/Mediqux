import { useState } from 'react'

/** Shared inline-validation wiring for form dialogs: errors are computed fresh on every
 * render from `computeErrors(form)`, but only shown for fields the user has touched
 * (blurred a text input, or picked a value in a select) — not the moment the dialog opens.
 * `guardSubmit` returns true if the form has errors (after revealing all of them, so a
 * failed submit surfaces everything at once), false if it's clean and safe to submit. */
export function useFieldValidation(form, computeErrors) {
  const [touched, setTouched] = useState({})

  const allErrors = computeErrors(form)
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => touched[k]))

  function touch(field) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }))
  }

  function guardSubmit() {
    if (Object.keys(allErrors).length === 0) return false
    setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(allErrors).map((k) => [k, true])) }))
    return true
  }

  return { errors, allErrors, touch, guardSubmit }
}
