import { useState, useEffect } from 'react';
import { getCurrentUser } from '../lib/api';
import Header from './Header';
import Dashboard from './Dashboard';
import EnrollmentList from './EnrollmentList';
import EnrollmentDetail from './EnrollmentDetail';
import CreateEnrollment from './CreateEnrollment';
import AuditLogList from './AuditLogList';

interface AppProps {
  initialPage?: string;
  initialParams?: any;
}

export default function App({ initialPage = 'dashboard', initialParams }: AppProps) {
  const [page, setPage] = useState(initialPage);
  const [params, setParams] = useState(initialParams || {});
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setIsLoggedIn(true);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const navigate = (newPage: string, newParams?: any) => {
    setPage(newPage);
    setParams(newParams || {});
    window.scrollTo(0, 0);
  };

  if (!isLoggedIn) {
    return <div className="loading">加载中...</div>;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'enrollments':
        return (
          <EnrollmentList
            initialStatus={params.status}
            onViewDetail={(id) => navigate('detail', { id })}
            onCreate={() => navigate('create')}
          />
        );
      case 'detail':
        return (
          <EnrollmentDetail
            id={params.id}
            onBack={() => navigate('enrollments')}
          />
        );
      case 'create':
        return (
          <CreateEnrollment
            onBack={() => navigate('enrollments')}
            onCreated={(id) => navigate('detail', { id })}
          />
        );
      case 'audit':
        return <AuditLogList />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="app">
      <Header activePage={page} onNavigate={navigate} />
      <main className="main-content">
        {renderPage()}
      </main>

      <style>{`
        .app {
          min-height: 100vh;
          background: #f3f4f6;
        }
        .main-content {
          max-width: 1400px;
          margin: 0 auto;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
