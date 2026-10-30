import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { EscrowItem } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

const ESCROW_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待开户', color: 'default' },
  active: { label: '监管中', color: 'blue' },
  released: { label: '已解冻', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
};
const TX_TYPE: Record<string, string> = { deposit: '存入', release: '解冻', transfer: '划转', refund: '退款' };

export default function EscrowsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const canOperate = ['store_manager', 'finance', 'admin'].includes(user?.role ?? '');
  const [rows, setRows] = useState<EscrowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<{ accountCount: number; totalAmount: number; depositedAmount: number; releasedAmount: number; activeCount: number } | null>(null);
  const [detail, setDetail] = useState<EscrowItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [txForm] = Form.useForm();
  const [status, setStatus] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, ov] = await Promise.all([
        apiGet<{ items: EscrowItem[]; total: number }>('/escrows', { params: { page, pageSize: 10, status } }),
        apiGet<typeof overview>('/escrows/overview'),
      ]);
      setRows(data.items);
      setTotal(data.total);
      setOverview(ov);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, status, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (item: EscrowItem): Promise<void> => {
    setDetail(await apiGet<EscrowItem>(`/escrows/${item.id}`));
    setDetailOpen(true);
  };

  const submitTx = async (): Promise<void> => {
    if (!detail) return;
    try {
      const values = await txForm.validateFields();
      await apiPost(`/escrows/${detail.id}/transactions`, values);
      message.success('资金流水已登记（Mock）');
      setTxOpen(false);
      txForm.resetFields();
      setDetail(await apiGet<EscrowItem>(`/escrows/${detail.id}`));
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<EscrowItem> = [
    {
      title: '监管账户 / 合同',
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.contract.code} · {record.contract.listing.title}</div>
        </div>
      ),
    },
    { title: '监管银行', dataIndex: 'bankName', width: 200 },
    { title: '监管总额', width: 120, render: (_, record) => `${toWan(record.totalAmount)} 万` },
    { title: '已解冻', width: 120, render: (_, record) => `${toWan(record.releasedAmount)} 万` },
    { title: '状态', width: 100, render: (_, record) => <Tag color={ESCROW_STATUS[record.status]?.color}>{ESCROW_STATUS[record.status]?.label}</Tag> },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => void openDetail(record)}>明细</Button>
          {canOperate && record.status === 'active' && (
            <Button size="small" type="link" onClick={() => { setDetail(record); txForm.setFieldsValue({ type: 'release', amount: Math.round(record.totalAmount * 0.1) }); setTxOpen(true); }}>登记流水</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>资金监管 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>银行监管账户 Mock · 不产生真实资金</Text></Title>
        <Select allowClear placeholder="账户状态" style={{ width: 140 }} value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={Object.entries(ESCROW_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
      </div>

      {overview && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="监管账户" value={overview.accountCount} suffix="个" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="监管总额" value={overview.totalAmount / 10000} precision={0} suffix="万" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已存入" value={overview.depositedAmount / 10000} precision={0} suffix="万" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="已解冻" value={overview.releasedAmount / 10000} precision={0} suffix="万" /></Card></Col>
        </Row>
      )}

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Drawer title={detail ? `监管明细 · ${detail.code}` : '监管明细'} width={720} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="合同">{detail.contract.code}</Descriptions.Item>
              <Descriptions.Item label="房源">{detail.contract.listing.title}</Descriptions.Item>
              <Descriptions.Item label="监管银行">{detail.bankName}</Descriptions.Item>
              <Descriptions.Item label="账号">{detail.accountNoMasked}</Descriptions.Item>
              <Descriptions.Item label="监管总额">{detail.totalAmount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="已解冻">{detail.releasedAmount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}><Tag color={ESCROW_STATUS[detail.status]?.color}>{ESCROW_STATUS[detail.status]?.label}</Tag></Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
              <Title level={5} style={{ margin: 0 }}>资金流水</Title>
              {canOperate && detail.status === 'active' && (
                <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => { txForm.setFieldsValue({ type: 'release', amount: Math.round(detail.totalAmount * 0.1) }); setTxOpen(true); }}>登记流水</Button>
              )}
            </div>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.transactions}
              columns={[
                { title: '类型', dataIndex: 'type', width: 90, render: (value: string) => <Tag>{TX_TYPE[value] ?? value}</Tag> },
                { title: '金额', dataIndex: 'amount', width: 120, render: (value: number) => `${toWan(value)} 万` },
                { title: '流水号', dataIndex: 'tradeNo' },
                { title: '备注', dataIndex: 'remark' },
                { title: '时间', dataIndex: 'createdAt', width: 130, render: (value: string) => dayjs(value).format('YYYY-MM-DD') },
              ]}
            />
          </>
        )}
      </Drawer>

      <Modal title="登记资金流水（Mock）" open={txOpen} onCancel={() => setTxOpen(false)} onOk={() => void submitTx()} okText="提交" width={520}>
        <Form form={txForm} layout="vertical">
          <Form.Item name="type" label="流水类型" rules={[{ required: true }]}>
            <Select options={Object.entries(TX_TYPE).map(([value, label]) => ({ value, label }))} data-testid="tx-type" />
          </Form.Item>
          <Form.Item name="amount" label="金额（元）" rules={[{ required: true }]}>
            <InputNumber min={1} step={10000} style={{ width: '100%' }} data-testid="tx-amount" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
