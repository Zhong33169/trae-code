import { createSignal } from 'solid-js';
import LoginPage from './components/LoginPage';
import MainLayout from './components/MainLayout';
import { getCurrentUser } from './api';

function App() {
  const [isLoggedIn, setIsLoggedIn] = createSignal(!!getCurrentUser());

  return (
    <div>
      {isLoggedIn() ? (
        <MainLayout onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <LoginPage onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  );
}

export default App;
