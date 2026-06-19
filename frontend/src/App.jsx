import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Router, Route, Link } from 'preact-router';
import { fetchUsers } from './api/client';
import QueueList from './components/QueueList';
import OrderDetail from './components/OrderDetail';
import Statistics from './components/Statistics';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers()
      .then((data) => {
        const list = data.users || data || [];
        setUsers(list);
        if (list.length > 0) {
          setCurrentUser(list[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleUserChange = (e) => {
    const userId = parseInt(e.target.value);
    const user = users.find((u) => u.id === userId);
    if (user) setCurrentUser(user);
  };

  return (
    <div>
      <header class="app-header">
        <div class="logo">售后处理工作流</div>
        <nav class="nav-links">
          <Link href="/">处理队列</Link>
          <Link href="/stats">统计概览</Link>
        </nav>
        <div class="user-switcher">
          {currentUser && (
            <select value={currentUser.id} onChange={handleUserChange}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>
      <Router>
        <Route path="/" component={QueueList} currentUser={currentUser} />
        <Route path="/order/:id" component={OrderDetail} currentUser={currentUser} />
        <Route path="/stats" component={Statistics} />
      </Router>
    </div>
  );
}
