<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">
        <button class="btn btn-sm" @click="navigateTo('/clues')">← 返回列表</button>
        &nbsp; ➕ 新建新闻线索单
      </h2>
    </div>

    <div class="card">
      <div class="form-grid-3">
        <div class="form-row">
          <label>线索标题<span class="req">*</span></label>
          <input v-model="form.title" class="form-input" placeholder="请输入简明扼要的线索标题" />
        </div>
        <div class="form-row">
          <label>信息来源</label>
          <select v-model="form.source" class="form-select">
            <option>市民热线12345</option>
            <option>群众来访</option>
            <option>新媒体爆料</option>
            <option>记者暗访</option>
            <option>上级交办</option>
            <option>其他</option>
          </select>
        </div>
        <div class="form-row">
          <label>优先级</label>
          <select v-model="form.priority" class="form-select">
            <option value="high">🔴 高</option>
            <option value="normal">🟡 中</option>
            <option value="low">🟢 低</option>
          </select>
        </div>
        <div class="form-row">
          <label>联系人</label>
          <input v-model="form.contactPerson" class="form-input" placeholder="可选" />
        </div>
        <div class="form-row">
          <label>联系电话</label>
          <input v-model="form.contactPhone" class="form-input" placeholder="可选" />
        </div>
        <div class="form-row">
          <label>发生地点</label>
          <input v-model="form.location" class="form-input" placeholder="请输入详细地址" />
        </div>
      </div>

      <div class="form-row">
        <label>线索内容<span class="req">*</span></label>
        <textarea v-model="form.content" class="form-textarea" style="min-height:140px;"
          placeholder="请详细描述线索内容：时间、地点、人物、事件经过、相关方等关键信息，越详细越有利于核实办理"></textarea>
      </div>

      <div class="form-row">
        <label>标签（逗号分隔）</label>
        <input v-model="form.tags" class="form-input" placeholder="如：民生,投诉,安全隐患" />
      </div>

      <div class="form-row">
        <label>证据材料（提交时至少 1 份）</label>
        <div v-for="(_, i) in form.evidences" :key="i" class="flex gap-2 mb-0" style="margin-bottom:6px;">
          <select v-model="form.evidences[i].type" class="form-select" style="width:110px;">
            <option value="image">📷 图片</option>
            <option value="video">🎥 视频</option>
            <option value="audio">🔊 录音</option>
            <option value="document">📄 文档</option>
          </select>
          <input v-model="form.evidences[i].name" class="form-input" placeholder="材料名称（如：现场照片-1）" />
          <input v-model="form.evidences[i].desc" class="form-input" placeholder="说明描述" />
          <button class="btn btn-sm" @click="form.evidences.splice(i,1)">删除</button>
        </div>
        <button class="btn btn-sm" @click="form.evidences.push({type:'image',name:'',desc:''})">➕ 追加证据</button>
      </div>

      <div style="margin-top:20px; display:flex;gap:10px;">
        <button class="btn btn-primary" :disabled="loading" @click="onSubmit(true)">📤 提交登记（直接进入待分派）</button>
        <button class="btn" :disabled="loading" @click="onSubmit(false)">💾 保存草稿</button>
        <button class="btn ml-auto" @click="navigateTo('/clues')">取消</button>
      </div>
    </div>

    <div v-if="toast" style="position:fixed;top:20px;right:20px;padding:12px 20px;background:var(--gray-900);color:#fff;border-radius:8px;z-index:9999;">
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { post } = useApi()
definePageMeta({ middleware: ['auth'] })

const form = reactive<any>({
  title: '', content: '', source: '市民热线12345',
  contactPerson: '', contactPhone: '', priority: 'normal',
  location: '', tags: '', evidences: [{ type: 'image', name: '', desc: '' }]
})
const loading = ref(false)
const toast = ref('')
const showToast = (m: string) => { toast.value = m; setTimeout(() => toast.value = '', 2200) }

const onSubmit = async (submitNow: boolean) => {
  if (!form.title.trim() || !form.content.trim()) {
    showToast('❌ 标题和内容必填')
    return
  }
  const evidences = form.evidences.filter((e: any) => e.name)
  if (submitNow && evidences.length === 0) {
    showToast('❌ 提交时至少上传 1 份证据')
    return
  }
  loading.value = true
  try {
    const res: any = await post('/api/clues', { ...form, evidences, submitNow })
    showToast('✅ ' + (submitNow ? '提交成功' : '草稿保存成功'))
    setTimeout(() => navigateTo(`/clues/${res.id}`), 600)
  } catch (e: any) {
    showToast('❌ ' + (e.message || '操作失败'))
  } finally {
    loading.value = false
  }
}

if (!authStore.isRegistrar) {
  onMounted(() => {
    showToast('⚠️ 仅线索登记员可创建')
    navigateTo('/')
  })
}
</script>
