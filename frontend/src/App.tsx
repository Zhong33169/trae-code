import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { AccountsReceivableList } from '@/pages/AccountsReceivable/List';
import { AccountsReceivableDetail } from '@/pages/AccountsReceivable/Detail';
import { ConfirmationOrdersList } from '@/pages/ConfirmationOrders/List';
import { ConfirmationOrdersDetail } from '@/pages/ConfirmationOrders/Detail';
import { PaymentVerificationsList } from '@/pages/PaymentVerifications/List';
import { OperationLogsList } from '@/pages/OperationLogs/List';
import type { UserRole } from '@/lib/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const ROLE_ACCESS_MAP: Record<string, UserRole[]> = {
  '/dashboard': ['registrar', 'auditor', 'reviewer'],
  '/accounts-receivable': ['registrar', 'reviewer'],
  '/accounts-receivable/:id': ['registrar', 'reviewer'],
  '/confirmation-orders': ['registrar', 'auditor', 'reviewer'],
  '/confirmation-orders/:id': ['registrar', 'auditor', 'reviewer'],
  '/payment-verifications': ['reviewer'],
  '/operation-logs': ['registrar', 'auditor', 'reviewer'],
};

function canAccess(path: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const normalizedPath = path.replace(/\/\d+[^/]*/g, '/:id');
  const allowed = ROLE_ACCESS_MAP[normalizedPath];
  if (!allowed) return true;
  return allowed.includes(role);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (!canAccess(location.pathname, user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  if (!user) return null;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/accounts-receivable" element={<AccountsReceivableList />} />
        <Route path="/accounts-receivable/:id" element={<AccountsReceivableDetail />} />
        <Route path="/confirmation-orders" element={<ConfirmationOrdersList />} />
        <Route path="/confirmation-orders/:id" element={<ConfirmationOrdersDetail />} />
        <Route path="/payment-verifications" element={<PaymentVerificationsList />} />
        <Route path="/operation-logs" element={<OperationLogsList />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function AppInit() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
  return <AppRoutes />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
