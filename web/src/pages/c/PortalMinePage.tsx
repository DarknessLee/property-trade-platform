import { Alert, Avatar, Button, Card, Col, Descriptions, Divider, Form, Input, List, Row, Space, Spin, Tag, Typography, App as AntdApp } from 'antd';
import { CheckCircleOutlined, IdcardOutlined, NotificationOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { TOKEN_KEY } from '../../api/client';

const { Title, Text } = Typography;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function PortalMinePage(): JSX.Element {
  const { user, loading, refresh } = useAuth();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<{ realName: string; idCard: string }>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void apiGet<{ items: NotificationItem[]; unreadCount: number }>('/notifications')
      .then((data) => {
        setNotifications(data.items);
        setUnread(data.unreadCount);
      })
      .catch(() => undefined);
  }, [user]);

  if (loading) {
    return (
      <div className="page-section" style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const submitRealName = async (values: { realName: string; idCard: string }): Promise<void> => {
    setSubmitting(true);
    try {
      await apiPost('/auth/realname', values);
      message.success('实名认证资料已提交（演示环境自动进入待审核）');
      form.resetFields();
      await refresh();
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const markAllRead = async (): Promise<void> => {
    try {
      await apiPost('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
      message.success('已全部标记为已读');
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const realNameTag =
    user.realNameStatus === 'approved' ? (
      <Tag icon={<CheckCircleOutlined />} color="success">已实名</Tag>
    ) : user.realNameStatus === 'pending' ? (
      <Tag color="processing">实名审核中</Tag>
    ) : user.realNameStatus === 'rejected' ? (
      <Tag color="error">实名被驳回</Tag>
    ) : (
      <Tag color="default">未实名</Tag>
    );

  return (
    <div className="page-section" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <Row gutter={24}>
        <Col xs={24} lg={9}>
          <Card>
            <Space size={16} align="start">
              <Avatar size={64} style={{ background: '#1677ff', fontSize: 24 }}>
                {user.name.slice(0, 1)}
              </Avatar>
              <div>
                <Title level={4} style={{ margin: 0 }} data-testid="mine-name">
                  {user.name}
                </Title>
                <Space size={6} style={{ marginTop: 6 }}>
                  <Tag color="blue">{user.roleLabel}</Tag>
                  {realNameTag}
                </Space>
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>
                  {user.phone} {user.agencyName ? `· ${user.agencyName}` : ''}
                </div>
              </div>
            </Space>

            <Divider />

            <Descriptions column={1} size="small">
              <Descriptions.Item label="账号 ID">{user.id}</Descriptions.Item>
              <Descriptions.Item label="注册手机">{user.phone}</Descriptions.Item>
              <Descriptions.Item label="实名状态">
                {user.realNameStatus === 'approved' ? '已通过' : user.realNameStatus === 'pending' ? '审核中' : user.realNameStatus === 'rejected' ? '已驳回' : '未提交'}
              </Descriptions.Item>
              <Descriptions.Item label="登录令牌">已签发（JWT，12 小时有效）</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={<span><IdcardOutlined /> 实名认证</span>} style={{ marginTop: 16 }} data-testid="realname-card">
            {user.realNameStatus === 'approved' ? (
              <Alert type="success" showIcon message="已完成实名认证" description="您的身份信息已脱敏存储，仅用于交易核验。" />
            ) : (
              <>
                <Alert
                  style={{ marginBottom: 16 }}
                  type="info"
                  showIcon
                  message="演示环境"
                  description="证件号需通过 GB 11643 校验位，提交后自动进入待审核状态；不会调用真实核验接口。"
                />
                <Form form={form} layout="vertical" onFinish={submitRealName} initialValues={{ realName: user.name }}>
                  <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请填写真实姓名' }]}>
                    <Input placeholder="请输入真实姓名" data-testid="input-realname" />
                  </Form.Item>
                  <Form.Item
                    name="idCard"
                    label="身份证号"
                    rules={[
                      { required: true, message: '请填写身份证号' },
                      { pattern: /^\d{17}[\dXx]$/, message: '身份证号应为 18 位' },
                    ]}
                  >
                    <Input placeholder="18 位身份证号（演示可用 11010119900307001X 类格式）" data-testid="input-idcard" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={submitting} icon={<SafetyCertificateOutlined />} data-testid="btn-submit-realname">
                    提交实名认证
                  </Button>
                </Form>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title={<span><NotificationOutlined /> 我的消息 {unread > 0 ? <Tag color="red">{unread} 条未读</Tag> : null}</span>}
            extra={<Button size="small" onClick={markAllRead} disabled={unread === 0}>全部已读</Button>}
          >
            <List
              dataSource={notifications}
              locale={{ emptyText: '暂无消息' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ fontWeight: item.isRead ? 400 : 600 }}>{item.title}</span>
                        {!item.isRead && <Tag color="red">未读</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ color: '#4b5563' }}>{item.content}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Card size="small" title="我的预约带看">
                <Text type="secondary">M3 阶段开放：查看/取消预约</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="我的合同">
                <Text type="secondary">M3 阶段开放：合同预览与签署</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" title="交易进度">
                <Text type="secondary">M3 阶段开放：时间轴跟踪</Text>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
      {localStorage.getItem(TOKEN_KEY) ? null : null}
    </div>
  );
}
