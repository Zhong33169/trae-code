import { useState, useEffect, useCallback } from 'react';
import LoginPanel from './LoginPanel';
import ApplicationQueue from './ApplicationQueue';
import ApplicationDetail from './ApplicationDetail';
import EvidencePanel from './EvidencePanel';
import CreateApplicationModal from './CreateApplicationModal';
import BatchResultsModal from './BatchResultsModal';
import Header from './Header';
import type {
  User,
  ReplenishmentApplication,
  ApplicationVersion,
  Store,
  BatchReviewResponse,
} from '../types';
import {
  getCurrentUser,
  setCurrentUser,
  logout,
  login as apiLogin,
  getApplications,
  getApplication,
  getApplicationHistory,
  getStores,
} from '../lib/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<ReplenishmentApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ReplenishmentApplication | null>(null);
  const [appHistory, setAppHistory] = useState<ApplicationVersion[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const apps = await getApplications(
        statusFilter || undefined,
        storeFilter || undefined
      );
      setApplications(apps);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, storeFilter]);

  const loadStores = useCallback(async () => {
    if (!user) return;
    try {
      const s = await getStores();
      setStores(s);
    } catch (e) {
      console.error('Failed to load stores:', e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadApplications();
      loadStores();
    }
  }, [user, loadApplications, loadStores]);

  const handleLogin = async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setUser(result.user);
    setCurrentUser(result.user, result.token);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setSelectedApp(null);
    setApplications([]);
    setSelectedIds(new Set());
  };

  const handleSelectApp = async (app: ReplenishmentApplication) => {
    setSelectedApp(app);
    try {
      const history = await getApplicationHistory(app.id);
      setAppHistory(history);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const handleRefresh = async () => {
    await loadApplications();
    if (selectedApp) {
      try {
        const refreshed = await getApplication(selectedApp.id);
        setSelectedApp(refreshed);
        const history = await getApplicationHistory(selectedApp.id);
        setAppHistory(history);
      } catch (e) {
        setSelectedApp(null);
        setAppHistory([]);
      }
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map(a => a.id)));
    }
  };

  if (!user) {
    return <LoginPanel onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <Header
        user={user}
        onLogout={handleLogout}
        onCreateClick={() => setShowCreateModal(true)}
        canCreate={user.role === 'registrar'}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          <ApplicationQueue
            applications={applications}
            selectedApp={selectedApp}
            onSelectApp={handleSelectApp}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            storeFilter={storeFilter}
            onStoreFilterChange={setStoreFilter}
            stores={stores}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onRefresh={handleRefresh}
            loading={loading}
            error={error}
            userRole={user.role}
            onBatchResult={setBatchResult}
            onApplicationsUpdated={loadApplications}
          />
        </div>

        <div style={{ width: '400px', background: 'white', borderLeft: '1px solid #e5e7eb', overflow: 'auto' }}>
          <EvidencePanel
            application={selectedApp}
            history={appHistory}
          />
        </div>
      </div>

      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          history={appHistory}
          user={user}
          onClose={() => setSelectedApp(null)}
          onUpdated={handleRefresh}
        />
      )}

      {showCreateModal && (
        <CreateApplicationModal
          stores={stores}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRefresh}
        />
      )}

      {batchResult && (
        <BatchResultsModal
          result={batchResult}
          onClose={() => {
            setBatchResult(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
