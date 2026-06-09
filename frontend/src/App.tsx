import { Router, Routes, Route } from './router';
import { UserProvider } from './contexts/UserContext';
import Layout from './components/Layout';
import PlanList from './pages/PlanList';
import PlanDetail from './pages/PlanDetail';
import { onMount } from 'solid-js';
import { useUser } from './contexts/UserContext';

function AppContent() {
  const { loadUsers } = useUser();

  onMount(() => {
    loadUsers();
  });

  return (
    <Layout>
      <Routes>
        <Route path="/" component={PlanList} />
        <Route path="/plans/:id" component={PlanDetail} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </Router>
  );
}

export default App;
