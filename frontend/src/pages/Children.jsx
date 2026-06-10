import { useState, useEffect } from 'preact/hooks'
import { api } from '../utils/api.js'

export default function Children({ user }) {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    birth_date: '',
    class_name: '',
    guardian_name: '',
    guardian_phone: '',
    health_status: '正常',
  })

  const canEdit = user.role === 'registrar' || user.role === 'reviewer'

  const loadData = async () => {
    setLoading(true)
    try {
      const params = { page, pageSize }
      if (keyword) params.keyword = keyword
      const res = await api.getChildren(params)
      setList(res.list)
      setTotal(res.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, keyword])

  const handleSearch = () => {
    setPage(1)
    loadData()
  }

  const openCreate = () => {
    setFormData({
      name: '',
      gender: '',
      birth_date: '',
      class_name: '',
      guardian_name: '',
      guardian_phone: '',
      health_status: '正常',
    })
    setEditingId(null)
    setShowCreate(true)
  }

  const openEdit = (child) => {
    setFormData({
      name: child.name,
      gender: child.gender || '',
      birth_date: child.birth_date || '',
      class_name: child.class_name,
      guardian_name: child.guardian_name || '',
      guardian_phone: child.guardian_phone || '',
      health_status: child.health_status || '正常',
    })
    setEditingId(child.id)
    setShowCreate(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.class_name) {
      alert('姓名和班级为必填项')
      return
    }
    try {
      if (editingId) {
        await api.updateChild(editingId, formData)
        alert('更新成功')
      } else {
        await api.createChild(formData)
        alert('创建成功')
      }
      setShowCreate(false)
      loadData()
    } catch (err) {
      alert(err.message || '保存失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="page-header">
        <h1>幼儿档案</h1>
        {canEdit && (
          <button className="btn btn-primary" onClick={openCreate}>
            + 新增幼儿
          </button>
        )}
      </div>

      <div className="page-content">
        <div className="card">
          <div className="filter-bar">
            <div className="form-item">
              <label>关键词搜索</label>
              <input
                type="text"
                placeholder="姓名/班级/监护人"
                value={keyword}
                onInput={(e) => setKeyword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
            <button className="btn" onClick={() => { setKeyword(''); setPage(1) }}>重置</button>
          </div>

          {loading ? (
            <div className="empty">加载中...</div>
          ) : list.length === 0 ? (
            <div className="empty">暂无幼儿档案</div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>姓名</th>
                    <th>性别</th>
                    <th>出生日期</th>
                    <th>班级</th>
                    <th>监护人</th>
                    <th>联系电话</th>
                    <th>健康状况</th>
                    {canEdit && <th>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map(child => (
                    <tr key={child.id}>
                      <td>#{child.id}</td>
                      <td>{child.name}</td>
                      <td>{child.gender || '-'}</td>
                      <td>{child.birth_date || '-'}</td>
                      <td>{child.class_name}</td>
                      <td>{child.guardian_name || '-'}</td>
                      <td>{child.guardian_phone || '-'}</td>
                      <td>
                        <span className={`status-tag ${child.health_status === '正常' ? 'status-archived' : 'status-pending_correction'}`}>
                          {child.health_status}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <button className="btn btn-small" onClick={() => openEdit(child)}>
                            编辑
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination">
                <span className="page-info">共 {total} 条</span>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  上一页
                </button>
                <span className="page-info">{page} / {totalPages || 1}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? '编辑幼儿档案' : '新增幼儿档案'}</h3>
              <button className="close-btn" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-item">
                    <label>姓名 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onInput={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-item">
                    <label>性别</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>出生日期</label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onInput={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="form-item">
                    <label>班级 *</label>
                    <input
                      type="text"
                      value={formData.class_name}
                      onInput={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>监护人姓名</label>
                    <input
                      type="text"
                      value={formData.guardian_name}
                      onInput={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                    />
                  </div>
                  <div className="form-item">
                    <label>联系电话</label>
                    <input
                      type="text"
                      value={formData.guardian_phone}
                      onInput={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-item">
                  <label>健康状况</label>
                  <input
                    type="text"
                    value={formData.health_status}
                    onInput={(e) => setFormData({ ...formData, health_status: e.target.value })}
                    placeholder="如：正常、过敏体质等"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
