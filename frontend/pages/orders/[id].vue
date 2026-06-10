<template>
  <div class="page-container">
    <div class="flex items-center gap-4 mb-6">
      <button class="btn btn-default" @click="goBack">
        ← 返回列表
      </button>
      <h1 class="page-title mb-0">订单详情</h1>
      <span class="badge" :class="getStatusBadgeClass(order?.status)">
        {{ OrderStatusLabels[order?.status] || '-' }}
      </span>
      <span class="badge" :class="order?.source === 'offline_import' ? 'badge-warning' : 'badge-info'">
        {{ OrderSourceLabels[order?.source] || '-' }}
      </span>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-500">加载中...</div>

    <div v-else-if="!order" class="text-center py-8 text-gray-500">订单不存在</div>

    <div v-else class="space-y-6">
      <div class="grid grid-cols-3 gap-6">
        <div class="card p-6 col-span-2">
          <h3 class="section-title">基本信息</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-gray-500 text-sm">订单编号</span>
              <p class="font-medium">{{ order.orderNo }}</p>
            </div>
            <div>
              <span class="text-gray-500 text-sm">创建时间</span>
              <p class="font-medium">{{ formatDate(order.createdAt) }}</p>
            </div>
            <div>
              <span class="text-gray-500 text-sm">社区名称</span>
              <p class="font-medium">{{ order.communityName }}</p>
            </div>
            <div>
              <span class="text-gray-500 text-sm">联系人</span>
              <p class="font-medium">{{ order.contactName || '-' }}</p>
            </div>
            <div>
              <span class="text-gray-500 text-sm">联系电话</span>
              <p class="font-medium">{{ order.contactPhone || '-' }}</p>
            </div>
            <div>
              <span class="text-gray-500 text-sm">预计配送日期</span>
              <p class="font-medium">{{ order.expectedDeliveryDate || '-' }}</p>
            </div>
            <div class="col-span-2">
              <span class="text-gray-500 text-sm">配送地址</span>
              <p class="font-medium">{{ order.deliveryAddress || '-' }}</p>
            </div>
            <div class="col-span-2">
              <span class="text-gray-500 text-sm">备注</span>
              <p class="font-medium">{{ order.remark || '无' }}</p>
            </div>
          </div>

          <div v-if="order.rejectReason" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <span class="text-red-600 font-medium text-sm">退回原因：</span>
            <span class="text-red-700">{{ order.rejectReason }}</span>
          </div>

          <div v-if="order.auditRemark" class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <span class="text-blue-600 font-medium text-sm">审核备注：</span>
            <span class="text-blue-700">{{ order.auditRemark }}</span>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="section-title">处理流程</h3>
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <div class="flex-1">
                <p class="font-medium">订单创建</p>
                <p class="text-sm text-gray-500">{{ order.createdBy?.name || '-' }} · {{ formatDate(order.createdAt) }}</p>
              </div>
            </div>
            <div v-if="order.reviewedAt" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full" :class="order.status === 'review_rejected' ? 'bg-red-500' : 'bg-green-500'"></div>
              <div class="flex-1">
                <p class="font-medium">
                  {{ order.status === 'review_rejected' ? '审核退回' : '审核通过' }}
                </p>
                <p class="text-sm text-gray-500">{{ order.reviewedBy?.name || '-' }} · {{ formatDate(order.reviewedAt) }}</p>
              </div>
            </div>
            <div v-else-if="order.status === 'pending_review'" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
              <div class="flex-1">
                <p class="font-medium text-yellow-600">待主管审核</p>
                <p class="text-sm text-gray-500">处理中...</p>
              </div>
            </div>
            <div v-if="order.finalReviewedAt" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full" :class="order.status === 'final_rejected' ? 'bg-red-500' : 'bg-green-500'"></div>
              <div class="flex-1">
                <p class="font-medium">
                  {{ order.status === 'final_rejected' ? '复核退回' : '复核通过' }}
                </p>
                <p class="text-sm text-gray-500">{{ order.finalReviewedBy?.name || '-' }} · {{ formatDate(order.finalReviewedAt) }}</p>
              </div>
            </div>
            <div v-else-if="order.status === 'pending_final_review'" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
              <div class="flex-1">
                <p class="font-medium text-yellow-600">待平台复核</p>
                <p class="text-sm text-gray-500">处理中...</p>
              </div>
            </div>
            <div v-if="order.status === 'shipped'" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <div class="flex-1">
                <p class="font-medium">已发货</p>
              </div>
            </div>
            <div v-if="order.status === 'delivered'" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <div class="flex-1">
                <p class="font-medium">已配送</p>
              </div>
            </div>
            <div v-if="order.signedAt" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <div class="flex-1">
                <p class="font-medium">已签收</p>
                <p class="text-sm text-gray-500">{{ formatDate(order.signedAt) }}</p>
              </div>
            </div>
            <div v-if="['exception', 'materials_missing', 'timeout', 'returned'].includes(order.status)" class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <div class="flex-1">
                <p class="font-medium text-red-600">
                  {{ OrderStatusLabels[order.status] }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 space-y-2">
            <button
              v-if="canSubmit"
              class="btn btn-primary w-full"
              @click="submitForReview"
            >
              提交审核
            </button>
            <button
              v-if="canEdit"
              class="btn btn-default w-full"
              @click="showEditModal = true"
            >
              编辑订单
            </button>
            <button
              v-if="canReviewApprove"
              class="btn btn-success w-full"
              @click="showReviewApproveModal = true"
            >
              审核通过
            </button>
            <button
              v-if="canReviewReject"
              class="btn btn-danger w-full"
              @click="showReviewRejectModal = true"
            >
              审核退回
            </button>
            <button
              v-if="canSubmitFinal"
              class="btn btn-primary w-full"
              @click="submitForFinalReview"
            >
              提交复核
            </button>
            <button
              v-if="canFinalApprove"
              class="btn btn-success w-full"
              @click="showFinalApproveModal = true"
            >
              复核通过
            </button>
            <button
              v-if="canFinalReject"
              class="btn btn-danger w-full"
              @click="showFinalRejectModal = true"
            >
              复核退回
            </button>
            <button
              v-if="canShip"
              class="btn btn-primary w-full"
              @click="shipOrder"
            >
              发货
            </button>
            <button
              v-if="canDeliver"
              class="btn btn-primary w-full"
              @click="deliverOrder"
            >
              配送
            </button>
            <button
              v-if="canSign"
              class="btn btn-success w-full"
              @click="signOrder"
            >
              签收
            </button>
            <button
              v-if="canArchive"
              class="btn btn-default w-full"
              @click="archiveOrder"
            >
              归档
            </button>
            <button
              v-if="canMarkException"
              class="btn btn-warning w-full"
              @click="showExceptionModal = true"
            >
              标记异常
            </button>
            <button
              v-if="canReturn"
              class="btn btn-danger w-full"
              @click="showReturnModal = true"
            >
              退回订单
            </button>
            <button
              v-if="canRectify"
              class="btn btn-primary w-full"
              @click="rectifyOrder"
            >
              补正订单
            </button>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="section-title">商品明细</h3>
        <table>
          <thead>
            <tr>
              <th>商品名称</th>
              <th>单价</th>
              <th>数量</th>
              <th>单位</th>
              <th class="text-right">小计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in order.items" :key="item.id">
              <td>{{ item.productName }}</td>
              <td>¥{{ item.unitPrice.toFixed(2) }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.unit || '件' }}</td>
              <td class="text-right font-medium">¥{{ item.subtotal.toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"></td>
              <td class="font-medium">合计：</td>
              <td class="text-right text-lg font-bold text-red-600">¥{{ order.totalAmount.toFixed(2) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="section-title mb-0">附件资料</h3>
          <button
            v-if="canUploadAttachment"
            class="btn btn-primary btn-sm"
            @click="triggerUpload"
          >
            + 上传附件
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          @change="handleFileUpload"
        />
        <div v-if="order.attachments?.length" class="space-y-2">
          <div
            v-for="att in order.attachments"
            :key="att.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-md"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">📎</span>
              <div>
                <p class="font-medium">{{ att.originalName }}</p>
                <p class="text-sm text-gray-500">
                  {{ AttachmentTypeLabels[att.type] }} · {{ formatSize(att.size) }} · {{ formatDate(att.createdAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-400">
          暂无附件
        </div>
      </div>

      <div class="card p-6">
        <h3 class="section-title">审计日志</h3>
        <div class="space-y-3">
          <div
            v-for="log in auditLogs"
            :key="log.id"
            class="flex items-start gap-4 p-3 bg-gray-50 rounded-md"
          >
            <div class="w-2 h-2 rounded-full mt-2" :class="log.success ? 'bg-green-500' : 'bg-red-500'"></div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ AuditActionLabels[log.action] }}</span>
                <span v-if="!log.success" class="badge badge-error">失败</span>
              </div>
              <p class="text-sm text-gray-600 mt-1">{{ log.description }}</p>
              <p v-if="log.failReason" class="text-sm text-red-600 mt-1">
                失败原因：{{ log.failReason }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ log.user?.name || '系统' }} · {{ formatDate(log.createdAt) }}
              </p>
            </div>
          </div>
          <div v-if="auditLogs.length === 0" class="text-center py-4 text-gray-400">
            暂无审计日志
          </div>
        </div>
      </div>
    </div>

    <div v-if="showReviewApproveModal" class="modal-overlay" @click.self="showReviewApproveModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">审核通过</h3>
        <div class="form-group">
          <label class="label">审核备注（可选）</label>
          <textarea v-model="reviewRemark" class="input" rows="3" placeholder="请输入审核备注"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showReviewApproveModal = false">取消</button>
          <button class="btn btn-success" @click="reviewApprove">确认通过</button>
        </div>
      </div>
    </div>

    <div v-if="showReviewRejectModal" class="modal-overlay" @click.self="showReviewRejectModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">审核退回</h3>
        <div class="form-group">
          <label class="label">退回原因</label>
          <textarea v-model="rejectReason" class="input" rows="3" placeholder="请输入退回原因（必填）"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showReviewRejectModal = false">取消</button>
          <button class="btn btn-danger" :disabled="!rejectReason" @click="reviewReject">确认退回</button>
        </div>
      </div>
    </div>

    <div v-if="showFinalApproveModal" class="modal-overlay" @click.self="showFinalApproveModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">复核通过</h3>
        <div class="form-group">
          <label class="label">复核备注（可选）</label>
          <textarea v-model="finalRemark" class="input" rows="3" placeholder="请输入复核备注"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showFinalApproveModal = false">取消</button>
          <button class="btn btn-success" @click="finalApprove">确认通过</button>
        </div>
      </div>
    </div>

    <div v-if="showFinalRejectModal" class="modal-overlay" @click.self="showFinalRejectModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">复核退回</h3>
        <div class="form-group">
          <label class="label">退回原因</label>
          <textarea v-model="rejectReason" class="input" rows="3" placeholder="请输入退回原因（必填）"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showFinalRejectModal = false">取消</button>
          <button class="btn btn-danger" :disabled="!rejectReason" @click="finalReject">确认退回</button>
        </div>
      </div>
    </div>

    <div v-if="showExceptionModal" class="modal-overlay" @click.self="showExceptionModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">标记异常</h3>
        <div class="form-group">
          <label class="label">异常原因</label>
          <textarea v-model="exceptionReason" class="input" rows="3" placeholder="请输入异常原因（必填）"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showExceptionModal = false">取消</button>
          <button class="btn btn-warning" :disabled="!exceptionReason" @click="markException">确认标记</button>
        </div>
      </div>
    </div>

    <div v-if="showReturnModal" class="modal-overlay" @click.self="showReturnModal = false">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4">退回订单</h3>
        <div class="form-group">
          <label class="label">退回原因</label>
          <textarea v-model="returnReason" class="input" rows="3" placeholder="请输入退回原因（必填）"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showReturnModal = false">取消</button>
          <button class="btn btn-danger" :disabled="!returnReason" @click="returnOrder">确认退回</button>
        </div>
      </div>
    </div>

    <OrderEditModal
      v-if="showEditModal"
      :order="order"
      @close="showEditModal = false"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import {
  OrderStatusLabels,
  OrderSourceLabels,
  AttachmentTypeLabels,
  AuditActionLabels,
  OrderStatus,
} from '~/types';
import type { Order, AuditLog } from '~/types';

const authStore = useAuthStore();
const api = useApi();
const route = useRoute();

const order = ref<Order | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const loading = ref(false);

const showEditModal = ref(false);
const showReviewApproveModal = ref(false);
const showReviewRejectModal = ref(false);
const showFinalApproveModal = ref(false);
const showFinalRejectModal = ref(false);
const showExceptionModal = ref(false);
const showReturnModal = ref(false);

const reviewRemark = ref('');
const finalRemark = ref('');
const rejectReason = ref('');
const exceptionReason = ref('');
const returnReason = ref('');

const fileInput = ref<HTMLInputElement | null>(null);

const canSubmit = computed(() => {
  if (!order.value) return false;
  return authStore.isRegistrar && ['draft', 'review_rejected', 'final_rejected'].includes(order.value.status);
});

const canEdit = computed(() => {
  if (!order.value) return false;
  return authStore.isRegistrar && ['draft', 'review_rejected', 'final_rejected'].includes(order.value.status);
});

const canReviewApprove = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && order.value.status === 'pending_review';
});

const canReviewReject = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && order.value.status === 'pending_review';
});

const canSubmitFinal = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && order.value.status === 'review_approved';
});

const canFinalApprove = computed(() => {
  if (!order.value) return false;
  return authStore.isReviewer && order.value.status === 'pending_final_review';
});

const canFinalReject = computed(() => {
  if (!order.value) return false;
  return authStore.isReviewer && order.value.status === 'pending_final_review';
});

const canShip = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && order.value.status === 'final_approved';
});

const canDeliver = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && order.value.status === 'shipped';
});

const canSign = computed(() => {
  if (!order.value) return false;
  return authStore.isRegistrar && order.value.status === 'delivered';
});

const canArchive = computed(() => {
  if (!order.value) return false;
  return authStore.isReviewer && order.value.status === 'signed';
});

const canMarkException = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && !['archived', 'draft'].includes(order.value.status);
});

const canReturn = computed(() => {
  if (!order.value) return false;
  return authStore.isSupervisor && ['shipped', 'delivered', 'signed'].includes(order.value.status);
});

const canRectify = computed(() => {
  if (!order.value) return false;
  return authStore.isRegistrar && ['exception', 'materials_missing', 'timeout'].includes(order.value.status);
});

const canUploadAttachment = computed(() => {
  if (!order.value) return false;
  return authStore.isRegistrar || authStore.isSupervisor;
});

const getStatusBadgeClass = (status?: OrderStatus): string => {
  if (!status) return 'badge-draft';
  const successStatuses: OrderStatus[] = ['signed', 'archived', 'final_approved', 'review_approved'];
  const warningStatuses: OrderStatus[] = ['pending_review', 'pending_final_review', 'shipped', 'delivered', 'processing'];
  const errorStatuses: OrderStatus[] = ['review_rejected', 'final_rejected', 'returned', 'exception', 'materials_missing', 'timeout'];
  const draftStatuses: OrderStatus[] = ['draft'];

  if (successStatuses.includes(status)) return 'badge-success';
  if (warningStatuses.includes(status)) return 'badge-warning';
  if (errorStatuses.includes(status)) return 'badge-error';
  if (draftStatuses.includes(status)) return 'badge-draft';
  return 'badge-info';
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const loadOrder = async () => {
  const id = route.params.id as string;
  if (!id) return;

  loading.value = true;
  try {
    order.value = await api.get<Order>(`/orders/${id}`);
    await loadAuditLogs();
  } catch (e) {
    console.error('加载订单失败:', e);
  } finally {
    loading.value = false;
  }
};

const loadAuditLogs = async () => {
  const id = route.params.id as string;
  try {
    const logs = await api.get<AuditLog[]>(`/audit-logs/order/${id}`);
    auditLogs.value = logs;
  } catch (e) {
    console.error('加载审计日志失败:', e);
  }
};

const goBack = () => {
  navigateTo('/orders');
};

const submitForReview = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/submit`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const reviewApprove = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/review-approve`, { auditRemark: reviewRemark.value });
    showReviewApproveModal.value = false;
    reviewRemark.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const reviewReject = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/review-reject`, { rejectReason: rejectReason.value });
    showReviewRejectModal.value = false;
    rejectReason.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const submitForFinalReview = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/submit-final`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const finalApprove = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/final-approve`, { auditRemark: finalRemark.value });
    showFinalApproveModal.value = false;
    finalRemark.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const finalReject = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/final-reject`, { rejectReason: rejectReason.value });
    showFinalRejectModal.value = false;
    rejectReason.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const shipOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/ship`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const deliverOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/deliver`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const signOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/sign`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const archiveOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/archive`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const markException = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/exception`, { reason: exceptionReason.value });
    showExceptionModal.value = false;
    exceptionReason.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const returnOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/return`, { reason: returnReason.value });
    showReturnModal.value = false;
    returnReason.value = '';
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const rectifyOrder = async () => {
  const id = route.params.id as string;
  try {
    await api.post(`/orders/${id}/rectify`);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  }
};

const triggerUpload = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const id = route.params.id as string;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'material');

  try {
    await api.upload(`/orders/${id}/attachments`, formData);
    loadOrder();
  } catch (e: any) {
    alert(e.data?.message || '上传失败');
  } finally {
    target.value = '';
  }
};

const handleEditSuccess = () => {
  showEditModal.value = false;
  loadOrder();
};

onMounted(() => {
  loadOrder();
});
</script>
