import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Card, DatePicker, Input, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, errorMessage } from '../../api/client';

const { Title, Text } = Typography;

interface LogRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  create_listing: '房源录入',
  update_listing: '房源编辑',
  submit_listing_verify: '提交验真',
  verify_listing: '房源验真',
  publish_listing: '房源上架',
  offline_listing: '房源下架',
  create_community: '新建小区',
  create_customer: '客户建档',
  update_customer: '客户更新',
  protect_customer: '续保护期',
  create_showing: '新建带看',
  update_showing: '带看更新',
  cancel_showing: '取消带看',
  create_contract: '发起合同',
  sign_contract: '合同签署',
  void_contract: '合同作废',
  download_contract: '合同下载',
  update_progress: '进度更新',
  review_realname: '实名审核',
  settle_payment: '资金核对',
  create_agency: '新增门店',
  update_agent: '经纪人调整',
  update_user_status: '用户状态',
  reset_password: '重置密码',
};

export default function LogsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: LogRow[]; total: number }>('/logs', {
        params: {
          action: action || undefined,
          dateFrom: range?.[0]?.format('YYYY-MM-DD'),
          dateTo: range?.[1]?.format('YYYY-MM-DD'),
          page,
          pageSize: 10,
        },
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [action, range, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<LogRow> = [
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
    { title: '操作人', width: 150, render: (_, record) => record.user ? <span>{record.user.name}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.user.role}</div></span> : '—' },
    { title: '操作', width: 140, render: (_, record) => <Tag color="blue">{ACTION_LABELS[record.action] ?? record.action}<div style={{ fontSize: 11, color: '#8a9099' }}>{record.action}</div></Tag> },
    { title: '对象', width: 140, render: (_, record) => <span>{record.targetType}{record.targetId ? <div style={{ color: '#8a9099', fontSize: 11 }}>{record.targetId.slice(0, 12)}…</div> : ''}</span> },
    { title: '详情', render: (_, record) => <span style={{ fontSize: 12, color: '#6b7280' }}>{record.detail}</span> },
    { title: 'IP', dataIndex: 'ip', width: 130 },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          操作日志 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 条 · 保留 3 年以上（演示：本地 SQLite）</Text>
        </Title>
        <Space wrap>
          <Input.Search allowClear placeholder="按操作类型筛选，如 sign_contract" style={{ width: 240 }} onSearch={(value) => { setPage(1); setAction(value); }} />
          <DatePicker.RangePicker value={range} onChange={(value) => { setRange(value as [Dayjs, Dayjs] | null); setPage(1); }} />
        </Space>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage, showTotal: (value) => `共 ${value} 条` }}
      />
    </Card>
  );
}
