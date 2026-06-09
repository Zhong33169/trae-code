import { ParentComponent, createSignal, onMount, Show } from 'solid-js';
import { useUser } from '../contexts/UserContext';
import { roleLabels, UserRole } from '../types';
import './Layout.css';
import { useNavigate, usePath } from '../router';

const Layout: ParentComponent = (props) => {
  const { currentUser, users, setCurrentUser, loadUsers } = useUser();
  const navigate = useNavigate();
  const path = usePath();
  const [stats, setStats] = createSignal<any>(null);

  const handleUserChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const user = users().find(u => u.id === target.value);
    if (user) {
      setCurrentUser(user);
      navigate('/');
    }
  };

  const getActiveNav = () => {
    if (path() === '/') return 'all';
    return 'all';
  };

  return (
    <div class="layout">
      <header class="layout-header">
        <div class="header-left">
          <div class="logo">🦷 口腔门诊治疗计划系统</div>
          <nav class="nav-menu">
            <a href="/" class={getActiveNav() === 'all' ? 'nav-item active' : 'nav-item'}>
              治疗计划单
            </a>
          </nav>
        </div>
        <div class="header-right">
          <div class="user-switcher">
            <span class="switcher-label">当前身份：</span>
            <select value={currentUser()?.id || ''} onChange={handleUserChange} class="user-select">
              {users().map(user => (
                <option value={user.id}>
                  {user.name}（{roleLabels[user.role]}）- {user.store}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main class="layout-main">
        <div class="content-wrapper">
          {props.children}
        </div>
      </main>

      <footer class="layout-footer">
        <span>口腔连锁门诊 - 到期预警处理治疗计划单系统 v1.0</span>
      </footer>
    </div>
  );
};

export default Layout;
