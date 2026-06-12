import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './styles.css';
import { auth, api } from './utils/api';
import Login from './pages/Login';
import Layout from './components/Layout';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = auth.getToken();
    if (token) {
      api.me()
        .then((u) => {
          setUser(u);
          auth.setUser(u);
        })
        .catch(() => {
          auth.clearToken();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>
    );
  }

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return <Layout user={user} onLogout={() => { auth.clearToken(); setUser(null); }} />;
}

render(<App />, document.getElementById('app'));
