import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Users as UsersIcon, Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { createResourceHooks } from '../lib/resource'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import { UserFormDialog } from '../components/users/UserFormDialog'
import { ResetPasswordDialog } from '../components/users/ResetPasswordDialog'
import { Button, IconButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { usePageHeader } from '../lib/pageHeader'

const { useList, useCreate, useUpdate, useDelete } = createResourceHooks('users', '/users')

function roleLabel(role) {
  if (!role) return 'User'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function patientAccessSummary(user) {
  const patients = user.patients ?? []
  if (!patients.length) return 'No patient access'
  return patients.map((p) => `${p.first_name} ${p.last_name}`).join(', ')
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useList()
  const createUser = useCreate()
  const updateUser = useUpdate()
  const deleteUser = useDelete()
  const notify = useToast()

  const resetPassword = useMutation({
    mutationFn: ({ id, newPassword }) => api.put(`/users/${id}/reset-password`, { newPassword }),
  })

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  usePageHeader({
    title: 'Users',
    subtitle: 'Admin, staff, and patient-portal accounts',
    action: (
      <Button onClick={() => setAddOpen(true)}>
        <Plus size={16} /> Add user
      </Button>
    ),
  })

  const adminCount = useMemo(() => (users ?? []).filter((u) => u.role === 'admin').length, [users])
  const sorted = useMemo(() => [...(users ?? [])].sort((a, b) => a.first_name?.localeCompare(b.first_name ?? '') ?? 0), [users])

  async function handleAdd(payload) {
    try {
      await createUser.mutateAsync(payload)
      notify('User added')
      setAddOpen(false)
    } catch (err) {
      notify(err.message || 'Failed to save user', 'error')
    }
  }

  async function handleEdit(payload) {
    if (!editTarget) return
    try {
      await updateUser.mutateAsync({ id: editTarget.id, data: payload })
      notify('User updated')
      setEditTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to save user', 'error')
    }
  }

  async function handleResetPassword(newPassword) {
    if (!resetTarget) return
    try {
      await resetPassword.mutateAsync({ id: resetTarget.id, newPassword })
      notify('Password reset')
      setResetTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to reset password', 'error')
    }
  }

  function requestDelete(user) {
    if (user.id === currentUser?.id) {
      notify("You can't delete your own account.", 'error')
      return
    }
    if (user.role === 'admin' && adminCount <= 1) {
      notify('Cannot delete the last admin user.', 'error')
      return
    }
    setDeleteTarget(user)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      notify('User deleted')
      setDeleteTarget(null)
    } catch (err) {
      notify(err.message || 'Failed to delete user', 'error')
    }
  }

  return (
    <div>
      <div className="glass rounded-[20px]">
        <div className="flex items-center justify-between border-b border-glass-border px-5 py-3.75">
          <h2 className="text-[0.9rem] font-bold">
            User list <span className="ml-1.5 rounded-full bg-glass-2 px-2 py-0.5 font-mono text-xs text-glow-b">{sorted.length}</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-muted">Loading…</div>
        ) : sorted.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" description="Add your first user to get started." />
        ) : (
          <>
            <div className="divide-y divide-glass-border sm:hidden">
              {sorted.map((u) => (
                <div key={u.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text">
                      {u.first_name} {u.last_name}
                    </div>
                    <div className="text-xs text-muted">
                      {u.username} · {u.email}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={u.role === 'admin' ? 'high' : 'default'}>{roleLabel(u.role)}</Badge>
                      <Badge tone={u.is_active === false ? 'discontinued' : 'active'}>{u.is_active === false ? 'Inactive' : 'Active'}</Badge>
                    </div>
                    <div className="mt-1.5 text-xs text-muted">{patientAccessSummary(u)}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Edit" onClick={() => setEditTarget(u)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label="Reset password" onClick={() => setResetTarget(u)}>
                      <KeyRound size={14} />
                    </IconButton>
                    <IconButton label="Delete" onClick={() => requestDelete(u)}>
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
                    <th className="px-5 py-2.5 font-semibold">Username</th>
                    <th className="px-5 py-2.5 font-semibold">Email</th>
                    <th className="px-5 py-2.5 font-semibold">Role</th>
                    <th className="px-5 py-2.5 font-semibold">Patient access</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold">Last login</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u) => (
                    <tr key={u.id} className="border-b border-glass-border last:border-none hover:bg-white/3">
                      <td className="px-5 py-3 font-semibold text-text">
                        {u.first_name} {u.last_name}
                        {u.id === currentUser?.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                      </td>
                      <td className="px-5 py-3 text-muted">{u.username}</td>
                      <td className="px-5 py-3 text-muted">{u.email}</td>
                      <td className="px-5 py-3">
                        <Badge tone={u.role === 'admin' ? 'high' : 'default'}>{roleLabel(u.role)}</Badge>
                      </td>
                      <td className="max-w-56 truncate px-5 py-3 text-muted">{patientAccessSummary(u)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={u.is_active === false ? 'discontinued' : 'active'}>{u.is_active === false ? 'Inactive' : 'Active'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-muted">{formatDate(u.last_login) ?? 'Never'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Edit" onClick={() => setEditTarget(u)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label="Reset password" onClick={() => setResetTarget(u)}>
                            <KeyRound size={14} />
                          </IconButton>
                          <IconButton label="Delete" onClick={() => requestDelete(u)}>
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

      <UserFormDialog
        key={addOpen ? 'add' : 'add-closed'}
        open={addOpen}
        onOpenChange={setAddOpen}
        user={null}
        onSubmit={handleAdd}
        saving={createUser.isPending}
      />

      <UserFormDialog
        key={editTarget ? editTarget.id : 'edit-closed'}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        user={editTarget}
        onSubmit={handleEdit}
        saving={updateUser.isPending}
      />

      <ResetPasswordDialog
        key={resetTarget ? `reset-${resetTarget.id}` : 'reset-closed'}
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        user={resetTarget}
        onSubmit={handleResetPassword}
        saving={resetPassword.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user"
        description={deleteTarget && `Delete "${deleteTarget.first_name} ${deleteTarget.last_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        pending={deleteUser.isPending}
      />
    </div>
  )
}
