<template>
  <div class="application-form-page">
    <div class="page-header">
      <div class="header-left">
        <button class="btn-back" @click="goBack">
          <span>←</span> 返回
        </button>
        <h2 class="page-title">{{ isEdit ? '编辑展期申请' : '新建展期申请' }}</h2>
      </div>
    </div>

    <div class="form-container">
      <div class="card form-card">
        <div class="form-section">
          <h3 class="section-title">基本信息</h3>
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">借款人姓名 <span class="required">*</span></label>
              <input v-model="form.borrower_name" type="text" class="form-input" placeholder="请输入借款人姓名" />
            </div>
            <div class="form-item">
              <label class="form-label">身份证号 <span class="required">*</span></label>
              <input v-model="form.borrower_id_card" type="text" class="form-input" placeholder="请输入身份证号" />
            </div>
            <div class="form-item">
              <label class="form-label">联系电话 <span class="required">*</span></label>
              <input v-model="form.borrower_phone" type="tel" class="form-input" placeholder="请输入联系电话" />
            </div>
            <div class="form-item">
              <label class="form-label">借款合同号 <span class="required">*</span></label>
              <input v-model="form.loan_contract_no" type="text" class="form-input" placeholder="请输入借款合同号" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">原贷款信息</h3>
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">贷款本金（元） <span class="required">*</span></label>
              <input v-model.number="form.original_principal" type="number" class="form-input" placeholder="请输入贷款本金" />
            </div>
            <div class="form-item">
              <label class="form-label">年利率（%） <span class="required">*</span></label>
              <input v-model.number="form.original_interest_rate" type="number" step="0.01" class="form-input" placeholder="请输入年利率" />
            </div>
            <div class="form-item">
              <label class="form-label">原到期日 <span class="required">*</span></label>
              <input v-model="form.original_due_date" type="date" class="form-input" />
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">展期申请</h3>
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">展期天数（天） <span class="required">*</span></label>
              <input v-model.number="form.extension_days" type="number" class="form-input" placeholder="请输入展期天数" @blur="calculateNewDueDate" />
            </div>
            <div class="form-item">
              <label class="form-label">新到期日</label>
              <input v-model="new_due_date" type="text" class="form-input" readonly />
            </div>
            <div class="form-item form-item-checkbox">
              <label class="form-label">是否加急</label>
              <label class="checkbox-label">
                <input v-model="form.is_urgent" type="checkbox" />
                <span class="custom-checkbox"></span>
                加急处理
              </label>
            </div>
          </div>
          <div class="form-item form-item-full">
            <label class="form-label">展期原因 <span class="required">*</span></label>
            <textarea v-model="form.extension_reason" class="form-textarea" rows="4" placeholder="请详细说明展期原因"></textarea>
          </div>
        </div>

        <div class="form-section" v-if="repaymentPlan">
          <h3 class="section-title">还款测算</h3>
          <div class="calculation-box">
            <div class="calc-row">
              <span class="calc-label">展期利息：</span>
              <span class="calc-value">¥ {{ formatMoney(repaymentPlan.interest) }}</span>
            </div>
            <div class="calc-row">
              <span class="calc-label">到期应还总额：</span>
              <span class="calc-value calc-total">¥ {{ formatMoney(repaymentPlan.total_amount) }}</span>
            </div>
            <div class="calc-row">
              <span class="calc-label">展期到期日：</span>
              <span class="calc-value">{{ new_due_date }}</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" @click="goBack">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="submitting">
            {{ submitting ? '保存中...' : '保存' }}
          </button>
          <button v-if="canSubmit" class="btn btn-success" @click="handleSubmit" :disabled="submitting">
            {{ submitting ? '提交中...' : '保存并提交审核' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { get, post, put } = useApi()
const route = useRoute()
const router = useRouter()

interface FormData {
  borrower_name: string
  borrower_id_card: string
  borrower_phone: string
  loan_contract_no: string
  original_principal: number | null
  original_interest_rate: number | null
  original_due_date: string
  extension_days: number | null
  extension_reason: string
  is_urgent: boolean
}

const isEdit = computed(() => !!route.params.id)
const submitting = ref(false)
const applicationId = computed(() => Number(route.params.id) || 0)

const form = ref<FormData>({
  borrower_name: '',
  borrower_id_card: '',
  borrower_phone: '',
  loan_contract_no: '',
  original_principal: null,
  original_interest_rate: null,
  original_due_date: '',
  extension_days: null,
  extension_reason: '',
  is_urgent: false,
})

const new_due_date = ref('')
const repaymentPlan = ref<any>(null)
const canSubmit = computed(() => {
  if (isEdit.value) {
    return false
  }
  return true
})

const formatMoney = (value: number | string): string => {
  const num = Number(value) || 0
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const calculateNewDueDate = () => {
  if (!form.value.original_due_date || !form.value.extension_days) {
    new_due_date.value = ''
    repaymentPlan.value = null
    return
  }

  const dueDate = new Date(form.value.original_due_date)
  dueDate.setDate(dueDate.getDate() + form.value.extension_days)
  const year = dueDate.getFullYear()
  const month = String(dueDate.getMonth() + 1).padStart(2, '0')
  const day = String(dueDate.getDate()).padStart(2, '0')
  new_due_date.value = `${year}-${month}-${day}`

  if (form.value.original_principal && form.value.original_interest_rate) {
    const principal = Number(form.value.original_principal)
    const annualRate = Number(form.value.original_interest_rate)
    const dailyRate = annualRate / 360 / 100
    const interest = principal * dailyRate * form.value.extension_days
    repaymentPlan.value = {
      principal,
      interest: Number(interest.toFixed(2)),
      total_amount: Number((principal + interest).toFixed(2)),
    }
  }
}

const loadApplication = async () => {
  if (!isEdit.value) return

  try {
    const data = await get<any>(`/applications/${applicationId.value}`)
    form.value = {
      borrower_name: data.borrower_name,
      borrower_id_card: data.borrower_id_card,
      borrower_phone: data.borrower_phone,
      loan_contract_no: data.loan_contract_no,
      original_principal: Number(data.original_principal),
      original_interest_rate: Number(data.original_interest_rate),
      original_due_date: data.original_due_date,
      extension_days: data.extension_days,
      extension_reason: data.extension_reason,
      is_urgent: data.is_urgent,
    }
    calculateNewDueDate()
  } catch (error) {
    console.error('Failed to load application:', error)
  }
}

const validateForm = (): boolean => {
  if (!form.value.borrower_name.trim()) {
    alert('请输入借款人姓名')
    return false
  }
  if (!form.value.borrower_id_card.trim()) {
    alert('请输入身份证号')
    return false
  }
  if (!form.value.borrower_phone.trim()) {
    alert('请输入联系电话')
    return false
  }
  if (!form.value.loan_contract_no.trim()) {
    alert('请输入借款合同号')
    return false
  }
  if (!form.value.original_principal || form.value.original_principal <= 0) {
    alert('请输入有效的贷款本金')
    return false
  }
  if (!form.value.original_interest_rate || form.value.original_interest_rate <= 0) {
    alert('请输入有效的年利率')
    return false
  }
  if (!form.value.original_due_date) {
    alert('请选择原到期日')
    return false
  }
  if (!form.value.extension_days || form.value.extension_days <= 0) {
    alert('请输入有效的展期天数')
    return false
  }
  if (!form.value.extension_reason.trim()) {
    alert('请输入展期原因')
    return false
  }
  return true
}

const handleSave = async () => {
  if (!validateForm()) return

  submitting.value = true
  try {
    if (isEdit.value) {
      await put(`/applications/${applicationId.value}/correct`, {
        extension_days: form.value.extension_days,
        extension_reason: form.value.extension_reason,
        borrower_phone: form.value.borrower_phone,
        is_urgent: form.value.is_urgent,
      })
      alert('保存成功')
    } else {
      const data = await post<any>('/applications', form.value)
      alert('保存成功')
      router.push(`/applications/${data.id}`)
    }
  } catch (error: any) {
    alert(error.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

const handleSubmit = async () => {
  if (!validateForm()) return

  submitting.value = true
  try {
    const data = await post<any>('/applications', form.value)
    await put(`/applications/${data.id}/submit`)
    alert('提交成功')
    router.push(`/applications/${data.id}`)
  } catch (error: any) {
    alert(error.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/applications')
  }
}

onMounted(() => {
  if (isEdit.value) {
    loadApplication()
  }
})
</script>

<style scoped>
.application-form-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.btn-back:hover {
  color: #2563eb;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.form-container {
  max-width: 900px;
}

.form-card {
  padding: 24px;
}

.form-section {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f3f4f6;
}

.form-section:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item-full {
  grid-column: 1 / -1;
}

.form-item-checkbox {
  justify-content: flex-end;
  flex-direction: row;
  align-items: center;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #1f2937;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:read-only {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .custom-checkbox {
  background: #3b82f6;
  border-color: #3b82f6;
}

.checkbox-label input[type="checkbox"]:checked + .custom-checkbox::after {
  content: '✓';
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.calculation-box {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 10px;
  padding: 20px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.calc-row:last-child {
  margin-bottom: 0;
}

.calc-label {
  font-size: 14px;
  color: #0369a1;
}

.calc-value {
  font-size: 14px;
  color: #0c4a6e;
  font-weight: 500;
}

.calc-total {
  font-size: 18px;
  color: #0891b2;
  font-weight: 700;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover {
  background: #059669;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
