<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content p-6">
      <h3 class="text-lg font-bold mb-4">{{ mode === 'create' ? '新建订单' : '编辑订单' }}</h3>

      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="label">社区名称 *</label>
            <input v-model="form.communityName" class="input" placeholder="请输入社区名称" />
          </div>
          <div class="form-group">
            <label class="label">联系人</label>
            <input v-model="form.contactName" class="input" placeholder="请输入联系人" />
          </div>
          <div class="form-group">
            <label class="label">联系电话</label>
            <input v-model="form.contactPhone" class="input" placeholder="请输入联系电话" />
          </div>
          <div class="form-group">
            <label class="label">预计配送日期</label>
            <input v-model="form.expectedDeliveryDate" type="date" class="input" />
          </div>
        </div>

        <div class="form-group">
          <label class="label">配送地址</label>
          <input v-model="form.deliveryAddress" class="input" placeholder="请输入配送地址" />
        </div>

        <div class="form-group">
          <label class="label">备注</label>
          <textarea v-model="form.remark" class="input" rows="2" placeholder="请输入备注"></textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="label mb-0">商品明细</label>
            <button class="btn btn-primary text-sm" type="button" @click="addItem">
              + 添加商品
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>商品名称</th>
                <th>单价</th>
                <th>数量</th>
                <th>单位</th>
                <th>小计</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in form.items" :key="index">
                <td>
                  <input v-model="item.productName" class="input text-sm" placeholder="商品名称" />
                </td>
                <td style="width: 100px">
                  <input v-model.number="item.unitPrice" type="number" step="0.01" class="input text-sm" />
                </td>
                <td style="width: 80px">
                  <input v-model.number="item.quantity" type="number" class="input text-sm" />
                </td>
                <td style="width: 70px">
                  <input v-model="item.unit" class="input text-sm" placeholder="件" />
                </td>
                <td class="font-medium">¥{{ (item.unitPrice * item.quantity).toFixed(2) }}</td>
                <td>
                  <button class="text-red-500 text-sm" @click="removeItem(index)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="text-right mt-2">
            总金额：<span class="text-lg font-bold text-red-600">¥{{ totalAmount.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!canSubmit" @click="handleSubmit">
          {{ mode === 'create' ? '创建订单' : '保存修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue';
import type { Order } from '~/types';

const props = defineProps<{
  order?: Order | null;
  mode?: 'create' | 'edit';
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const mode = computed(() => props.mode || 'create');

const form = reactive({
  communityName: '',
  contactName: '',
  contactPhone: '',
  deliveryAddress: '',
  remark: '',
  expectedDeliveryDate: '',
  items: [] as { productId: string; productName: string; unitPrice: number; quantity: number; unit: string }[],
});

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
});

const canSubmit = computed(() => {
  return form.communityName && form.items.length > 0 && form.items.every(i => i.productName && i.unitPrice > 0 && i.quantity > 0);
});

const api = useApi();

const addItem = () => {
  form.items.push({
    productId: 'temp_' + Date.now(),
    productName: '',
    unitPrice: 0,
    quantity: 1,
    unit: '件',
  });
};

const removeItem = (index: number) => {
  form.items.splice(index, 1);
};

const loadOrderData = () => {
  if (props.order) {
    form.communityName = props.order.communityName;
    form.contactName = props.order.contactName || '';
    form.contactPhone = props.order.contactPhone || '';
    form.deliveryAddress = props.order.deliveryAddress || '';
    form.remark = props.order.remark || '';
    form.expectedDeliveryDate = props.order.expectedDeliveryDate
      ? props.order.expectedDeliveryDate.split('T')[0]
      : '';
    form.items = (props.order.items || []).map(item => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      unit: item.unit || '件',
    }));
  }
};

const handleSubmit = async () => {
  try {
    if (mode.value === 'create') {
      await api.post('/orders', form);
    } else {
      await api.put(`/orders/${props.order?.id}`, form);
    }
    emit('success');
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

onMounted(() => {
  if (mode.value === 'create') {
    addItem();
  } else {
    loadOrderData();
  }
});

watch(
  () => props.order,
  () => {
    if (mode.value === 'edit') {
      loadOrderData();
    }
  }
);
</script>
