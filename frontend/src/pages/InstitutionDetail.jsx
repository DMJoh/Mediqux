import { useState } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Pencil, Trash2, Stethoscope } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { formatDateTime } from '../lib/format'
import { useToast } from '../components/ui/Toast'
import { usePageHeader } from '../lib/pageHeader'
import { InstitutionFormDialog } from '../components/institutions/InstitutionFormDialog'
import { IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const { useOne, useUpdate, useDelete } = createResourceHooks('institutions', '/institutions')

export default function InstitutionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const { data: institution, isLoading } = useOne(id)
  const updateInstitution = useUpdate()
  const deleteInstitution = useDelete()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleUpdate(payload) {
    try {
      await updateInstitution.mutateAsync({ id, data: payload })
      notify('Institution updated')
      setEditOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save institution', 'error')
    }
  }

  function requestDelete() {
    const count = institution?.doctors?.length ?? 0
    if (count > 0) {
      notify(`Can't delete: ${count} doctor(s) are still associated. Remove those associations first.`, 'error')
      return
    }
    setDeleteOpen(true)
  }

  async function handleDelete() {
    try {
      await deleteInstitution.mutateAsync(id)
      notify('Institution deleted')
      navigate('/institutions')
    } catch (err) {
      notify(err.message || 'Failed to delete institution', 'error')
    }
  }

  usePageHeader({
    title: institution?.name,
    icon: institution && (
      <span className="glow-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
        <Building2 size={15} />
      </span>
    ),
    action: (
      <div className="flex gap-2">
        <IconButton label="Edit institution" onClick={() => setEditOpen(true)} className="border border-glass-border">
          <Pencil size={15} />
        </IconButton>
        <IconButton label="Delete institution" onClick={requestDelete} className="border border-glass-border">
          <Trash2 size={15} />
        </IconButton>
      </div>
    ),
  })

  if (isLoading) return <div className="text-sm text-muted">Loading…</div>
  if (!institution) return <div className="text-sm text-muted">Institution not found.</div>

  return (
    <div>
      <button
        onClick={() => (location.key === 'default' ? navigate('/institutions') : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="glass mb-4 rounded-[20px] p-6">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="font-semibold text-muted">Type</dt>
          <dd className="col-span-2">{institution.type ?? 'Not specified'}</dd>

          <dt className="font-semibold text-muted">Address</dt>
          <dd className="col-span-2">{institution.address || 'Not provided'}</dd>

          <dt className="font-semibold text-muted">Phone</dt>
          <dd className="col-span-2">
            {institution.phone ? (
              <a href={`tel:${institution.phone}`} className="text-glow-b hover:underline">
                {institution.phone}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          <dt className="font-semibold text-muted">Email</dt>
          <dd className="col-span-2">
            {institution.email ? (
              <a href={`mailto:${institution.email}`} className="text-glow-b hover:underline">
                {institution.email}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          <dt className="font-semibold text-muted">Website</dt>
          <dd className="col-span-2">
            {institution.website ? (
              <a href={institution.website} target="_blank" rel="noreferrer" className="text-glow-b hover:underline">
                {institution.website}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>

          {institution.created_at && (
            <>
              <dt className="font-semibold text-muted">Created</dt>
              <dd className="col-span-2 text-muted">{formatDateTime(institution.created_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Associated doctors{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">
              {institution.doctors?.length ?? 0}
            </span>
          </h2>
        </div>
        {institution.doctors?.length ? (
          <div className="divide-y divide-glass-border">
            {institution.doctors.map((d) => (
              <Link
                key={d.id}
                to={`/doctors/${d.id}`}
                className="flex items-center gap-3 px-5 py-3 text-sm text-text hover:bg-white/3 hover:text-glow-b"
              >
                <Stethoscope size={15} className="shrink-0 text-muted" />
                <span className="font-medium">
                  Dr. {d.first_name} {d.last_name}
                </span>
                {d.specialty && <span className="text-muted"> - {d.specialty}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">No doctors assigned to this institution.</p>
        )}
      </div>

      <InstitutionFormDialog
        key={editOpen ? institution.id : 'closed'}
        open={editOpen}
        onOpenChange={setEditOpen}
        institution={institution}
        onSubmit={handleUpdate}
        saving={updateInstitution.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete institution"
        description={`Delete "${institution.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteInstitution.isPending}
      />
    </div>
  )
}
