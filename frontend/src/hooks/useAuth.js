import { useState, useCallback } from 'react'

const DEFAULT_USER = 'wang_ling'
const DEFAULT_ROLE = 'registrar'

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem('currentUser') || DEFAULT_USER
  )
  const [currentRole, setCurrentRole] = useState(
    localStorage.getItem('currentRole') || DEFAULT_ROLE
  )

  const switchRole = useCallback((role) => {
    setCurrentRole(role)
    localStorage.setItem('currentRole', role)
  }, [])

  const switchUser = useCallback((user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', user)
  }, [])

  return {
    currentUser,
    currentRole,
    switchRole,
    switchUser,
  }
}
