import { useState } from 'react'
import { usePatients, useDoctors, useInstitutions } from '../../lib/queries'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'

const STUDY_TYPES = ['MRI', 'CT Scan', 'Echography', 'X-Ray', 'Ultrasound', 'PET Scan', 'Mammography', 'Endoscopy', 'Other']
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FIELDS = {
  patient_id: '',
  study_type: '',
  study_date: today(),
  body_region: '',
  ordering_physician_id: '',
  performing_physician_id: '',
  institution_id: '',
  clinical_indication: '',
  findings: '',
  conclusion: '',
  notes: '',
}

function toFields(study) {
  if (!study) return EMPTY_FIELDS
  return {
    patient_id: study.patient_id || '',
    study_type: study.study_type || '',
    study_date: study.study_date ? study.study_date.slice(0, 10) : today(),
    body_region: study.body_region || '',
    ordering_physician_id: study.ordering_physician?.id || study.ordering_physician_id || '',
    performing_physician_id: study.performing_physician?.id || study.performing_physician_id || '',
    institution_id: study.institution?.id || study.institution_id || '',
    clinical_indication: study.clinical_indication || '',
    findings: study.findings || '',
    conclusion: study.conclusion || '',
    notes: study.notes || '',
  }
}

/** Shared add/edit form for diagnostic studies — used from the list page (add + edit) and
 * the detail page (edit). Unlike Lab Reports, both POST and PUT here always go through the
 * same multipart endpoint (upload.single('attachment') is unconditional server-side), so
 * there's no add-vs-upload branching — this always builds one FormData and submits it. */
export function DiagnosticStudyFormDialog({ open, onOpenChange, study, onSubmit, saving }) {
  const [fields, setFields] = useState(() => toFields(study))
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const { data: patients } = usePatients()
  const { data: doctors } = useDoctors()
  const { data: institutions } = useInstitutions()

  function validate() {
    const next = {}
    if (!fields.patient_id) next.patient_id = 'Please select a patient'
    if (!fields.study_type) next.study_type = 'Please select a study type'
    if (!fields.study_date) next.study_date = 'Please select a study date'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleFileChange(e) {
    const picked = e.target.files?.[0] || null
    if (picked && !ALLOWED_TYPES.includes(picked.type)) {
      setErrors((prev) => ({ ...prev, file: 'Only PDF, JPEG, PNG, or WEBP files are supported' }))
      e.target.value = ''
      setFile(null)
      return
    }
    if (picked && picked.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, file: 'File must be 20MB or smaller' }))
      e.target.value = ''
      setFile(null)
      return
    }
    setErrors((prev) => ({ ...prev, file: undefined }))
    setFile(picked)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    const formData = new FormData()
    formData.append('patient_id', fields.patient_id)
    formData.append('study_type', fields.study_type)
    formData.append('study_date', fields.study_date)
    if (fields.body_region.trim()) formData.append('body_region', fields.body_region.trim())
    if (fields.ordering_physician_id) formData.append('ordering_physician_id', fields.ordering_physician_id)
    if (fields.performing_physician_id) formData.append('performing_physician_id', fields.performing_physician_id)
    if (fields.institution_id) formData.append('institution_id', fields.institution_id)
    if (fields.clinical_indication.trim()) formData.append('clinical_indication', fields.clinical_indication.trim())
    if (fields.findings.trim()) formData.append('findings', fields.findings.trim())
    if (fields.conclusion.trim()) formData.append('conclusion', fields.conclusion.trim())
    if (fields.notes.trim()) formData.append('notes', fields.notes.trim())
    if (file) formData.append('attachment', file)

    onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={study ? 'Edit diagnostic study' : 'Add diagnostic study'} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patient" htmlFor="patient_id" required error={errors.patient_id}>
            <Select id="patient_id" value={fields.patient_id} error={errors.patient_id} onChange={(e) => setFields((f) => ({ ...f, patient_id: e.target.value }))}>
              <option value="">Select patient</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Study type" htmlFor="study_type" required error={errors.study_type}>
            <Select id="study_type" value={fields.study_type} error={errors.study_type} onChange={(e) => setFields((f) => ({ ...f, study_type: e.target.value }))}>
              <option value="">Select type</option>
              {STUDY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Study date" htmlFor="study_date" required error={errors.study_date}>
            <TextInput
              id="study_date"
              type="date"
              value={fields.study_date}
              error={errors.study_date}
              onChange={(e) => setFields((f) => ({ ...f, study_date: e.target.value }))}
            />
          </Field>
          <Field label="Body region" htmlFor="body_region">
            <TextInput
              id="body_region"
              placeholder="e.g. Brain, Chest, Abdomen"
              value={fields.body_region}
              onChange={(e) => setFields((f) => ({ ...f, body_region: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ordering physician" htmlFor="ordering_physician_id">
            <Select
              id="ordering_physician_id"
              value={fields.ordering_physician_id}
              onChange={(e) => setFields((f) => ({ ...f, ordering_physician_id: e.target.value }))}
            >
              <option value="">Not specified</option>
              {(doctors ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                  {d.specialty ? ` - ${d.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Performing physician / radiologist" htmlFor="performing_physician_id">
            <Select
              id="performing_physician_id"
              value={fields.performing_physician_id}
              onChange={(e) => setFields((f) => ({ ...f, performing_physician_id: e.target.value }))}
            >
              <option value="">Not specified</option>
              {(doctors ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                  {d.specialty ? ` - ${d.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Institution / imaging center" htmlFor="institution_id">
          <Select id="institution_id" value={fields.institution_id} onChange={(e) => setFields((f) => ({ ...f, institution_id: e.target.value }))}>
            <option value="">Not specified</option>
            {(institutions ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>

        {study?.attachment_original_name && (
          <p className="text-xs text-muted">Current file: {study.attachment_original_name} - choosing a new file below will replace it.</p>
        )}
        <Field label="Attachment (optional)" htmlFor="attachment" error={errors.file}>
          <input
            id="attachment"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="w-full rounded-[10px] border border-glass-border bg-white/6 px-3 py-2.5 text-sm text-text file:mr-3 file:rounded-[8px] file:border-0 file:bg-glass-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text"
          />
        </Field>

        <Field label="Clinical indication" htmlFor="clinical_indication">
          <Textarea
            id="clinical_indication"
            rows={2}
            value={fields.clinical_indication}
            onChange={(e) => setFields((f) => ({ ...f, clinical_indication: e.target.value }))}
            placeholder="Reason for the study / symptoms…"
          />
        </Field>

        <Field label="Findings" htmlFor="findings">
          <Textarea id="findings" rows={4} value={fields.findings} onChange={(e) => setFields((f) => ({ ...f, findings: e.target.value }))} />
        </Field>

        <Field label="Conclusion / impression" htmlFor="conclusion">
          <Textarea id="conclusion" rows={2} value={fields.conclusion} onChange={(e) => setFields((f) => ({ ...f, conclusion: e.target.value }))} />
        </Field>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" rows={2} value={fields.notes} onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))} />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : study ? 'Update study' : 'Save study'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
