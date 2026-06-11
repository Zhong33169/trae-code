import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useActionData, useNavigation, useSubmit } from "@remix-run/react";
import { Form as AntForm, Input, Button, Card } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { API_BASE_URL, getSession, commitSession } from "~/utils/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("token")) {
    throw redirect("/");
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.code !== 200) {
      return json({ error: data.message }, { status: 400 });
    }

    const session = await getSession(request.headers.get("Cookie"));
    session.set("token", data.data.token);

    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch {
    return json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [form] = AntForm.useForm();
  const isSubmitting = navigation.state === "submitting";

  const onFinish = (values: any) => {
    submit(values, { method: "post" });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}
        title={
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <h2 style={{ margin: 0, color: "#1890ff", fontSize: 20 }}>
              工程监理旁站记录系统
            </h2>
            <p style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
              异常申诉复核旁站记录单管理平台
            </p>
          </div>
        }
      >
        {actionData?.error && (
          <div
            style={{
              color: "#ff4d4f",
              marginBottom: 16,
              textAlign: "center",
              padding: "8px 12px",
              background: "#fff2f0",
              borderRadius: 4,
              border: "1px solid #ffccc7",
            }}
          >
            {actionData.error}
          </div>
        )}

        <AntForm
          form={form}
          layout="vertical"
          initialValues={{ username: "registrar1", password: "123456" }}
          onFinish={onFinish}
        >
          <AntForm.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
              autoComplete="username"
            />
          </AntForm.Item>

          <AntForm.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              size="large"
              autoComplete="current-password"
            />
          </AntForm.Item>

          <AntForm.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={isSubmitting}
              style={{ marginTop: 8, height: 44 }}
            >
              登 录
            </Button>
          </AntForm.Item>
        </AntForm>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #f0f0f0",
          }}
        >
          <p style={{ margin: "0 0 10px", color: "#999", fontSize: 12 }}>
            测试账号（密码均为 123456）：
          </p>
          <div
            style={{
              fontSize: 12,
              color: "#555",
              lineHeight: 2,
              padding: "8px 12px",
              background: "#fafafa",
              borderRadius: 4,
            }}
          >
            <div>
              <strong style={{ color: "#1890ff" }}>旁站记录登记员：</strong>
              registrar1 / registrar2
            </div>
            <div>
              <strong style={{ color: "#fa8c16" }}>旁站记录审核主管：</strong>
              supervisor1 / supervisor2
            </div>
            <div>
              <strong style={{ color: "#52c41a" }}>监理公司复核负责人：</strong>
              reviewer1 / reviewer2
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
