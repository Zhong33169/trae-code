import { useNavigate } from '../router/index.js';
import { useAuth } from '../stores/authStore';
import { expenseApi } from '../api/expenseApi';
import { useToast } from '../stores/toastStore';
import { createSignal, onMount, children } from 'solid-js';

function Layout(props) {
  const { userId, userInfo, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = createSignal(null);

  const loadStats = async () => {
    try {
      const res = await expenseApi.getStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  };

  onMount(async () => {
    if (!userInfo()) {
      try {
        const res = await expenseApi.getUsers();
        if (res.success) {
          const user = res.data.find(u => u.id === userId());
          if (user) {
            setUser(user);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  });

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    navigate('/login');
  };

  const roleLabels = {
    clerk: '报销专员',
    accountant: '费用会计',
    manager: '财务经理',
  };

  const c = children(() => props.children);

  return (
    <div class="layout">
      <style>{`
        .layout { display: flex; min-height: 100vh; }
        .sidebar { width: 220px; background: #001529; color: #fff; display: flex; flex-direction: column; flex-shrink: 0; }
        .sidebar-logo { padding: 20px 16px; font-size: 16px; font-weight: 600; border-bottom: 1px solid #1f1f1f; }
        .sidebar-logo .sub { font-size: 12px; color: rgba(255,255,255,0.65); font-weight: normal; margin-top: 4px; }
        .menu { flex: 1; padding: 12px 0; }
        .menu-item { display: block; padding: 10px 20px; color: rgba(255,255,255,0.65); text-decoration: none; transition: all 0.2s; cursor: pointer; }
        .menu-item:hover { color: #fff; background: #1890ff; }
        .menu-item.active { color: #fff; background: #1890ff; }
        .menu-icon { margin-right: 8px; }
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .header { height: 56px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .header-title { font-size: 16px; font-weight: 500; }
        .header-right { display: flex; align-items: center; gap: 16px; }
        .user-info { display: flex; align-items: center; gap: 8px; }
        .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1890ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
        .user-detail { display: flex; flex-direction: column; line-height: 1.2; }
        .user-name { font-size: 14px; font-weight: 500; }
        .user-role { font-size: 12px; color: #8c8c8c; }
        .logout-btn { padding: 6px 12px; font-size: 12px; border: 1px solid #d9d9d9; background: #fff; border-radius: 4px; cursor: pointer; }
        .logout-btn:hover { border-color: #1890ff; color: #1890ff; }
        .content { flex: 1; padding: 20px; background: #f5f7fa; overflow-y: auto; }
        .stats-bar { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-card { flex: 1; min-width: 140px; background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .stat-label { font-size: 12px; color: #8c8c8c; margin-bottom: 8px; }
        .stat-value { font-size: 28px; font-weight: 600; line-height: 1; }
        .stat-value.overdue { color: #ff4d4f; }
        .stat-value.warning { color: #faad14; }
        .stat-value.normal { color: #52c41a; }
        .stat-value.total { color: #1890ff; }
      `}</style>

      <div class="sidebar">
        <div class="sidebar-logo">
          <div>财务共享中心</div>
          <div class="sub">报销申请预警系统</div>
        </div>
        <div class="menu">
          <div
            class="menu-item active"
            onClick={() => navigate('/expenses')}
          >
            <span class="menu-icon">📋</span>
            报销申请
          </div>
        </div>
      </div>

      <div class="main">
        <div class="header">
          <div class="header-left">
            <span class="header-title">报销申请管理</span>
          </div>
          <div class="header-right">
            <div class="user-info">
              <div class="user-avatar">{userInfo()?.name?.charAt?.(0) || '?'}</div>
              <div class="user-detail">
                <span class="user-name">{userInfo()?.name || '加载中...'}</span>
                <span class="user-role">{userInfo() ? roleLabels[userInfo().role] : ''}</span>
              </div>
            </div>
            <button class="logout-btn" onClick={handleLogout}>
              切换身份
            </button>
          </div>
        </div>

        {stats() && (
          <div style={{ padding: '20px 20px 0 20px', background: '#f5f7fa' }}>
            <div class="stats-bar">
              <div class="stat-card">
                <div class="stat-label">全部申请</div>
                <div class="stat-value total">{stats().total}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">已逾期</div>
                <div class="stat-value overdue">{stats().overdue}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">临期预警</div>
                <div class="stat-value warning">{stats().warning}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">正常处理</div>
                <div class="stat-value normal">{stats().normal}</div>
              </div>
              {userInfo()?.role !== 'manager' && (
                <div class="stat-card">
                  <div class="stat-label">我的待办</div>
                  <div class="stat-value total">{stats().myPending}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div class="content">
          {c()}
        </div>
      </div>
    </div>
  );
}

export default Layout;
