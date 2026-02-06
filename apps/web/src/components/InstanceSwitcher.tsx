import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveInstance, useInstanceStore } from '@/stores/instance-store'
import AddInstanceDialog from '@/components/AddInstanceDialog'

export default function InstanceSwitcher() {
  const instance = useActiveInstance()
  const instances = useInstanceStore((s) => s.instances)
  const setActiveInstance = useInstanceStore((s) => s.setActiveInstance)
  const [isOpen, setIsOpen] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setIsOpen(false), [])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, close])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, close])

  const instanceList = Object.values(instances)

  if (!instance && instanceList.length === 0) return null

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          aria-label="Switch instance"
        >
          <span className="truncate max-w-[140px]">
            {instance?.label ?? 'No instance'}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border shadow-lg z-50">
            {instanceList.map((inst) => (
              <button
                key={inst.id}
                onClick={() => {
                  setActiveInstance(inst.id)
                  close()
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                  inst.id === instance?.id ? 'bg-accent' : ''
                }`}
              >
                <span className="truncate flex-1">{inst.label}</span>
                {inst.id === instance?.id ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 7l3 3 5-6" />
                  </svg>
                ) : null}
              </button>
            ))}
            <div className="border-t border-border">
              <button
                onClick={() => {
                  close()
                  setShowAddDialog(true)
                }}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                + Add Instance
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showAddDialog ? (
        <AddInstanceDialog onClose={() => setShowAddDialog(false)} />
      ) : null}
    </>
  )
}
