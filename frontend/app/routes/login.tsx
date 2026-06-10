import React, { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { validateRequired } from "~/utils/helpers";
import { ROLE_LABELS } from "~/config";
import { LayoutContent } from "~/root";

export function meta() {
  return [{ title: "登录 - 充电桩巡检系统" }];
}

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const usernameError = validateRequired(username);
    const passwordError = validateRequired(password);
    if (usernameError) newErrors.username = usernameError;
    if (passwordError) newErrors.password = passwordError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await login(username.trim(), password);
      success(`欢迎回来，${response.user.full_name}！`);
      navigate("/", { replace: true });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "登录失败，请检查用户名和密码";
      error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "12px 16px",
    border: `1px solid ${errors[field] ? "#ef4444" : "#d1d5db"}`,
    borderRadius: "8px",
    fontSize: "15px",
    boxSizing: "border-box",
    transition: "all 0.2s",
  });

  return (
    <LayoutContent>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            backgroundColor: "#fff",
            borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            padding: "40px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>⚡</div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              充电桩巡检系统
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              Charging Pile Inspection System
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) {
                    setErrors((prev) => ({ ...prev, username: "" }));
                  }
                }}
                placeholder="请输入用户名"
                style={inputStyle("username")}
                disabled={loading}
                autoComplete="username"
              />
              {errors.username && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#ef4444",
                    marginTop: "6px",
                  }}
                >
                  {errors.username}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }
                }}
                placeholder="请输入密码"
                style={inputStyle("password")}
                disabled={loading}
                autoComplete="current-password"
              />
              {errors.password && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#ef4444",
                    marginTop: "6px",
                  }}
                >
                  {errors.password}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "8px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#2563eb";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  (e.target as HTMLButtonElement).style.backgroundColor = "#3b82f6";
                }
              }}
            >
              {loading ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  登录中...
                </span>
              ) : (
                "登 录"
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: "32px",
              paddingTop: "24px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                textAlign: "center",
                marginBottom: "12px",
              }}
            >
              测试账号（密码均为 123456）
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div
                  key={role}
                  onClick={() => {
                    setUsername(role);
                    setPassword("123456");
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f9fafb";
                  }}
                >
                  <span style={{ color: "#374151", fontWeight: 500 }}>{role}</span>
                  <span style={{ color: "#6b7280" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LayoutContent>
  );
}

export default LoginPage;
