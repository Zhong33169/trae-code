import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import {
  getTicketList,
  getTicketDetail,
  getStatistics,
  createTicket,
  updateTicketStatus,
  submitHandover,
  acceptHandover,
  rejectHandover
} from '@/api/ticket'

export const useTicketStore = defineStore('ticket', () => {
  const list = ref([])
  const total = ref(0)
  const detail = ref(null)
  const stats = ref({
    total_tickets: 0,
    incoming_count: 0,
    dispatched_count: 0,
    return_visit_count: 0,
    closed_count: 0,
    exception_count: 0,
    pending_handover_count: 0,
    today_tickets: 0
  })
  const loading = ref(false)
  const detailLoading = ref(false)

  const queryParams = reactive({
    page: 1,
    page_size: 10,
    status: ''
  })

  async function fetchList(params = {}) {
    loading.value = true
    try {
      Object.assign(queryParams, params)
      const res = await getTicketList(queryParams)
      list.value = res.items || []
      total.value = res.total || 0
      return res
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    const res = await getStatistics()
    stats.value = res
    return res
  }

  async function fetchDetail(id) {
    detailLoading.value = true
    try {
      const res = await getTicketDetail(id)
      detail.value = res
      return res
    } finally {
      detailLoading.value = false
    }
  }

  async function handleCreateTicket(data) {
    const res = await createTicket(data)
    await fetchList()
    await fetchStats()
    return res
  }

  async function handleUpdateStatus(id, data) {
    const res = await updateTicketStatus(id, data)
    await fetchList()
    if (detail.value && detail.value.ticket && detail.value.ticket.id === id) {
      await fetchDetail(id)
    }
    await fetchStats()
    return res
  }

  async function handleSubmitHandover(data) {
    const res = await submitHandover(data)
    await fetchList()
    if (detail.value && detail.value.ticket && detail.value.ticket.id === data.ticket_id) {
      await fetchDetail(data.ticket_id)
    }
    await fetchStats()
    return res
  }

  async function handleAcceptHandover(id) {
    const res = await acceptHandover(id)
    await fetchList()
    if (detail.value && detail.value.handover_records) {
      const record = detail.value.handover_records.find(r => r.id === id)
      if (record && detail.value.ticket) {
        await fetchDetail(detail.value.ticket.id)
      }
    }
    await fetchStats()
    return res
  }

  async function handleRejectHandover(id, data) {
    const res = await rejectHandover(id, data)
    await fetchList()
    if (detail.value && detail.value.handover_records) {
      const record = detail.value.handover_records.find(r => r.id === id)
      if (record && detail.value.ticket) {
        await fetchDetail(detail.value.ticket.id)
      }
    }
    await fetchStats()
    return res
  }

  function resetQuery() {
    queryParams.page = 1
    queryParams.page_size = 10
    queryParams.status = ''
  }

  return {
    list,
    total,
    detail,
    stats,
    loading,
    detailLoading,
    queryParams,
    fetchList,
    fetchStats,
    fetchDetail,
    handleCreateTicket,
    handleUpdateStatus,
    handleSubmitHandover,
    handleAcceptHandover,
    handleRejectHandover,
    resetQuery
  }
})
