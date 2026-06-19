import React, { useState } from 'react';
import { Form, Input, Button, Select, message, Card } from 'antd';
import { UserOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { User, RoleLabelMap, Role } from '../types';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const demoAccounts = [
    { username: 'admin1', name: '张三（田间管理员）', role: Role.FIELD_ADMIN },
    { username: 'tech1', name: '李四（农技员）', role: Role.TECHNICIAN },
    { username: 'director1', name: '王五（合作社主任）', role: Role.COOP_DIRECTOR },
  ];

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const user = (await authApi.login(values)) as User;
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userInfo', JSON.stringify(user));
      message.success(`欢迎回来，${user.name}`);
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string) => {
    form.setFieldsValue({ username, password: '123456' });
  };

  return (
    <div className="login-container">
      <Card className="login-box">
        <h2 className="login-title">
          <TeamOutlined style={{ marginRight: 8 }} />
          采收记录管理系统
        </h2>
        <Form form={form} layout="vertical" onFinish={handleLogin}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e8e8' }}>
          <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>演示账号（密码均为 123456）：</div>
          {demoAccounts.map((acc) => (
            <Button
              key={acc.username}
              type="text"
              size="small"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px' }}
              onClick={() => handleQuickLogin(acc.username)}
            >
              {acc.name} - {RoleLabelMap[acc.role]}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
