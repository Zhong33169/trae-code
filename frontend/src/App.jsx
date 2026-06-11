import { useState, useEffect } from 'preact/hooks';
import { api, getCurrentUser, setCurrentUser } from './api.js';
import OrderList from './components/OrderList.jsx';
import OrderDetail from './components/OrderDetail.jsx';
import AuditLogPage from './components/AuditLogPage.jsx';
import Header from './components/Header.jsx';

export default function App() {
  const [page, setPage] = useState('list');
  const [pageParams, setPageParams] = useState({});
  const [user, setUser] = useState(getCurrentUser());
  const [meta, setMeta] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.meta();
        setMeta(m);
      } catch (e) {
        showToast('加载基础配置失败：' + e.message, 'error');
      }
    })();
  }, []);

  function showToast(message, type = 'info') {
    setToast({ message, type, ts: Date.now() });
    setTimeout(() => {
      setToast((t) => (t && Date.now() - t.ts >= 3000 ? null : t));
    }, 3500);
  }

  async function handleSwitchRole(userId, role) {
    try {
      const res = await api.switchUser(userId, role);
      setCurrentUser(res.user.id, res.user.role);
      setUser(res.user);
      showToast(`已切换为「${res.roleName || res.user.role}」：${res.user.name}`, 'success');
      if (page === 'detail' && pageParams.id) {
        navigate('detail', { id: pageParams.id, _ts: Date.now() });
      } else {
        navigate('list', { _ts: Date.now() });
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function navigate(p, params = {}) {
    setPage(p);
    setPageParams(params);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app-layout">
      <Header user={user} meta={meta} onSwitchRole={handleSwitchRole} navigate={navigate} page={page} />
      <div className="app-main">
        {toast && (
          <div style={{ position: 'fixed', top: 70, right: 24, zIndex: 999 }}>
            <div className={`alert ${toast.type}`} style={{ boxShadow: 'var(--shadow-md)' }}>
              {toast.message}
            </div>
          </div>
        )}
        {page === 'list' && (
          <OrderList
            meta={meta}
            user={user}
            navigate={navigate}
            showToast={showToast}
          />
        )}
        {page === 'detail' && (
          <OrderDetail
            id={pageParams.id}
            meta={meta}
            user={user}
            navigate={navigate}
            showToast={showToast}
          />
        )}
        {page === 'audit' && (
          <AuditLogPage
            meta={meta}
            user={user}
            navigate={navigate}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
