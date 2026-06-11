import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import FormList from '../components/FormList'
import EvidencePanel from '../components/EvidencePanel'
import FormDetail from '../components/FormDetail'
import CreateFormModal from '../components/CreateFormModal'
import BatchToolbar from '../components/BatchToolbar'

const ROLE_LABELS = {
  clerk: '资料员',
  foreman: '施工负责人',
  manager: '项目经理'
}

const STATUS_LABELS = {
  draft: '草稿',
  pending_clerk: '待资料员补录',
  pending_foreman: '待施工负责人核验',
  pending_manager: '待项目经理确认',
  verified: '已确认',
  rejected: '已驳回',
  archived: '已归档'
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [forms, setForms] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedForm, setSelectedForm] = useState(null)
  const [filters, setFilters] = useState({ status: '', project: '', search: '' })
  const [projects, setProjects] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [formsData, projectsData] = await Promise.all([
        api.listForms(filters),
        api.projects()
      ])
      setForms(formsData)
      setProjects(projectsData)
      if (selectedId) {
        try {
          const detail = await api.getForm(selectedId)
          setSelectedForm(detail)
        } catch (e) {
          setSelectedForm(null)
        }
      }
    } catch (err) {
      showNotification(err.data?.message || err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, selectedId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelectForm = async (id) => {
    setSelectedId(id)
    try {
      const detail = await api.getForm(id)
      setSelectedForm(detail)
    } catch (err) {
      showNotification(err.data?.message || err.message, 'error')
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleProcess = async (action, data = {}) => {
    try {
      await api.processForm({
        form_id: selectedId,
        expected_version: selectedForm?.form?.version,
        action,
        ...data
      })
      showNotification('操作成功', 'success')
      setSelectedIds(new Set())
      loadData()
    } catch (err) {
      showNotification(`${err.data?.reason || err.data?.message || err.message}`, 'error')
    }
  }

  const handleBatchProcess = async (action, reason = '') => {
    try {
      const result = await api.batchProcess({
        form_ids: Array.from(selectedIds),
        action,
        reason
      })
      showNotification(`批量处理完成：成功${result.success_count}，失败${result.fail_count}`,
        result.fail_count > 0 ? 'warning' : 'success')
      setSelectedIds(new Set())
      loadData()
    } catch (err) {
      showNotification(err.data?.message || err.message, 'error')
    }
  }

  const handleUploadEvidence = async (ev) => {
    try {
      await api.uploadEvidence(ev)
      showNotification('证据上传成功', 'success')
      loadData()
    } catch (err) {
      showNotification(`${err.data?.reason}: ${err.data?.message || ''}`, 'error')
    }
  }

  return (
    <div className="dashboard">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="app-title">分包进场单移动补录校验系统</h1>
          <span className="project-badge">建筑施工项目部</span>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{ROLE_LABELS[user.role]}</span>
          </div>
          <button className="btn btn-text" onClick={logout}>退出登录</button>
        </div>
      </header>

      <div className="dashboard-main">
        <aside className="left-panel">
          <div className="filters">
            <div className="filter-row">
              <input
                type="text"
                placeholder="搜索编号/分包单位/施工内容"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input"
              />
            </div>
            <div className="filter-row">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input"
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filters.project}
                onChange={(e) => setFilters({ ...filters, project: e.target.value })}
                className="input"
              >
                <option value="">全部项目</option>
                {projects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="filter-row actions">
              {user.role === 'clerk' && (
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  + 新建进场单
                </button>
              )}
              {selectedIds.size > 0 && (
                <BatchToolbar
                  selectedCount={selectedIds.size}
                  userRole={user.role}
                  onProcess={handleBatchProcess}
                  onClear={() => setSelectedIds(new Set())}
                />
              )}
            </div>
          </div>

          <FormList
            forms={forms}
            loading={loading}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={handleSelectForm}
            onToggleSelect={handleToggleSelect}
          />
        </aside>

        <main className="center-panel">
          {selectedForm ? (
            <FormDetail
              formData={selectedForm}
              user={user}
              onProcess={handleProcess}
              onRefresh={loadData}
              onNotify={showNotification}
            />
          ) : (
            <div className="empty-state">
              <h2>请从左侧队列选择分包进场单</h2>
              <p>选择后可查看详情、办理流程、管理证据</p>
              <div className="role-guide">
                <h3>流程指引</h3>
                <ul>
                  <li><b>资料员</b>：创建登记 → 提交 → 补录驳回 → 归档</li>
                  <li><b>施工负责人</b>：现场核验（上传核验证据）→ 或驳回给资料员</li>
                  <li><b>项目经理</b>：最终确认（需归档证据齐全）→ 或驳回</li>
                  <li>补录操作需标注原因，与原始记录分开显示</li>
                </ul>
              </div>
            </div>
          )}
        </main>

        <aside className="right-panel">
          <EvidencePanel
            selectedForm={selectedForm}
            user={user}
            onUpload={handleUploadEvidence}
            onNotify={showNotification}
          />
        </aside>
      </div>

      {showCreate && (
        <CreateFormModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            showNotification('创建成功', 'success')
            loadData()
          }}
        />
      )}
    </div>
  )
}

export { ROLE_LABELS, STATUS_LABELS }
