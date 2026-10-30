import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Drawer, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { CommissionItem } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'gold' },
  confirmed: { label: '已确认', color: 'blue' },
  paid: { label: '已支付', color: 'green' },
};
const ROLE_LABEL: Record<string, string> = {
  listing_agent: '房源维护经纪人',
  co_agent: '协作经纪人',
  store: '门店留存',
  finance: '平台/财务',
};

export default function CommissionsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const canConfirm = user?.role === 'store_manager' || user?.role === 'admin';
  const canPay = user?.role === 'finance' || user?.role === 'admin';
  const [rows, setRows] = useState<CommissionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CommissionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rule, setRule] = useState<{ name: string; description: string; items: Array<{ role: string; label: string; rate: number }> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: CommissionItem[]; total: number }>('/commissions', { params: { status, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiGet<typeof rule>('/commissions/rules').then(setRule).catch(() => undefined);
  }, []);

  const operate = async (item: CommissionItem, action: 'confirm' | 'pay', success: string): Promise<void> => {
    try {
      await apiPost(`/commissions/${item.id}/${action}`);
      message.success(success);
      await load();
      if (detail?.id === item.id) setDetail(await apiGet<CommissionItem>(`/commissions/${item.id}`));
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<CommissionItem> = [
    {
      title: '结算单 / 合同',
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.contract.code} · {record.contract.listing.title}</div>
        </div>
      ),
    },
    { title: '合同金额', width: 120, render: (_, record) => `${toWan(record.baseAmount)} 万` },
    { title: '佣金总额', width: 120, render: (_, record) => <Text strong style={{ color: '#f5222d' }}>{record.totalCommission.toLocaleString()} 元</Text> },
    { title: '规则', dataIndex: 'ruleName', width: 200 },
    { title: '状态', width: 100, render: (_, record) => <Tag color={STATUS[record.status]?.color}>{STATUS[record.status]?.label}</Tag> },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={async () => { setDetail(await apiGet<CommissionItem>(`/commissions/${record.id}`)); setDetailOpen(true); }}>分摊明细</Button>
          {canConfirm && record.status === 'pending' && <Button size="small" type="link" onClick={() => void operate(record, 'confirm', '佣金已确认')}>确认</Button>}
          {canPay && record.status === 'confirmed' && <Button size="small" type="link" onClick={() => void operate(record, 'pay', '佣金已支付（Mock）')}>支付</Button>}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          佣金结算 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{rule?.name ?? '标准佣金分成规则'} · 共 {total} 单</Text>
        </Title>
        <Select allowClear placeholder="结算状态" style={{ width: 140 }} value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={Object.entries(STATUS).map(([value, info]) => ({ value, label: info.label }))} />
      </div>

      {rule && (
        <div style={{ background: '#f7f9fc', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: '#6b7280', fontSize: 12 }}>
          {rule.description}：{rule.items.map((item) => `${item.label} ${Math.round(item.rate * 100)}%`).join(' · ')}
        </div>
      )}

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Drawer title={detail ? `佣金分摊 · ${detail.code}` : '佣金分摊'} width={620} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="合同">{detail.contract.code}</Descriptions.Item>
              <Descriptions.Item label="房源">{detail.contract.listing.title}</Descriptions.Item>
              <Descriptions.Item label="合同金额">{detail.baseAmount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="佣金总额">{detail.totalCommission.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}><Tag color={STATUS[detail.status]?.color}>{STATUS[detail.status]?.label}</Tag></Descriptions.Item>
            </Descriptions>
            <Title level={5} style={{ marginTop: 16 }}>分摊明细</Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.allocations}
              columns={[
                { title: '角色', dataIndex: 'role', render: (value: string) => ROLE_LABEL[value] ?? value },
                { title: '姓名/主体', dataIndex: 'name' },
                { title: '比例', dataIndex: 'rate', width: 100, render: (value: number) => `${Math.round(value * 100)}%` },
                { title: '金额', dataIndex: 'amount', width: 130, render: (value: number) => `${value.toLocaleString()} 元` },
              ]}
            />
            <div style={{ marginTop: 12, color: '#8a9099', fontSize: 12 }}>
              确认时间：{detail.confirmedAt ? dayjs(detail.confirmedAt).format('YYYY-MM-DD HH:mm') : '—'} · 支付时间：{detail.paidAt ? dayjs(detail.paidAt).format('YYYY-MM-DD HH:mm') : '—'}
            </div>
          </>
        )}
      </Drawer>
    </Card>
  );
}
