import { createContext, useContext, createSignal, createEffect, onMount } from 'solid-js'

const AuthContext = createContext()

const mockUsers = [
  { id: 1, username: 'registrar1', name: '张登记', role: 'registrar' },
  { id: 2, username: 'registrar2', name: '李登记', role: 'registrar' },
  { id: 3, username: 'supervisor1', name: '王主管', role: 'supervisor' },
  { id: 4, username: 'supervisor2', name: '赵主管', role: 'supervisor' },
  { id: 5, username: 'reviewer1', name: '陈复核', role: 'reviewer' },
  { id: 6, username: 'reviewer2', name: '刘复核', role: 'reviewer' },
]

const roleNames = {
  registrar: '维修登记员',
  supervisor: '维修审核主管',
  reviewer: '复核负责人',
}

export function AuthProvider(props) {
  const [currentUser, setCurrentUser] = createSignal(mockUsers[0])
  const [loading, setLoading] = createSignal(false)

  const getToken = () => {
    return `Bearer ${currentUser().id}`
  }

  const switchUser = (userId) => {
    const user = mockUsers.find((u) => u.id === parseInt(userId))
    if (user) {
      setCurrentUser(user)
      localStorage.setItem('repair_user_id', userId)
    }
  }

  onMount(() => {
    const saved = localStorage.getItem('repair_user_id')
    if (saved) {
      switchUser(saved)
    }
  })

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        switchUser,
        getToken,
        loading,
        setLoading,
        mockUsers,
        roleNames,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
