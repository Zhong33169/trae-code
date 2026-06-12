import { render } from 'solid-js/web'
import './styles.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

render(
  () => (
    <AuthProvider>
      <App />
    </AuthProvider>
  ),
  document.getElementById('root')
)
