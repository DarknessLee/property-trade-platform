import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { ApprovalItem } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤回', color: 'default' },
};

export default function ApprovalsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const canReview = user?.role === 'store_manager' || user?.role === 'admin';

  const [rows, setRows] = useState<ApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ApprovalItem | null>(null);
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm<{ comment?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: ApprovalItem[]; total: number }>('/approvals', { params: { status, page, pageSize: 10 } });
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

  const submitReview = async (): Promise<void> => {
    if (!target) return;
    try {
      const values = await form.validateFields();
      await apiPost(`/approvals/${target.id}/${mode}`, { comment: values.comment });
      message.success(mode === 'approve' ? '已通过审批，房源价格已更新' : '已驳回并通知申请人');
      setTarget(null);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<ApprovalItem> = [
    {
      title: '审批单 / 房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.listing?.title ?? '—'}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>
            {record.code} · {record.listing?.community.district} · {record.listing?.community.name}
          </div>
        </div>
      ),
    },
    {
      title: '调价',
      width: 180,
      render: (_, record) => (
        <div>
          <span style={{ color: '#8a9099', textDecoration: 'line-through' }}>{toWan(record.payload.oldTotalPrice ?? 0)} 万</span>
          <span style={{ margin: '0 6px', color: '#d9d9d9' }}>→</span>
          <span style={{ color: '#f5222d', fontWeight: 600 }}>{toWan(record.payload.newTotalPrice ?? 0)} 万</span>
        </div>
      ),
    },
    { title: '申请人', width: 100, render: (_, record) => record.requester.name },
    { title: '申请原因', render: (_, record) => <span style={{ color: '#6b7280', fontSize: 12 }}>{record.reason}</span> },
    { title: '状态', width: 100, render: (_, record) => <Tag color={STATUS[record.status]?.color}>{STATUS[record.status]?.label}</Tag> },
    { title: '申请时间', width: 150, render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      width: 150,
      render: (_, record) =>
        record.status === 'pending' && canReview ? (
          <Space size={0}>
            <Button size="small" type="link" onClick={() => { setTarget(record); setMode('approve'); form.setFieldsValue({ comment: '同意调价，请同步意向客户。' }); }} data-testid={`btn-approve-${record.code}`}>
              通过
            </Button>
            <Button size="small" type="link" danger onClick={() => { setTarget(record); setMode('reject'); form.setFieldsValue({ comment: '' }); }}>
              驳回
            </Button>
          </Space>
        ) : (
          <Button size="small" type="link" onClick={() => { setTarget(record); setMode('approve'); form.setFieldsValue({ comment: record.reviewComment ?? '' }); }} disabled={record.status !== 'pending'}>
            查看
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          审批中心 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>在售房源调价审批 · 共 {total} 条</Text>
        </Title>
        <Space>
          <Select
            allowClear
            placeholder="审批状态"
            style={{ width: 140 }}
            value={status}
            onChange={(value) => { setPage(1); setStatus(value); }}
            options={Object.entries(STATUS).map(([value, info]) => ({ value, label: info.label }))}
            data-testid="approval-status"
          />
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }}
        locale={{ emptyText: '暂无审批单' }}
        data-testid="approval-table"
      />

      <Modal
        title={mode === 'approve' ? '通过调价审批' : '驳回调价审批'}
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => void submitReview()}
        okText={mode === 'approve' ? '确认通过' : '确认驳回'}
        okButtonProps={{ danger: mode === 'reject' }}
        width={560}
      >
        {target && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="房源" span={2}>{target.listing?.title}</Descriptions.Item>
              <Descriptions.Item label="当前挂牌">{toWan(target.payload.oldTotalPrice ?? 0)} 万</Descriptions.Item>
              <Descriptions.Item label="申请调至">{toWan(target.payload.newTotalPrice ?? 0)} 万</Descriptions.Item>
              <Descriptions.Item label="申请人">{target.requester.name}</Descriptions.Item>
              <Descriptions.Item label="申请时间">{dayjs(target.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="原因" span={2}>{target.reason}</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical">
              <Form.Item name="comment" label={mode === 'reject' ? '驳回意见（必填）' : '审批意见'}>
                <Input.TextArea rows={3} maxLength={200} showCount placeholder={mode === 'reject' ? '如：降幅过大，请补充带看反馈后再提交' : '如：同意调价，请同步意向客户'} data-testid="approval-comment" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
}
