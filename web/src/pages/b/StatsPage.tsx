import { useEffect, useState } from 'react';
import { App as AntdApp, Card, Col, Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { BarChartOutlined, CrownOutlined, FunnelPlotOutlined, FundOutlined, PieChartOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiGet, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import TrendChart from '../../components/TrendChart';
import PriceTrendLineChart from '../../components/PriceTrendLineChart';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

interface Overview {
  listingCount: number;
  onSaleCount: number;
  customerCount: number;
  showingCount: number;
  showingDoneCount: number;
  signedContractCount: number;
  dealAmount: number;
  commissionAmount: number;
  pendingVerifyCount: number;
}

interface RankingRow {
  id: string;
  name: string;
  agency: string;
  signedContractCount: number;
  dealAmount: number;
  showingCount: number;
}

interface MarketRow {
  district: string;
  onSaleCount: number;
  avgUnitPrice: number;
  signedCount: number;
  dealAmount: number;
  avgDealAmount: number;
  communities: Array<{ name: string; onSaleCount: number; avgUnitPrice: number; signedCount: number; dealAmount: number }>;
}

interface CustomerProfile {
  total: number;
  types: { buyer: number; seller: number };
  levels: Array<{ level: string; count: number }>;
  budgetSegments: Array<{ label: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
}

export default function StatsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<Array<{ month: string; contractCount: number; dealAmount: number }>>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [funnel, setFunnel] = useState<Array<{ name: string; value: number }>>([]);
  const [priceTrend, setPriceTrend] = useState<Array<{ month: string; avgUnitPrice: number; listingCount: number }>>([]);
  const [priceDistrict, setPriceDistrict] = useState<string | undefined>();

  useEffect(() => {
    void Promise.all([
      apiGet<Overview>('/stats/overview'),
      apiGet<Array<{ month: string; contractCount: number; dealAmount: number }>>('/stats/trend', { params: { months: 6 } }),
      apiGet<RankingRow[]>('/stats/ranking'),
      apiGet<MarketRow[]>('/stats/market'),
      apiGet<CustomerProfile>('/stats/customers'),
      apiGet<{ stages: Array<{ name: string; value: number }> }>('/stats/funnel'),
    ])
      .then(([overviewData, trendData, rankingData, marketData, profileData, funnelData]) => {
        setOverview(overviewData);
        setTrend(trendData);
        setRanking(rankingData);
        setMarket(marketData);
        setProfile(profileData);
        setFunnel(funnelData.stages);
      })
      .catch((error) => message.error(errorMessage(error)));
  }, [message]);

  useEffect(() => {
    void apiGet<Array<{ month: string; avgUnitPrice: number; listingCount: number }>>('/stats/price-trend', { params: { district: priceDistrict, months: 6 } })
      .then(setPriceTrend)
      .catch(() => setPriceTrend([]));
  }, [priceDistrict]);

  const cards = [
    { title: '房源总数', value: overview?.listingCount ?? 0, suffix: '套', color: '#1677ff' },
    { title: '在售房源', value: overview?.onSaleCount ?? 0, suffix: '套', color: '#13a8a8' },
    { title: '客户档案', value: overview?.customerCount ?? 0, suffix: '位', color: '#722ed1' },
    { title: '带看次数', value: overview?.showingCount ?? 0, suffix: '次', color: '#fa8c16' },
    { title: '成交单量', value: overview?.signedContractCount ?? 0, suffix: '单', color: '#f5222d' },
    { title: '成交金额', value: Math.round((overview?.dealAmount ?? 0) / 10000), suffix: '万', color: '#eb2f96' },
    { title: '佣金收入', value: Math.round((overview?.commissionAmount ?? 0) / 10000), suffix: '万', color: '#52c41a' },
    { title: '待验真房源', value: overview?.pendingVerifyCount ?? 0, suffix: '套', color: '#faad14' },
  ];

  const overviewTab = (
    <div>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={12} md={6} key={card.title}>
            <Card>
              <Statistic title={card.title} value={card.value} suffix={card.suffix} valueStyle={{ color: card.color, fontWeight: 700, fontSize: 26 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title={<span><FundOutlined /> 近 6 个月成交趋势</span>} style={{ marginTop: 16 }} extra={<Text type="secondary" style={{ fontSize: 12 }}>统计口径：已签署合同</Text>} data-testid="stats-trend-card">
        {trend.length > 0 ? <TrendChart data={trend} /> : <div style={{ padding: 40, textAlign: 'center' }}><Text type="secondary">加载中…</Text></div>}
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={<span><CrownOutlined /> 业绩排行</span>} data-testid="stats-ranking-card">
            <Table
              rowKey="id"
              pagination={false}
              dataSource={ranking}
              columns={[
                {
                  title: '排名',
                  width: 70,
                  render: (_, record, index) => <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'orange' : 'default'}>{index + 1}</Tag>,
                },
                { title: '经纪人', dataIndex: 'name', width: 110 },
                { title: '门店', dataIndex: 'agency', render: (value: string) => value.replace('安家地产·', '') },
                { title: '成交单量', dataIndex: 'signedContractCount', width: 100, render: (value: number) => `${value} 单` },
                { title: '成交金额', dataIndex: 'dealAmount', width: 130, render: (value: number) => <Text strong>{toWan(value)} 万</Text> },
                { title: '带看', dataIndex: 'showingCount', width: 80 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<span><TeamOutlined /> 统计口径</span>}>
            <Space direction="vertical" size={8} style={{ color: '#6b7280', fontSize: 13 }}>
              <div>· 数据范围：{user?.role === 'admin' ? '全平台' : user?.role === 'finance' ? '机构全部门店' : '本店'}</div>
              <div>· 成交金额 = 已签署合同金额合计</div>
              <div>· 佣金 = 合同佣金合计（费率 1%–2.5%）</div>
              <div>· 趋势按合同签署时间归档（{dayjs().subtract(5, 'month').format('YYYY-MM')} 至 {dayjs().format('YYYY-MM')}）</div>
              <div>· 待验真 = 房源验真状态为待审核</div>
            </Space>
          </Card>
          <Card title={<span><BarChartOutlined /> 经营提示</span>} style={{ marginTop: 16 }}>
            <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 2 }}>
              · 在售房源 {overview?.onSaleCount ?? 0} 套，建议关注挂牌周期较长的房源；<br />
              · 累计带看 {overview?.showingCount ?? 0} 次，完成率约 {overview && overview.showingCount > 0 ? Math.round((overview.showingDoneCount / overview.showingCount) * 100) : 0}%；<br />
              · 待验真 {overview?.pendingVerifyCount ?? 0} 套，请尽快处理以免影响上架。
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const marketTab = (
    <div>
      <Card
        title={<span><FundOutlined /> 挂牌价走势</span>}
        extra={
          <Select
            allowClear
            placeholder="全部行政区"
            style={{ width: 160 }}
            value={priceDistrict}
            onChange={setPriceDistrict}
            options={market.map((item) => ({ value: item.district, label: item.district }))}
            data-testid="price-district-select"
          />
        }
        data-testid="stats-price-trend-card"
      >
        {priceTrend.length > 0 ? <PriceTrendLineChart data={priceTrend} /> : <div style={{ padding: 40, textAlign: 'center' }}><Text type="secondary">加载中…</Text></div>}
        <Text type="secondary" style={{ fontSize: 12 }}>
          按月末统计各房源最新挂牌单价均值，柱状为当月挂牌样本量；可切换行政区下钻查看。
        </Text>
      </Card>

      <Card title={<span><BarChartOutlined /> 区域行情（点击行下钻小区）</span>} style={{ marginTop: 16 }} extra={<Text type="secondary" style={{ fontSize: 12 }}>在售量与成交均价按小区所属行政区统计</Text>} data-testid="stats-market-card">
        <Table
          rowKey="district"
          pagination={false}
          dataSource={market}
          expandable={{
            expandedRowRender: (row: MarketRow) => (
              <Table
                size="small"
                rowKey="name"
                pagination={false}
                dataSource={row.communities}
                columns={[
                  { title: '小区', dataIndex: 'name', width: 160 },
                  { title: '在售', dataIndex: 'onSaleCount', width: 90, render: (value: number) => `${value} 套` },
                  { title: '在售均价', dataIndex: 'avgUnitPrice', width: 150, render: (value: number) => `${value.toLocaleString()} 元/㎡` },
                  { title: '成交单量', dataIndex: 'signedCount', width: 100, render: (value: number) => `${value} 单` },
                  { title: '成交金额', dataIndex: 'dealAmount', width: 130, render: (value: number) => `${toWan(value)} 万` },
                ]}
              />
            ),
          }}
          columns={[
            { title: '行政区', dataIndex: 'district', width: 140 },
            { title: '在售套数', dataIndex: 'onSaleCount', width: 110, render: (value: number) => `${value} 套` },
            { title: '在售均价', dataIndex: 'avgUnitPrice', width: 150, render: (value: number) => `${value.toLocaleString()} 元/㎡` },
            { title: '成交单量', dataIndex: 'signedCount', width: 110, render: (value: number) => `${value} 单` },
            { title: '成交金额', dataIndex: 'dealAmount', width: 140, render: (value: number) => <Text strong>{toWan(value)} 万</Text> },
            { title: '套均成交', dataIndex: 'avgDealAmount', width: 140, render: (value: number) => `${toWan(value)} 万` },
          ]}
        />
      </Card>
    </div>
  );

  const customersTab = (
    <div>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card><Statistic title="客户总数" value={profile?.total ?? 0} suffix="位" /></Card>
        </Col>
        <Col xs={12} md={8}>
          <Card><Statistic title="买方客户" value={profile?.types.buyer ?? 0} suffix="位" valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} md={8}>
          <Card><Statistic title="卖方客户" value={profile?.types.seller ?? 0} suffix="位" valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<span><PieChartOutlined /> 预算分布（买方）</span>} data-testid="stats-customer-card">
            <Table
              rowKey="label"
              pagination={false}
              dataSource={profile?.budgetSegments ?? []}
              columns={[
                { title: '预算区间', dataIndex: 'label' },
                { title: '客户数', dataIndex: 'count', width: 100, render: (value: number) => `${value} 位` },
                {
                  title: '占比',
                  width: 120,
                  render: (_, record: { count: number }) => `${profile && profile.types.buyer > 0 ? Math.round((record.count / profile.types.buyer) * 100) : 0}%`,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<span><TeamOutlined /> 客户等级 / 热门需求</span>}>
            <Space wrap style={{ marginBottom: 12 }}>
              {(profile?.levels ?? []).map((item) => <Tag key={item.level} color={item.level === 'A' ? 'red' : item.level === 'B' ? 'gold' : 'default'}>{item.level} 级 {item.count} 位</Tag>)}
            </Space>
            <div style={{ color: '#8a9099', fontSize: 12, marginBottom: 8 }}>热门需求标签</div>
            <Space wrap>
              {(profile?.topTags ?? []).map((item) => <Tag key={item.tag} color="blue">{item.tag} · {item.count}</Tag>)}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const maxFunnel = Math.max(...funnel.map((item) => item.value), 1);
  const funnelTab = (
    <Card title={<span><FunnelPlotOutlined /> 转化漏斗</span>} extra={<Text type="secondary" style={{ fontSize: 12 }}>浏览 → 带看 → 合同发起 → 签约成交</Text>} data-testid="stats-funnel-card">
      <div style={{ padding: '8px 24px' }}>
        {funnel.map((item, index) => (
          <div key={item.name} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text strong>{item.name}</Text>
              <Text>{item.value.toLocaleString()}</Text>
            </div>
            <Progress
              percent={Math.round((item.value / maxFunnel) * 100)}
              showInfo={false}
              strokeColor={['#1677ff', '#13a8a8', '#fa8c16', '#f5222d'][index]}
              trailColor="#f0f2f5"
            />
            {index > 0 && funnel[index - 1].value > 0 && (
              <div style={{ color: '#8a9099', fontSize: 12, marginTop: 4 }}>环节转化率：{Math.round((item.value / funnel[index - 1].value) * 100)}%</div>
            )}
          </div>
        ))}
        <div style={{ color: '#8a9099', fontSize: 12 }}>说明：房源浏览为挂牌浏览计数汇总；带看/合同/签约取当前数据范围内数量，仅用于运营参考。</div>
      </div>
    </Card>
  );

  return (
      <Tabs
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: '业绩总览', children: overviewTab },
          { key: 'market', label: '区域行情', children: marketTab },
          { key: 'customers', label: '客群画像', children: customersTab },
          { key: 'funnel', label: '转化漏斗', children: funnelTab },
        ]}
      />
  );
}
