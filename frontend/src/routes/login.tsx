import { A, useNavigate } from "@solidjs/router";
import { createSignal, createEffect, onMount } from "solid-js";
import { api } from "../lib/api";

const DEMO_USERS = [
  { username: "registrar01", name: "张伟", role: "registrar", label: "授信登记员", pwd: "123456", desc: "发起/补正申请" },
  { username: "registrar02", name: "李娜", role: "registrar", label: "授信登记员", pwd: "123456", desc: "发起/补正申请" },
  { username: "auditor01", name: "王强", role: "auditor", label: "授信审核主管", pwd: "123456", desc: "核验办理" },
  { username: "auditor02", name: "刘芳", role: "auditor", label: "授信审核主管", pwd: "123456", desc: "核验办理" },
  { username: "reviewer01", name: "陈明", role: "reviewer", label: "B2B复核负责人", pwd: "123456", desc: "复核归档" },
  { username: "reviewer02", name: "赵雪", role: "reviewer", label: "B2B复核负责人", pwd: "123456", desc: "复核归档" },
];

export default function Login() {
  const [username, setUsername] = createSignal("registrar01");
  const [password, setPassword] = createSignal("123456");
  const [loading, setLoading] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [selRole, setSelRole] = createSignal("registrar");
  const nav = useNavigate();

  onMount(() => {
    try {
      const u = localStorage.getItem("credit_user");
      if (u) { nav("/"); }
    } catch {}
  });

  const pickUser = (u) => {
    setUsername(u.username);
    setPassword(u.pwd);
    setSelRole(u.role);
    setErr("");
  };

  const visibleUsers = () => DEMO_USERS.filter(u => u.role === selRole()).slice(0, 2);

  const doLogin = async (e) => {
    e.preventDefault();
    if (!username() || !password()) { setErr("请输入账号和密码"); return; }
    setLoading(true); setErr("");
    try {
      const r = await api.login(username(), password());
      if (r.ok) {
        api.saveUser(r.data);
        nav("/");
      } else {
        setErr(r.msg || "登录失败");
      }
    } catch (e) { setErr("网络错误，请检查后端服务是否启动"); }
    finally { setLoading(false); }
  };

  return (
    <div class="login-wrap">
      <div class="login-box">
        <div class="login-logo">CR</div>
        <h1 class="login-title">授信申请审批系统</h1>
        <p class="login-sub">B2B 批发平台 · 三级审批流程</p>

        <div>
          <div class="form-label">选择角色</div>
          <div class="role-switch">
            {(["registrar","auditor","reviewer"]).map(r => (
              <div class={"role-option" + (selRole()===r ? " active" : "")} onClick={() => setSelRole(r)}>
                <strong>{({registrar:"登记员",auditor:"审核主管",reviewer:"复核负责人"}[r])}</strong>
                <small>{({registrar:"发起/补正",auditor:"核验办理",reviewer:"复核归档"}[r])}</small>
              </div>
            ))}
          </div>

          <div class="form-label" style="margin-bottom:8px">快速选择（点击自动填充）</div>
          <div style="display:flex; gap:8px; margin-bottom:20px; flex-wrap: wrap">
            {visibleUsers().map(u => (
              <button type="button" class="btn btn-default btn-sm" onClick={() => pickUser(u)}>
                {u.name}（{u.username}）
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={doLogin}>
          <div class="form-group">
            <label class="form-label">账号</label>
            <input class="form-input" value={username()} onInput={e => setUsername(e.target.value)} placeholder="请输入账号" />
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input class="form-input" type="password" value={password()} onInput={e => setPassword(e.target.value)} placeholder="默认 123456" />
          </div>
          <div class="form-error">{err()}</div>
          <button class="btn btn-primary" style="width:100%; margin-top:8px; padding:11px; font-size:14px" disabled={loading()}>
            {loading() ? "登录中..." : "登 录"}
          </button>
        </form>
        <div style="text-align:center; font-size:12px; color:#9ca3af; margin-top:18px">
          默认端口：前端 3004 / 后端 8004
        </div>
      </div>
    </div>
  );
}
