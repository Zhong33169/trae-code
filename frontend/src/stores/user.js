import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('care_user') || 'null'))
  const careListRefreshKey = ref(0)

  const role = computed(() => user.value?.role || '')
  const isLoggedIn = computed(() => !!user.value)

  function setUser(u) {
    user.value = u
    localStorage.setItem('care_user', JSON.stringify(u))
  }

  function logout() {
    user.value = null
    localStorage.removeItem('care_user')
  }

  function refreshCareList() {
    careListRefreshKey.value++
  }

  const roleLabel = computed(() => {
    const map = { doctor: '医生', nurse: '护士', reviewer: '复核员', admin: '管理员' }
    return map[user.value?.role] || ''
  })

  const canInitiate = computed(() => ['doctor', 'admin'].includes(role.value))
  const canProcess = computed(() => ['nurse', 'admin'].includes(role.value))
  const canReview = computed(() => ['reviewer', 'admin'].includes(role.value))

  return { user, role, isLoggedIn, roleLabel, canInitiate, canProcess, canReview, careListRefreshKey, setUser, logout, refreshCareList }
})
