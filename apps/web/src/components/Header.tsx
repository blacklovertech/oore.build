import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import InstanceSwitcher from '@/components/InstanceSwitcher'
import { useActiveInstance, useInstanceStore } from '@/stores/instance-store'
import { useAuthStore } from '@/stores/auth-store'
import { useLogout } from '@/hooks/use-auth'
import AddInstanceDialog from '@/components/AddInstanceDialog'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAddInstance, setShowAddInstance] = useState(false)
  const instances = useInstanceStore((s) => s.instances)
  const activeInstance = useActiveInstance()
  const setActiveInstance = useInstanceStore((s) => s.setActiveInstance)
  const removeInstance = useInstanceStore((s) => s.removeInstance)
  const authUser = useAuthStore((s) => s.user)
  const authToken = useAuthStore((s) => s.token)
  const logoutMutation = useLogout()
  const isAdmin = authUser?.role === 'owner' || authUser?.role === 'admin'

  const close = useCallback(() => setIsOpen(false), [])

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close])

  return (
    <>
      <header className="px-4 py-3 flex items-center gap-3 bg-sidebar border-b border-sidebar-border">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <Link to="/" className="text-sidebar-foreground hover:text-sidebar-primary transition-colors flex-1">
          <span className="text-lg font-semibold tracking-tight">oore.build</span>
        </Link>
        {authToken && authUser ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {authUser.email}
            </span>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : null}
        <InstanceSwitcher />
      </header>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground shadow-2xl z-50 transform transition-transform duration-200 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
          <span className="text-lg font-semibold tracking-tight">oore.build</span>
          <button
            onClick={close}
            className="p-2 hover:bg-sidebar-accent transition-colors"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <Link
            to="/"
            onClick={close}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            activeProps={{
              className:
                'flex items-center gap-3 px-3 py-2 text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground',
            }}
          >
            Dashboard
          </Link>
          {isAdmin ? (
            <Link
              to="/settings/users"
              onClick={close}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              activeProps={{
                className:
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground',
              }}
            >
              Users
            </Link>
          ) : null}
        </nav>

        {/* Instance management */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Instances
          </p>
          {Object.values(instances).map((inst) => (
            <div
              key={inst.id}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                inst.id === activeInstance?.id ? 'bg-sidebar-accent' : ''
              }`}
            >
              <button
                onClick={() => {
                  setActiveInstance(inst.id)
                  close()
                }}
                className="flex-1 text-left truncate hover:text-sidebar-primary transition-colors"
              >
                {inst.label}
              </button>
              <button
                onClick={() => removeInstance(inst.id)}
                className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${inst.label}`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l6 6M10 4l-6 6" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              close()
              setShowAddInstance(true)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:text-sidebar-primary transition-colors"
          >
            + Add Instance
          </button>
        </div>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">oore.build v0.1.0</p>
        </div>
      </aside>

      {showAddInstance ? (
        <AddInstanceDialog onClose={() => setShowAddInstance(false)} />
      ) : null}
    </>
  )
}
