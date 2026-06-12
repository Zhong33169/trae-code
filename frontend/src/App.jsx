import { createSignal, Show } from 'solid-js'
import { useAuth } from './context/AuthContext.jsx'
import QueuePage from './pages/QueuePage.jsx'
import DetailPage from './pages/DetailPage.jsx'
import CreatePage from './pages/CreatePage.jsx'
import StatisticsPage from './pages/StatisticsPage.jsx'
import { roleNames } from './utils/constants.js'

export default function App() {
  const { currentUser, switchUser, mockUsers, loading } = useAuth()
  const [currentPage, setCurrentPage] = createSignal('queue')
  const [selectedOrderId, setSelectedOrderId] = createSignal(null)

  const navigateTo = (page, orderId = null) => {
    setCurrentPage(page)
    setSelectedOrderId(orderId)
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
              refreshKey={selectedOrderId()}
            />
          </Show>
          <Show when={currentPage() === 'detail'}>
            <DetailPage
              orderId={selectedOrderId()}
              onBack={() => navigateTo('queue')}
            />
          </Show>
          <Show when={currentPage() === 'create'}>
            <CreatePage onCreated={() => navigateTo('queue')} />
          </Show>
          <Show when={currentPage() === 'statistics'}>
            <StatisticsPage />
          </Show>
        </main>
      </div>
    </div>
  )
}
