import { createContext, useContext } from 'react'

export const UserContext = createContext({
  currentUser: null,
  users: [],
  setCurrentUserId: () => {}
})

export function useCurrentUser() {
  return useContext(UserContext)
}
