<template>
  <div class="scan-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">扫码核验</h2>
        <p class="page-subtitle">扫描二维码核验展期申请真伪</p>
      </div>
    </div>

    <div class="scan-container">
      <div class="card scan-card">
        <div class="scan-area">
          <div class="qr-placeholder">
            <div class="qr-icon">📷</div>
            <p class="qr-tip">请将二维码放入框内</p>
            <p class="qr-subtip">支持扫描展期申请单上的二维码</p>
          </div>
          <div class="scan-frame">
            <div class="corner corner-tl"></div>
            <div class="corner corner-tr"></div>
            <div class="corner corner-bl"></div>
            <div class="corner corner-br"></div>
            <div class="scan-line"></div>
          </div>
        </div>

        <div class="divider">
          <span>或</span>
        </div>

        <div class="manual-input">
          <label class="input-label">手动输入核验码</label>
          <div class="input-row">
            <input 
              v-model="qrCode" 
              type="text" 
              class="verify-input" 
              placeholder="请输入二维码内容"
            />
            <button class="btn btn-primary verify-btn" @click="handleVerify" :disabled="verifying">
              {{ verifying ? '核验中...' : '核验' }}
            </button>
          </div>
        </div>

        <div class="quick-test">
          <div class="quick-test-label">快速测试：</div>
          <div class="quick-test-btns">
            <button class="quick-test-btn" @click="quickTest('QRDEMO0000000002')">待审核</button>
            <button class="quick-test-btn" @click="quickTest('QRDEMO0000000003')">审核通过待复核</button>
            <button class="quick-test-btn" @click="quickTest('QRDEMO0000000004')">退回补正</button>
            <button class="quick-test-btn btn-danger" @click="quickTest('QRINVALID')">无效码</button>
          </div>
        </div>
      </div>

      <div class="card result-card" v-if="scanResult">
        <div :class="['result-header', `result-${resultType}`]">
          <div class="result-icon">
            {{ resultIcon }}
          </div>
          <div class="result-title">
            {{ scanResult.scan_result_display }}
          </div>
        </div>

        <div class="result-content" v-if="scanResult.success && scanResult.application">
          <div class="result-section">
            <h4 class="section-title">申请信息</h4>
            <div class="result-grid">
              <div class="result-item">
                <span class="result-label">申请编号</span>
                <span class="result-value link-text" @click="goToApplication(scanResult.application?.id)">{{ scanResult.application.application_no }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">借款人</span>
                <span class="result-value">{{ scanResult.application.borrower_name }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">身份证</span>
                <span class="result-value">{{ scanResult.application.borrower_id_card }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">借款合同号</span>
                <span class="result-value">{{ scanResult.application.loan_contract_no }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">展期天数</span>
                <span class="result-value">{{ scanResult.application.extension_days }} 天</span>
              </div>
              <div class="result-item">
                <span class="result-label">申请状态</span>
                <span :class="['status-tag', `status-${scanResult.application.status}`]">
                  {{ statusMap[scanResult.application.status] }}
                </span>
              </div>
            </div>
          </div>

          <div class="result-tip" v-if="scanResult.scan_result === 'duplicate'">
            <p>该二维码已于 {{ formatDate(scanResult.last_scan_time) }} 由 {{ scanResult.last_scan_user }} 扫描过</p>
          </div>

          <div class="result-tip result-tip-info" v-if="scanResult.scan_result === 'not_current_handler'">
            <p>当前处理角色：{{ scanResult.current_handler_role }}</p>
          </div>
        </div>

        <div class="result-error" v-if="!scanResult.success">
          <p>{{ scanResult.error_message || '核验失败' }}</p>
        </div>
      </div>

      <div class="card history-card">
        <div class="card-header">
          <h3 class="card-title">最近扫码历史</h3>
        </div>
        <div class="history-list">
          <div v-for="(item, index) in scanHistory" :key="index" class="history-item">
            <div class="history-icon">{{ item.qr_code }}</div>
            <div class="history-info">
              <div class="history-result">
                <span :class="['status-tag', `status-${item.scan_result}`]">
                  {{ resultTypeMap[item.scan_result] || item.scan_result }}
                </span>
              </div>
              <div class="history-time">{{ formatDate(item.created_at) }}</div>
            </div>
          </div>
        </div>
        <div v-if="scanHistory.length === 0 && !historyLoading" class="empty-history">
          暂无扫码记录
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { get, post } = useApi()

interface ScanApplication {
  id: number
  application_no: string
  borrower_name: string
  borrower_id_card: string
  loan_contract_no: string
  extension_days: number
  status: string
}

interface ScanResult {
  success: boolean
  scan_result: string
  scan_result_display: string
  error_message: string
  application: ScanApplication | null
  last_scan_time: string
  last_scan_user: string
  current_handler_role: string
}

interface ScanHistoryItem {
  id: number
  qr_code: string
  scan_result: string
  created_at: string
}

const qrCode = ref('')
const verifying = ref(false)
const scanResult = ref<ScanResult | null>(null)
const historyLoading = ref(false)
const scanHistory = ref<ScanHistoryItem[]>([])

const statusMap: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_approved: '审核通过待复核',
  returned_for_correction: '退回补正',
  final_approved: '复核通过待归档',
  rejected: '已拒绝',
  archived: '已归档'
}

const resultTypeMap: Record<string, string> = {
  success: '核验成功',
  invalid: '无效码',
  duplicate: '重复扫码',
  not_current_handler: '非当前处理人',
  wrong_status: '状态不匹配'
}

const resultType = computed(() => {
  if (!scanResult.value) return 'info'
  if (!scanResult.value.success) return 'error'
  switch (scanResult.value.scan_result) {
    case 'success': return 'success'
    case 'duplicate': return 'warning'
    case 'not_current_handler': return 'info'
    default: return 'info'
  }
})

const resultIcon = computed(() => {
  if (!scanResult.value) return ''
  if (!scanResult.value.success) return '❌'
  switch (scanResult.value.scan_result) {
    case 'success': return '✅'
    case 'duplicate': return '⚠️'
    case 'not_current_handler': return 'ℹ️'
    default: return 'ℹ️'
  }
})

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const handleVerify = async () => {
  if (!qrCode.value.trim()) {
    alert('请输入二维码内容')
    return
  }

  verifying.value = true
  try {
    const data = await post<ScanResult>('/scan', {
      qr_code: qrCode.value.trim(),
      location: 'web'
    })
    scanResult.value = data
    loadHistory()
  } catch (error: any) {
    scanResult.value = {
      success: false,
      scan_result: 'error',
      scan_result_display: '核验失败',
      error_message: error.message || '网络错误，请稍后重试',
      application: null,
      last_scan_time: '',
      last_scan_user: '',
      current_handler_role: ''
    }
  } finally {
    verifying.value = false
  }
}

const quickTest = (code: string) => {
  qrCode.value = code
  handleVerify()
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const data = await get<{ items: ScanHistoryItem[] }>('/scan/history', { page_size: 10 })
    scanHistory.value = data.items || []
  } catch (error) {
    console.error('Failed to load scan history:', error)
  } finally {
    historyLoading.value = false
  }
}

const goToApplication = (id: number | undefined) => {
  if (id) {
    navigateTo(`/applications/${id}`)
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.scan-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.scan-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.scan-card {
  padding: 30px;
}

.scan-area {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  background: #f9fafb;
  border-radius: 12px;
  overflow: hidden;
}

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 1;
}

.qr-icon {
  font-size: 64px;
  opacity: 0.5;
}

.qr-tip {
  font-size: 16px;
  color: #374151;
  font-weight: 500;
  margin: 0;
}

.qr-subtip {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.scan-frame {
  position: absolute;
  width: 200px;
  height: 200px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 3px solid #3b82f6;
}

.corner-tl {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
  border-radius: 8px 0 0 0;
}

.corner-tr {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
  border-radius: 0 8px 0 0;
}

.corner-bl {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
  border-radius: 0 0 0 8px;
}

.corner-br {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
  border-radius: 0 0 8px 0;
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  animation: scan 2s linear infinite;
}

@keyframes scan {
  0% { top: 0; }
  100% { top: 100%; }
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: #9ca3af;
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.divider span {
  padding: 0 16px;
}

.manual-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.input-row {
  display: flex;
  gap: 10px;
}

.verify-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.verify-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.verify-btn {
  padding: 10px 24px;
  white-space: nowrap;
}

.quick-test {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.quick-test-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 10px;
}

.quick-test-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-test-btn {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-test-btn:hover {
  background: #e5e7eb;
}

.quick-test-btn.btn-danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.quick-test-btn.btn-danger:hover {
  background: #fee2e2;
}

.result-card {
  padding: 24px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 20px;
}

.result-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.result-success .result-icon {
  background: #d1fae5;
}

.result-error .result-icon {
  background: #fee2e2;
}

.result-warning .result-icon {
  background: #fef3c7;
}

.result-info .result-icon {
  background: #dbeafe;
}

.result-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.result-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-label {
  font-size: 12px;
  color: #6b7280;
}

.result-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.result-tip {
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 13px;
}

.result-tip-warning {
  background: #fef3c7;
  color: #92400e;
}

.result-tip-info {
  background: #dbeafe;
  color: #1e40af;
}

.result-error {
  text-align: center;
  padding: 20px;
  color: #ef4444;
}

.history-card {
  grid-column: 1 / -1;
}

.card-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.history-icon {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  font-family: monospace;
}

.history-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.history-time {
  font-size: 12px;
  color: #9ca3af;
}

.empty-history {
  text-align: center;
  color: #9ca3af;
  padding: 30px 0;
}

.link-text {
  color: #3b82f6;
  cursor: pointer;
  text-decoration: none;
}

.link-text:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .scan-container {
    grid-template-columns: 1fr;
  }
}
</style>
