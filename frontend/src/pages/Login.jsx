import { createSignal, onMount } from 'solid-js';
import { useNavigate } from '../router/index.js';
import { expenseApi } from '../api/expenseApi';
import { useAuth } from '../stores/authStore';
import { useToast } from '../stores/toastStore';

function Login() {
  const [users, setUsers] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const navigate = useNavigate();
  const { login, setUser } = useAuth();
  const toast = useToast();

  onMount(async () => {
    try {
      const res = await expenseApi.getUsers();
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err) {
      toast.error(err.message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  });

  const handleLogin = (user) => {
    login(user.id);
    setUser(user);
    toast.success(`已切换为「${user.name}」`);
    navigate('/expenses');
  };

  const roleLabels = {
    clerk: '报销专员',
    accountant: '费用会计',
    manager: '财务经理',
  };

  const roleDescs = {
    clerk: '创建、提交报销申请，管理草稿',
    accountant: '核验报销材料，推进或退回申请',
    manager: '复核申请，批量处理，监控预警',
  };

  const roleColors = {
    clerk: '#1890ff',
    accountant: '#52c41a',
    manager: '#faad14',
  };

  return (
    <div class="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .login-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px;
          width: 480px;
          max-width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .login-title {
          text-align: center;
          margin-bottom: 8px;
          font-size: 24px;
          font-weight: 600;
          color: #262626;
        }
        .login-subtitle {
          text-align: center;
          color: #8c8c8c;
          margin-bottom: 32px;
          font-size: 14px;
        }
        .user-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .user-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .user-card:hover {
          border-color: #1890ff;
          box-shadow: 0 4px 12px rgba(24,144,255,0.15);
          transform: translateY(-2px);
        }
        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .user-info { flex: 1; }
        .user-name { font-size: 16px; font-weight: 600; color: #262626; margin-bottom: 4px; }
        .user-role {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #fff;
          margin-bottom: 4px;
        }
        .user-desc { font-size: 12px; color: #8c8c8c; }
        .login-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: #8c8c8c;
        }
        .loading { text-align: center; padding: 40px; color: #8c8c8c; }
      `}</style>

      <div class="login-card">
        <h1 class="login-title">财务共享中心</h1>
        <p class="login-subtitle">报销申请到期预警系统</p>

        {loading() ? (
          <div class="loading">加载用户列表中...</div>
        ) : (
          <div class="user-list">
            {users().map(user => (
              <div
                key={user.id}
                class="user-card"
                onClick={() => handleLogin(user)}
              >
                <div
                  class="user-avatar"
                  style={{ background: roleColors[user.role] }}
                >
                  {user.name.charAt(0)}
                </div>
                <div class="user-info">
                  <div class="user-name">{user.name}</div>
                  <div
                    class="user-role"
                    style={{ background: roleColors[user.role] }}
                  >
                    {roleLabels[user.role]}
                  </div>
                  <div class="user-desc">{roleDescs[user.role]}</div>
                </div>
                <div style={{ color: '#bfbfbf' }}>→</div>
              </div>
            ))}
          </div>
        )}

        <div class="login-footer">
          本地演示系统 · 请选择岗位身份进入
        </div>
      </div>
    </div>
  );
}

export default Login;
