import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

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
        <Link to="/" className="text-sidebar-foreground hover:text-sidebar-primary transition-colors">
          <span className="text-lg font-semibold tracking-tight">oore.build</span>
        </Link>
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
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">oore.build v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
