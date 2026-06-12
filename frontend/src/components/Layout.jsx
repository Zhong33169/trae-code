import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { ROLE_TEXT } from '../utils/format';
import OrderList from '../pages/OrderList';
import OrderDetail from '../pages/OrderDetail';
import Statistics from '../pages/Statistics';
import Toast from './Toast';

export default function Layout({ user, onLogout }) {
  const [page, setPage] = useState('list');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '');
      if (h.startsWith('detail/')) {
        setPage('detail');
        setOrderId(parseInt(h.split('/')[1], 10));
      } else if (h === 'statistics') {
        setPage('statistics');
      } else {
        setPage('list');
      }
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (p) => {
    if (p === 'detail') {
      location.hash = `#detail/${orderId}`;
    } else if (p === 'statistics') {
      location.hash = '#statistics';
    } else {
      location.hash = '#';
    }
  };

  const openDetail = (id) => {
    location.hash = `#detail/${id}`;
  };

  const backToList = () => {
    location.hash = '#';
  };

  const navItems = [
    { key: 'list', label: '隐患单列表', hash: '' },
    { key: 'statistics', label: '统计分析', hash: 'statistics' },
  ];

  return (
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-logo">
          消防隐患单<br />节点超时追踪系统
        </div>
        <nav class="sidebar-nav">
          {navItems.map((n) => {
            const active = (n.key === 'list' && page !== 'statistics') || (n.key === page);
            return (
              <a
                key={n.key}
                class={active ? 'active' : ''}
                onClick={() => (location.hash = n.hash ? `#${n.hash}` : '#')}
              >
                {n.label}
              </a>
            );
          })}
          {page === 'detail' && (
            <a class="active">隐患单详情</a>
          )}
        </nav>
      </aside>
      <div class="main-content">
        <div class="header-bar">
          <div class="header-title">
            {page === 'list' && '消防隐患单列表'}
            {page === 'detail' && <a onClick={backToList} style={{ marginRight: 8 }}>← 返回列表</a>}
            {page === 'detail' && '消防隐患单详情'}
            {page === 'statistics' && '统计分析'}
          </div>
          <div class="user-info">
            <span class="role-tag">{ROLE_TEXT[user.role] || user.role}</span>
            <span>{user.name}</span>
            <span style={{ color: '#999' }}>{user.station}</span>
            <a onClick={onLogout} style={{ color: '#ff4d4f' }}>退出</a>
          </div>
        </div>

        {page === 'list' && <OrderList user={user} onOpenDetail={openDetail} />}
        {page === 'detail' && orderId && (
          <OrderDetail user={user} orderId={orderId} onBack={backToList} onListRefresh={() => {}} />
        )}
        {page === 'statistics' && <Statistics user={user} />}
      </div>
      <Toast />
    </div>
  );
}
