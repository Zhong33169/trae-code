import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Role } from '../types';

const Navigation: React.FC = () => {
  const { currentUser } = useAppStore();

  const getNavItems = () => {
    const baseItems = [
      { to: '/scan', label: '扫码核验', icon: '📱' },
      { to: '/orders', label: '订单列表', icon: '📋' },
    ];

    if (currentUser?.role === Role.REGISTRAR) {
      baseItems.push({ to: '/create', label: '新增订单', icon: '➕' });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <nav className="nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          {item.icon} {item.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default Navigation;
