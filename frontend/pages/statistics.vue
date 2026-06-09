<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">统计概览</h2>
      <button class="btn btn-default" @click="loadStats">刷新</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else>
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-card-title">护理计划单总数</div>
          <div class="stat-card-value" style="color: #1890ff;">{{ stats.total_plans }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">草稿</div>
          <div class="stat-card-value" style="color: #666;">{{ stats.draft }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">待审核</div>
          <div class="stat-card-value" style="color: #fa8c16;">{{ stats.pending_audit }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">待复核</div>
          <div class="stat-card-value" style="color: #f5222d;">{{ stats.pending_review }}</div>
        </div>
      </div>
      
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-card-title">已归档</div>
          <div class="stat-card-value" style="color: #52c41a;">{{ stats.archived }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">已退回</div>
          <div class="stat-card-value" style="color: #ff4d4f;">{{ stats.returned }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">完成率</div>
          <div class="stat-card-value" style="color: #13c2c2;">{{ completionRate }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">在办数量</div>
          <div class="stat-card-value" style="color: #722ed1;">{{ inProgressCount }}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 class="section-title">按护理级别分布</h3>
          <div v-if="stats.by_level.length === 0" class="empty">暂无数据</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>护理级别</th>
                <th>数量</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in stats.by_level" :key="item.level">
                <td>{{ item.level }}</td>
                <td>{{ item.count }}</td>
                <td>{{ getLevelPercent(item.count) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3 class="section-title">按班次交接统计</h3>
          <div v-if="stats.by_shift.length === 0" class="empty">暂无交接数据</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>班次</th>
                <th>交接次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in stats.by_shift" :key="item.shift">
                <td>{{ item.shift }}</td>
                <td>{{ item.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top: 20px;">
        <h3 class="section-title">状态说明</h3>
        <div class="grid-3">
          <div>
            <span class="status-tag status-draft">草稿</span>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">登记员创建或退回补正中的计划</p>
          </div>
          <div>
            <span class="status-tag status-pending_audit">待审核</span>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">已提交，等待审核主管审核</p>
          </div>
          <div>
            <span class="status-tag status-pending_review">待复核</span>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">审核通过，等待复核负责人归档</p>
          </div>
          <div>
            <span class="status-tag status-archived">已归档</span>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">复核完成，已正式归档</p>
          </div>
          <div>
            <span class="status-tag status-returned">已退回</span>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">审核或复核不通过，需补正</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'default'
})

const authStore = useAuthStore()

const loading = ref(true)
const stats = ref({
  total_plans: 0,
  draft: 0,
  pending_audit: 0,
  audited: 0,
  pending_review: 0,
  archived: 0,
  returned: 0,
  by_shift: [] as { shift: string; count: number }[],
  by_level: [] as { level: string; count: number }[]
})

const completionRate = computed(() => {
  if (stats.value.total_plans === 0) return 0
  return Math.round((stats.value.archived / stats.value.total_plans) * 100)
})

const inProgressCount = computed(() => {
  return stats.value.pending_audit + stats.value.pending_review
})

function getLevelPercent(count: number) {
  if (stats.value.total_plans === 0) return 0
  return Math.round((count / stats.value.total_plans) * 100)
}

async function loadStats() {
  loading.value = true
  try {
    const result = await $fetch('http://localhost:8001/api/statistics/summary', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      stats.value = result.data
    }
  } catch (e) {
    console.error('加载统计失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    navigateTo('/login')
    return
  }
  loadStats()
})
</script>
