<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { createCareRecord } from '../api/care'

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  pet_name: '', species: '', breed: '', owner_name: '', owner_phone: '',
  admission_date: '', diagnosis: '', treatment_plan: '', priority: 'normal',
  ward: '', bed_number: '', deadline: ''
})

const msg = ref('')
const msgType = ref('info')

async function handleSubmit() {
  if (!form.value.pet_name || !form.value.owner_name || !form.value.admission_date) {
    msg.value = '请填写宠物名、主人和入院日期'
    msgType.value = 'warning'
    return
  }
  try {
    const res = await createCareRecord(form.value)
    msg.value = '护理单创建成功，正在跳转...'
    msgType.value = 'success'
    setTimeout(() => router.push(`/care-records/${res.data.id}`), 1000)
  } catch (e) {
    msg.value = e.response?.data?.error || '创建失败'
    msgType.value = 'danger'
  }
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>
        <button class="btn btn-sm btn-outline" @click="router.push('/care-records')" style="margin-right:8px">← 返回</button>
        新建住院护理单
      </span>
    </div>

    <div v-if="msg" :class="`alert alert-${msgType}`">{{ msg }}</div>

    <div class="card">
      <div class="card-header">
        <h3>填写护理单信息</h3>
        <span style="font-size:12px;color:#999">发起角色: {{ userStore.roleLabel }}</span>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>宠物名 *</label>
          <input v-model="form.pet_name" placeholder="例：豆豆" />
        </div>
        <div class="form-group">
          <label>物种</label>
          <select v-model="form.species">
            <option value="">请选择</option>
            <option value="犬">犬</option>
            <option value="猫">猫</option>
            <option value="兔">兔</option>
            <option value="仓鼠">仓鼠</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>品种</label>
          <input v-model="form.breed" placeholder="例：金毛" />
        </div>
        <div class="form-group">
          <label>主人姓名 *</label>
          <input v-model="form.owner_name" placeholder="例：王小明" />
        </div>
        <div class="form-group">
          <label>主人电话</label>
          <input v-model="form.owner_phone" placeholder="例：13800001111" />
        </div>
        <div class="form-group">
          <label>入院日期 *</label>
          <input v-model="form.admission_date" type="date" />
        </div>
      </div>

      <div class="form-group">
        <label>诊断</label>
        <textarea v-model="form.diagnosis" rows="2" placeholder="入院诊断..."></textarea>
      </div>

      <div class="form-group">
        <label>治疗方案</label>
        <textarea v-model="form.treatment_plan" rows="2" placeholder="治疗方案..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>优先级</label>
          <select v-model="form.priority">
            <option value="normal">普通</option>
            <option value="urgent">紧急</option>
            <option value="critical">危重</option>
          </select>
        </div>
        <div class="form-group">
          <label>病房</label>
          <input v-model="form.ward" placeholder="例：A区" />
        </div>
        <div class="form-group">
          <label>床位号</label>
          <input v-model="form.bed_number" placeholder="例：A-01" />
        </div>
        <div class="form-group">
          <label>处理截止日期</label>
          <input v-model="form.deadline" type="date" />
        </div>
      </div>

      <button class="btn btn-primary btn-lg" @click="handleSubmit">创建护理单</button>
    </div>
  </div>
</template>
