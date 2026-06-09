import { useState, useCallback } from 'react'

const ROLE_DEFAULT_USERS = {
  registrar: 'wang_ling',
  supervisor: 'li_min',
  reviewer: 'zhao_fang',
}

const DEFAULT_ROLE = 'registrar'
const DEFAULT_USER = ROLE_DEFAULT_USERS[DEFAULT_ROLE]

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem('currentUser') || DEFAULT_USER
  )
  const [currentRole, setCurrentRole] = useState(
    localStorage.getItem('currentRole') || DEFAULT_ROLE
  )

  const switchRole = useCallback((role) => {
    const defaultUser = ROLE_DEFAULT_USERS[role] || DEFAULT_USER
    setCurrentRole(role)
    setCurrentUser(defaultUser)
    localStorage.setItem('currentRole', role)
    localStorage.setItem('currentUser', defaultUser)
  }, [])

  const switchUser = useCallback((user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', user)
  }, [])

  const getDefaultUserForRole = useCallback((role) => {
    return ROLE_DEFAULT_USERS[role] || DEFAULT_USER
  }, [])

  return {
    currentUser,
    currentRole,
    switchRole,
    switchUser,
    getDefaultUserForRole,
  }
}
