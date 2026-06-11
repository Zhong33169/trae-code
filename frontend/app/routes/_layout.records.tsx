import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { Table, Tag, Button, Input, Select, Form, Row, Col, Card, Space, DatePicker } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiGet } from "~/utils/api.server";
import { SupervisionRecord, Statistics } from "~/types";
import dayjs from "dayjs";
import { useState } from "react";

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { token, user } = await requireAuth(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "10");
  const status = url.searchParams.get("status") || "";
  const projectName = url.searchParams.get("projectName") || "";
  const recordNo = url.searchParams.get("recordNo") || "";
  const scope = url.searchParams.get("scope") || "";

  const params: Record<string, any> = { page, pageSize };
  if (status) params.status = status;
  if (projectName) params.projectName = projectName;
  if (recordNo) params.recordNo = recordNo;
  if (scope) params.scope = scope;

  const [recordsResponse, statsResponse, optionsResponse] = await Promise.all([
    apiGet<{ list: SupervisionRecord[]; total: number }>(token, "/api/records", params),
    apiGet<Statistics>(token, "/api/records/statistics"),
    apiGet<{ statuses: Array<{ value: string; label: string }> }>(token, "/api/records/options"),
  ]);

  return json({
    user,
    records: recordsResponse.data?.list || [],
    total: recordsResponse.data?.total || 0,
    page,
    pageSize,
    statistics: statsResponse.data,
    statusOptions: optionsResponse.data?.statuses || [],
  });
};

export default function RecordsList() {
  const { user, records, total, page, pageSize, statistics, statusOptions } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();

  const handleSearch = (values: any) => {
    const newParams: Record<string, string> = {};
    if (values.status) newParams.status = values.status;
    if (values.projectName) newParams.projectName = values.projectName;
    if (values.recordNo) newParams.recordNo = values.recordNo;
    if (values.scope) newParams.scope = values.scope;
    newParams.page = "1";
    setSearchParams(newParams);
  };

  const handleReset = () => {
    form.resetFields();
    setSearchParams({});
  };

  const handleTableChange = (pagination: any) => {
    const newParams = Object.fromEntries(searchParams.entries());
    newParams.page = pagination.current.toString();
    newParams.pageSize = pagination.pageSize.toString();
    setSearchParams(newParams);
  };

  const columns = [
    {
      title: "记录编号",
      dataIndex: "record_no",
      key: "record_no",
      width: 140,
      render: (text: string, record: SupervisionRecord) => (
        <Link to={`/records/${record.id}`} style={{ color: "#1890ff" }}>
          {text}
        </Link>
      ),
    },
    {
      title: "工程名称",
      dataIndex: "project_name",
      key: "project_name",
      ellipsis: true,
    },
    {
      title: "施工部位",
      dataIndex: "location",
      key: "location",
      ellipsis: true,
    },
    {
      title: "旁站日期",
      dataIndex: "record_date",
      key: "record_date",
      width: 110,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string, record: SupervisionRecord) => (
        <Tag color={STATUS_COLORS[status]}>{record.statusName || status}</Tag>
      ),
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 60,
      render: (v: number) => `v${v}`,
    },
    {
      title: "创建人",
      dataIndex: "created_by_name",
      key: "created_by_name",
      width: 100,
    },
    {
      title: "当前处理人",
      dataIndex: "handler_name",
      key: "handler_name",
      width: 100,
      render: (text: string) => text || "-",
    },
    {
      title: "截止时间",
      dataIndex: "deadline",
      key: "deadline",
      width: 160,
      render: (text: string) => {
        if (!text) return "-";
        const isOverdue = dayjs(text).isBefore(dayjs());
        return (
          <span style={{ color: isOverdue ? "#ff4d4f" : undefined }}>
            {dayjs(text).format("YYYY-MM-DD HH:mm")}
          </span>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: any, record: SupervisionRecord) => (
        <Link to={`/records/${record.id}`}>
          查看
        </Link>
      ),
    },
  ];

  const quickFilters = [
    { label: "全部", key: "all", status: "" },
    { label: "待处理", key: "pending", status: "submitted,corrected,review_passed,needs_correction,evidence_missing,review_rejected,status_conflict" },
    { label: "处理中", key: "processing", status: "in_review,in_final_review" },
    { label: "已通过", key: "passed", status: "review_passed,final_passed,archived" },
    { label: "异常", key: "abnormal", status: "evidence_missing,overdue,status_conflict" },
  ];

  const [activeFilter, setActiveFilter] = useState(searchParams.get("status") || "all");

  const handleQuickFilter = (status: string, key: string) => {
    setActiveFilter(key);
    const newParams: Record<string, string> = {};
    if (status) newParams.status = status;
    newParams.page = "1";
    setSearchParams(newParams);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>旁站记录单</h2>
        {user.role === "registrar" && (
          <Link to="/records/new">
            <Button type="primary" icon={<PlusOutlined />}>
              新建记录
            </Button>
          </Link>
        )}
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            {quickFilters.map((item) => (
              <Button
                key={item.key}
                type={activeFilter === item.key ? "primary" : "default"}
                onClick={() => handleQuickFilter(item.status, item.key)}
                style={{ marginRight: 8 }}
              >
                {item.label}
                {item.key !== "all" && statistics?.byStatus?.[item.status.split(',')[0]] !== undefined && (
                  <Tag style={{ marginLeft: 4 }}>
                    {item.status.split(',').reduce((sum, s) => sum + (statistics.byStatus[s] || 0), 0)}
                  </Tag>
                )}
              </Button>
            ))}
          </div>

          <Form form={form} layout="inline" onFinish={handleSearch}>
            <Form.Item name="status" label="状态">
              <Select
                placeholder="请选择状态"
                style={{ width: 150 }}
                allowClear
                options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
              />
            </Form.Item>
            <Form.Item name="projectName" label="工程名称">
              <Input placeholder="请输入工程名称" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="recordNo" label="记录编号">
              <Input placeholder="请输入记录编号" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="scope" label="范围">
              <Select
                placeholder="全部记录"
                style={{ width: 120 }}
                allowClear
                options={[
                  { value: "my", label: "我的记录" },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  搜索
                </Button>
                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
