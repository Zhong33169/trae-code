import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const LoginPage: React.FC = () => {
  const { mockUsers, loadMockUsers, switchUser, isLoading, error, clearError } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadMockUsers();
  }, []);

  const handleSelectUser = async (userId: string) => {
    clearError();
    try {
      await switchUser(userId);
      navigate('/');
    } catch (err) {
      console.error('登录失败:', err);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '60px auto', padding: '20px' }}>
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>🏟️ 体育场馆扫码核验场地订单系统</h2>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '24px' }}>
          请选择您的岗位身份进入系统
        </p>

        {error && (
          <div className="error-box" style={{ marginBottom: '20px' }}>
            <div className="error-title">❌ 错误</div>
            <div className="error-message">{error}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mockUsers.map((user) => (
            <button
              key={user.id}
              className="btn btn-default"
              style={{
                padding: '16px 24px',
                textAlign: 'left',
                justifyContent: 'space-between',
                fontSize: '14px',
                border: '2px solid #e8e8e8',
              }}
              onClick={() => handleSelectUser(user.id)}
              disabled={isLoading}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{user.name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  {user.roleLabel}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#1890ff' }}>
                {user.description}
              </div>
            </button>
          ))}
        </div>

        {mockUsers.length === 0 && !error && (
          <div className="empty-state">
            <div className="loading"></div>
            <p style={{ marginTop: '12px' }}>加载用户列表中...</p>
          </div>
        )}

        <div className="test-scenario">
          <h4>💡 测试说明</h4>
          <ul>
            <li>系统预设 3 个岗位共 4 位用户，可自由切换测试流程</li>
            <li>场地登记员：可扫码、登记、补正材料</li>
            <li>场地审核主管：可扫码、审核订单、要求补正</li>
            <li>体育场馆复核负责人：可扫码、最终复核、归档</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
