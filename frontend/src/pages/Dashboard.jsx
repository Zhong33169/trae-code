import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import FormList from '../components/FormList'
import EvidencePanel from '../components/EvidencePanel'
import FormDetail from '../components/FormDetail'
import CreateFormModal from '../components/CreateFormModal'
import BatchToolbar from '../components/BatchToolbar'
import BatchResultModal from '../components/BatchResultModal'

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
  const [selectedForms, setSelectedForms] = useState(new Map())
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [batchResult, setBatchResult] = useState(null)

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const refreshAll = useCallback(async (keepSelection = true) => {
    setLoading(true)
    try {
      const [formsData, projectsData] = await Promise.all([
        api.listForms(filters),
        api.projects()
      ])
      setForms(formsData)
      setProjects(projectsData)
      setSelectedForms((prev) => {
        if (prev.size === 0) return prev
        const next = new Map(prev)
        for (const f of formsData) {
          if (next.has(f.id)) {
            next.set(f.id, f.version)
          }
        }
        return next
      })
      if (keepSelection && selectedId) {
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
    refreshAll()
  }, [refreshAll])

  const handleSelectForm = async (id) => {
    setSelectedId(id)
    try {
      const detail = await api.getForm(id)
      setSelectedForm(detail)
    } catch (err) {
      showNotification(err.data?.message || err.message, 'error')
    }
  }

  const handleToggleSelect = (form) => {
    setSelectedForms((prev) => {
      const next = new Map(prev)
      if (next.has(form.id)) next.delete(form.id)
      else next.set(form.id, form.version)
      return next
    })
  }

  const handleProcess = async (action, data = {}) => {
    const version = selectedForm?.form?.version
    if (!version || version <= 0) {
      showNotification('缺少版本信息，请刷新页面后重试', 'error')
      return
    }
    try {
      await api.processForm({
        form_id: selectedId,
        expected_version: version,
        action,
        ...data
      })
      showNotification('操作成功', 'success')
      setSelectedForms(new Map())
      refreshAll()
    } catch (err) {
      const reason = err.data?.reason || ''
      const message = err.data?.message || err.message
      if (reason === 'version_conflict') {
        showNotification(`版本冲突：${message}，正在刷新...`, 'error')
        refreshAll()
      } else {
        showNotification(`${reason ? reason + '：' : ''}${message}`, 'error')
      }
    }
  }

  const handleBatchProcess = async (action, reason = '') => {
    try {
      const form_versions = {}
      const missing = []
      for (const [id, v] of selectedForms) {
        if (v && v > 0) {
          form_versions[id] = v
        } else {
          missing.push(id)
        }
      }
      if (missing.length > 0) {
        showNotification(`有 ${missing.length} 项缺少版本信息，请刷新列表后重新勾选`, 'error')
        return
      }
      const result = await api.batchProcess({
        form_ids: Array.from(selectedForms.keys()),
        form_versions,
        action,
        reason
      })
      setSelectedForms(new Map())
      refreshAll()
      if (result.fail_count > 0) {
        setBatchResult(result)
      } else {
        showNotification(`批量处理完成：全部 ${result.success_count} 项成功`, 'success')
      }
    } catch (err) {
      showNotification(err.data?.message || err.message, 'error')
    }
  }

  const handleUploadEvidence = async (ev) => {
    try {
      await api.uploadEvidence(ev)
      showNotification('证据上传成功', 'success')
      refreshAll()
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
              {selectedForms.size > 0 && (
                <BatchToolbar
                  selectedCount={selectedForms.size}
                  userRole={user.role}
                  onProcess={handleBatchProcess}
                  onClear={() => setSelectedForms(new Map())}
                />
              )}
            </div>
          </div>

          <FormList
            forms={forms}
            loading={loading}
            selectedId={selectedId}
            selectedIds={selectedForms}
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
              onRefresh={refreshAll}
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
            refreshAll()
          }}
        />
      )}

      {batchResult && (
        <BatchResultModal
          result={batchResult}
          onClose={() => setBatchResult(null)}
        />
      )}
    </div>
  )
}

export { ROLE_LABELS, STATUS_LABELS }
