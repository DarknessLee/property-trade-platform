import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Col, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { AccountBookOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

const { Title, Text } = Typography;

interface PaymentRow {
  id: string;
  type: string;
  amount: number;
  status: string;
  tradeNo: string;
  paidAt: string | null;
  createdAt: string;
  contract: { id: string; code: string; amount: number; signStatus: string; listing: { title: string }; buyer: string; seller: string; agent: string };
}

interface FinanceOverview {
  paidAmount: number;
  unpaidAmount: number;
  commissionPaid: number;
  commissionUnpaid: number;
  recordCount: number;
}

const TYPE_LABELS: Record<string, string> = { deposit: '定金', down_payment: '首付', balance: '尾款', commission: '佣金' };

export default function FinancePage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, listData] = await Promise.all([
        apiGet<FinanceOverview>('/finance/overview'),
        apiGet<{ items: PaymentRow[]; total: number }>('/payments', { params: { status, type, page, pageSize: 10 } }),
      ]);
      setOverview(overviewData);
      setRows(listData.items);
      setTotal(listData.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, type, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const settle = async (record: PaymentRow): Promise<void> => {
    try {
      await apiPost(`/payments/${record.id}/settle`);
      message.success('已核对入账，并通知交易相关方');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<PaymentRow> = [
    {
      title: '合同 / 房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.contract.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.contract.listing.title}</div>
        </div>
      ),
    },
    { title: '款项', width: 90, render: (_, record) => <Tag color="blue">{TYPE_LABELS[record.type] ?? record.type}</Tag> },
    { title: '金额', width: 130, render: (_, record) => <Text strong>{record.amount.toLocaleString()} 元</Text> },
    { title: '状态', width: 100, render: (_, record) => <Tag color={record.status === 'paid' ? 'green' : record.status === 'refunded' ? 'orange' : 'gold'}>{record.status === 'paid' ? '已入账' : record.status === 'refunded' ? '已退款' : '待入账'}</Tag> },
    { title: '买卖双方', width: 130, render: (_, record) => `${record.contract.buyer} / ${record.contract.seller}` },
    { title: '流水号', dataIndex: 'tradeNo', width: 170 },
    {
      title: '入账时间',
      width: 150,
      render: (_, record) => (record.paidAt ? dayjs(record.paidAt).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      width: 110,
      render: (_, record) =>
        record.status === 'unpaid' && (user?.role === 'finance' || user?.role === 'admin') ? (
          <Button size="small" type="primary" ghost onClick={() => void settle(record)} data-testid={`btn-settle-${record.tradeNo}`}>
            核对入账
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        ),
    },
  ];

  return (
    <div>
      <Row gutter={16}>
        {[
          { title: '已入账金额', value: overview?.paidAmount ?? 0, suffix: '元', color: '#52c41a' },
          { title: '待入账金额', value: overview?.unpaidAmount ?? 0, suffix: '元', color: '#faad14' },
          { title: '已收佣金', value: overview?.commissionPaid ?? 0, suffix: '元', color: '#1677ff' },
          { title: '待收佣金', value: overview?.commissionUnpaid ?? 0, suffix: '元', color: '#f5222d' },
        ].map((item) => (
          <Col xs={12} md={6} key={item.title}>
            <Card>
              <Statistic title={item.title} value={item.value} suffix={item.suffix} valueStyle={{ color: item.color, fontWeight: 700, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{ marginTop: 16 }}
        title={<span><AccountBookOutlined /> 交易资金记录</span>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>共 {total} 条 · 演示环境支付通道为 Mock</Text>}
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Select allowClear placeholder="款项类型" style={{ width: 140 }} value={type} onChange={(value) => { setPage(1); setType(value); }} options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select allowClear placeholder="入账状态" style={{ width: 140 }} data-testid="finance-status" value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={[{ value: 'paid', label: '已入账' }, { value: 'unpaid', label: '待入账' }, { value: 'refunded', label: '已退款' }]} />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1100 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />
      </Card>
    </div>
  );
}
