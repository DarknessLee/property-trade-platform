import { Button, Col, Input, Row, Select, Space, Statistic, Steps, Tag, Typography } from 'antd';
import { EnvironmentOutlined, FileProtectOutlined, HomeOutlined, SafetyCertificateOutlined, ScheduleOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { HomeStats, Listing } from '../../types';
import ListingCard from '../../components/ListingCard';

const { Title, Paragraph } = Typography;

const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'];

const SERVICE_STEPS = [
  { title: '真实房源', icon: <HomeOutlined />, desc: '业主实名委托，房源验真审核' },
  { title: '预约带看', icon: <ScheduleOutlined />, desc: '在线选时段，经纪人一对一陪同' },
  { title: '在线签约', icon: <FileProtectOutlined />, desc: '标准合同模板，电子签章存证' },
  { title: '交易进度', icon: <SafetyCertificateOutlined />, desc: '面签/贷款/缴税/过户全程可查' },
];

export default function PortalHomePage(): JSX.Element {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [hot, setHot] = useState<Listing[]>([]);
  const [keyword, setKeyword] = useState('');
  const [district, setDistrict] = useState<string | undefined>();

  useEffect(() => {
    void apiGet<HomeStats>('/public/home').then(setStats).catch(() => setStats(null));
    void apiGet<{ items: Listing[] }>('/public/listings', { params: { pageSize: 6 } })
      .then((data) => setHot(data.items))
      .catch(() => setHot([]));
  }, []);

  const goSearch = (): void => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (district) params.set('district', district);
    navigate(`/portal/listings?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(120deg,#0b3b8c 0%,#1677ff 45%,#36cfc9 100%)',
          color: '#fff',
          padding: '72px 24px 96px',
        }}
      >
        <div className="page-section">
          <Tag color="cyan" style={{ marginBottom: 16 }}>真实房源 · 透明交易 · 全程可溯</Tag>
          <Title level={1} style={{ color: '#fff', margin: '8px 0 12px', fontSize: 40 }}>
            在江州，找到安心好房
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, maxWidth: 640 }}>
            平台连接买卖双方与经纪机构，房源验真、在线带看、电子签约、交易进度一站完成。
          </Paragraph>

          <div style={{ background: '#fff', borderRadius: 10, padding: 16, maxWidth: 900, marginTop: 28 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Select
                placeholder="区域"
                allowClear
                style={{ width: 140 }}
                value={district}
                onChange={setDistrict}
                options={DISTRICTS.map((d) => ({ value: d, label: d }))}
                data-testid="home-district"
              />
              <Input
                size="large"
                placeholder="输入小区名、地段或关键词，如「锦绣华庭」"
                prefix={<EnvironmentOutlined />}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onPressEnter={goSearch}
                data-testid="home-keyword"
              />
              <Button size="large" type="primary" icon={<SearchOutlined />} onClick={goSearch} data-testid="home-search">
                搜索房源
              </Button>
            </Space.Compact>
          </div>

          <Row gutter={16} style={{ marginTop: 32, maxWidth: 900 }}>
            {[
              { label: '在售房源', value: stats?.onSaleListings ?? 0, suffix: '套' },
              { label: '合作小区', value: stats?.communities ?? 0, suffix: '个' },
              { label: '累计成交', value: stats?.signedContracts ?? 0, suffix: '单' },
              { label: '认证经纪人', value: stats?.agents ?? 0, suffix: '位' },
            ].map((item) => (
              <Col span={6} key={item.label}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>{item.label}</span>}
                  value={item.value}
                  suffix={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{item.suffix}</span>}
                  valueStyle={{ color: '#fff', fontSize: 30, fontWeight: 700 }}
                />
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* 服务流程 */}
      <div style={{ marginTop: -40 }}>
        <div className="page-section">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 8px 24px rgba(11,59,140,0.10)' }}>
            <Steps
              items={SERVICE_STEPS.map((step) => ({
                title: step.title,
                icon: step.icon,
                description: step.desc,
              }))}
            />
          </div>
        </div>
      </div>

      {/* 精选房源 */}
      <div className="page-section" style={{ marginTop: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Title level={3} style={{ margin: 0 }}>精选房源</Title>
          <Button type="link" onClick={() => navigate('/portal/listings')}>查看全部 →</Button>
        </div>
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          {hot.length === 0 ? (
            <Col span={24}>
              <div className="placeholder-box">暂无在售房源，请稍后再试（若为初次启动，请先执行 npm run db:reset）</div>
            </Col>
          ) : (
            hot.map((listing) => (
              <Col xs={24} sm={12} lg={8} key={listing.id}>
                <ListingCard listing={listing} testId={`listing-card-${listing.code}`} />
              </Col>
            ))
          )}
        </Row>
      </div>

      {/* 平台保障 */}
      <div className="page-section" style={{ marginTop: 56, marginBottom: 56 }}>
        <div style={{ background: '#f0f7ff', borderRadius: 12, padding: 32, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            { title: '房源验真', desc: '业主实名 + 产权资料审核，杜绝虚假房源' },
            { title: '资金安全', desc: '交易资金记录留痕，关键节点通知提醒' },
            { title: '合规签约', desc: '标准示范合同文本，电子签章 Mock 演示' },
            { title: '隐私保护', desc: '证件信息脱敏存储，符合个人信息保护要求' },
          ].map((item) => (
            <div key={item.title} style={{ flex: '1 1 200px' }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{item.title}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
