<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-gray-500">加载中...</div>
    </div>

    <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-700">{{ loadError }}</p>
      <button @click="loadTicket" class="mt-3 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
        重试
      </button>
    </div>

    <div v-else-if="ticket" class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-4">
          <button @click="goBack" class="text-gray-500 hover:text-gray-700">
            ← 返回
          </button>
          <h2 class="text-2xl font-bold text-gray-900">{{ ticket.ticket_no }}</h2>
          <span class="status-tag" :class="ticket.status_color">{{ ticket.status_label }}</span>
          <span v-if="ticket.is_abnormal" class="abnormal-badge">异常</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button
            v-if="canSubmit"
            @click="handleSubmit"
            class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            提交审核
          </button>
          <button
            v-if="canAuditPass"
            @click="handleAuditPass"
            class="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            审核通过
          </button>
          <button
            v-if="canReject"
            @click="showRejectModal = true"
            class="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700"
          >
            退回
          </button>
          <button
            v-if="canReviewPass"
            @click="showReviewPassModal = true"
            class="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            评审通过
          </button>
          <button
            v-if="canReviewReject"
            @click="showReviewRejectModal = true"
            class="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
          >
            评审不通过
          </button>
          <button
            v-if="canRelease"
            @click="handleRelease"
            class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            发布
          </button>
          <button
            v-if="canRequestReview"
            @click="handleRequestReview"
            class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            申请复核
          </button>
          <button
            v-if="canArchive"
            @click="showArchiveModal = true"
            class="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            复核归档
          </button>
          <button
            v-if="canEdit"
            @click="openEditModal"
            class="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
          >
            编辑
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2 space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div class="text-gray-500">标题</div>
                <div class="text-gray-900 font-medium">{{ ticket.title }}</div>
              </div>
              <div>
                <div class="text-gray-500">阶段</div>
                <div class="text-gray-900">{{ ticket.stage_label }}</div>
              </div>
              <div>
                <div class="text-gray-500">客户名称</div>
                <div class="text-gray-900">{{ ticket.customer_name || '-' }}</div>
              </div>
              <div>
                <div class="text-gray-500">客户联系方式</div>
                <div class="text-gray-900">{{ ticket.customer_contact || '-' }}</div>
              </div>
              <div>
                <div class="text-gray-500">产品版本</div>
                <div class="text-gray-900">{{ ticket.product_version || '-' }}</div>
              </div>
              <div>
                <div class="text-gray-500">优先级</div>
                <div class="text-gray-900">
                  <span :class="priorityClass(ticket.priority)">{{ priorityLabel(ticket.priority) }}</span>
                </div>
              </div>
              <div>
                <div class="text-gray-500">截止日期</div>
                <div class="text-gray-900">{{ ticket.deadline || '-' }}</div>
              </div>
              <div>
                <div class="text-gray-500">来源</div>
                <div class="text-gray-900">{{ sourceLabel(ticket.source) }}</div>
              </div>
              <div v-if="ticket.import_batch_label">
                <div class="text-gray-500">导入批次</div>
                <div class="text-gray-900 text-xs">{{ ticket.import_batch_label }}</div>
              </div>
              <div>
                <div class="text-gray-500">创建人</div>
                <div class="text-gray-900">{{ ticket.creator_name }}</div>
              </div>
              <div>
                <div class="text-gray-500">创建时间</div>
                <div class="text-gray-900">{{ ticket.created_at }}</div>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-gray-500 text-sm mb-1">描述</div>
              <div class="text-gray-900 text-sm whitespace-pre-wrap">{{ ticket.description || '-' }}</div>
            </div>
          </div>

          <div v-if="ticket.reject_reason" class="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold text-orange-900">退回原因</h3>
              <button
                v-if="canEdit"
                @click="openEditModal"
                class="text-xs text-orange-600 hover:text-orange-800 underline"
              >
                编辑
              </button>
            </div>
            <p class="text-orange-800 text-sm">{{ ticket.reject_reason }}</p>
          </div>

          <div v-if="ticket.result" class="bg-green-50 border border-green-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold text-green-900">处理结果</h3>
              <button
                v-if="canEdit"
                @click="openEditModal"
                class="text-xs text-green-600 hover:text-green-800 underline"
              >
                编辑
              </button>
            </div>
            <p class="text-green-800 text-sm">{{ ticket.result }}</p>
          </div>

          <div v-if="ticket.audit_remark" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold text-blue-900">审计备注</h3>
              <button
                v-if="canEdit"
                @click="openEditModal"
                class="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                编辑
              </button>
            </div>
            <p class="text-blue-800 text-sm">{{ ticket.audit_remark }}</p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">附件</h3>
              <button
                v-if="canManageAttachments"
                @click="showAddAttachmentModal = true"
                class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
              >
                + 添加附件
              </button>
            </div>
            <div v-if="ticket.attachments && ticket.attachments.length > 0" class="space-y-2">
              <div
                v-for="att in ticket.attachments"
                :key="att.id"
                class="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">📎</span>
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ att.file_name }}</div>
                    <div class="text-xs text-gray-500">{{ formatFileSize(att.file_size) }} · {{ att.uploaded_at }}</div>
                  </div>
                </div>
                <button
                  v-if="canManageAttachments"
                  @click="handleDeleteAttachment(att)"
                  class="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
            <div v-else class="text-gray-500 text-sm py-4 text-center">
              暂无附件
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">审计日志</h3>
            <div v-if="ticket.audit_logs && ticket.audit_logs.length > 0" class="space-y-4">
              <div
                v-for="log in ticket.audit_logs"
                :key="log.id"
                class="flex gap-4"
              >
                <div class="flex flex-col items-center">
                  <div
                    class="w-3 h-3 rounded-full"
                    :class="log.is_failure ? 'bg-red-500' : 'bg-blue-500'"
                  />
                  <div class="w-px flex-1 bg-gray-200" />
                </div>
                <div class="flex-1 pb-4">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900 text-sm">{{ log.action }}</span>
                    <span v-if="log.is_failure" class="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">失败</span>
                  </div>
                  <div class="text-sm text-gray-600 mt-1">{{ log.detail }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ log.operator_name }} ({{ log.operator_role_label }}) · {{ log.created_at }}
                  </div>
                  <div v-if="log.failure_reason" class="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                    失败原因：{{ log.failure_reason }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-gray-500 text-sm py-4 text-center">
              暂无审计日志
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">处理进度</h3>
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                <div>
                  <div class="text-sm font-medium text-gray-900">需求反馈</div>
                  <div class="text-xs text-gray-500">登记员创建并提交</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  :class="isStagePassed('product_review') ? 'bg-green-500' : isCurrentStage('product_review') ? 'bg-blue-500' : 'bg-gray-300'"
                >
                  <span v-if="isStagePassed('product_review')">✓</span>
                  <span v-else-if="isCurrentStage('product_review')">2</span>
                  <span v-else>2</span>
                </div>
                <div>
                  <div class="text-sm font-medium" :class="isStagePassed('product_review') || isCurrentStage('product_review') ? 'text-gray-900' : 'text-gray-400'">产品评审</div>
                  <div class="text-xs" :class="isStagePassed('product_review') || isCurrentStage('product_review') ? 'text-gray-500' : 'text-gray-300'">审核主管评审</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  :class="isStagePassed('release_visit') ? 'bg-green-500' : isCurrentStage('release_visit') ? 'bg-blue-500' : 'bg-gray-300'"
                >
                  <span v-if="isStagePassed('release_visit')">✓</span>
                  <span v-else-if="isCurrentStage('release_visit')">3</span>
                  <span v-else>3</span>
                </div>
                <div>
                  <div class="text-sm font-medium" :class="isStagePassed('release_visit') || isCurrentStage('release_visit') ? 'text-gray-900' : 'text-gray-400'">发布回访</div>
                  <div class="text-xs" :class="isStagePassed('release_visit') || isCurrentStage('release_visit') ? 'text-gray-500' : 'text-gray-300'">复核负责人归档</div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">处理人信息</h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">登记员</span>
                <span class="text-gray-900 font-medium">{{ ticket.creator_name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">审核主管</span>
                <span class="text-gray-900">{{ ticket.auditor_name || '-' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">复核负责人</span>
                <span class="text-gray-900">{{ ticket.reviewer_name || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showRejectModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold">退回需求单</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">退回类型</label>
              <select v-model="rejectForm.type" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="returned">退回补正</option>
                <option value="material_missing">材料缺失</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">退回原因 *</label>
              <textarea v-model="rejectForm.reason" rows="4" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请详细说明退回原因..." />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showRejectModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleReject" class="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700">
              确认退回
            </button>
          </div>
        </div>
      </div>

      <div v-if="showReviewPassModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold">评审通过</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">评审结果</label>
              <textarea v-model="reviewPassForm.result" rows="4" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请填写评审结果和处理意见..." />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showReviewPassModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleReviewPass" class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
              确认通过
            </button>
          </div>
        </div>
      </div>

      <div v-if="showReviewRejectModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold">评审不通过</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">不通过原因 *</label>
              <textarea v-model="reviewRejectForm.reason" rows="4" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请详细说明不通过原因..." />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showReviewRejectModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleReviewReject" class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
              确认不通过
            </button>
          </div>
        </div>
      </div>

      <div v-if="showArchiveModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold">复核归档</h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">审计备注</label>
              <textarea v-model="archiveForm.audit_remark" rows="4" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请填写审计备注..." />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showArchiveModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleArchive" class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
              确认归档
            </button>
          </div>
        </div>
      </div>

      <div v-if="showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-semibold">编辑需求单</h3>
            <button @click="showEditModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
              <input v-model="editForm.title" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea v-model="editForm.description" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
                <input v-model="editForm.customer_name" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">客户联系方式</label>
                <input v-model="editForm.customer_contact" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                <select v-model="editForm.priority" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">产品版本</label>
                <input v-model="editForm.product_version" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
              <input v-model="editForm.deadline" type="date" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">处理结果</label>
              <textarea v-model="editForm.result" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请填写处理结果..." />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">退回原因</label>
              <textarea v-model="editForm.reject_reason" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请填写退回原因（如有）..." />
            </div>
            <div v-if="isReviewer">
              <label class="block text-sm font-medium text-gray-700 mb-1">审计备注</label>
              <textarea v-model="editForm.audit_remark" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="请填写审计备注..." />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showEditModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleEdit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              保存
            </button>
          </div>
        </div>
      </div>

      <div v-if="showAddAttachmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 class="text-lg font-semibold">添加附件</h3>
            <button @click="showAddAttachmentModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">文件名 *</label>
              <input v-model="attachmentForm.file_name" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="例如：需求规格说明书.pdf" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">文件大小 (字节)</label>
              <input v-model.number="attachmentForm.file_size" type="number" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="例如：102400" />
            </div>
          </div>
          <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button @click="showAddAttachmentModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button @click="handleAddAttachment" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { get, post, put, del } = useApi();
const { isRegistrar, isAuditor, isReviewer, currentUser } = useAuth();

const ticket = ref<any>(null);
const loading = ref(true);
const loadError = ref('');
const showRejectModal = ref(false);
const showReviewPassModal = ref(false);
const showReviewRejectModal = ref(false);
const showArchiveModal = ref(false);
const showEditModal = ref(false);
const showAddAttachmentModal = ref(false);

const rejectForm = ref({ type: 'returned', reason: '' });
const reviewPassForm = ref({ result: '' });
const reviewRejectForm = ref({ reason: '' });
const archiveForm = ref({ audit_remark: '' });
const editForm = ref<any>({});
const attachmentForm = ref({ file_name: '', file_size: 0 });

const loadTicket = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const res: any = await get(`/tickets/${route.params.id}`);
    ticket.value = res.data;
  } catch (e: any) {
    loadError.value = e?.data?.error || e?.message || '加载需求单失败';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

const canSubmit = computed(() => {
  if (!ticket.value || !isRegistrar.value) return false;
  return ['draft', 'returned', 'material_missing'].includes(ticket.value.status);
});

const canAuditPass = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.status === 'pending_audit';
});

const canReject = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.status === 'pending_audit';
});

const canReviewPass = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.stage === 'product_review' && ['in_review'].includes(ticket.value.status);
});

const canReviewReject = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.stage === 'product_review' && ticket.value.status === 'in_review';
});

const canRelease = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.status === 'pending_release';
});

const canRequestReview = computed(() => {
  if (!ticket.value || !isAuditor.value) return false;
  return ticket.value.status === 'released';
});

const canArchive = computed(() => {
  if (!ticket.value || !isReviewer.value) return false;
  return ticket.value.status === 'pending_review';
});

const canEdit = computed(() => {
  if (!ticket.value || !currentUser.value) return false;
  if (isRegistrar.value && ['draft', 'returned', 'material_missing'].includes(ticket.value.status)) return true;
  if (isAuditor.value && ['pending_audit', 'in_review', 'review_passed', 'review_rejected', 'pending_release', 'released', 'overdue'].includes(ticket.value.status)) return true;
  if (isReviewer.value && ticket.value.status === 'pending_review') return true;
  return false;
});

const canManageAttachments = computed(() => {
  return canEdit.value;
});

const isCurrentStage = (stage: string) => {
  return ticket.value?.stage === stage && ticket.value?.status !== 'archived';
};

const isStagePassed = (stage: string) => {
  if (!ticket.value) return false;
  const stageOrder = ['feedback', 'product_review', 'release_visit'];
  const currentIdx = stageOrder.indexOf(ticket.value.stage);
  const targetIdx = stageOrder.indexOf(stage);
  
  if (targetIdx < currentIdx) return true;
  if (targetIdx === currentIdx && ticket.value.status === 'archived') return true;
  return false;
};

const openEditModal = () => {
  if (!ticket.value) return;
  editForm.value = {
    title: ticket.value.title,
    description: ticket.value.description,
    customer_name: ticket.value.customer_name,
    customer_contact: ticket.value.customer_contact,
    priority: ticket.value.priority,
    product_version: ticket.value.product_version,
    deadline: ticket.value.deadline,
    result: ticket.value.result || '',
    reject_reason: ticket.value.reject_reason || '',
    audit_remark: ticket.value.audit_remark || '',
  };
  showEditModal.value = true;
};

const handleSubmit = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/submit`);
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleAuditPass = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/audit-pass`);
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleReject = async () => {
  if (!rejectForm.value.reason) {
    alert('请填写退回原因');
    return;
  }
  try {
    await post(`/tickets/${ticket.value.id}/reject`, {
      reason: rejectForm.value.reason,
      type: rejectForm.value.type,
    });
    showRejectModal.value = false;
    rejectForm.value = { type: 'returned', reason: '' };
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleReviewPass = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/review-pass`, {
      result: reviewPassForm.value.result,
    });
    showReviewPassModal.value = false;
    reviewPassForm.value = { result: '' };
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleReviewReject = async () => {
  if (!reviewRejectForm.value.reason) {
    alert('请填写不通过原因');
    return;
  }
  try {
    await post(`/tickets/${ticket.value.id}/review-reject`, {
      reason: reviewRejectForm.value.reason,
    });
    showReviewRejectModal.value = false;
    reviewRejectForm.value = { reason: '' };
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleRelease = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/release`);
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleRequestReview = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/request-review`);
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleArchive = async () => {
  try {
    await post(`/tickets/${ticket.value.id}/archive`, {
      audit_remark: archiveForm.value.audit_remark,
    });
    showArchiveModal.value = false;
    archiveForm.value = { audit_remark: '' };
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '操作失败');
  }
};

const handleEdit = async () => {
  try {
    await put(`/tickets/${ticket.value.id}`, editForm.value);
    showEditModal.value = false;
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '保存失败');
  }
};

const handleAddAttachment = async () => {
  if (!attachmentForm.value.file_name) {
    alert('请输入文件名');
    return;
  }
  try {
    await post(`/tickets/${ticket.value.id}/attachments`, {
      file_name: attachmentForm.value.file_name,
      file_size: attachmentForm.value.file_size || 0,
    });
    showAddAttachmentModal.value = false;
    attachmentForm.value = { file_name: '', file_size: 0 };
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '添加附件失败');
  }
};

const handleDeleteAttachment = async (att: any) => {
  if (!confirm(`确定删除附件「${att.file_name}」？`)) return;
  try {
    await del(`/tickets/${ticket.value.id}/attachments/${att.id}`);
    await loadTicket();
  } catch (e: any) {
    alert(e?.data?.error || '删除附件失败');
  }
};

const priorityLabel = (p: string) => {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' };
  return map[p] || p;
};

const priorityClass = (p: string) => {
  const map: Record<string, string> = {
    high: 'text-red-600 font-medium',
    medium: 'text-orange-600',
    low: 'text-gray-600',
  };
  return map[p] || '';
};

const sourceLabel = (s: string) => {
  const map: Record<string, string> = {
    online: '线上创建',
    offline_import: '离线导入',
  };
  return map[s] || s;
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

onMounted(() => {
  loadTicket();
});

watch(() => currentUser.value, () => {
  if (ticket.value) {
    loadTicket();
  }
});
</script>
