import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Login from "@/pages/Login"
import Workspace from "@/pages/Workspace"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}
