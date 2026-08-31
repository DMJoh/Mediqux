import { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'

const CATEGORIES = [
  'Cardiovascular', 'Respiratory', 'Neurological', 'Gastrointestinal', 'Endocrine', 'Musculoskeletal',
  'Dermatological', 'Psychiatric', 'Infectious Disease', 'Oncological', 'Hematological', 'Renal',
  'Ophthalmological', 'ENT', 'Gynecological', 'Pediatric', 'Emergency', 'Other',
]

const ICD_REGEX = /^[A-Z]\d{2}(\.\d+)?$/i

const EMPTY_FORM = { name: '', description: '', icd_code: '', category: '', severity: '' }

function toForm(condition) {
  if (!condition) return EMPTY_FORM
  return {
    name: condition.name || '',
    description: condition.description || '',
    icd_code: condition.icd_code || '',
    category: condition.category || '',
    severity: condition.severity || '',
  }
}

/** Shared add/edit form for medical conditions — used from the list page (add) and the detail page (edit).
 * The backend doesn't validate ICD-code format (or reject an odd severity string) — it only enforces
 * that name/icd_code are unique. The format check here is a client-side data-quality nicety, not a
 * server requirement, and duplicate-name/code errors just surface through the normal error toast. */
export function ConditionFormDialog({ open, onOpenChange, condition, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(condition))
  const [errors, setErrors] = useState({})

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Condition name is required'
    if (form.icd_code.trim() && !ICD_REGEX.test(form.icd_code.trim())) {
      next.icd_code = 'ICD code should look like A12 or A12.34'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      icd_code: form.icd_code.trim().toUpperCase() || null,
      category: form.category || null,
      severity: form.severity || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={condition ? 'Edit condition' : 'Add medical condition'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="name" required error={errors.name}>
          <TextInput id="name" value={form.name} error={errors.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>

        <Field label="Description" htmlFor="description">
          <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ICD-10 code" htmlFor="icd_code" error={errors.icd_code}>
            <TextInput
              id="icd_code"
              placeholder="A12.34"
              value={form.icd_code}
              error={errors.icd_code}
              onChange={(e) => setForm((f) => ({ ...f, icd_code: e.target.value }))}
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <Select id="category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Severity" htmlFor="severity">
          <Select id="severity" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
            <option value="">Not set</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </Select>
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : condition ? 'Update condition' : 'Save condition'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
