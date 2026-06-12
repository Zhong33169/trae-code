import { Router, Route, useNavigate } from '@solidjs/router';
import { createEffect } from 'solid-js';
import { token } from './stores/auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Queue from './pages/Queue';
import ApplicationDetail from './pages/ApplicationDetail';
import ScanVerify from './pages/ScanVerify';
import BatchProcess from './pages/BatchProcess';

function Protected(props: { children: any }) {
  const navigate = useNavigate();
  createEffect(() => {
    if (!token()) {
      navigate('/');
    }
  });
  return <>{token() ? props.children : null}</>;
}

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={() => <Protected><Dashboard /></Protected>} />
      <Route path="/queue" component={() => <Protected><Queue /></Protected>} />
      <Route path="/queue/:tab" component={() => <Protected><Queue /></Protected>} />
      <Route path="/application/:id" component={() => <Protected><ApplicationDetail /></Protected>} />
      <Route path="/scan" component={() => <Protected><ScanVerify /></Protected>} />
      <Route path="/batch" component={() => <Protected><BatchProcess /></Protected>} />
    </Router>
  );
}
