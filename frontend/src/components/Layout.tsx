import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_TEXT } from '../types';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-logo">
          <span>🌐</span>
          <span>跨境电商订单到期预警系统</span>
        </div>
        <div className="app-header-right">
          {user && (
            <div className="user-info">
              <span>{user.name}</span>
              <span className="user-role">{ROLE_TEXT[user.role]}</span>
            </div>
          )}
          <button className="btn btn-default btn-sm" onClick={handleLogout}>
            切换角色
          </button>
        </div>
      </header>
      <main className="app-content">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
