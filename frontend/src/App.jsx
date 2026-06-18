import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { api } from './lib/api.js';
import { ROLE_NAMES } from './lib/constants.js';
import ApplicationsList from './pages/ApplicationsList.jsx';
import ApplicationDetail from './pages/ApplicationDetail.jsx';
import AuditLogs from './pages/AuditLogs.jsx';

function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const savedId = localStorage.getItem('currentUserId');
    api.getUsers().then(data => {
      setUsers(data);
      if (savedId && data.find(u => u.id === parseInt(savedId))) {
        setCurrentUserId(parseInt(savedId));
        setCurrentUser(data.find(u => u.id === parseInt(savedId)));
      } else if (data.length > 0) {
        setCurrentUserId(data[0].id);
        setCurrentUser(data[0]);
        localStorage.setItem('currentUserId', data[0].id);
      }
    }).catch(err => {
      console.error('加载用户失败:', err);
    });
  }, []);

  const handleUserChange = (e) => {
    const id = parseInt(e.target.value);
    setCurrentUserId(id);
    localStorage.setItem('currentUserId', id);
    const user = users.find(u => u.id === id);
    setCurrentUser(user || null);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 style={{ marginBottom: 4 }}>换表申请管理系统</h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <Link 
              to="/" 
              className="link" 
              style={{ fontWeight: isActive('/') ? 600 : 'normal', color: isActive('/') ? '#0f172a' : undefined }}
            >
              申请列表
            </Link>
            <Link 
              to="/audit" 
              className="link" 
              style={{ fontWeight: isActive('/audit') ? 600 : 'normal', color: isActive('/audit') ? '#0f172a' : undefined }}
            >
              审计日志
            </Link>
          </div>
        </div>
        <div className="user-selector">
          <label>当前角色:</label>
          <select value={currentUserId || ''} onChange={handleUserChange}>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} - {ROLE_NAMES[u.role]}
              </option>
            ))}
          </select>
          {currentUser && (
            <span className="role-badge">{ROLE_NAMES[currentUser.role]}</span>
          )}
        </div>
      </div>

      <Routes>
        <Route path="/" element={<ApplicationsList />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/audit" element={<AuditLogs />} />
      </Routes>
    </div>
  );
}

export default App;
