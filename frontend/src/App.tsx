import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { OrderListPage } from './pages/OrderListPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { NewOrderPage } from './pages/NewOrderPage';
import './styles/global.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<OrderListPage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
