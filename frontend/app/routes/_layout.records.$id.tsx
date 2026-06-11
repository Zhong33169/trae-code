import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useRevalidator, Link } from "@remix-run/react";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  Table,
  Timeline,
  Row,
  Col,
  Divider,
  List,
  App,
  message,
  Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  EditOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiGet, apiPost, apiPut, apiDelete } from "~/utils/api.server";
import { RecordDetailResponse, Evidence, ReviewRecord, OperationLog, SupervisionRecord } from "~/types";
import dayjs from "dayjs";
import { useState } from "react";
import type { UploadProps } from "antd";

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  submitted: "blue",
  in_review: "processing",
  review_passed: "success",
  review_rejected: "error",
  needs_correction: "warning",
  corrected: "blue",
  in_final_review: "processing",
  final_passed: "success",
  final_rejected: "error",
  evidence_missing: "warning",
  overdue: "red",
  status_conflict: "magenta",
  archived: "default",
};

const EVIDENCE_ICONS: Record<string, any> = {
  photo: <CameraOutlined />,
  video: <VideoCameraOutlined />,
  document: <FileTextOutlined />,
  signature: <FileImageOutlined />,
  other: <FileTextOutlined />,
};

const EVIDENCE_TYPE_NAMES: Record<string, string> = {
  photo: "照片",
  video: "视频",
  document: "文档",
  signature: "签字",
  other: "其他",
};

const RESULT_COLORS: Record<string, string> = {
  pass: "success",
  reject: "error",
  correction: "warning",
  process: "processing",
  corrected: "blue",
  conflict: "magenta",
};

const RESULT_NAMES: Record<string, string> = {
  pass: "通过",
  reject: "驳回",
  correction: "补正",
  process: "处理中",
  corrected: "已补正",
  conflict: "冲突",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { token } = await requireAuth(request);
  const response = await apiGet<RecordDetailResponse>(token, `/api/records/${params.id}`);
  if (response.code !== 200) {
    throw new Error(response.message);
  }
  return json(response.data);
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { token } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "operate") {
    const operation = formData.get("operation") as string;
    const opinion = formData.get("opinion") as string;
    const rejectReason = formData.get("rejectReason") as string;
    const version = parseInt(formData.get("version") as string);
    const deadline = formData.get("deadline") as string;
    const handlerId = formData.get("handlerId") ? parseInt(formData.get("handlerId") as string) : undefined;

    const body: any = { operation, opinion, rejectReason, version };
    if (deadline) body.deadline = deadline;
    if (handlerId) body.handlerId = handlerId;

    const response = await apiPost(token, `/api/records/${params.id}/operate`, body);
    return json({ ...response, operation });
  }

  if (intent === "delete") {
    const response = await apiDelete(token, `/api/records/${params.id}`);
    if (response.code === 200) {
      return redirect("/records");
    }
    return json(response);
  }

  return null;
};

export default function RecordDetail() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const revalidator = useRevalidator();
  const { message: messageApi } = App.useApp();
  
  const [operationModal, setOperationModal] = useState<{ open: boolean; operation: string; label: string }>({ open: false, operation: "", label: "" });
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { record, evidences, reviewRecords, operationLogs, availableOperations, lastReview } = data;

  if (actionData && "code" in actionData) {
    if (actionData.code === 200) {
      messageApi.success(`${operationModal.label}成功`);
      setOperationModal({ open: false, operation: "", label: "" });
      revalidator.revalidate();
    } else {
      messageApi.error(actionData.message || "操作失败");
      setIsSubmitting(false);
    }
  }

  const handleOperation = (op: string, label: string) => {
    setOperationModal({ open: true, operation: op, label });
    form.resetFields();
  };

  const handleSubmitOperation = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);
      
      const formEl = document.createElement('form');
      formEl.method = 'post';
      formEl.style.display = 'none';
      
      const addField = (name: string, value: any) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        formEl.appendChild(input);
      };
      
      addField('intent', 'operate');
      addField('operation', operationModal.operation);
      addField('opinion', values.opinion || '');
      addField('rejectReason', values.rejectReason || '');
      addField('version', record.version);
      if (values.deadline) {
        addField('deadline', dayjs(values.deadline).format('YYYY-MM-DD HH:mm:ss'));
      }
      if (values.handlerId) {
        addField('handlerId', values.handlerId);
      }
      
      document.body.appendChild(formEl);
      formEl.submit();
    } catch {
      messageApi.error("请填写必填项");
    }
  };

  const needOpinion = ["review_pass", "review_reject", "request_correction", "mark_evidence_missing", "mark_status_conflict", "final_pass", "final_reject", "correct"].includes(operationModal.operation);
  const needRejectReason = ["review_reject", "request_correction", "mark_evidence_missing", "mark_status_conflict", "final_reject"].includes(operationModal.operation);
  const needDeadline = ["review", "final_review", "correct"].includes(operationModal.operation);

  const evidenceColumns = [
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 80,
      render: (type: string) => (
        <Tag color="blue">
          {EVIDENCE_ICONS[type]} {EVIDENCE_TYPE_NAMES[type] || type}
        </Tag>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (text: string) => text || "-",
    },
    {
      title: "上传人",
      dataIndex: "uploaded_by_name",
      key: "uploaded_by_name",
      width: 100,
    },
    {
      title: "上传时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm"),
    },
  ];

  const operationLogColumns = [
    {
      title: "操作时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "操作人",
      dataIndex: "user_name",
      key: "user_name",
      width: 100,
      render: (text: string, record: OperationLog) => (
        <Space>
          {text}
          <Tag color="blue" size="small">{record.user_role_name}</Tag>
        </Space>
      ),
    },
    {
      title: "操作类型",
      dataIndex: "operation_type_name",
      key: "operation_type_name",
      width: 120,
    },
    {
      title: "操作描述",
      dataIndex: "description",
      key: "description",
    },
  ];

  const isOverdue = record.deadline && dayjs(record.deadline).isBefore(dayjs());

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/records" style={{ color: "#1890ff" }}>
          <ArrowLeftOutlined /> 返回列表
        </Link>
      </div>

      <Card
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <span>{record.record_no}</span>
            <Tag color={STATUS_COLORS[record.status]}>{record.statusName}</Tag>
            <Tag>版本 v{record.version}</Tag>
            {isOverdue && <Tag color="red">已逾期</Tag>}
          </Space>
        }
        extra={
          <Space>
            {availableOperations.map((op: any) => (
              <Button
                key={op.operation}
                type={op.operation.includes("pass") ? "primary" : op.operation.includes("reject") ? "default" : "default"}
                danger={op.operation.includes("reject")}
                onClick={() => handleOperation(op.operation, op.label)}
                icon={
                  op.operation.includes("pass") ? <CheckCircleOutlined /> :
                  op.operation.includes("reject") ? <CloseCircleOutlined /> :
                  op.operation.includes("correction") ? <ExclamationCircleOutlined /> :
                  undefined
                }
              >
                {op.label}
              </Button>
            ))}
            {record.status === "draft" && record.created_by_name && (
              <Space>
                <Link to={`/records/${record.id}/edit`}>
                  <Button icon={<EditOutlined />}>编辑</Button>
                </Link>
                <Popconfirm
                  title="确认删除"
                  description="删除后无法恢复，确定要删除这条草稿记录吗？"
                  onConfirm={async () => {
                    const formEl = document.createElement('form');
                    formEl.method = 'post';
                    const intentInput = document.createElement('input');
                    intentInput.type = 'hidden';
                    intentInput.name = 'intent';
                    intentInput.value = 'delete';
                    formEl.appendChild(intentInput);
                    document.body.appendChild(formEl);
                    formEl.submit();
                  }}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger>删除</Button>
                </Popconfirm>
              </Space>
            )}
          </Space>
        }
      >
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="工程名称">{record.project_name}</Descriptions.Item>
          <Descriptions.Item label="施工单位">{record.construction_unit || "-"}</Descriptions.Item>
          <Descriptions.Item label="监理单位">{record.supervision_unit || "-"}</Descriptions.Item>
          <Descriptions.Item label="旁站部位">{record.location || "-"}</Descriptions.Item>
          <Descriptions.Item label="旁站日期">{record.record_date}</Descriptions.Item>
          <Descriptions.Item label="天气">{record.weather || "-"} / {record.temperature || "-"}</Descriptions.Item>
          <Descriptions.Item label="创建人">{record.created_by_name}</Descriptions.Item>
          <Descriptions.Item label="当前处理人">{record.handler_name || "-"}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(record.created_at).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
          {record.deadline && (
            <Descriptions.Item label="截止时间" span={2}>
              <span style={{ color: isOverdue ? "#ff4d4f" : undefined }}>
                {dayjs(record.deadline).format("YYYY-MM-DD HH:mm")}
                {isOverdue && " (已逾期)"}
              </span>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="旁站内容" span={2}>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{record.content}</div>
          </Descriptions.Item>
          {record.issues && (
            <Descriptions.Item label="发现问题" span={2}>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#fa8c16" }}>{record.issues}</div>
            </Descriptions.Item>
          )}
          {record.requirement && (
            <Descriptions.Item label="整改要求" span={2}>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#1890ff" }}>{record.requirement}</div>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {lastReview && (
        <Card
          style={{ marginBottom: 16 }}
          title="上一处理人意见"
          size="small"
        >
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ color: "#666", fontSize: 12 }}>处理人</div>
              <div style={{ fontWeight: 500 }}>
                {lastReview.handler_name}
                <Tag style={{ marginLeft: 8 }} color="blue" size="small">{lastReview.handler_role_name}</Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ color: "#666", fontSize: 12 }}>操作</div>
              <div style={{ fontWeight: 500 }}>{lastReview.operation_type_name}</div>
            </Col>
            <Col span={6}>
              <div style={{ color: "#666", fontSize: 12 }}>结果</div>
              <div>
                <Tag color={RESULT_COLORS[lastReview.result]}>
                  {RESULT_NAMES[lastReview.result] || lastReview.result}
                </Tag>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ color: "#666", fontSize: 12 }}>处理时间</div>
              <div style={{ fontWeight: 500 }}>{dayjs(lastReview.created_at).format("YYYY-MM-DD HH:mm")}</div>
            </Col>
          </Row>
          <Divider style={{ margin: "12px 0" }} />
          <div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>处理意见</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{lastReview.opinion}</div>
          </div>
          {lastReview.reject_reason && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>驳回/补正原因</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#ff4d4f" }}>{lastReview.reject_reason}</div>
            </div>
          )}
        </Card>
      )}

      <Card
        style={{ marginBottom: 16 }}
        title="证据材料"
        size="small"
        extra={<Tag color={evidences.length > 0 ? "success" : "warning"}>共 {evidences.length} 份</Tag>}
      >
        {evidences.length > 0 ? (
          <Table
            dataSource={evidences}
            columns={evidenceColumns}
            pagination={false}
            size="small"
            rowKey="id"
          />
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
            暂无证据材料
          </div>
        )}
      </Card>

      {reviewRecords.length > 0 && (
        <Card
          style={{ marginBottom: 16 }}
          title="审核复核历史"
          size="small"
        >
          <Timeline
            items={reviewRecords.map((rv: ReviewRecord) => ({
              color: rv.result === "pass" ? "green" : rv.result === "reject" ? "red" : rv.result === "correction" ? "orange" : "blue",
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <Space>
                      <strong>{rv.handler_name}</strong>
                      <Tag color="blue" size="small">{rv.handler_role_name}</Tag>
                      <Tag>{rv.operation_type_name}</Tag>
                      <Tag color={RESULT_COLORS[rv.result]}>{RESULT_NAMES[rv.result] || rv.result}</Tag>
                    </Space>
                    <Space>
                      <Tag>版本 v{rv.version}</Tag>
                      <span style={{ color: "#999" }}>{dayjs(rv.created_at).format("YYYY-MM-DD HH:mm")}</span>
                    </Space>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                    <div>
                      <span style={{ color: "#666" }}>从：</span>
                      <Tag color={STATUS_COLORS[rv.previous_status]}>{rv.previous_status_name}</Tag>
                      <span style={{ color: "#666", margin: "0 8px" }}>→</span>
                      <span style={{ color: "#666" }}>到：</span>
                      <Tag color={STATUS_COLORS[rv.new_status]}>{rv.new_status_name}</Tag>
                    </div>
                  </div>
                  <div style={{ background: "#fafafa", padding: 12, borderRadius: 4 }}>
                    <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>意见：</div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{rv.opinion}</div>
                  </div>
                  {rv.reject_reason && (
                    <div style={{ marginTop: 8, background: "#fff2f0", padding: 12, borderRadius: 4, border: "1px solid #ffccc7" }}>
                      <div style={{ color: "#ff4d4f", fontSize: 12, marginBottom: 4 }}>驳回/补正原因：</div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#ff4d4f" }}>{rv.reject_reason}</div>
                    </div>
                  )}
                </Card>
              ),
            }))}
          />
        </Card>
      )}

      <Card title="操作日志" size="small">
        {operationLogs.length > 0 ? (
          <Table
            dataSource={operationLogs}
            columns={operationLogColumns}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            rowKey="id"
          />
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: "#999" }}>
            暂无操作日志
          </div>
        )}
      </Card>

      <Modal
        title={operationModal.label}
        open={operationModal.open}
        onCancel={() => {
          setOperationModal({ open: false, operation: "", label: "" });
          setIsSubmitting(false);
        }}
        footer={[
          <Button key="cancel" onClick={() => setOperationModal({ open: false, operation: "", label: "" })}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isSubmitting}
            onClick={handleSubmitOperation}
            danger={operationModal.operation.includes("reject")}
          >
            确认{operationModal.label}
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {needOpinion && (
            <Form.Item
              name="opinion"
              label="处理意见"
              rules={[{ required: true, message: "请填写处理意见" }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="请详细填写处理意见..."
                maxLength={1000}
                showCount
              />
            </Form.Item>
          )}
          {needRejectReason && (
            <Form.Item
              name="rejectReason"
              label="驳回/补正原因"
              rules={[{ required: true, message: "请填写驳回或补正原因" }]}
            >
              <Input.TextArea
                rows={3}
                placeholder="请填写驳回或补正的具体原因..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          )}
          {needDeadline && (
            <Form.Item name="deadline" label="要求完成截止时间">
              <DatePicker
                showTime
                style={{ width: "100%" }}
                disabledDate={(current) => current && current < dayjs().startOf("day").toDate()}
              />
            </Form.Item>
          )}
          {operationModal.operation === "submit" && (
            <Form.Item name="handlerId" label="指派审核主管">
              <Select
                placeholder="请选择审核主管"
                options={[
                  { value: 3, label: "王审核 (supervisor1)" },
                  { value: 4, label: "赵审核 (supervisor2)" },
                ]}
              />
            </Form.Item>
          )}
          {operationModal.operation === "review_pass" && (
            <Form.Item name="handlerId" label="指派复核负责人">
              <Select
                placeholder="请选择复核负责人"
                options={[
                  { value: 5, label: "刘复核 (reviewer1)" },
                  { value: 6, label: "陈复核 (reviewer2)" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
