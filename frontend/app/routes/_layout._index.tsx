import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Row, Col, Card, Statistic, Table, Tag, Space, Button } from "antd";
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { requireAuth } from "~/utils/auth.server";
import { apiGet } from "~/utils/api.server";
import { SupervisionRecord, Statistics, OperationLog } from "~/types";
import dayjs from "dayjs";

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
  
  const [statsResponse, myRecordsResponse, recentLogsResponse] = await Promise.all([
    apiGet<Statistics>(token, "/api/records/statistics"),
    apiGet<{ list: SupervisionRecord[] }>(token, "/api/records", { 
      scope: "my", 
      pageSize: 5 
    }),
    apiGet<{ list: OperationLog[] }>(token, "/api/logs", { pageSize: 10 }),
  ]);

  return json({
    user,
    statistics: statsResponse.data,
    myRecords: myRecordsResponse.data?.list || [],
    recentLogs: recentLogsResponse.data?.list || [],
  });
};

export default function Dashboard() {
  const { user, statistics, myRecords, recentLogs } = useLoaderData<typeof loader>();

  const statsCards = [
    {
      title: "待我处理",
      value: statistics.myPending,
      icon: <ClockCircleOutlined style={{ color: "#1890ff", fontSize: 32 }} />,
      color: "#e6f7ff",
    },
    {
      title: "我创建的",
      value: statistics.myCreated,
      icon: <FileTextOutlined style={{ color: "#52c41a", fontSize: 32 }} />,
      color: "#f6ffed",
    },
    {
      title: "已通过",
      value: (statistics.byStatus?.final_passed || 0) + (statistics.byStatus?.review_passed || 0),
      icon: <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 32 }} />,
      color: "#f6ffed",
    },
    {
      title: "异常状态",
      value: (statistics.byStatus?.evidence_missing || 0) + 
             (statistics.byStatus?.overdue || 0) + 
             (statistics.byStatus?.status_conflict || 0),
      icon: <ExclamationCircleOutlined style={{ color: "#fa8c16", fontSize: 32 }} />,
      color: "#fff7e6",
    },
  ];

  const todoItems = [
    {
      label: "待审核",
      count: statistics.todoCounts?.pendingReview || 0,
      status: "submitted",
      roles: ["supervisor"],
    },
    {
      label: "审核中",
      count: statistics.todoCounts?.inReview || 0,
      status: "in_review",
      roles: ["supervisor"],
    },
    {
      label: "待复核",
      count: statistics.todoCounts?.pendingFinal || 0,
      status: "review_passed",
      roles: ["reviewer"],
    },
    {
      label: "复核中",
      count: statistics.todoCounts?.inFinal || 0,
      status: "in_final_review",
      roles: ["reviewer"],
    },
    {
      label: "需补正",
      count: statistics.todoCounts?.needCorrection || 0,
      status: "needs_correction",
      roles: ["registrar"],
    },
    {
      label: "草稿",
      count: statistics.todoCounts?.draft || 0,
      status: "draft",
      roles: ["registrar"],
    },
  ].filter(item => item.roles.includes(user.role));

  const recordColumns = [
    {
      title: "记录编号",
      dataIndex: "record_no",
      key: "record_no",
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
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string, record: SupervisionRecord) => (
        <Tag color={STATUS_COLORS[status]}>{record.statusName || status}</Tag>
      ),
    },
    {
      title: "处理人",
      dataIndex: "handler_name",
      key: "handler_name",
      render: (text: string) => text || "-",
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text: string) => dayjs(text).format("YYYY-MM-DD HH:mm"),
    },
  ];

  const logColumns = [
    {
      title: "操作时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (text: string) => dayjs(text).format("MM-DD HH:mm:ss"),
    },
    {
      title: "操作人",
      dataIndex: "user_name",
      key: "user_name",
      width: 100,
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
      ellipsis: true,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>
          欢迎回来，{user.name}！
          <Tag style={{ marginLeft: 8 }} color="blue">{user.roleName}</Tag>
        </h2>
        <p style={{ color: "#666", margin: 0 }}>
          今天是 {dayjs().format("YYYY年MM月DD日 dddd")}
        </p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statsCards.map((card, idx) => (
          <Col xs={12} md={6} key={idx}>
            <Card bodyStyle={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: card.color,
                  }}
                >
                  {card.icon}
                </div>
                <Statistic title={card.title} value={card.value} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {todoItems.length > 0 && (
        <Card
          title="待办事项"
          style={{ marginBottom: 24 }}
          extra={
            <Link to="/records">
              查看全部 <ArrowRightOutlined />
            </Link>
          }
        >
          <Row gutter={[16, 16]}>
            {todoItems.map((item, idx) => (
              <Col xs={12} md={8} key={idx}>
                <Card 
                  size="small"
                  style={{ 
                    background: item.count > 0 ? "#fffbe6" : "#fafafa",
                    border: item.count > 0 ? "1px solid #ffe58f" : "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666" }}>{item.label}</span>
                    <Tag color={STATUS_COLORS[item.status]}>{item.count}</Tag>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="我的旁站记录单"
            extra={
              <Link to="/records?scope=my">
                查看全部 <ArrowRightOutlined />
              </Link>
            }
          >
            {myRecords.length > 0 ? (
              <Table
                dataSource={myRecords}
                columns={recordColumns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                暂无记录
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="最近操作"
            extra={
              <Link to="/logs">
                查看全部 <ArrowRightOutlined />
              </Link>
            }
          >
            {recentLogs.length > 0 ? (
              <Table
                dataSource={recentLogs}
                columns={logColumns}
                pagination={false}
                size="small"
                rowKey="id"
                showHeader={false}
              />
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                暂无操作记录
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
