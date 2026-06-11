<template>
  <div>
    <h2 style="margin-bottom: 20px;">📱 扫码核验</h2>
    
    <div class="card">
      <div class="form-item">
        <label class="form-label">输入工单二维码</label>
        <div style="display: flex; gap: 8px;">
          <input 
            type="text" 
            v-model="qrCodeInput" 
            class="form-input" 
            placeholder="请输入或扫描二维码..."
            style="flex: 1; font-size: 16px; font-family: monospace;"
            @keyup.enter="handleScan"
          />
          <button class="btn btn-primary" @click="handleScan" :disabled="scanning">
            {{ scanning ? '核验中...' : '扫码核验' }}
          </button>
        </div>
      </div>
      
      <div style="margin-top: 16px;">
        <p style="color: #999; font-size: 13px; margin-bottom: 8px;">💡 快速测试：点击下方二维码快速填充</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <button 
            v-for="code in quickCodes" 
            :key="code.value"
            class="btn" 
            style="font-size: 12px; padding: 6px 12px; font-family: monospace;"
            :style="code.type === 'success' ? 'background: #f6ffed; border-color: #b7eb8f;': ''"
            @click="qrCodeInput = code.value"
          >
            {{ code.label }}
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="scanResult" class="card" :class="scanResult.success ? 'card-success' : 'card-error'">
      <div v-if="scanResult.success">
        <h3 style="color: #52c41a; margin-bottom: 16px;">✅ 扫码成功</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">工单码</span>
            <span class="info-value"><code>{{ scanResult.data.qrCode }}</code></span>
          </div>
          <div class="info-item">
            <span class="info-label">产品名称</span>
            <span class="info-value">{{ scanResult.data.productName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">批次</span>
            <span class="info-value">{{ scanResult.data.productBatch }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">状态</span>
            <span class="info-value">
              <span :class="'status-tag status-' + scanResult.data.status">
                {{ scanResult.data.statusName }}
              </span>
            </span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <NuxtLink :to="'/workorders/' + scanResult.data.id" class="btn btn-primary">
            查看详情 →
          </NuxtLink>
        </div>
      </div>
      
      <div v-else>
        <h3 style="color: #f5222d; margin-bottom: 16px;">❌ 扫码失败</h3>
        <div class="alert alert-error" style="margin-bottom: 16px;">
          <strong>错误码: {{ scanResult.code }}</strong>
          <p style="margin-top: 8px;">{{ scanResult.message }}</p>
          <p v-if="scanResult.detail" style="margin-top: 4px; font-size: 13px; opacity: 0.9;">
            详情: {{ scanResult.detail }}
          </p>
        </div>
        
        <div class="error-explanation">
          <h4 style="margin-bottom: 8px;">📖 错误说明</h4>
          <p>{{ getErrorExplanation(scanResult.code) }}</p>
          
          <div v-if="scanResult.code === 'WRONG_ROLE' || scanResult.code === 'WRONG_STATUS'" style="margin-top: 12px;">
            <h4 style="margin-bottom: 8px;">🔧 处理建议</h4>
            <ul style="margin-left: 20px; color: #666;">
              <li v-if="scanResult.code === 'WRONG_ROLE'">请切换到对应岗位的账号进行操作</li>
              <li v-if="scanResult.code === 'WRONG_STATUS'">请等待工单流转到您的处理环节</li>
              <li>您可以在工单列表中查看所有工单的当前状态</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h3 class="section-title">🕐 最近扫码记录</h3>
      <div v-if="recentScans.length === 0" style="text-align: center; padding: 20px; color: #999;">暂无扫码记录</div>
      <table v-else>
        <thead>
          <tr>
            <th>二维码</th>
            <th>结果</th>
            <th>错误码</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(scan, idx) in recentScans" :key="idx">
            <td><code>{{ scan.qrCode }}</code></td>
            <td>
              <span v-if="scan.success" style="color: #52c41a;">成功</span>
              <span v-else style="color: #f5222d;">失败</span>
            </td>
            <td>
              <code v-if="!scan.success">{{ scan.code }}</code>
              <span v-else>-</span>
            </td>
            <td style="color: #999; font-size: 12px;">{{ formatTime(scan.time) }}</td>
            <td>
              <button 
                v-if="!scan.success"
                class="btn" 
                style="padding: 2px 8px; font-size: 12px;"
                @click="qrCodeInput = scan.qrCode"
              >
                重试
              </button>
              <NuxtLink 
                v-else
                :to="'/workorders/' + scan.id"
                class="btn" 
                style="padding: 2px 8px; font-size: 12px;"
              >
                查看
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()

const qrCodeInput = ref('')
const scanning = ref(false)
const scanResult = ref(null)
const recentScans = ref([])

const quickCodes = [
  { label: 'WO001 (待登记)', value: 'WO0002024001', type: 'success' },
  { label: 'WO004 (待核验)', value: 'WO0002024004', type: 'success' },
  { label: 'WO007 (待复核)', value: 'WO0002024007', type: 'success' },
  { label: 'WO010 (已归档)', value: 'WO0002024010', type: 'success' },
  { label: 'WO013 (已驳回)', value: 'WO0002024013', type: 'success' },
  { label: '无效码 INVALID', value: 'INVALID_CODE', type: 'error' }
]

onMounted(() => {
  if (!auth.checkAuth()) {
    navigateTo('/login')
  }
})

const handleScan = async () => {
  if (!qrCodeInput.value.trim()) {
    alert('请输入二维码')
    return
  }
  
  scanning.value = true
  scanResult.value = null
  
  try {
    const res = await api.post('/workorders/scan', {
      qrCode: qrCodeInput.value.trim()
    })
    
    scanResult.value = {
      success: true,
      data: res.data
    }
    
    recentScans.value.unshift({
      qrCode: qrCodeInput.value.trim(),
      success: true,
      id: res.data.id,
      time: new Date()
    })
  } catch (e) {
    scanResult.value = {
      success: false,
      code: e.code || 'UNKNOWN',
      message: e.message,
      detail: e.detail || ''
    }
    
    recentScans.value.unshift({
      qrCode: qrCodeInput.value.trim(),
      success: false,
      code: e.code || 'UNKNOWN',
      time: new Date()
    })
  } finally {
    scanning.value = false
    if (recentScans.value.length > 10) {
      recentScans.value = recentScans.value.slice(0, 10)
    }
  }
}

const getErrorExplanation = (code) => {
  const explanations = {
    'INVALID_QR': '二维码格式无效或无法识别，请检查二维码是否正确。系统只支持 WO 开头的标准工单二维码。',
    'NOT_FOUND': '该二维码对应的工单不存在，可能是二维码错误或工单已被删除。',
    'DUPLICATE_SCAN': '该工单已经完成扫码登记，无需重复扫码。请在工单列表中查看详情。',
    'WRONG_ROLE': '您当前的岗位无权处理该工单。工单当前环节需要对应岗位的人员处理。',
    'WRONG_STATUS': '工单当前状态不允许此操作。工单需要按流程顺序推进，不能跳过环节。',
    'ALREADY_COMPLETED': '该工单已完成归档，不能再进行扫码操作。已归档工单仅可查看。',
    'CONCURRENT_LOCK': '该工单正在被其他用户处理，请稍后再试。防止并发操作导致数据不一致。',
    'PERMISSION_DENIED': '您没有权限执行此操作。请联系管理员获取相应权限。'
  }
  return explanations[code] || '未知错误，请联系系统管理员。'
}

const formatTime = (date) => {
  const d = new Date(date)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

useHead({ title: '扫码核验 - 生产工单系统' })
</script>

<style scoped>
.card-success {
  border-left: 4px solid #52c41a;
}
.card-error {
  border-left: 4px solid #f5222d;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 12px;
  color: #999;
}
.info-value {
  color: #333;
}
.error-explanation {
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  padding: 16px;
}
.error-explanation h4 {
  color: #d46b08;
}
</style>
