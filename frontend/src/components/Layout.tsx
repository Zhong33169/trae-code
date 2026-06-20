import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Radio, Select } from 'antd';
import { Home, List, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Role, ROLE_LABEL_MAP } from '@/types';

const MENU_ITEMS = [
  { key: '/', label: '工作台', icon: <Home size={16} /> },
  { key: '/invitations', label: '邀约单列表', icon: <List size={16} /> },
  { key: '/audit', label: '审计记录', icon: <FileText size={16} /> },
];

const ROLE_OPTIONS = [
  { value: Role.Registrar, label: ROLE_LABEL_MAP[Role.Registrar] },
  { value: Role.Reviewer, label: ROLE_LABEL_MAP[Role.Reviewer] },
  { value: Role.FinalReviewer, label: ROLE_LABEL_MAP[Role.FinalReviewer] },
];

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, currentUser, setCurrentRole } = useAppStore();
  const [collapsed] = useState(false);

  const selectedKey = MENU_ITEMS.find((item) => {
    if (item.key === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.key);
  })?.key || '/';

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="flex flex-col"
        style={{ width: collapsed ? 64 : 220, background: 'var(--color-primary)', transition: 'width 0.2s' }}
      >
        <div className="flex items-center justify-center h-16 px-4 text-white font-bold text-lg border-b border-white/10">
          {!collapsed && '媒体邀约单管理系统'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={MENU_ITEMS.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
          }))}
          style={{ flex: 1, borderRight: 0, background: 'transparent' }}
          theme="dark"
        />
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header
          className="flex items-center justify-between h-16 px-6 border-b"
          style={{ background: '#fff' }}
        >
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">当前角色：</span>
            <Radio.Group
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              {ROLE_OPTIONS.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">当前用户：</span>
            <span className="font-medium text-sm">{currentUser.name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
