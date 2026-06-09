<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">护理计划单列表</h2>
      <div>
        <button 
          v-if="authStore.role === 'registrar'"
          class="btn btn-primary" 
          @click="navigateTo('/plans/create')"
        >
          + 新建护理计划
        </button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <label>状态筛选：</label>
        <select v-model="filterStatus" @change="loadPlans">
          <option value="all">全部</option>
          <option value="draft">草稿</option>
          <option value="pending_audit">待审核</option>
          <option value="pending_review">待复核</option>
          <option value="archived">已归档</option>
          <option value="returned">已退回</option>
        </select>
        <span style="margin-left: auto; color: #666;">共 {{ total }} 条</span>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      
      <div v-else-if="plans.length === 0" class="empty">
        暂无数据
      </div>
      
      <table v-else class="table">
        <thead>
          <tr>
            <th>计划编号</th>
            <th>老人姓名</th>
            <th>性别</th>
            <th>年龄</th>
            <th>房间/床位</th>
            <th>护理级别</th>
            <th>入住评估</th>
            <th>家属确认</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id">
            <td>{{ plan.plan_no }}</td>
            <td>{{ plan.elder_name }}</td>
            <td>{{ plan.elder_gender }}</td>
            <td>{{ plan.elder_age }}</td>
            <td>{{ plan.room_no }} / {{ plan.bed_no }}</td>
            <td>{{ plan.plan_level || '-' }}</td>
            <td>
              <span :class="['status-tag', `status-${plan.assessment_status}`]">
                {{ ASSESSMENT_STATUS_MAP[plan.assessment_status] }}
              </span>
            </td>
            <td>
              <span :class="['status-tag', `status-${plan.family_confirm_status}`]">
                {{ FAMILY_CONFIRM_STATUS_MAP[plan.family_confirm_status] }}
              </span>
            </td>
            <td>
              <span :class="['status-tag', `status-${plan.status}`]">
                {{ STATUS_MAP[plan.status] }}
              </span>
            </td>
            <td>{{ formatDate(plan.created_at) }}</td>
            <td>
              <button class="btn btn-default btn-sm" @click="viewDetail(plan.id)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > pageSize" class="pagination">
        <button @click="prevPage" :disabled="page <= 1">上一页</button>
        <span>第 {{ page }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { 
  STATUS_MAP, 
  ASSESSMENT_STATUS_MAP, 
  FAMILY_CONFIRM_STATUS_MAP,
  type NursingPlan 
} from '~/types'

definePageMeta({
  layout: 'default'
})

const authStore = useAuthStore()

const plans = ref<NursingPlan[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const filterStatus = ref('all')

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

async function loadPlans() {
  loading.value = true
  try {
    const statusParam = filterStatus.value === 'all' ? '' : filterStatus.value
    const result = await $fetch(`http://localhost:8001/api/plans/list`, {
      method: 'GET',
      params: {
        status: statusParam,
        page: page.value,
        page_size: pageSize.value
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any

    if (result.success) {
      plans.value = result.data.items
      total.value = result.data.total
    }
  } catch (e) {
    console.error('加载列表失败', e)
  } finally {
    loading.value = false
  }
}

function viewDetail(id: string) {
  navigateTo(`/plans/${id}`)
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    loadPlans()
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    loadPlans()
  }
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    navigateTo('/login')
    return
  }
  loadPlans()
})
</script>

<style scoped>
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.status-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-cancelled {
  background: #f0f0f0;
  color: #999;
}

.status-confirmed {
  background: #f6ffed;
  color: #52c41a;
}

.status-rejected {
  background: #fff1f0;
  color: #f5222d;
}
</style>
