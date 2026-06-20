import { createSignal, Component } from "solid-js";
import { useNavigate, Navigate } from "@solidjs/router";
import { useApp } from "../lib/store";
import { api } from "../lib/api";

const Login: Component = () => {
  const app = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  if (app.token()) {
    return <Navigate href="/bills" />;
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.login(username(), password());
      app.setToken(response.access_token);
      app.setUser(response.user);
      navigate("/bills");
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <h2>⚡ 能耗账单管理系统</h2>
        <p class="subtitle">登录后开始处理能耗账单流程</p>

        {error() && <div class="alert alert-error">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: "100%" }}
            disabled={loading()}
          >
            {loading() ? <span class="spinner"></span> : "登 录"}
          </button>
        </form>

        <div class="test-accounts">
          <h4>测试账号（点击快速填充）:</h4>
          <div class="test-account-item" onClick={() => fillCredentials("registrar", "123456")}>
            <span>registrar / 123456</span>
            <span class="role">能耗账登记员</span>
          </div>
          <div class="test-account-item" onClick={() => fillCredentials("auditor", "123456")}>
            <span>auditor / 123456</span>
            <span class="role">能耗账审核主管</span>
          </div>
          <div class="test-account-item" onClick={() => fillCredentials("property", "123456")}>
            <span>property / 123456</span>
            <span class="role">产业园物业复核负责人</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
