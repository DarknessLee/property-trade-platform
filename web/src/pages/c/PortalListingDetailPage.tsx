import { Alert, Avatar, Button, Card, Col, Descriptions, Divider, Image, Row, Space, Spin, Tag, Typography, App as AntdApp } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, PhoneOutlined, ScheduleOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { Listing } from '../../types';
import { toWan } from '../../components/ListingCard';
import { useAuth } from '../../auth/AuthContext';

const { Title, Paragraph, Text } = Typography;

export default function PortalListingDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    void apiGet<Listing>(`/public/listings/${id}`)
      .then(setListing)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page-section" style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="page-section" style={{ padding: 40 }}>
        <Alert type="warning" message="房源不存在或已下架" showIcon />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/portal/listings')}>返回房源列表</Button>
      </div>
    );
  }

  const images = listing.images.length > 0 ? listing.images : [{ name: '房源图', url: '/mock/listings/1.svg' }];

  return (
    <div className="page-section" style={{ paddingTop: 20, paddingBottom: 48 }}>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ paddingLeft: 0 }}>
        返回
      </Button>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Title level={3} style={{ margin: '0 0 8px' }} data-testid="listing-title">
                  {listing.title}
                </Title>
                <Space wrap size={8}>
                  <Tag color="blue">{listing.status === 'on_sale' ? '在售' : listing.status}</Tag>
                  <Tag color="green">已验真</Tag>
                  <Tag>{listing.propertyType}</Tag>
                  <Tag>{listing.buildYear} 年建</Tag>
                  <Tag>房源编号 {listing.code}</Tag>
                </Space>
                <div style={{ marginTop: 12, color: '#6b7280' }}>
                  <EnvironmentOutlined /> {listing.community.district} · {listing.community.name} · {listing.address}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <span style={{ color: '#f5222d', fontSize: 34, fontWeight: 700 }}>{toWan(listing.totalPrice)}</span>
                  <span style={{ color: '#f5222d', fontSize: 16 }}> 万</span>
                </div>
                <Text type="secondary">{Math.round(listing.unitPrice)} 元/㎡</Text>
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <Image.PreviewGroup>
              <Row gutter={8}>
                <Col span={24}>
                  <Image
                    src={images[0].url}
                    alt={images[0].name}
                    style={{ width: '100%', height: 360, objectFit: 'cover', borderRadius: 8 }}
                    fallback="/mock/listings/1.svg"
                  />
                </Col>
                {images.slice(1, 4).map((img) => (
                  <Col span={8} key={img.url}>
                    <Image
                      src={img.url}
                      alt={img.name}
                      style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8 }}
                      fallback="/mock/listings/1.svg"
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>

            <Descriptions title="房源信息" column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginTop: 20 }}>
              <Descriptions.Item label="户型">{listing.rooms}室{listing.halls}厅{listing.bathrooms}卫</Descriptions.Item>
              <Descriptions.Item label="建筑面积">{listing.area} ㎡</Descriptions.Item>
              <Descriptions.Item label="朝向">{listing.orientation}</Descriptions.Item>
              <Descriptions.Item label="楼层">{listing.floor}/{listing.totalFloors} 层</Descriptions.Item>
              <Descriptions.Item label="装修">{listing.decoration}</Descriptions.Item>
              <Descriptions.Item label="产权性质">{listing.propertyType}</Descriptions.Item>
              <Descriptions.Item label="挂牌时间">{listing.listedAt ? new Date(listing.listedAt).toLocaleDateString('zh-CN') : '—'}</Descriptions.Item>
              <Descriptions.Item label="浏览次数">{listing.viewCount}</Descriptions.Item>
              <Descriptions.Item label="所属门店">{listing.agent?.agency.name ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Title level={5}>房源描述</Title>
            <Paragraph style={{ color: '#4b5563', lineHeight: 1.9 }}>{listing.description}</Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="小区信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="小区名称">{listing.community.name}</Descriptions.Item>
              <Descriptions.Item label="所在区域">{listing.community.district} · {listing.community.businessArea}</Descriptions.Item>
              <Descriptions.Item label="建成年代">{listing.community.buildYear} 年</Descriptions.Item>
              <Descriptions.Item label="容积率">{listing.community.plotRatio}</Descriptions.Item>
              <Descriptions.Item label="绿化率">{(listing.community.greenRate * 100).toFixed(0)}%</Descriptions.Item>
              <Descriptions.Item label="物业费">{listing.community.propertyFee} 元/㎡/月</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="专属经纪人" data-testid="listing-agent-card">
            <Space align="start" size={12}>
              <Avatar size={48} style={{ background: '#1677ff' }}>
                {listing.agent?.user.name.slice(0, 1) ?? '房'}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {listing.agent?.user.name ?? '平台经纪人'} <Tag color="gold">已实名</Tag>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{listing.agent?.agency.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  <PhoneOutlined /> {listing.agent?.agency.phone}
                </div>
              </div>
            </Space>

            <Divider style={{ margin: '14px 0' }} />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                block
                icon={<ScheduleOutlined />}
                onClick={() => {
                  if (!user) {
                    message.info('请先登录后预约看房');
                    navigate('/login');
                    return;
                  }
                  message.info('预约带看将在 M3 阶段开放（本阶段仅完成房源浏览与账户体系）');
                }}
                data-testid="btn-book-showing"
              >
                预约看房
              </Button>
              <Button block icon={<UserOutlined />} onClick={() => message.info('在线咨询将在 M3 阶段开放')}>
                在线咨询
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                平台承诺：看房不收取任何费用，交易资金请走监管账户。
              </Text>
            </Space>
          </Card>

          <Alert style={{ marginTop: 16 }} type="info" showIcon message="演示环境提示" description="房源、价格、经纪人均为虚构数据，仅用于功能演示。" />
        </Col>
      </Row>
    </div>
  );
}
