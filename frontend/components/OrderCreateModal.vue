<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content p-6" style="max-width: 900px;">
      <h3 class="text-lg font-bold mb-4">{{ mode === 'create' ? '新建团购订单' : '编辑团购订单' }}</h3>

      <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="label">社区名称 <span class="text-red-500">*</span></label>
            <input v-model="form.communityName" class="input" placeholder="请输入社区名称，如：阳光小区" />
          </div>
          <div class="form-group">
            <label class="label">联系人</label>
            <input v-model="form.contactName" class="input" placeholder="请输入联系人姓名" />
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
          <input v-model="form.deliveryAddress" class="input" placeholder="请输入详细配送地址" />
        </div>

        <div class="form-group">
          <label class="label">备注</label>
          <textarea v-model="form.remark" class="input" rows="2" placeholder="请输入备注信息"></textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="label mb-0">团购商品明细 <span class="text-red-500">*</span></label>
            <button class="btn btn-primary text-sm" type="button" @click="addItem">
              + 添加商品
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead>
                <tr>
                  <th style="width: 28%;">商品选择</th>
                  <th style="width: 12%;">团购价(元)</th>
                  <th style="width: 10%;">库存</th>
                  <th style="width: 12%;">数量</th>
                  <th style="width: 8%;">单位</th>
                  <th style="width: 12%;">小计(元)</th>
                  <th style="width: 8%;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in form.items" :key="index">
                  <td>
                    <select
                      v-model="item.productId"
                      class="input text-sm"
                      @change="onProductSelect(index)"
                    >
                      <option value="">-- 请选择商品 --</option>
                      <option
                        v-for="p in availableProducts"
                        :key="p.id"
                        :value="p.id"
                        :disabled="!canSelectProduct(p, index)"
                      >
                        {{ p.name }} ({{ p.stock > 0 ? '库存:' + p.stock : '已售罄' }})
                      </option>
                    </select>
                  </td>
                  <td>
                    <input
                      v-model.number="item.unitPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      class="input text-sm"
                      @change="updateSubtotal(index)"
                    />
                  </td>
                  <td class="text-sm text-gray-600 text-center">
                    {{ getProductStock(item.productId) }}
                  </td>
                  <td>
                    <input
                      v-model.number="item.quantity"
                      type="number"
                      min="1"
                      class="input text-sm"
                      @change="updateSubtotal(index)"
                    />
                  </td>
                  <td>
                    <input v-model="item.unit" class="input text-sm" placeholder="件" />
                  </td>
                  <td class="font-medium text-center text-red-600">
                    ¥{{ getSubtotal(item).toFixed(2) }}
                  </td>
                  <td>
                    <button
                      v-if="form.items.length > 1"
                      class="text-red-500 text-sm hover:text-red-700"
                      @click="removeItem(index)"
                    >
                      删除
                    </button>
                  </td>
                </tr>
                <tr v-if="form.items.length === 0">
                  <td colspan="7" class="text-center py-4 text-gray-400">
                    暂无商品，请点击上方「添加商品」按钮
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-right mt-3 pr-2">
            <span class="text-gray-500">总数量：</span>
            <span class="font-medium mr-6">{{ totalQuantity }} 件</span>
            <span class="text-gray-500">总金额：</span>
            <span class="text-xl font-bold text-red-600">¥{{ totalAmount.toFixed(2) }}</span>
          </div>
          <div v-if="stockWarnings.length > 0" class="mt-3 space-y-1">
            <p v-for="(w, i) in stockWarnings" :key="i" class="text-sm text-orange-600">
              ⚠️ {{ w }}
            </p>
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
import type { Order, Product } from '~/types';

const props = defineProps<{
  order?: Order | null;
  mode?: 'create' | 'edit';
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const mode = computed(() => props.mode || 'create');
const api = useApi();

const products = ref<Product[]>([]);

const form = reactive({
  communityName: '',
  contactName: '',
  contactPhone: '',
  deliveryAddress: '',
  remark: '',
  expectedDeliveryDate: '',
  items: [] as {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    unit: string;
  }[],
});

const availableProducts = computed(() => {
  return products.value.filter(p => p.status === 'on_shelf');
});

const totalAmount = computed(() => {
  return form.items.reduce((sum, item) => sum + getSubtotal(item), 0);
});

const totalQuantity = computed(() => {
  return form.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

const stockWarnings = computed(() => {
  const warnings: string[] = [];
  form.items.forEach(item => {
    if (!item.productId || !item.quantity) return;
    const product = products.value.find(p => p.id === item.productId);
    if (product && item.quantity > product.stock) {
      warnings.push(`商品「${product.name}」库存不足，当前库存 ${product.stock}，已选 ${item.quantity}`);
    }
  });
  return warnings;
});

const canSubmit = computed(() => {
  const basicValid = form.communityName && form.items.length > 0;
  const itemsValid = form.items.every(i =>
    i.productId && i.productName && i.unitPrice > 0 && i.quantity > 0
  );
  return basicValid && itemsValid && stockWarnings.value.length === 0;
});

const getSubtotal = (item: { unitPrice: number; quantity: number }) => {
  return (item.unitPrice || 0) * (item.quantity || 0);
};

const getProductStock = (productId: string) => {
  const product = products.value.find(p => p.id === productId);
  return product ? product.stock : '-';
};

const canSelectProduct = (product: Product, currentIndex: number) => {
  if (product.stock <= 0) {
    const alreadySelected = form.items[currentIndex]?.productId === product.id;
    return alreadySelected;
  }
  return true;
};

const onProductSelect = (index: number) => {
  const item = form.items[index];
  if (!item.productId) {
    item.productName = '';
    item.unitPrice = 0;
    item.unit = '件';
    return;
  }
  const product = products.value.find(p => p.id === item.productId);
  if (product) {
    item.productName = product.name;
    item.unitPrice = product.groupBuyPrice || product.price;
    item.unit = product.unit || '件';
    if (!item.quantity || item.quantity <= 0) {
      item.quantity = 1;
    }
  }
};

const updateSubtotal = (_index: number) => {
  // computed 会自动更新，这里留空以便后续扩展校验
};

const addItem = () => {
  form.items.push({
    productId: '',
    productName: '',
    unitPrice: 0,
    quantity: 1,
    unit: '件',
  });
};

const removeItem = (index: number) => {
  form.items.splice(index, 1);
};

const loadProducts = async () => {
  try {
    const result = await api.get<{ data: Product[] }>('/products?pageSize=100&status=on_shelf');
    products.value = result.data || [];
  } catch (e) {
    console.error('加载商品列表失败:', e);
  }
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

onMounted(async () => {
  await loadProducts();
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
