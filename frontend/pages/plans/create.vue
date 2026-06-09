<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">新建护理计划单</h2>
      <button class="btn btn-default" @click="goBack">返回</button>
    </div>

    <div class="card">
      <h3 class="section-title">基本信息</h3>
      
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      
      <div class="grid-2">
        <div class="form-item">
          <label class="form-label">老人姓名 <span style="color: #f5222d;">*</span></label>
          <input v-model="form.elder_name" class="form-input" placeholder="请输入老人姓名" />
        </div>
        
        <div class="form-item">
          <label class="form-label">性别 <span style="color: #f5222d;">*</span></label>
          <select v-model="form.elder_gender" class="form-select">
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        
        <div class="form-item">
          <label class="form-label">年龄 <span style="color: #f5222d;">*</span></label>
          <input v-model.number="form.elder_age" type="number" class="form-input" placeholder="请输入年龄" />
        </div>
        
        <div class="form-item">
          <label class="form-label">房间号</label>
          <input v-model="form.room_no" class="form-input" placeholder="请输入房间号" />
        </div>
        
        <div class="form-item">
          <label class="form-label">床位号</label>
          <input v-model="form.bed_no" class="form-input" placeholder="请输入床位号" />
        </div>
        
        <div class="form-item">
          <label class="form-label">入住日期</label>
          <input v-model="form.admission_date" type="date" class="form-input" />
        </div>
        
        <div class="form-item">
          <label class="form-label">护理级别</label>
          <select v-model="form.plan_level" class="form-select">
            <option value="">请选择</option>
            <option value="自理">自理</option>
            <option value="半自理">半自理</option>
            <option value="完全失能">完全失能</option>
            <option value="特护">特护</option>
          </select>
        </div>
      </div>
      
      <div class="form-item" style="margin-top: 16px;">
        <label class="form-label">护理计划内容</label>
        <textarea 
          v-model="form.plan_content" 
          class="form-textarea" 
          placeholder="请填写护理计划内容，包括护理项目、频次、注意事项等"
          rows="6"
        ></textarea>
      </div>

      <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-default" @click="goBack">取消</button>
        <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">
          {{ submitting ? '创建中...' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'default'
})

const authStore = useAuthStore()

const error = ref('')
const submitting = ref(false)

const form = reactive({
  elder_name: '',
  elder_gender: '男',
  elder_age: 70,
  room_no: '',
  bed_no: '',
  admission_date: '',
  plan_content: '',
  plan_level: ''
})

function goBack() {
  navigateTo('/plans')
}

async function handleSubmit() {
  error.value = ''
  
  if (!form.elder_name.trim()) {
    error.value = '请输入老人姓名'
    return
  }
  if (form.elder_age <= 0) {
    error.value = '请输入有效的年龄'
    return
  }
  
  submitting.value = true
  
  try {
    const result = await $fetch('http://localhost:8001/api/plans/create', {
      method: 'POST',
      body: {
        elder_name: form.elder_name,
        elder_gender: form.elder_gender,
        elder_age: form.elder_age,
        room_no: form.room_no,
        bed_no: form.bed_no,
        admission_date: form.admission_date || null,
        plan_content: form.plan_content || null,
        plan_level: form.plan_level || null
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any
    
    if (result.success) {
      navigateTo(`/plans/${result.data.id}`)
    } else {
      error.value = result.message || '创建失败'
    }
  } catch (e: any) {
    error.value = e.data?.message || e.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    navigateTo('/login')
    return
  }
  if (authStore.role !== 'registrar') {
    navigateTo('/plans')
  }
})
</script>
