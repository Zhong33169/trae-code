import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import Header from './components/Header';
import Navigation from './components/Navigation';
import ScanPage from './pages/ScanPage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import CreateOrderPage from './pages/CreateOrderPage';
import LoginPage from './pages/LoginPage';

const App: React.FC = () => {
  const { currentUser, loadMockUsers, switchUser, isLoading } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadMockUsers();
    const savedOperatorId = localStorage.getItem('operatorId');
    if (savedOperatorId) {
      switchUser(savedOperatorId).catch(() => {
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      });
    } else if (location.pathname !== '/login') {
      navigate('/login');
    }
  }, []);

  useEffect(() => {
    if (!currentUser && location.pathname !== '/login') {
      navigate('/login');
    } else if (currentUser && location.pathname === '/login') {
      navigate('/');
    }
  }, [currentUser, location.pathname]);

  if (isLoading && !currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loading"></div>
        <span style={{ marginLeft: '12px' }}>加载中...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {currentUser && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      <main style={{ flex: 1 }}>
        <div className="container">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/orders" element={<OrderListPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/create" element={<CreateOrderPage />} />
            <Route path="/" element={<Navigate to="/scan" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
