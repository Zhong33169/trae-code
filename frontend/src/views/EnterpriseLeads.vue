<template>
  <div>
    <div class="container">
      <div class="toolbar">
        <input class="input" placeholder="搜索线索编号/企业名称/联系人" v-model="keyword" style="width:280px" @input="loadLeads" />
        <div style="flex:1"></div>
        <button v-if="canAdd" class="btn btn-primary" @click="showAddModal = true">＋ 录入企业线索</button>
      </div>

      <div v-if="alert" class="alert" :class="'alert-' + alert.type" style="margin:12px 16px 0;">
        {{ alert.message }}
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>线索编号</th>
              <th>企业名称</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>行业</th>
              <th>规模</th>
              <th>意向</th>
              <th>来源</th>
              <th>状态</th>
              <th>录入人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in leads" :key="l.clue_no">
              <td>{{ l.clue_no }}</td>
              <td><b>{{ l.enterprise_name }}</b></td>
              <td>{{ l.contact_person }}</td>
              <td>{{ l.contact_phone }}</td>
              <td>{{ l.industry || '-' }}</td>
              <td>{{ l.scale || '-' }}</td>
              <td>
                <span class="tag" :class="l.intention === '高' ? 'tag-reviewed' : l.intention === '中' ? 'tag-handled' : 'tag-rejected'">
                  {{ l.intention || '-' }}
                </span>
              </td>
              <td>{{ l.source || '-' }}</td>
              <td>
                <span class="tag" :class="l.active_order_count > 0 ? 'tag-initiated' : 'tag-archived'">
                  {{ l.active_order_count > 0 ? '进行中' : '可用' }}
                </span>
              </td>
              <td>{{ l.initiator_name }}</td>
              <td>
                <button v-if="l.active_order_count === 0 && canInitiate" class="btn" style="padding:4px 10px;font-size:12px" @click="goCreateOrder(l)">
                  发起线索单
                </button>
              </td>
            </tr>
            <tr v-if="leads.length === 0">
              <td colspan="11" class="empty">暂无企业线索</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-mask" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>录入企业线索</h3>
          <button class="btn" @click="showAddModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="addAlert" class="alert" :class="'alert-' + addAlert.type">{{ addAlert.message }}</div>
          <div class="form-row">
            <label class="required">企业名称</label>
            <input class="input" v-model="form.enterprise_name" />
          </div>
          <div class="form-row">
            <label class="required">联系人</label>
            <input class="input" v-model="form.contact_person" />
          </div>
          <div class="form-row">
            <label class="required">联系电话</label>
            <input class="input" v-model="form.contact_phone" />
          </div>
          <div class="form-row">
            <label>所属行业</label>
            <select class="select" v-model="form.industry">
              <option value="">请选择</option>
              <option>人工智能</option>
              <option>新能源</option>
              <option>生物医药</option>
              <option>软件服务</option>
              <option>高端制造</option>
              <option>新材料</option>
              <option>其他</option>
            </select>
          </div>
          <div class="form-row">
            <label>企业规模</label>
            <select class="select" v-model="form.scale">
              <option value="">请选择</option>
              <option>50人以下</option>
              <option>50-100人</option>
              <option>100-500人</option>
              <option>500人以上</option>
            </select>
          </div>
          <div class="form-row">
            <label>注册资本（万元）</label>
            <input type="number" class="input" v-model.number="form.registered_capital" />
          </div>
          <div class="form-row">
            <label>合作意向</label>
            <select class="select" v-model="form.intention">
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div class="form-row">
            <label>线索来源</label>
            <input class="input" v-model="form.source" placeholder="例如：推荐、展会、政府推荐" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" @click="submitAdd">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import api from '../utils/api.js';

const router = useRouter();
const userStore = useUserStore();

const leads = ref([]);
const keyword = ref('');
const alert = ref(null);
const showAddModal = ref(false);
const addAlert = ref(null);
const form = ref({
  enterprise_name: '', contact_person: '', contact_phone: '',
  industry: '', scale: '', registered_capital: 0, intention: '中', source: ''
});

const canAdd = computed(() => ['INITIATOR', 'HANDLER'].includes(userStore.currentUser?.role));
const canInitiate = computed(() => userStore.currentUser?.role === 'INITIATOR');

onMounted(() => loadLeads());

async function loadLeads() {
  const params = keyword.value ? '?keyword=' + encodeURIComponent(keyword.value) : '';
  const res = await api.get('/enterprise-leads' + params);
  if (res.success) leads.value = res.data;
}

function goCreateOrder(lead) {
  sessionStorage.setItem('preselect_clue', JSON.stringify(lead));
  router.push('/queue');
}

function showAlertMsg(type, message) {
  alert.value = { type, message };
  setTimeout(() => alert.value = null, 4000);
}

async function submitAdd() {
  addAlert.value = null;
  if (!form.value.enterprise_name || !form.value.contact_person || !form.value.contact_phone) {
    addAlert.value = { type: 'error', message: '请填写企业名称、联系人、联系电话' };
    return;
  }
  const res = await api.post('/enterprise-leads', form.value);
  if (res.success) {
    showAlertMsg('success', res.message);
    showAddModal.value = false;
    form.value = { enterprise_name: '', contact_person: '', contact_phone: '', industry: '', scale: '', registered_capital: 0, intention: '中', source: '' };
    await loadLeads();
  } else {
    addAlert.value = { type: 'error', message: res.message };
  }
}
</script>
