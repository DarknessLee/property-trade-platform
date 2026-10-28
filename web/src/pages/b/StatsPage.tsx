import { useEffect, useState } from 'react';
import { App as AntdApp, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { BarChartOutlined, CrownOutlined, FundOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiGet, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import TrendChart from '../../components/TrendChart';
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

export default function StatsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<Array<{ month: string; contractCount: number; dealAmount: number }>>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);

  useEffect(() => {
    void Promise.all([
      apiGet<Overview>('/stats/overview'),
      apiGet<Array<{ month: string; contractCount: number; dealAmount: number }>>('/stats/trend', { params: { months: 6 } }),
      apiGet<RankingRow[]>('/stats/ranking'),
    ])
      .then(([overviewData, trendData, rankingData]) => {
        setOverview(overviewData);
        setTrend(trendData);
        setRanking(rankingData);
      })
      .catch((error) => message.error(errorMessage(error)));
  }, [message]);

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

  return (
    <div>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={12} md={6} key={card.title}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                suffix={card.suffix}
                valueStyle={{ color: card.color, fontWeight: 700, fontSize: 26 }}
              />
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
                  render: (_, record, index) => (
                    <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'orange' : 'default'}>{index + 1}</Tag>
                  ),
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
              · 累计带看 {overview?.showingCount ?? 0} 次，完成率约{' '}
              {overview && overview.showingCount > 0 ? Math.round((overview.showingDoneCount / overview.showingCount) * 100) : 0}%；<br />
              · 待验真 {overview?.pendingVerifyCount ?? 0} 套，请尽快处理以免影响上架。
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
