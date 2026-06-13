import { createSignal, Show } from 'solid-js'
import { useAuth } from './context/AuthContext.jsx'
import QueuePage from './pages/QueuePage.jsx'
import DetailPage from './pages/DetailPage.jsx'
import CreatePage from './pages/CreatePage.jsx'
import StatisticsPage from './pages/StatisticsPage.jsx'
import { roleNames } from './utils/constants.js'

export default function App() {
  const { currentUser, switchUser, mockUsers } = useAuth()
  const [currentPage, setCurrentPage] = createSignal('queue')
  const [selectedOrderId, setSelectedOrderId] = createSignal(null)
  const [refreshTick, setRefreshTick] = createSignal(0)

  const navigateTo = (page, orderId = null) => {
    setCurrentPage(page)
    setSelectedOrderId(orderId)
  }

  const triggerRefresh = () => {
    setRefreshTick(prev => prev + 1)
  }

  return (
    <div class="app">
      <header class="header">
        <h1>🔧 维修服务平台 - 风险分级处置系统</h1>
        <div class="user-info">
          <span class="role-badge">{roleNames[currentUser().role]}</span>
          <select
            class="user-select"
            value={currentUser().id}
            onChange={(e) => switchUser(e.target.value)}
          >
            {mockUsers.map((u) => (
              <option value={u.id}>
                {u.name} ({roleNames[u.role]})
              </option>
            ))}
          </select>
        </div>
      </header>

      <div class="main">
        <aside class="sidebar">
          <div
            class={`nav-item ${currentPage() === 'queue' ? 'active' : ''}`}
            onClick={() => navigateTo('queue')}
          >
            📋 工单队列
          </div>
          <div
            class={`nav-item ${currentPage() === 'create' ? 'active' : ''}`}
            onClick={() => navigateTo('create')}
          >
            ➕ 新建工单
          </div>
          <div
            class={`nav-item ${currentPage() === 'statistics' ? 'active' : ''}`}
            onClick={() => navigateTo('statistics')}
          >
            📊 统计分析
          </div>
        </aside>

        <main class="content">
          <Show when={currentPage() === 'queue'}>
            <QueuePage
              onSelectOrder={(id) => navigateTo('detail', id)}
              refreshKey={refreshTick()}
            />
          </Show>
          <Show when={currentPage() === 'detail'}>
            <DetailPage
              orderId={selectedOrderId()}
              onBack={() => navigateTo('queue')}
              onProcessed={() => {
                triggerRefresh()
              }}
            />
          </Show>
          <Show when={currentPage() === 'create'}>
            <CreatePage onCreated={() => {
              triggerRefresh()
              navigateTo('queue')
            }} />
          </Show>
          <Show when={currentPage() === 'statistics'}>
            <StatisticsPage refreshKey={refreshTick()} />
          </Show>
        </main>
      </div>
    </div>
  )
}
