import { Card, Col, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { ArrowUpOutlined, CalendarOutlined, FileTextOutlined, HomeOutlined, TeamOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { HomeStats } from '../../types';

const { Title, Text } = Typography;

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const QUICK_ACTIONS = [
  { title: '录入房源', desc: '新增委托房源并提交验真', path: '/admin/listings', icon: <HomeOutlined />, color: '#1677ff' },
  { title: '安排带看', desc: '为客户预约带看并录入反馈', path: '/admin/showings', icon: <CalendarOutlined />, color: '#13a8a8' },
  { title: '发起签约', desc: '选择模板生成房屋买卖合同', path: '/admin/contracts', icon: <FileTextOutlined />, color: '#fa8c16' },
  { title: '客户跟进', desc: '维护客户档案与需求标签', path: '/admin/customers', icon: <TeamOutlined />, color: '#722ed1' },
];

export default function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    void apiGet<HomeStats>('/public/home').then(setStats).catch(() => setStats(null));
    void apiGet<{ items: NotificationItem[] }>('/notifications')
      .then((data) => setNotifications(data.items.slice(0, 6)))
      .catch(() => setNotifications([]));
  }, []);

  return (
    <div>
      <Card style={{ marginBottom: 16, background: 'linear-gradient(120deg,#0b3b8c,#1677ff 60%,#36cfc9)' }} styles={{ body: { padding: 24 } }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          你好，{user?.name}（{user?.roleLabel}）
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.82)' }}>
          {user?.agencyName ?? '平台总部'} · 今日建议优先处理带看确认与待签署合同
        </Text>
      </Card>

      <Row gutter={16}>
        {[
          { title: '在售房源', value: stats?.onSaleListings ?? 0, suffix: '套', icon: <HomeOutlined /> },
          { title: '合作小区', value: stats?.communities ?? 0, suffix: '个', icon: <TeamOutlined /> },
          { title: '累计成交', value: stats?.signedContracts ?? 0, suffix: '单', icon: <FileTextOutlined /> },
          { title: '认证经纪人', value: stats?.agents ?? 0, suffix: '位', icon: <TeamOutlined /> },
        ].map((item) => (
          <Col xs={12} md={6} key={item.title}>
            <Card>
              <Statistic
                title={item.title}
                value={item.value}
                suffix={item.suffix}
                prefix={<span style={{ color: '#1677ff', marginRight: 6 }}>{item.icon}</span>}
                valueStyle={{ fontSize: 28, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="快捷操作" extra={<Tag color="blue"><ArrowUpOutlined /> 高频</Tag>}>
            <Row gutter={[12, 12]}>
              {QUICK_ACTIONS.map((action) => (
                <Col xs={12} key={action.title}>
                  <Card hoverable size="small" onClick={() => navigate(action.path)} className="card-hover">
                    <Space align="start">
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: `${action.color}1a`,
                          color: action.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        {action.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{action.title}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{action.desc}</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="最新消息">
            <List
              size="small"
              dataSource={notifications}
              locale={{ emptyText: '暂无消息' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<span style={{ fontWeight: item.isRead ? 400 : 600 }}>{item.title}</span>}
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.content} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
