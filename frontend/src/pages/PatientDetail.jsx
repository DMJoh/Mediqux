import { useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, CalendarDays, Pill, FileText, FlaskConical, Scan } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDateLong, formatDate, formatDateTime, calculateAge } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { PatientFormDialog } from '../components/patients/PatientFormDialog'
import { IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('patients', '/patients')
const { useList: useAppointmentsList } = createResourceHooks('appointments', '/appointments')
const { useList: usePrescriptionsList } = createResourceHooks('prescriptions', '/prescriptions')
const { useList: useLabReportsList } = createResourceHooks('lab-reports', '/test-results')
const { useList: useDiagnosticStudiesList } = createResourceHooks('diagnostic-studies', '/diagnostic-studies')

const SHOWN = 5

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function statusLabel(status) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function isAbnormalReport(report) {
  return (report.lab_values ?? []).some((v) => v.status?.toLowerCase() !== 'normal')
}

/** A bounded "N most recent, View all →" sub-section — used for every related-record
 * list below. Not the full EmptyState component: these sit inside a page that already
 * has content, not an empty-page state, so an empty section is just a muted line. */
function RelatedSection({ icon: Icon, title, count, viewAllHref, emptyLabel, children }) {
  return (
    <div className="glass mb-4 rounded-[20px]">
      <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
        <h2 className="flex items-center gap-2 text-[0.9rem] font-bold">
          <Icon size={15} className="text-muted" />
          {title} <span className="ml-1 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{count}</span>
        </h2>
        {count > SHOWN && (
          <Link to={viewAllHref} className="text-xs font-semibold text-glow-b hover:underline">
            View all →
          </Link>
        )}
      </div>
      {count === 0 ? <p className="px-5 py-4 text-sm text-muted">{emptyLabel}</p> : <div className="divide-y divide-glass-border">{children}</div>}
    </div>
  )
}

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: patient, isLoading } = useOne(id)
  const updatePatient = useUpdate()
  const deletePatient = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: allAppointments } = useAppointmentsList()
  const { data: allPrescriptions } = usePrescriptionsList()
  const { data: allLabReports } = useLabReportsList()
  const { data: allDiagnosticStudies } = useDiagnosticStudiesList()

  const appointments = useMemo(
    () => (allAppointments ?? []).filter((a) => a.patient_id === id).sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date)),
    [allAppointments, id],
  )
  const prescriptions = useMemo(
    () => (allPrescriptions ?? []).filter((p) => p.patient_id === id).sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date)),
    [allPrescriptions, id],
  )
  const labReports = useMemo(
    () => (allLabReports ?? []).filter((r) => r.patient_id === id).sort((a, b) => new Date(b.test_date) - new Date(a.test_date)),
    [allLabReports, id],
  )
  const diagnosticStudies = useMemo(
    () => (allDiagnosticStudies ?? []).filter((s) => s.patient_id === id).sort((a, b) => new Date(b.study_date) - new Date(a.study_date)),
    [allDiagnosticStudies, id],
  )
  const activeMedications = useMemo(() => {
    const seen = new Set()
    return prescriptions.filter((p) => p.status === 'active').filter((p) => (seen.has(p.medication_id) ? false : seen.add(p.medication_id)))
  }, [prescriptions])

  async function handleUpdate(payload) {
    try {
      await updatePatient.mutateAsync({ id, data: payload })
      notify('Patient updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save patient', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deletePatient.mutateAsync(id)
      notify('Patient deleted')
      navigate('/patients')
    } catch (err) {
      notify(err.message || 'Failed to delete patient', 'error')
    }
  }

  // These only ever call stable setState setters (or are purely decorative), so —
  // unlike a handler that reads patient data — they're safe to capture once via
  // usePageHeader without going stale.
  usePageHeader({
    title: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    icon: patient && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white">
        {initials(patient.first_name, patient.last_name)}
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit patient" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete patient" onClick={() => setDeleteOpen(true)} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!patient) return <div className="text-sm text-muted">Patient not found.</div>

  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/patients') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* One flat list — every field gets the same treatment, no field (gender
          included) singled out with special styling over the others. */}
      <div className="glass rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Gender</dt>
          <dd className="col-span-2">{patient.gender ?? 'Not specified'}</dd>

          <dt className="font-semibold text-muted">Date of birth</dt>
          <dd className="col-span-2">
            {formatDateLong(patient.date_of_birth) ?? 'Not specified'}
            {age !== null && <span className="text-muted"> ({age} years old)</span>}
          </dd>

          <dt className="font-semibold text-muted">Phone</dt>
          <dd className="col-span-2">
            {patient.phone ? (
              <a href={`tel:${patient.phone}`} className="text-glow-b hover:underline">
                {patient.phone}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          <dt className="font-semibold text-muted">Email</dt>
          <dd className="col-span-2">
            {patient.email ? (
              <a href={`mailto:${patient.email}`} className="text-glow-b hover:underline">
                {patient.email}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          {patient.address && (
            <>
              <dt className="font-semibold text-muted">Address</dt>
              <dd className="col-span-2">{patient.address}</dd>
            </>
          )}

          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <>
              <dt className="font-semibold text-muted">Emergency contact</dt>
              <dd className="col-span-2">
                {[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' - ')}
              </dd>
            </>
          )}

          {patient.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(patient.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-4">
        <RelatedSection
          icon={Pill}
          title="Active medications"
          count={activeMedications.length}
          viewAllHref={`/prescriptions?patient=${id}`}
          emptyLabel="No active medications."
        >
          {activeMedications.slice(0, SHOWN).map((p) => (
            <Link
              key={p.id}
              to={p.medication_id ? `/medications/${p.medication_id}` : `/prescriptions/${p.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b"
            >
              <span className="font-medium">{p.medication_name}</span>
              <span className="text-xs text-muted">
                {p.dosage} · {p.frequency}
              </span>
            </Link>
          ))}
        </RelatedSection>

        <RelatedSection
          icon={CalendarDays}
          title="Recent appointments"
          count={appointments.length}
          viewAllHref={`/appointments?patient=${id}`}
          emptyLabel="No appointments yet."
        >
          {appointments.slice(0, SHOWN).map((a) => (
            <Link key={a.id} to={`/appointments/${a.id}`} className="flex items-start gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{formatDate(a.appointment_date)}</span>
                  <Badge tone={a.status}>{statusLabel(a.status)}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {a.type || 'General'}
                  {a.doctor_first_name ? ` · Dr. ${a.doctor_first_name} ${a.doctor_last_name}` : ''}
                </div>
                {a.diagnosis && <div className="mt-0.5 text-xs text-muted">{a.diagnosis}</div>}
              </div>
            </Link>
          ))}
        </RelatedSection>

        <RelatedSection
          icon={FileText}
          title="Prescriptions"
          count={prescriptions.length}
          viewAllHref={`/prescriptions?patient=${id}`}
          emptyLabel="No prescriptions yet."
        >
          {prescriptions.slice(0, SHOWN).map((p) => (
            <Link key={p.id} to={`/prescriptions/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b">
              <div>
                <div className="font-medium">{p.medication_name}</div>
                <div className="text-xs text-muted">
                  {p.dosage} · {p.frequency}
                </div>
              </div>
              <Badge tone={p.status}>{statusLabel(p.status)}</Badge>
            </Link>
          ))}
        </RelatedSection>

        <RelatedSection
          icon={FlaskConical}
          title="Lab reports"
          count={labReports.length}
          viewAllHref={`/lab-reports?patient=${id}`}
          emptyLabel="No lab reports yet."
        >
          {labReports.slice(0, SHOWN).map((r) => (
            <Link key={r.id} to={`/lab-reports/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b">
              <div>
                <div className="font-medium">{r.test_name}</div>
                <div className="text-xs text-muted">
                  {r.test_type} · {formatDate(r.test_date)}
                </div>
              </div>
              {isAbnormalReport(r) ? <Badge tone="critical">Abnormal</Badge> : <Badge tone="normal">Normal</Badge>}
            </Link>
          ))}
        </RelatedSection>

        <RelatedSection
          icon={Scan}
          title="Diagnostic studies"
          count={diagnosticStudies.length}
          viewAllHref={`/diagnostic-studies?patient=${id}`}
          emptyLabel="No diagnostic studies yet."
        >
          {diagnosticStudies.slice(0, SHOWN).map((s) => (
            <Link
              key={s.id}
              to={`/diagnostic-studies/${s.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b"
            >
              <div>
                <div className="font-medium">
                  <Badge>{s.study_type}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted">{s.body_region || 'Not specified'}</div>
              </div>
              <span className="font-mono text-xs text-muted">{formatDate(s.study_date)}</span>
            </Link>
          ))}
        </RelatedSection>
      </div>

      <PatientFormDialog
        key={editOpen ? patient.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSubmit={handleUpdate}
        saving={updatePatient.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete patient"
        description={`Delete "${patient.first_name} ${patient.last_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deletePatient.isPending}
      />
    </div>
  )
}
