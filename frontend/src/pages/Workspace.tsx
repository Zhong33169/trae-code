import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useStore } from '@/store'
import RoleSwitcher from '@/components/RoleSwitcher'
import FilterBar from '@/components/FilterBar'
import AppointmentQueue from '@/components/AppointmentQueue'
import EvidenceSidebar from '@/components/EvidenceSidebar'
import AppointmentDetail from '@/components/AppointmentDetail'
import BatchActionBar from '@/components/BatchActionBar'
import CreateForm from '@/components/CreateForm'

export default function Workspace() {
  const user = useStore((s) => s.user)
  const token = useStore((s) => s.token)
  const logout = useStore((s) => s.logout)
  const loadAppointments = useStore((s) => s.loadAppointments)
  const loadAppointmentDetail = useStore((s) => s.loadAppointmentDetail)
  const toasts = useStore((s) => s.toasts)
  const removeToast = useStore((s) => s.removeToast)
  const currentAppointment = useStore((s) => s.currentAppointment)
  const navigate = useNavigate()

  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!token || !user) {
      navigate('/login')
      return
    }
    loadAppointments()
  }, [token, user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleOpenDetail = (id: string) => {
    loadAppointmentDetail(id)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-navy text-white px-6 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">展会预约管理系统</h1>
          <div className="flex items-center gap-4">
            <RoleSwitcher />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* 左侧：筛选 + 队列 */}
          <div className="flex-1 space-y-4">
            <FilterBar />
            <AppointmentQueue
              onOpenDetail={handleOpenDetail}
              onOpenCreate={() => setShowCreate(true)}
            />
          </div>
          {/* 右侧：证据侧边栏 */}
          <div className="w-72 shrink-0">
            <EvidenceSidebar />
          </div>
        </div>
      </main>

      {/* 预约单详情抽屉 */}
      {currentAppointment && <AppointmentDetail />}

      {/* 批量操作浮动栏 */}
      <BatchActionBar />

      {/* 发起预约单表单 */}
      {showCreate && <CreateForm onClose={() => setShowCreate(false)} />}

      {/* Toast 通知 */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-80">&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
