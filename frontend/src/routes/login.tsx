import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { authStore } from "~/store/auth";
import { showToast } from "~/store/toast";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  onMount(() => {
    if (authStore.token()) {
      navigate("/tasks", { replace: true });
    }
  });

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    if (!username() || !password()) {
      showToast("请输入用户名和密码", "warning");
      return;
    }

    setLoading(true);
    try {
      const result = await api.login(username(), password());
      authStore.setAuth(result.data.user, result.data.token);
      showToast("登录成功", "success");
      navigate("/tasks", { replace: true });
    } catch (err: any) {
      showToast(err.message || "登录失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (user: string, pwd: string) => {
    setUsername(user);
    setPassword(pwd);
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <h2>🌾 农业合作社</h2>
        <p class="subtitle">节点超时追踪种植任务系统</p>

        <form onSubmit={handleLogin}>
          <div class="form-item">
            <label class="form-label required">用户名</label>
            <input
              type="text"
              class="form-input"
              placeholder="请输入用户名"
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
            />
          </div>

          <div class="form-item">
            <label class="form-label required">密码</label>
            <input
              type="password"
              class="form-input"
              placeholder="请输入密码"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block"
            disabled={loading()}
          >
            {loading() ? "登录中..." : "登 录"}
          </button>
        </form>

        <div class="login-tips">
          <p><strong>测试账号：</strong></p>
          <p>
            种植登记员：
            <a href="#" onClick={() => quickLogin("registrar", "123456")}>registrar / 123456</a>
          </p>
          <p>
            种植审核主管：
            <a href="#" onClick={() => quickLogin("auditor", "123456")}>auditor / 123456</a>
          </p>
          <p>
            复核负责人：
            <a href="#" onClick={() => quickLogin("reviewer", "123456")}>reviewer / 123456</a>
          </p>
        </div>
      </div>
    </div>
  );
}
