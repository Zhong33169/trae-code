import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import ApplicationList from './pages/ApplicationList';
import ApplicationDetail from './pages/ApplicationDetail';
import { getUserFromStorage } from './utils/api';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={(u) => setUser(u)} />} />
      <Route
        path="/*"
        element={
          user ? (
            <Layout user={user} onLogout={() => setUser(null)}>
              <Routes>
                <Route path="/" element={<Navigate to="/applications" replace />} />
                <Route path="/applications" element={<ApplicationList user={user} />} />
                <Route path="/applications/:id" element={<ApplicationDetail user={user} />} />
                <Route path="*" element={<Navigate to="/applications" replace />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
