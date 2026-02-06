import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  useDeleteUser,
  useInviteUser,
  useReEnableUser,
  useUpdateUserRole,
  useUsers,
} from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import { ApiClientError } from '@/lib/api'
import type { UserRole } from '@/lib/types'

export const Route = createFileRoute('/settings/users')({
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)

    // Check that the current user has admin/owner role
    const user = useAuthStore.getState().user
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      throw redirect({ to: '/' })
    }
  },
  component: UsersSettingsPage,
})

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'qa_viewer', label: 'QA Viewer' },
]

interface ConfirmAction {
  type: 'disable' | 'role_change'
  userId: string
  userEmail: string
  newRole?: UserRole
}

interface Feedback {
  type: 'success' | 'error'
  message: string
}

function UsersSettingsPage() {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const { data, isLoading, error } = useUsers()
  const inviteMutation = useInviteUser()
  const updateRoleMutation = useUpdateUserRole()
  const deleteMutation = useDeleteUser()
  const reEnableMutation = useReEnableUser()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('developer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    document.title = 'User Management - oore.build'
  }, [])

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Redirect non-admin users
  useEffect(() => {
    if (authUser && authUser.role !== 'owner' && authUser.role !== 'admin') {
      void navigate({ to: '/' })
    }
  }, [authUser, navigate])

  const showError = useCallback((err: unknown, fallback: string) => {
    const message = err instanceof ApiClientError ? err.message : fallback
    setFeedback({ type: 'error', message })
  }, [])

  const handleInvite = () => {
    setInviteError(null)
    inviteMutation.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail('')
          setInviteRole('developer')
          setFeedback({ type: 'success', message: `${inviteEmail} invited` })
        },
        onError: (e) => {
          setInviteError(e instanceof Error ? e.message : 'Failed to invite user')
        },
      },
    )
  }

  const handleConfirm = () => {
    if (!confirmAction) return

    if (confirmAction.type === 'disable') {
      deleteMutation.mutate(confirmAction.userId, {
        onSuccess: () => {
          setFeedback({ type: 'success', message: `${confirmAction.userEmail} has been disabled` })
          setConfirmAction(null)
        },
        onError: (err) => {
          showError(err, 'Failed to disable user')
          setConfirmAction(null)
        },
      })
    } else if (confirmAction.type === 'role_change' && confirmAction.newRole) {
      updateRoleMutation.mutate(
        { userId: confirmAction.userId, data: { role: confirmAction.newRole } },
        {
          onSuccess: () => {
            setFeedback({ type: 'success', message: `Role updated for ${confirmAction.userEmail}` })
            setConfirmAction(null)
          },
          onError: (err) => {
            showError(err, 'Failed to update role')
            setConfirmAction(null)
          },
        },
      )
    }
  }

  const handleReEnable = (userId: string, email: string) => {
    reEnableMutation.mutate(userId, {
      onSuccess: () => {
        setFeedback({ type: 'success', message: `${email} has been re-enabled` })
      },
      onError: (err) => {
        showError(err, 'Failed to re-enable user')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading users...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-destructive text-sm">
          Failed to load users: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  const users = data?.users ?? []
  const pendingMutation = deleteMutation.isPending || updateRoleMutation.isPending

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Invite users, manage roles, and control access to this instance.
          </p>
        </div>

        {/* Feedback alert */}
        {feedback ? (
          <div
            className={`px-4 py-3 text-sm border ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
                : 'border-destructive/20 bg-destructive/5 text-destructive'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {/* Invite form */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-medium">Invite User</h2>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 text-sm border border-input bg-background"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="px-3 py-2 text-sm border border-input bg-background"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
              </Button>
            </div>
            {inviteError ? (
              <p className="text-sm text-destructive">{inviteError}</p>
            ) : null}
          </CardContent>
        </Card>

        {/* User list */}
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isOwner = user.role === 'owner'
                const isSelf = user.id === authUser?.user_id
                const isDisabled = user.status === 'disabled'

                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span>{user.email}</span>
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isOwner ? (
                        <span className="text-xs font-medium uppercase tracking-wider text-amber-600">
                          Owner
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => {
                            const newRole = e.target.value as UserRole
                            setConfirmAction({
                              type: 'role_change',
                              userId: user.id,
                              userEmail: user.email,
                              newRole,
                            })
                          }}
                          disabled={isSelf || isDisabled || updateRoleMutation.isPending}
                          className="px-2 py-1 text-xs border border-input bg-background"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          user.status === 'active'
                            ? 'text-green-600'
                            : user.status === 'invited'
                              ? 'text-blue-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isOwner && !isSelf && isDisabled ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReEnable(user.id, user.email)}
                          disabled={reEnableMutation.isPending}
                        >
                          Enable
                        </Button>
                      ) : !isOwner && !isSelf && !isDisabled ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setConfirmAction({
                              type: 'disable',
                              userId: user.id,
                              userEmail: user.email,
                            })
                          }
                          disabled={deleteMutation.isPending}
                        >
                          Disable
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmAction ? (
        <ConfirmDialog
          title={
            confirmAction.type === 'disable'
              ? `Disable ${confirmAction.userEmail}?`
              : `Change role for ${confirmAction.userEmail}?`
          }
          description={
            confirmAction.type === 'disable'
              ? 'This will revoke all their active sessions. You can re-enable them later.'
              : `Change role from current to ${confirmAction.newRole?.replace('_', ' ')}?`
          }
          confirmLabel={confirmAction.type === 'disable' ? 'Disable' : 'Change Role'}
          confirmVariant={confirmAction.type === 'disable' ? 'destructive' : 'default'}
          isPending={pendingMutation}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}
    </div>
  )
}
