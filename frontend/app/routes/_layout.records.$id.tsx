import { json, LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useRevalidator, Link, useFetcher } from "@remix-run/react";
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
  Table,
  Timeline,
  Row,
  Col,
  Divider,
  App,
  message,
  Popconfirm,
  List,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  CameraOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiGet, apiPost, apiDelete } from "~/utils/api.server";
import { RecordDetailResponse, Evidence, ReviewRecord, OperationLog, SupervisionRecord } from "~/types";
import dayjs from "dayjs";
import { useState, useEffect } from "react";

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

const EVIDENCE_TYPE_OPTIONS = [
  { value: "photo", label: "照片" },
  { value: "video", label: "视频" },
  { value: "document", label: "文档" },
  { value: "signature", label: "签字" },
  { value: "other", label: "其他" },
];

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
  correction: "补正要求",
  process: "处理中",
  corrected: "已补正",
  conflict: "冲突",
};

type EvidenceFormItem = {
  type: string;
  name: string;
  description?: string;
  fileUrl: string;
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { token } = await requireAuth(request);
  const response = await apiGet<RecordDetailResponse>(token, `/api/records/${params.id}`);
  if (response.code !== 200) {
    throw new Error(response.message || "获取记录详情失败");
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
    const evidencesStr = formData.get("evidences") as string;
    
    const body: any = { operation, opinion, rejectReason, version };
    if (deadline) body.deadline = deadline;
    if (handlerId) body.handlerId = handlerId;
    if (evidencesStr) {
      try {
        const evidences = JSON.parse(evidencesStr);
        if (Array.isArray(evidences) && evidences.length > 0) {
          body.evidences = evidences;
        }
      } catch (e) {
        console.error("解析证据数据失败", e);
      }
    }

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
  const initialData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const revalidator = useRevalidator();
  const { message: messageApi } = App.useApp();
  
  const [operationModal, setOperationModal] = useState<{ open: boolean; operation: string; label: string }>({ open: false, operation: "", label: "" });
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEvidences, setNewEvidences] = useState<EvidenceFormItem[]>([]);
  
  const [pageData, setPageData] = useState(initialData);

  useEffect(() => {
    setPageData(initialData);
  }, [initialData]);

  const { record, evidences, reviewRecords, operationLogs, availableOperations, lastReview } = pageData;

  useEffect(() => {
    if (actionData && "code" in actionData) {
      if (actionData.code === 200) {
        messageApi.success(`${operationModal.label}成功`);
        setOperationModal({ open: false, operation: "", label: "" });
        setIsSubmitting(false);
        setNewEvidences([]);
        form.resetFields();
        if ((actionData as any).record) {
          setPageData({
            record: (actionData as any).record,
            evidences: (actionData as any).evidences || evidences,
            reviewRecords: (actionData as any).reviewRecords || reviewRecords,
            operationLogs: (actionData as any).operationLogs || operationLogs,
            availableOperations: (actionData as any).availableOperations || [],
            lastReview: (actionData as any).lastReview || lastReview,
          });
        } else {
          revalidator.revalidate();
        }
      } else {
        messageApi.error(actionData.message || "操作失败");
        setIsSubmitting(false);
      }
    }
  }, [actionData]);

  const handleOperation = (op: string, label: string) => {
    setOperationModal({ open: true, operation: op, label });
    setNewEvidences([]);
    form.resetFields();
  };

  const addEvidenceItem = () => {
    setNewEvidences([
      ...newEvidences,
      { type: "photo", name: "", description: "", fileUrl: `/demo/evidence-${Date.now()}.jpg` },
    ]);
  };

  const removeEvidenceItem = (index: number) => {
    const updated = [...newEvidences];
    updated.splice(index, 1);
    setNewEvidences(updated);
  };

  const updateEvidenceItem = (index: number, field: keyof EvidenceFormItem, value: any) => {
    const updated = [...newEvidences];
    updated[index] = { ...updated[index], [field]: value };
    setNewEvidences(updated);
  };

  const handleSubmitOperation = async () => {
    try {
      const values = await form.validateFields();
      
      const needEvidences = ["correct", "resubmit"].includes(operationModal.operation);
      if (needEvidences && operationModal.operation === "correct") {
        const hasPhoto = [...(evidences || []), ...newEvidences].some(e => e.type === "photo");
        if (!hasPhoto) {
          messageApi.warning("至少需要包含1份照片证据，请补充证据材料");
          return;
        }
      }
      
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
      if (newEvidences.length > 0 && needEvidences) {
        addField('evidences', JSON.stringify(newEvidences));
      }
      
      document.body.appendChild(formEl);
      formEl.submit();
    } catch (e: any) {
      if (e?.errorFields) {
        messageApi.error("请填写必填项");
      } else {
        messageApi.error("提交失败，请检查填写内容");
      }
    }
  };

  const needOpinion = ["review_pass", "review_reject", "request_correction", "mark_evidence_missing", "mark_status_conflict", "final_pass", "final_reject", "correct"].includes(operationModal.operation);
  const needRejectReason = ["review_reject", "request_correction", "mark_evidence_missing", "mark_status_conflict", "final_reject"].includes(operationModal.operation);
  const needDeadline = ["review", "final_review", "correct", "mark_evidence_missing", "request_correction"].includes(operationModal.operation);
  const showEvidences = ["correct", "resubmit"].includes(operationModal.operation);
  const opIsCorrect = operationModal.operation === "correct";

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
      render: (text: string, lrecord: OperationLog) => (
        <Space>
          {text}
          <Tag color="blue" size="small">{lrecord.user_role_name}</Tag>
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
          <Space wrap>
            {availableOperations && availableOperations.length > 0 && availableOperations.map((op: any) => (
              <Button
                key={op.operation}
                type={op.operation.includes("pass") ? "primary" : "default"}
                danger={op.operation.includes("reject")}
                onClick={() => handleOperation(op.operation, op.label)}
                icon={
                  op.operation.includes("pass") ? <CheckCircleOutlined /> :
                  op.operation.includes("reject") ? <CloseCircleOutlined /> :
                  op.operation.includes("correction") || op.operation === "correct" ? <ExclamationCircleOutlined /> :
                  undefined
                }
              >
                {op.label}
              </Button>
            ))}
            {record.status === "draft" && (
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
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: "#fa8c16" }} />
              <span style={{ color: "#fa8c16" }}>上一处理人意见（请参考此内容进行办理）</span>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16, border: "1px solid #ffd591", background: "#fffbe6" } as any}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <div style={{ color: "#666", fontSize: 12 }}>处理人</div>
              <div style={{ fontWeight: 500 }}>
                {lastReview.handler_name}
                <Tag style={{ marginLeft: 8 }} color="blue" size="small">{lastReview.handler_role_name}</Tag>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ color: "#666", fontSize: 12 }}>操作类型</div>
              <div style={{ fontWeight: 500 }}>{lastReview.operation_type_name}</div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ color: "#666", fontSize: 12 }}>办理结果</div>
              <div>
                <Tag color={RESULT_COLORS[lastReview.result]}>
                  {RESULT_NAMES[lastReview.result] || lastReview.result}
                </Tag>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ color: "#666", fontSize: 12 }}>处理时间</div>
              <div style={{ fontWeight: 500 }}>{dayjs(lastReview.created_at).format("YYYY-MM-DD HH:mm")}</div>
            </Col>
          </Row>
          <Divider style={{ margin: "12px 0" }} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>处理意见：</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, background: "white", padding: 12, borderRadius: 4 }}>{lastReview.opinion}</div>
          </div>
          {lastReview.reject_reason && (
            <div>
              <div style={{ color: "#ff4d4f", fontSize: 12, marginBottom: 4 }}>驳回/补正原因：</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, color: "#ff4d4f", background: "#fff2f0", padding: 12, borderRadius: 4 }}>{lastReview.reject_reason}</div>
            </div>
          )}
        </Card>
      )}

      <Card
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <FileImageOutlined />
            <span>证据材料</span>
            <Tag color={evidences && evidences.length > 0 ? "success" : "warning"}>共 {evidences?.length || 0} 份</Tag>
            {showEvidences && (
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEvidenceItem}>
                新增证据
              </Button>
            )}
          </Space>
        }
        size="small"
      >
        {showEvidences && newEvidences.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: "#e6f7ff", borderRadius: 4, border: "1px solid #91d5ff" }}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: "#1890ff" }}>
              待提交的新证据（{newEvidences.length} 份）
            </div>
            <List
              size="small"
              bordered
              dataSource={newEvidences}
              renderItem={(item, index) => (
                <List.Item
                  actions={[
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeEvidenceItem(index)}>
                      删除
                    </Button>
                  ]}
                >
                  <div style={{ width: "100%" }}>
                    <Row gutter={8} align="middle">
                      <Col xs={24} sm={8} md={5} style={{ marginBottom: 4 }}>
                        <Select
                          size="small"
                          value={item.type}
                          onChange={(v) => updateEvidenceItem(index, "type", v)}
                          options={EVIDENCE_TYPE_OPTIONS}
                          style={{ width: "100%" }}
                        />
                      </Col>
                      <Col xs={24} sm={16} md={7} style={{ marginBottom: 4 }}>
                        <Input
                          size="small"
                          placeholder="证据名称"
                          value={item.name}
                          onChange={(e) => updateEvidenceItem(index, "name", e.target.value)}
                        />
                      </Col>
                      <Col xs={24} sm={16} md={8} style={{ marginBottom: 4 }}>
                        <Input
                          size="small"
                          placeholder="描述（选填）"
                          value={item.description}
                          onChange={(e) => updateEvidenceItem(index, "description", e.target.value)}
                        />
                      </Col>
                      <Col xs={24} sm={8} md={4}>
                        <Input
                          size="small"
                          placeholder="文件标识/URL"
                          value={item.fileUrl}
                          onChange={(e) => updateEvidenceItem(index, "fileUrl", e.target.value)}
                        />
                      </Col>
                    </Row>
                    {!item.name && (
                      <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}>请填写证据名称</div>
                    )}
                  </div>
                </List.Item>
              )}
            />
            {opIsCorrect && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#fa8c16" }}>
                提示：补正提交时必须包含至少1份照片证据
              </div>
            )}
          </div>
        )}
        {evidences && evidences.length > 0 ? (
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
            {showEvidences && (
              <div style={{ marginTop: 8 }}>
                点击上方"新增证据"按钮添加
              </div>
            )}
          </div>
        )}
      </Card>

      {reviewRecords && reviewRecords.length > 0 && (
        <Card
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <CheckCircleOutlined />
              <span>审核复核历史</span>
            </Space>
          }
          size="small"
        >
          <Timeline
            mode="left"
            items={reviewRecords.map((rv: ReviewRecord) => ({
              color: rv.result === "pass" ? "green" : rv.result === "reject" ? "red" : rv.result === "correction" || rv.result === "corrected" ? "orange" : "blue",
              children: (
                <Card size="small" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <Space wrap>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
                    <div>
                      <span style={{ color: "#666" }}>状态流转：</span>
                      <Tag color={STATUS_COLORS[rv.previous_status]}>{rv.previous_status_name}</Tag>
                      <span style={{ color: "#666", margin: "0 8px" }}>→</span>
                      <Tag color={STATUS_COLORS[rv.new_status]}>{rv.new_status_name}</Tag>
                    </div>
                  </div>
                  {rv.opinion && (
                    <div style={{ background: "#fafafa", padding: 12, borderRadius: 4, marginBottom: 8 }}>
                      <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>处理意见：</div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{rv.opinion}</div>
                    </div>
                  )}
                  {rv.reject_reason && (
                    <div style={{ background: "#fff2f0", padding: 12, borderRadius: 4, border: "1px solid #ffccc7" }}>
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

      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>操作日志</span>
          </Space>
        }
        size="small"
      >
        {operationLogs && operationLogs.length > 0 ? (
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
        title={
          <Space>
            {operationModal.operation.includes("pass") ? <CheckCircleOutlined style={{ color: "#52c41a" }} /> :
             operationModal.operation.includes("reject") ? <CloseCircleOutlined style={{ color: "#ff4d4f" }} /> :
             opIsCorrect ? <ExclamationCircleOutlined style={{ color: "#fa8c16" }} /> : null}
            {operationModal.label}
          </Space>
        }
        open={operationModal.open}
        onCancel={() => {
          setOperationModal({ open: false, operation: "", label: "" });
          setIsSubmitting(false);
          setNewEvidences([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setOperationModal({ open: false, operation: "", label: "" });
            setNewEvidences([]);
          }}>
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
        width={showEvidences ? 800 : 600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {showEvidences && opIsCorrect && (
            <Alert
              message="补正要求"
              description={lastReview ? `上一处理人：${lastReview.handler_name} 要求：${lastReview.reject_reason || lastReview.opinion}` : "请根据上一环节意见补正相关内容，并补充相应证据材料"}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {needOpinion && (
            <Form.Item
              name="opinion"
              label={opIsCorrect ? "补正说明/处理意见" : "处理意见"}
              rules={[{ required: true, message: "请填写处理意见" }]}
            >
              <Input.TextArea
                rows={4}
                placeholder={opIsCorrect ? "请详细填写补正情况说明、整改措施等..." : "请详细填写处理意见..."}
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
          {showEvidences && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                补充证据材料
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEvidenceItem} style={{ marginLeft: 8 }}>
                  添加证据
                </Button>
                <span style={{ color: "#999", marginLeft: 8, fontSize: 12 }}>（至少需要1份照片证据）</span>
              </div>
              {newEvidences.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#999", border: "1px dashed #d9d9d9", borderRadius: 4 }}>
                  暂无新增证据，点击上方"添加证据"按钮添加
                </div>
              ) : (
                <List
                  size="small"
                  bordered
                  dataSource={newEvidences}
                  renderItem={(item, index) => (
                    <List.Item
                      actions={[
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeEvidenceItem(index)}>
                          删除
                        </Button>
                      ]}
                    >
                      <div style={{ width: "100%" }}>
                        <Row gutter={[8, 8]} align="middle">
                          <Col xs={24} sm={12} md={6}>
                            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>证据类型 *</div>
                            <Select
                              size="small"
                              value={item.type}
                              onChange={(v) => updateEvidenceItem(index, "type", v)}
                              options={EVIDENCE_TYPE_OPTIONS}
                              style={{ width: "100%" }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={8}>
                            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>证据名称 *</div>
                            <Input
                              size="small"
                              placeholder="证据名称（必填）"
                              value={item.name}
                              onChange={(e) => updateEvidenceItem(index, "name", e.target.value)}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={6}>
                            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>描述</div>
                            <Input
                              size="small"
                              placeholder="证据描述（选填）"
                              value={item.description}
                              onChange={(e) => updateEvidenceItem(index, "description", e.target.value)}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <div style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>文件标识</div>
                            <Input
                              size="small"
                              placeholder="文件URL/标识"
                              value={item.fileUrl}
                              onChange={(e) => updateEvidenceItem(index, "fileUrl", e.target.value)}
                            />
                          </Col>
                        </Row>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
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
                placeholder="请选择审核主管（可不选，系统自动分配）"
                allowClear
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
                placeholder="请选择复核负责人（可不选）"
                allowClear
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

function Alert(props: any) {
  return (
    <div style={{
      padding: "12px 16px",
      borderRadius: 4,
      background: props.type === "warning" ? "#fffbe6" : "#e6f7ff",
      border: `1px solid ${props.type === "warning" ? "#ffe58f" : "#91d5ff"}`,
    }}>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{props.message}</div>
      <div style={{ fontSize: 13 }}>{props.description}</div>
    </div>
  );
}
