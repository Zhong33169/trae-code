<template>
  <div class="page-container">
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title mb-0">商品管理</h1>
      <div class="flex gap-3">
        <button
          v-if="authStore.isRegistrar || authStore.isSupervisor"
          class="btn btn-primary"
          @click="showCreateModal = true"
        >
          + 新建商品
        </button>
      </div>
    </div>

    <div class="card p-4 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label class="label">商品名称</label>
          <input v-model="filters.keyword" class="input" placeholder="输入商品名称搜索" />
        </div>
        <div>
          <label class="label">状态</label>
          <select v-model="filters.status" class="input">
            <option value="">全部状态</option>
            <option v-for="(label, key) in ProductStatusLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">分类</label>
          <select v-model="filters.category" class="input">
            <option value="">全部分类</option>
            <option value="蔬菜">蔬菜</option>
            <option value="水果">水果</option>
            <option value="蛋类">蛋类</option>
            <option value="乳制品">乳制品</option>
            <option value="粮油">粮油</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn btn-primary w-full" @click="loadProducts">查询</button>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>商品名称</th>
            <th>分类</th>
            <th>原价</th>
            <th>团购价</th>
            <th>库存</th>
            <th>最小团购量</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td class="font-medium">{{ product.name }}</td>
            <td>{{ product.category || '-' }}</td>
            <td>¥{{ product.price.toFixed(2) }}</td>
            <td class="text-red-600 font-medium">¥{{ (product.groupBuyPrice || product.price).toFixed(2) }}</td>
            <td>{{ product.stock }} {{ product.unit }}</td>
            <td>{{ product.minGroupQuantity }} {{ product.unit }}</td>
            <td>
              <span class="badge" :class="product.status === 'on_shelf' ? 'badge-success' : 'badge-draft'">
                {{ ProductStatusLabels[product.status] }}
              </span>
            </td>
            <td class="text-gray-500 text-sm">{{ formatDate(product.createdAt) }}</td>
            <td>
              <button
                v-if="authStore.isSupervisor"
                class="text-blue-600 hover:text-blue-800 text-sm mr-3"
                @click="toggleShelf(product)"
              >
                {{ product.status === 'on_shelf' ? '下架' : '上架' }}
              </button>
            </td>
          </tr>
          <tr v-if="products.length === 0">
            <td colspan="9" class="text-center text-gray-400 py-8">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>

      <div class="flex items-center justify-between p-4 border-t">
        <span class="text-sm text-gray-500">共 {{ total }} 条</span>
        <div class="flex gap-2">
          <button
            class="btn btn-default text-sm"
            :disabled="page <= 1"
            @click="changePage(page - 1)"
          >
            上一页
          </button>
          <span class="px-3 py-2 text-sm">第 {{ page }} / {{ totalPages }} 页</span>
          <button
            class="btn btn-default text-sm"
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">新建商品</h3>
        <div class="space-y-4">
          <div class="form-group">
            <label class="label">商品名称 *</label>
            <input v-model="newProduct.name" class="input" placeholder="请输入商品名称" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="label">原价 *</label>
              <input v-model.number="newProduct.price" type="number" step="0.01" class="input" />
            </div>
            <div class="form-group">
              <label class="label">团购价</label>
              <input v-model.number="newProduct.groupBuyPrice" type="number" step="0.01" class="input" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="label">库存</label>
              <input v-model.number="newProduct.stock" type="number" class="input" />
            </div>
            <div class="form-group">
              <label class="label">最小团购量</label>
              <input v-model.number="newProduct.minGroupQuantity" type="number" class="input" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="label">单位</label>
              <input v-model="newProduct.unit" class="input" placeholder="件/斤/盒等" />
            </div>
            <div class="form-group">
              <label class="label">分类</label>
              <select v-model="newProduct.category" class="input">
                <option value="">请选择分类</option>
                <option value="蔬菜">蔬菜</option>
                <option value="水果">水果</option>
                <option value="蛋类">蛋类</option>
                <option value="乳制品">乳制品</option>
                <option value="粮油">粮油</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="label">商品描述</label>
            <textarea v-model="newProduct.description" class="input" rows="3"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button class="btn btn-default" @click="showCreateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="!canCreate" @click="createProduct">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { ProductStatusLabels } from '~/types';
import type { Product } from '~/types';

const authStore = useAuthStore();
const api = useApi();

const products = ref<Product[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = reactive({
  keyword: '',
  status: '',
  category: '',
});

const showCreateModal = ref(false);

const newProduct = reactive({
  name: '',
  description: '',
  price: 0,
  groupBuyPrice: 0,
  stock: 0,
  minGroupQuantity: 0,
  unit: '件',
  category: '',
});

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

const canCreate = computed(() => {
  return newProduct.name && newProduct.price > 0;
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
};

const loadProducts = async () => {
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;

    const result = await api.get<any>('/products', params);
    products.value = result.data;
    total.value = result.total;
  } catch (e) {
    console.error('加载商品失败:', e);
  }
};

const changePage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p;
    loadProducts();
  }
};

const createProduct = async () => {
  try {
    await api.post('/products', newProduct);
    showCreateModal.value = false;
    Object.assign(newProduct, {
      name: '',
      description: '',
      price: 0,
      groupBuyPrice: 0,
      stock: 0,
      minGroupQuantity: 0,
      unit: '件',
      category: '',
    });
    loadProducts();
  } catch (e: any) {
    alert(e.data?.message || '创建失败');
  }
};

const toggleShelf = async (product: Product) => {
  try {
    if (product.status === 'on_shelf') {
      await api.put(`/products/${product.id}/off-shelf`);
    } else {
      await api.put(`/products/${product.id}/on-shelf`);
    }
    loadProducts();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

onMounted(() => {
  loadProducts();
});
</script>
