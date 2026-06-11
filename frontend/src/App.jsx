import { RouterProvider, useRouter } from './router/index.js';
import { useAuth } from './stores/authStore';
import { useToast } from './stores/toastStore';
import { createSignal, onMount } from 'solid-js';
import { expenseApi } from './api/expenseApi';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import ExpenseList from './pages/ExpenseList.jsx';
import ExpenseDetail from './pages/ExpenseDetail.jsx';

function AppContent() {
  const { userId, setUser } = useAuth();
  const { toasts } = useToast();
  const { currentPath } = useRouter();
  const [initialized, setInitialized] = createSignal(false);

  onMount(async () => {
    if (userId()) {
      try {
        const res = await expenseApi.getUsers();
        if (res.success) {
          const user = res.data.find(u => u.id === userId());
          if (user) {
            setUser(user);
          }
        }
      } catch (err) {
        console.error('获取用户信息失败:', err);
      }
    }
    setInitialized(true);
  });

  const renderPage = () => {
    if (!initialized()) {
      return <div class="loading">加载中...</div>;
    }

    const path = currentPath();
    const isLoggedIn = !!userId();

    if (!isLoggedIn) {
      return <Login />;
    }

    if (path === '/login') {
      return <Login />;
    }

    if (path === '/expenses' || path === '/') {
      return (
        <Layout>
          <ExpenseList />
        </Layout>
      );
    }

    if (path.startsWith('/expenses/')) {
      return (
        <Layout>
          <ExpenseDetail />
        </Layout>
      );
    }

    return (
      <Layout>
        <ExpenseList />
      </Layout>
    );
  };

  return (
    <div>
      <div class="toast-container">
        {toasts().map(toast => (
          <div key={toast.id} class={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
      {renderPage()}
    </div>
  );
}

function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}

export default App;
