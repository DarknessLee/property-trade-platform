import { Avatar, Badge, Button, Drawer, Dropdown, Layout, Menu, Space, Tag } from 'antd';
import { BellOutlined, EnvironmentOutlined, HomeOutlined, LogoutOutlined, MenuOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { apiGet } from '../../api/client';

const { Header, Content, Footer } = Layout;

export default function PortalLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    void apiGet<{ unreadCount: number }>('/notifications')
      .then((data) => setUnread(data.unreadCount))
      .catch(() => setUnread(0));
  }, [user]);

  const selectedKey = location.pathname.startsWith('/portal/listings') ? '/portal/listings' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Header
        className="portal-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          background: '#fff',
          borderBottom: '1px solid #eef0f3',
          padding: '0 32px',
        }}
      >
        <Button
          className="portal-mobile-only"
          type="text"
          icon={<MenuOutlined />}
          aria-label="打开导航"
          onClick={() => setMobileOpen(true)}
          style={{ marginRight: 4 }}
        />
        <Link to="/portal" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }} data-testid="portal-brand">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#1677ff,#36cfc9)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            房
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1f2329' }}>房交平台</span>
          <Tag color="blue" className="portal-hide-mobile" style={{ marginLeft: 4 }}>演示环境</Tag>
        </Link>

        <Menu
          className="portal-desktop-menu"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          style={{ flex: 1, minWidth: 200, borderBottom: 'none' }}
          items={[
            { key: '/portal', label: <Link to="/portal"><HomeOutlined /> 首页</Link> },
            { key: '/portal/listings', label: <Link to="/portal/listings"><SearchOutlined /> 找房</Link> },
            { key: '/portal/map', label: <Link to="/portal/map"><EnvironmentOutlined /> 地图找房</Link> },
            ...(user ? [{ key: '/portal/mine', label: <Link to="/portal/mine"><UserOutlined /> 我的</Link> }] : []),
          ]}
        />

        {user ? (
          <Space size={20}>
            <Badge count={unread} size="small">
              <Link to="/portal/mine">
                <BellOutlined style={{ fontSize: 18, color: '#4b5563' }} />
              </Link>
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: 'mine', label: '个人中心', icon: <UserOutlined />, onClick: () => navigate('/portal/mine') },
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => { logout(); navigate('/login'); } },
                ],
              }}
            >
              <Space className="portal-user" style={{ cursor: 'pointer' }} data-testid="portal-user">
                <Avatar size={28} style={{ background: '#1677ff' }}>{user.name.slice(0, 1)}</Avatar>
                <span style={{ color: '#1f2329' }}>{user.name}</span>
                <Tag color="green">{user.roleLabel}</Tag>
              </Space>
            </Dropdown>
          </Space>
        ) : (
          <Space>
            <Link to="/login" style={{ color: '#4b5563' }}>登录</Link>
            <Link to="/login" style={{ color: '#1677ff', fontWeight: 600 }}>免费注册</Link>
          </Space>
        )}
      </Header>

      <Drawer title="房交平台" placement="left" width={260} open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Menu
          mode="vertical"
          selectedKeys={[selectedKey]}
          onClick={() => setMobileOpen(false)}
          items={[
            { key: '/portal', icon: <HomeOutlined />, label: <Link to="/portal">首页</Link> },
            { key: '/portal/listings', icon: <SearchOutlined />, label: <Link to="/portal/listings">找房</Link> },
            { key: '/portal/map', icon: <EnvironmentOutlined />, label: <Link to="/portal/map">地图找房</Link> },
            ...(user ? [{ key: '/portal/mine', icon: <UserOutlined />, label: <Link to="/portal/mine">个人中心</Link> }] : [{ key: '/login', icon: <UserOutlined />, label: <Link to="/login">登录 / 注册</Link> }]),
          ]}
        />
        {user && (
          <Button block style={{ marginTop: 16 }} icon={<LogoutOutlined />} onClick={() => { setMobileOpen(false); logout(); navigate('/login'); }}>
            退出登录
          </Button>
        )}
      </Drawer>

      <Content>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', color: '#8a9099', background: '#fafafa' }}>
        房产交易数字化协同平台 V1.0 · 演示环境（数据均为虚构 Mock）· 江州市房地产经纪协会指导
      </Footer>
    </Layout>
  );
}
