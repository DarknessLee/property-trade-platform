import { Avatar, Badge, Dropdown, Layout, Menu, Space, Tag, Typography } from 'antd';
import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  NodeIndexOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { apiGet } from '../../api/client';
import type { Role } from '../../types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MenuDef {
  key: string;
  label: string;
  icon: JSX.Element;
  roles: Role[];
}

const MENU_DEFS: MenuDef[] = [
  { key: '/admin', label: '工作台', icon: <DashboardOutlined />, roles: ['agent', 'store_manager', 'finance', 'admin'] },
  { key: '/admin/listings', label: '房源管理', icon: <HomeOutlined />, roles: ['agent', 'store_manager', 'admin'] },
  { key: '/admin/communities', label: '小区字典', icon: <ApartmentOutlined />, roles: ['admin'] },
  { key: '/admin/customers', label: '客户管理', icon: <TeamOutlined />, roles: ['agent', 'store_manager', 'admin'] },
  { key: '/admin/showings', label: '带看管理', icon: <CalendarOutlined />, roles: ['agent', 'store_manager', 'admin'] },
  { key: '/admin/contracts', label: '合同签约', icon: <FileTextOutlined />, roles: ['agent', 'store_manager', 'finance', 'admin'] },
  { key: '/admin/progress', label: '交易进度', icon: <NodeIndexOutlined />, roles: ['agent', 'store_manager', 'finance', 'admin'] },
  { key: '/admin/agencies', label: '门店与经纪人', icon: <BankOutlined />, roles: ['store_manager', 'admin'] },
  { key: '/admin/stats', label: '业绩统计', icon: <BarChartOutlined />, roles: ['store_manager', 'finance', 'admin'] },
  { key: '/admin/audit', label: '后台审核', icon: <AuditOutlined />, roles: ['admin'] },
  { key: '/admin/logs', label: '操作日志', icon: <HistoryOutlined />, roles: ['admin'] },
];

export default function AdminLayout(): JSX.Element {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    void apiGet<{ unreadCount: number }>('/notifications')
      .then((data) => setUnread(data.unreadCount))
      .catch(() => setUnread(0));
  }, [user]);

  const menuItems = useMemo(
    () =>
      MENU_DEFS.filter((item) => (user ? item.roles.includes(user.role) : false)).map((item) => ({
        key: item.key,
        icon: item.icon,
        label: <Link to={item.key}>{item.label}</Link>,
      })),
    [user],
  );

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}>加载中…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'buyer' || user.role === 'seller') return <Navigate to="/portal" replace />;

  const selectedKey = MENU_DEFS.filter((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))
    .map((item) => item.key)
    .sort((a, b) => b.length - a.length)[0] ?? '/admin';
  const current = MENU_DEFS.find((item) => item.key === selectedKey);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', color: '#fff' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#1677ff,#36cfc9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            房
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>房交平台</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>B 端工作台 V1.0</div>
          </div>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} style={{ borderInlineEnd: 'none' }} />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #eef0f3',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Space size={12}>
            <Text strong style={{ fontSize: 16 }} data-testid="admin-page-title">
              {current?.label ?? '工作台'}
            </Text>
            <Tag color="blue">{user.roleLabel}</Tag>
            <Tag>演示环境</Tag>
          </Space>

          <Space size={20}>
            <Badge count={unread} size="small">
              <Link to="/admin">
                <span style={{ fontSize: 18, color: '#4b5563' }}>🔔</span>
              </Link>
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: 'portal', label: '前往 C 端门户', onClick: () => navigate('/portal') },
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => { logout(); navigate('/login'); } },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer' }} data-testid="admin-user">
                <Avatar size={30} style={{ background: '#1677ff' }}>
                  {user.name.slice(0, 1)}
                </Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: '#8a9099' }}>{user.agencyName ?? '平台总部'}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: 24, background: '#f5f6f8' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
