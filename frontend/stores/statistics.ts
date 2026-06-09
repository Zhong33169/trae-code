import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

interface StatsData {
  total_plans: number
  draft: number
  pending_audit: number
  audited: number
  pending_review: number
  archived: number
  returned: number
  by_shift: { shift: string; count: number }[]
  by_level: { level: string; count: number }[]
}

export const useStatisticsStore = defineStore('statistics', () => {
  const authStore = useAuthStore()
  
  const stats = ref<StatsData>({
    total_plans: 0,
    draft: 0,
    pending_audit: 0,
    audited: 0,
    pending_review: 0,
    archived: 0,
    returned: 0,
    by_shift: [],
    by_level: []
  })
  
  const loading = ref(false)
  const lastUpdated = ref<string>('')

  async function loadStats() {
    if (!authStore.isLoggedIn) return
    
    loading.value = true
    try {
      const result = await $fetch('http://localhost:8001/api/statistics/summary', {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }) as any
      
      if (result.success) {
        stats.value = result.data
        lastUpdated.value = new Date().toISOString()
      }
    } catch (e) {
      console.error('加载统计失败', e)
    } finally {
      loading.value = false
    }
  }

  function refreshStats() {
    return loadStats()
  }

  return {
    stats,
    loading,
    lastUpdated,
    loadStats,
    refreshStats
  }
})
