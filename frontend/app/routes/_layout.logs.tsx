import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Table, Tag, Card, Input, Select, Form, Button, Space } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiGet } from "~/utils/api.server";
import { OperationLog } from "~/types";
import dayjs from "dayjs";
import { useState } from "react";
import { useSearchParams } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { token } = await requireAuth(request);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const operationType = url.searchParams.get("operationType") || "";

  const params: Record<string, any> = { page, pageSize };
  if (operationType) params.operationType = operationType;

  const response = await apiGet<{ list: OperationLog[]; total: number }>(token, "/api/logs", params);

  return json({
    logs: response.data?.list || [],
    total: response.data?.total || 0,
    page,
    pageSize,
  });
};

export default function OperationLogs() {
  const { logs, total, page, pageSize } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();

  const handleSearch = (values: any) => {
    const newParams: Record<string, string> = {};
    if (values.operationType) newParams.operationType = values.operationType;
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

  const operationTypeOptions = [
    { value: "create", label: "创建记录" },
    { value: "submit", label: "提交审核" },
    { value: "review", label: "开始审核" },
    { value: "review_pass", label: "审核通过" },
    { value: "review_reject", label: "审核驳回" },
    { value: "request_correction", label: "退回补正" },
    { value: "correct", label: "补正材料" },
    { value: "resubmit", label: "再次提交" },
    { value: "final_review", label: "开始复核" },
    { value: "final_pass", label: "复核通过" },
    { value: "final_reject", label: "复核驳回" },
    { value: "archive", label: "归档" },
    { value: "mark_evidence_missing", label: "标记缺证据" },
    { value: "mark_overdue", label: "标记逾期" },
    { value: "mark_status_conflict", label: "标记状态冲突" },
    { value: "update", label: "更新记录" },
    { value: "login", label: "登录" },
    { value: "logout", label: "退出" },
  ];

  const columns = [
    {
      title: "操作时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "关联记录",
      dataIndex: "record_no",
      key: "record_no",
      width: 130,
      render: (text: string, record: OperationLog) => 
        text ? (
          <Link to={`/records/${record.record_id}`} style={{ color: "#1890ff" }}>
            {text}
          </Link>
        ) : "-",
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
      width: 140,
      render: (text: string, record: OperationLog) => {
        const colors: Record<string, string> = {
          create: "default",
          submit: "blue",
          review_pass: "success",
          final_pass: "success",
          review_reject: "error",
          final_reject: "error",
          request_correction: "warning",
          mark_evidence_missing: "warning",
          mark_status_conflict: "magenta",
          mark_overdue: "red",
          login: "green",
          logout: "default",
        };
        return <Tag color={colors[record.operation_type]}>{text}</Tag>;
      },
    },
    {
      title: "操作描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "IP地址",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 120,
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>操作日志</h2>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="operationType" label="操作类型">
            <Select
              placeholder="请选择操作类型"
              style={{ width: 180 }}
              allowClear
              options={operationTypeOptions}
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
      </Card>

      <Card>
        <Table
          dataSource={logs}
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
        />
      </Card>
    </div>
  );
}
