import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { useToast } from '../components/ui/Toast'
import { ConditionFormDialog } from '../components/conditions/ConditionFormDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('conditions', '/conditions')

function usageCount(condition) {
  return Number(condition.usage_count) || 0
}

export default function Conditions() {
  const navigate = useNavigate()
  const { data: conditions, isLoading } = useList()
  const createCondition = useCreate()
  const updateCondition = useUpdate()
  const deleteCondition = useDelete()
  const notify = useToast()

  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Conditions',
    subtitle: 'Medical conditions on file, for diagnoses and history',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add condition
      </Button>
    ),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return conditions ?? []
    return (conditions ?? []).filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term) ||
        c.icd_code?.toLowerCase().includes(term) ||
        c.category?.toLowerCase().includes(term),
    )
  }, [conditions, search])

  async function handleAdd(payload) {
    try {
      await createCondition.mutateAsync(payload)
      notify('Condition added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save condition', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateCondition.mutateAsync({ id: editTarget.id, data: payload })
      notify('Condition updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save condition', 'error')
    }
  }

  function requestDelete(condition) {
    const count = usageCount(condition)
    if (count > 0) {
      notify(
        `Can't delete "${condition.name}": it's referenced in ${count} appointment(s). Update those appointments first.`,
        'error',
      )
      return
    }
    setDeleteTarget(condition)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteCondition.mutateAsync(deleteTarget.id)
      notify('Condition deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete condition', 'error')
    }
  }

  return (
    <div>
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-[16px] p-3">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-[10px] border border-glass-border bg-white/6 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, description, ICD code, or category…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-sm font-semibold text-muted hover:text-white">
            Clear
          </button>
        )}
      </div>

      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            Condition list{' '}
            <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{filtered.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No conditions found"
            description={conditions?.length ? 'Try a different search.' : 'Add your first condition to get started.'}
          />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/conditions/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/conditions/${c.id}`)
                    }
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 p-4 hover:bg-white/3 active:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">{c.name}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {c.category && <Badge>{c.category}</Badge>}
                      {c.severity && <Badge tone={c.severity.toLowerCase()}>{c.severity}</Badge>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                      {c.icd_code && <span className="font-mono">{c.icd_code}</span>}
                      <span>
                        {usageCount(c)} usage{usageCount(c) === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="Edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditTarget(c)
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDelete(c)
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-glass-border bg-white/3 text-left font-mono text-[0.68rem] uppercase tracking-wide text-muted-2">
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">ICD code</th>
                    <th className="px-5 py-2.5 font-semibold">Category</th>
                    <th className="px-5 py-2.5 font-semibold">Severity</th>
                    <th className="px-5 py-2.5 font-semibold">Usage</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3">
                        <Link to={`/conditions/${c.id}`} className="font-semibold text-text hover:text-glow-b">
                          {c.name}
                        </Link>
                        {c.description && <div className="max-w-72 truncate text-xs text-muted">{c.description}</div>}
                      </td>
                      <td className="px-5 py-3 font-mono text-muted">{c.icd_code || 'Not set'}</td>
                      <td className="px-5 py-3">{c.category ? <Badge>{c.category}</Badge> : <span className="text-muted-2">Uncategorized</span>}</td>
                      <td className="px-5 py-3">
                        {c.severity ? <Badge tone={c.severity.toLowerCase()}>{c.severity}</Badge> : <span className="text-muted-2">Not set</span>}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {usageCount(c)} usage{usageCount(c) === 1 ? '' : 's'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(c)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => requestDelete(c)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConditionFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        condition={null}
        onSubmit={handleAdd}
        saving={createCondition.isPending}
      />

      <ConditionFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        condition={editTarget}
        onSubmit={handleEdit}
        saving={updateCondition.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete condition"
        description={deleteTarget && `Delete "${deleteTarget.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteCondition.isPending}
      />
    </div>
  )
}
