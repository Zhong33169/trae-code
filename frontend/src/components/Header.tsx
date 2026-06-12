import React from 'react';
import { useAppStore } from '../store/appStore';

const Header: React.FC = () => {
  const { currentUser, mockUsers, switchUser, isLoading } = useAppStore();

  const handleSwitchUser = async (userId: string) => {
    try {
      await switchUser(userId);
    } catch (error) {
      console.error('切换用户失败:', error);
    }
  };

  return (
    <header className="header">
      <h1>🏟️ 体育场馆扫码核验场地订单系统</h1>
      <div className="user-info">
        <div className="role-selector">
          {mockUsers.map((user) => (
            <button
              key={user.id}
              className={`role-btn ${currentUser?.id === user.id ? 'active' : ''}`}
              onClick={() => handleSwitchUser(user.id)}
              disabled={isLoading}
              title={user.description}
            >
              {user.name}
              <span style={{ opacity: 0.7, marginLeft: '4px', fontSize: '11px' }}>
                ({user.roleLabel})
              </span>
            </button>
          ))}
        </div>
        {currentUser && (
          <span style={{ fontSize: '13px', opacity: 0.9 }}>
            当前身份: <strong>{currentUser.name}</strong> ({currentUser.roleLabel})
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
