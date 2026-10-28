import { Alert, Button, Card, Col, Divider, Form, Input, Row, Space, Tabs, Tag, Typography, App as AntdApp } from 'antd';
import { LockOutlined, MobileOutlined, SafetyOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage, apiPost } from '../api/client';
import type { Role } from '../types';

const { Title, Text, Paragraph } = Typography;

const DEMO_ACCOUNTS: Array<{ role: Role; roleLabel: string; phone: string; name: string; color: string }> = [
  { role: 'buyer', roleLabel: '买方（C 端）', phone: '13800000040', name: '张伟', color: 'blue' },
  { role: 'seller', roleLabel: '卖方（C 端）', phone: '13800000060', name: '高强', color: 'cyan' },
  { role: 'agent', roleLabel: '经纪人（B 端）', phone: '13800000020', name: '陈志远', color: 'green' },
  { role: 'store_manager', roleLabel: '店长（B 端）', phone: '13800000003', name: '赵敏', color: 'orange' },
  { role: 'finance', roleLabel: '财务（B 端）', phone: '13800000002', name: '邱丽', color: 'purple' },
  { role: 'admin', roleLabel: '平台管理员', phone: '13800000001', name: '平台管理员', color: 'red' },
];

export default function LoginPage(): JSX.Element {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  if (user) return <Navigate to="/" replace />;

  const doLogin = async (loginPhone: string, loginPassword: string): Promise<void> => {
    setLoading(true);
    try {
      await login(loginPhone, loginPassword);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onPasswordSubmit = async (): Promise<void> => {
    await doLogin(phone, password);
  };

  const onCodeSubmit = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiPost<{ token: string; user: unknown }>('/auth/login/code', { phone, code });
      localStorage.setItem('ptp_token', result.token);
      message.success('登录成功');
      window.location.href = '/';
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async (): Promise<void> => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      message.warning('请先填写正确手机号');
      return;
    }
    setCodeSending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setCodeSending(false);
    message.success('演示环境验证码为 123456（模拟短信）');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* 品牌区 */}
      <div
        style={{
          flex: '1 1 52%',
          background: 'linear-gradient(135deg,#0b3b8c 0%,#1677ff 55%,#36cfc9 120%)',
          color: '#fff',
          padding: '64px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Space size={10} style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            房
          </div>
          <span style={{ fontSize: 20, fontWeight: 700 }}>房产交易数字化协同平台</span>
          <Tag color="cyan">V1.0 演示</Tag>
        </Space>

        <Title level={1} style={{ color: '#fff', fontSize: 40, margin: '12px 0 16px' }}>
          房源 · 带看 · 签约 · 进度
          <br />
          一条链路全部打通
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, maxWidth: 520 }}>
          面向买卖双方与经纪机构的一体化协同平台：C 端真实房源与透明交易流程，B 端房源、客户、带看、合同与业绩全数字化管理。
        </Paragraph>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '28px 0' }} />

        <Row gutter={24}>
          {[
            { title: '6 类角色', desc: '买卖双方 / 经纪人 / 店长 / 财务 / 管理员' },
            { title: '7 大模块', desc: '用户 · 房源 · 客户带看 · 合同 · 机构 · 通知 · 系统' },
            { title: '全链路留痕', desc: '操作日志、交易进度、资金记录可追溯' },
          ].map((item) => (
            <Col span={8} key={item.title}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 1.7 }}>{item.desc}</div>
            </Col>
          ))}
        </Row>
      </div>

      {/* 登录区 */}
      <div style={{ flex: '1 1 48%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: '#f6f8fb' }}>
        <div style={{ width: 420, maxWidth: '100%' }}>
          <Card styles={{ body: { padding: 32 } }}>
            <Title level={3} style={{ marginBottom: 4 }} data-testid="login-title">
              欢迎登录
            </Title>
            <Text type="secondary">演示环境：使用下方任意演示账号，密码统一为 123456</Text>

            <Tabs
              style={{ marginTop: 16 }}
              activeKey={mode}
              onChange={(key) => setMode(key as 'password' | 'code')}
              items={[
                {
                  key: 'password',
                  label: '密码登录',
                  children: (
                    <Form layout="vertical" onFinish={onPasswordSubmit}>
                      <Form.Item label="手机号">
                        <Input
                          size="large"
                          prefix={<MobileOutlined />}
                          placeholder="11 位手机号"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          data-testid="login-phone"
                        />
                      </Form.Item>
                      <Form.Item label="密码">
                        <Input.Password
                          size="large"
                          prefix={<LockOutlined />}
                          placeholder="演示密码 123456"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          data-testid="login-password"
                        />
                      </Form.Item>
                      <Button type="primary" size="large" block htmlType="submit" loading={loading} data-testid="btn-login">
                        登录
                      </Button>
                    </Form>
                  ),
                },
                {
                  key: 'code',
                  label: '验证码登录',
                  children: (
                    <Form layout="vertical" onFinish={onCodeSubmit}>
                      <Form.Item label="手机号">
                        <Input
                          size="large"
                          prefix={<MobileOutlined />}
                          placeholder="11 位手机号"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          data-testid="code-phone"
                        />
                      </Form.Item>
                      <Form.Item label="验证码">
                        <Space.Compact style={{ width: '100%' }}>
                          <Input
                            size="large"
                            prefix={<SafetyOutlined />}
                            placeholder="6 位验证码"
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            data-testid="code-input"
                          />
                          <Button size="large" onClick={sendCode} loading={codeSending} data-testid="btn-send-code">
                            获取验证码
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                      <Button type="primary" size="large" block htmlType="submit" loading={loading} data-testid="btn-login-code">
                        登录
                      </Button>
                    </Form>
                  ),
                },
              ]}
            />

            <Divider style={{ margin: '20px 0 14px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>演示账号一键填充</Text>
            </Divider>

            <Row gutter={[8, 8]}>
              {DEMO_ACCOUNTS.map((account) => (
                <Col span={12} key={account.phone}>
                  <Button
                    block
                    size="small"
                    onClick={() => {
                      setPhone(account.phone);
                      setPassword('123456');
                      setMode('password');
                      void doLogin(account.phone, '123456');
                    }}
                    data-testid={`demo-account-${account.role}`}
                  >
                    <Tag color={account.color} style={{ marginRight: 6 }}>{account.roleLabel}</Tag>
                    {account.name}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="演示说明"
            description="平台数据全部为虚构 Mock；电子签、支付、短信、实名核验均为本地模拟，不产生真实法律效力与费用。"
          />
        </div>
      </div>
    </div>
  );
}
