import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const allRoles = ref([])
  const allUsers = ref([])

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const role = computed(() => user.value?.role || '')
  const roleName = computed(() => {
    const m = {
      registrar: '诉讼材料登记员',
      reviewer: '诉讼材料审核主管',
      verifier: '法务服务中心复核负责人',
    }
    return m[role.value] || '未知角色'
  })

  function can(action) {
    const roleMap = {
      register: ['registrar'],
      review: ['reviewer'],
      verify: ['verifier'],
      archive: ['verifier'],
      edit_material: ['registrar'],
      manage_attachment: ['registrar', 'reviewer'],
      reject_attachment: ['reviewer'],
      return_material: ['reviewer'],
      batch_process: ['reviewer', 'verifier'],
    }
    const allowed = roleMap[action]
    return allowed ? allowed.includes(role.value) : false
  }

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password })
    const d = res.data.data
    if (d?.success) {
      token.value = d.token
      user.value = d.user
      localStorage.setItem('token', d.token)
      localStorage.setItem('user', JSON.stringify(d.user))
      return true
    }
    return false
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function switchUser(u) {
    user.value = u
    localStorage.setItem('user', JSON.stringify(u))
  }

  async function fetchRoles() {
    const res = await api.get('/auth/roles')
    if (res.data.success) allRoles.value = res.data.data || []
  }

  async function fetchUsers() {
    const res = await api.get('/auth/users')
    if (res.data.success) allUsers.value = res.data.data || []
  }

  function getUserName(id) {
    const u = allUsers.value.find((x) => x.id === id)
    return u?.real_name || id || ''
  }

  function getRoleName(roleKey) {
    const r = allRoles.value.find((x) => x.key === roleKey)
    return r?.name || roleKey || ''
  }

  return {
    token,
    user,
    allRoles,
    allUsers,
    isLoggedIn,
    role,
    roleName,
    can,
    login,
    logout,
    switchUser,
    fetchRoles,
    fetchUsers,
    getUserName,
    getRoleName,
  }
})
