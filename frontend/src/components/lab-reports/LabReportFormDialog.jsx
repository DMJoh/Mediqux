import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { usePatients, useAppointments, useInstitutions, useDoctors } from '../../lib/queries'
import { Dialog } from '../ui/Dialog'
import { Field, TextInput, Select } from '../ui/Field'
import { Button, IconButton } from '../ui/Button'

const TEST_TYPES = ['Blood', 'Urine', 'X-Ray', 'MRI', 'CT', 'Ultrasound', 'ECG', 'Pathology', 'Other']
const MAX_FILE_BYTES = 10 * 1024 * 1024

function today() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FIELDS = {
  patient_id: '',
  appointment_id: '',
  test_name: '',
  test_type: '',
  test_date: today(),
  institution_id: '',
  performed_by_id: '',
}

function toFields(report) {
  if (!report) return EMPTY_FIELDS
  return {
    patient_id: report.patient_id || '',
    appointment_id: report.appointment_id || '',
    test_name: report.test_name || '',
    test_type: report.test_type || '',
    test_date: report.test_date ? report.test_date.slice(0, 10) : today(),
    institution_id: report.institution_id || '',
    performed_by_id: report.performed_by?.id || report.performed_by_id || '',
  }
}

function toLabValues(report) {
  if (!report) return []
  return (report.lab_values ?? []).map((v) => ({
    parameter_name: v.parameter_name || '',
    value: v.value ?? '',
    unit: v.unit || '',
    reference_range: v.reference_range || '',
    status: v.status || 'Normal',
  }))
}

/** Flattens lab_values across every already-loaded report into "most recent unit +
 * reference_range typed for this parameter name" — powers the datalist autocomplete
 * below. Replaces the legacy app's separate "Lab Panels" template CRUD subsystem with
 * something derived from the family's own history instead of a pre-configured catalog. */
function buildParameterSuggestions(reports) {
  const map = new Map()
  for (const report of reports ?? []) {
    for (const v of report.lab_values ?? []) {
      if (!v.parameter_name) continue
      const existing = map.get(v.parameter_name)
      if (!existing || new Date(report.test_date) > new Date(existing.test_date)) {
        map.set(v.parameter_name, { unit: v.unit || '', reference_range: v.reference_range || '', test_date: report.test_date })
      }
    }
  }
  return map
}

function LabValueRow({ row, onChange, onRemove, suggestions }) {
  function update(field, value) {
    const patch = { [field]: value }
    if (field === 'parameter_name') {
      const suggestion = suggestions.get(value)
      if (suggestion) {
        if (!row.unit) patch.unit = suggestion.unit
        if (!row.reference_range) patch.reference_range = suggestion.reference_range
      }
    }
    onChange({ ...row, ...patch })
  }

  return (
    <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-glass-border p-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_1.1fr_1fr_auto] sm:items-center">
      <TextInput
        list="lab-parameter-suggestions"
        placeholder="Parameter (e.g. Glucose)"
        value={row.parameter_name}
        onChange={(e) => update('parameter_name', e.target.value)}
        className="col-span-2 sm:col-span-1"
      />
      <TextInput type="number" step="0.001" placeholder="Value" value={row.value} onChange={(e) => update('value', e.target.value)} />
      <TextInput placeholder="Unit" value={row.unit} onChange={(e) => update('unit', e.target.value)} />
      <TextInput placeholder="Reference range" value={row.reference_range} onChange={(e) => update('reference_range', e.target.value)} />
      <Select value={row.status} onChange={(e) => update('status', e.target.value)}>
        <option value="Normal">Normal</option>
        <option value="High">High</option>
        <option value="Low">Low</option>
        <option value="Critical">Critical</option>
      </Select>
      <IconButton label="Remove value" type="button" onClick={onRemove} className="justify-self-end">
        <X size={14} />
      </IconButton>
    </div>
  )
}

/** Shared add/edit form for lab reports — used from the list page (add + edit) and the
 * detail page (edit). Editing never shows the PDF field: PUT /test-results/:id has no
 * way to attach or replace a file, only /test-results/upload (create-time only) does. */
export function LabReportFormDialog({ open, onOpenChange, report, reports, onSubmit, saving }) {
  const [fields, setFields] = useState(() => toFields(report))
  const [labValues, setLabValues] = useState(() => toLabValues(report))
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const { data: patients } = usePatients()
  const { data: appointments } = useAppointments()
  const { data: institutions } = useInstitutions()
  const { data: doctors } = useDoctors()

  const suggestions = useMemo(() => buildParameterSuggestions(reports), [reports])

  const patientAppointments = useMemo(
    () => (appointments ?? []).filter((a) => a.patient_id === fields.patient_id).sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date)),
    [appointments, fields.patient_id],
  )

  function validate() {
    const next = {}
    if (!fields.patient_id) next.patient_id = 'Please select a patient'
    if (!fields.test_name.trim()) next.test_name = 'Test name is required'
    if (!fields.test_type) next.test_type = 'Please select a test type'
    if (!fields.test_date) next.test_date = 'Please select a test date'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleFileChange(e) {
    const picked = e.target.files?.[0] || null
    if (picked && picked.type !== 'application/pdf') {
      setErrors((prev) => ({ ...prev, file: 'Only PDF files are supported' }))
      e.target.value = ''
      setFile(null)
      return
    }
    if (picked && picked.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, file: 'File must be 10MB or smaller' }))
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
    const cleanedValues = labValues
      .filter((v) => v.parameter_name.trim() && v.value !== '' && !Number.isNaN(Number(v.value)))
      .map((v) => ({
        parameter_name: v.parameter_name.trim(),
        value: Number(v.value),
        unit: v.unit.trim() || null,
        reference_range: v.reference_range.trim() || null,
        status: v.status || 'Normal',
      }))
    onSubmit({
      fields: {
        patient_id: fields.patient_id,
        appointment_id: fields.appointment_id || null,
        test_name: fields.test_name.trim(),
        test_type: fields.test_type,
        test_date: fields.test_date,
        institution_id: fields.institution_id || null,
        performed_by_id: fields.performed_by_id || null,
      },
      labValues: cleanedValues,
      file,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={report ? 'Edit lab report' : 'Add lab report'} size="lg">
      <datalist id="lab-parameter-suggestions">
        {[...suggestions.keys()].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patient" htmlFor="patient_id" required error={errors.patient_id}>
            <Select
              id="patient_id"
              value={fields.patient_id}
              error={errors.patient_id}
              onChange={(e) => setFields((f) => ({ ...f, patient_id: e.target.value, appointment_id: '' }))}
            >
              <option value="">Select patient</option>
              {(patients ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Appointment" htmlFor="appointment_id">
            <Select
              id="appointment_id"
              value={fields.appointment_id}
              onChange={(e) => setFields((f) => ({ ...f, appointment_id: e.target.value }))}
              disabled={!fields.patient_id}
            >
              <option value="">Not linked</option>
              {patientAppointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.appointment_date?.slice(0, 10)}
                  {a.type ? ` - ${a.type}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Test name" htmlFor="test_name" required error={errors.test_name}>
          <TextInput
            id="test_name"
            value={fields.test_name}
            error={errors.test_name}
            onChange={(e) => setFields((f) => ({ ...f, test_name: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Test type" htmlFor="test_type" required error={errors.test_type}>
            <Select id="test_type" value={fields.test_type} error={errors.test_type} onChange={(e) => setFields((f) => ({ ...f, test_type: e.target.value }))}>
              <option value="">Select type</option>
              {TEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Test date" htmlFor="test_date" required error={errors.test_date}>
            <TextInput
              id="test_date"
              type="date"
              value={fields.test_date}
              error={errors.test_date}
              onChange={(e) => setFields((f) => ({ ...f, test_date: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Institution" htmlFor="institution_id">
            <Select id="institution_id" value={fields.institution_id} onChange={(e) => setFields((f) => ({ ...f, institution_id: e.target.value }))}>
              <option value="">Not specified</option>
              {(institutions ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Performed by" htmlFor="performed_by_id">
            <Select id="performed_by_id" value={fields.performed_by_id} onChange={(e) => setFields((f) => ({ ...f, performed_by_id: e.target.value }))}>
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

        {!report && (
          <Field label="PDF report (optional)" htmlFor="pdfFile" error={errors.file}>
            <input
              id="pdfFile"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full rounded-[10px] border border-glass-border bg-white/6 px-3 py-2.5 text-sm text-text file:mr-3 file:rounded-[8px] file:border-0 file:bg-glass-2 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text"
            />
          </Field>
        )}
        {report?.pdf_file_path && (
          <p className="text-xs text-muted">This report has a PDF attached. Attaching a new file isn't supported yet — delete and re-add to replace it.</p>
        )}

        <Field label="Lab values" htmlFor="lab_values">
          <div className="flex flex-col gap-2">
            {labValues.map((row, i) => (
              <LabValueRow
                key={i}
                row={row}
                suggestions={suggestions}
                onChange={(next) => setLabValues((rows) => rows.map((r, idx) => (idx === i ? next : r)))}
                onRemove={() => setLabValues((rows) => rows.filter((_, idx) => idx !== i))}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLabValues((rows) => [...rows, { parameter_name: '', value: '', unit: '', reference_range: '', status: 'Normal' }])}
              className="self-start"
            >
              + Add value
            </Button>
          </div>
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : report ? 'Update report' : 'Save report'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
