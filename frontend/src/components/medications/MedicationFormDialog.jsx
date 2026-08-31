import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Textarea, MultiSelect } from '../ui/Field'
import { Button, IconButton } from '../ui/Button'

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Drops', 'Cream', 'Ointment',
  'Gel', 'Lotion', 'Patch', 'Inhaler', 'Spray', 'Other',
]
const DOSAGE_FORM_OPTIONS = DOSAGE_FORMS.map((f) => ({ value: f, label: f }))

const EMPTY_FORM = {
  name: '',
  generic_name: '',
  dosage_forms: [],
  strengths: [],
  active_ingredients: [],
  manufacturer: '',
  description: '',
}

function toForm(medication) {
  if (!medication) return EMPTY_FORM
  return {
    name: medication.name || '',
    generic_name: medication.generic_name || '',
    dosage_forms: medication.dosage_forms || [],
    strengths: medication.strengths || [],
    active_ingredients: (medication.active_ingredients || []).map((i) => ({ name: i.name || '', dosage: i.dosage || '' })),
    manufacturer: medication.manufacturer || '',
    description: medication.description || '',
  }
}

/** Free-text chip list (e.g. "500mg", "1g") — there's no fixed set of strengths like
 * there is for dosage forms, so this is a simple add/remove tag input, not a MultiSelect. */
function TagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }

  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={add}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-glass-2 px-2.5 py-1 text-xs font-semibold text-muted">
              {v}
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-muted-2 hover:text-white">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function IngredientsInput({ value, onChange }) {
  function update(i, field, val) {
    onChange(value.map((ing, idx) => (idx === i ? { ...ing, [field]: val } : ing)))
  }
  function remove(i) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((ing, i) => (
        <div key={i} className="flex gap-2">
          <TextInput
            placeholder="Ingredient name"
            value={ing.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            className="flex-1"
          />
          <TextInput
            placeholder="Dosage (e.g. 500mg)"
            value={ing.dosage}
            onChange={(e) => update(i, 'dosage', e.target.value)}
            className="flex-1"
          />
          <IconButton label="Remove ingredient" type="button" onClick={() => remove(i)}>
            <X size={14} />
          </IconButton>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => onChange([...value, { name: '', dosage: '' }])} className="self-start">
        <Plus size={14} /> Add ingredient
      </Button>
    </div>
  )
}

/** Shared add/edit form for medications — used from the list page (add) and the detail page (edit). */
export function MedicationFormDialog({ open, onOpenChange, medication, onSubmit, saving }) {
  const [form, setForm] = useState(() => toForm(medication))
  const [errors, setErrors] = useState({})

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Medication name is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: form.name.trim(),
      generic_name: form.generic_name.trim() || null,
      dosage_forms: form.dosage_forms,
      strengths: form.strengths,
      active_ingredients: form.active_ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), dosage: i.dosage.trim() })),
      manufacturer: form.manufacturer.trim() || null,
      description: form.description.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={medication ? 'Edit medication' : 'Add medication'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" required error={errors.name}>
            <TextInput id="name" value={form.name} error={errors.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Generic name" htmlFor="generic_name">
            <TextInput id="generic_name" value={form.generic_name} onChange={(e) => setForm((f) => ({ ...f, generic_name: e.target.value }))} />
          </Field>
        </div>

        <Field label="Dosage forms" htmlFor="dosage_forms">
          <MultiSelect
            options={DOSAGE_FORM_OPTIONS}
            value={form.dosage_forms}
            onChange={(v) => setForm((f) => ({ ...f, dosage_forms: v }))}
          />
        </Field>

        <Field label="Strengths" htmlFor="strengths">
          <TagInput value={form.strengths} onChange={(v) => setForm((f) => ({ ...f, strengths: v }))} placeholder="e.g. 500mg" />
        </Field>

        <Field label="Active ingredients" htmlFor="active_ingredients">
          <IngredientsInput value={form.active_ingredients} onChange={(v) => setForm((f) => ({ ...f, active_ingredients: v }))} />
        </Field>

        <Field label="Manufacturer" htmlFor="manufacturer">
          <TextInput id="manufacturer" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
        </Field>

        <Field label="Description" htmlFor="description">
          <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : medication ? 'Update medication' : 'Save medication'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
