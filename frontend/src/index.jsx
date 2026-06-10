import { render } from 'solid-js/web'
import { Router, Routes, Route, Navigate } from '@solidjs/router'
import App from './App'
import Login from './pages/Login'
import Tickets from './pages/Tickets'
import TicketDetail from './pages/TicketDetail'
import AuditLogs from './pages/AuditLogs'
import './styles/index.css'

const Protected = (props) => {
  const user = localStorage.getItem('repair_user')
  if (!user) return <Navigate href="/login" />
  return props.children
}

render(
  () => (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><App /></Protected>}>
          <Route path="/" element={<Navigate href="/tickets" />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/audit" element={<AuditLogs />} />
        </Route>
      </Routes>
    </Router>
  ),
  document.getElementById('root')
)
