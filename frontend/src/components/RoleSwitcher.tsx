import { useState, useRef, useEffect } from 'react'
import { User, Shield, Archive, ChevronDown } from 'lucide-react'
import { useStore, DEMO_ACCOUNTS } from '@/store'
import type { Role } from '@/types'

const ROLE_LABELS: Record<Role, { label: string; icon: React.ReactNode }> = {
  registrar: { label: '登记员', icon: <User className="w-4 h-4" /> },
  reviewer: { label: '审核主管', icon: <Shield className="w-4 h-4" /> },
  archivist: { label: '复核负责人', icon: <Archive className="w-4 h-4" /> },
}

export default function RoleSwitcher() {
  const [open, setOpen] = useState(false)
  const user = useStore((s) => s.user)
  const switchRole = useStore((s) => s.switchRole)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const current = ROLE_LABELS[user.role]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:bg-gray-50 transition-colors"
      >
        {current.icon}
        <span className="font-medium text-navy">{user.display_name}</span>
        <span className="text-gray-400">({current.label})</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
          {(Object.keys(DEMO_ACCOUNTS) as Role[]).map((role) => {
            const info = ROLE_LABELS[role]
            return (
              <button
                key={role}
                onClick={() => {
                  setOpen(false)
                  if (role !== user.role) switchRole(role)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  role === user.role ? 'text-navy font-medium bg-gray-50' : 'text-gray-700'
                }`}
              >
                {info.icon}
                {info.label}
                {role === user.role && <span className="ml-auto text-xs text-amber">当前</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
