import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { AuditOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, apiPut, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { ApprovalItem } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'gold' },
  level1_approved: { label: '待终审', color: 'blue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤回', color: 'default' },
};

export default function ApprovalsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const canReview = user?.role === 'store_manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState<ApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ApprovalItem | null>(null);
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm<{ comment?: string }>();
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm] = Form.useForm<{ mode: string }>();
  const [configs, setConfigs] = useState<Array<{ type: string; mode: string }>>([]);

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
      const result = await apiPost<{ status: string }>(`/approvals/${target.id}/${mode}`, { comment: values.comment });
      if (mode === 'reject') {
        message.success('已驳回并通知申请人');
      } else if (result.status === 'level1_approved') {
        message.success('初审通过，已转管理员终审');
      } else {
        message.success('已通过审批，房源价格已更新');
      }
      setTarget(null);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const openConfig = async (): Promise<void> => {
    const data = await apiGet<Array<{ type: string; mode: string }>>('/approvals/config');
    setConfigs(data);
    configForm.setFieldsValue({ mode: data.find((item) => item.type === 'price_change')?.mode ?? 'single' });
    setConfigOpen(true);
  };

  const saveConfig = async (): Promise<void> => {
    try {
      const values = await configForm.validateFields();
      await apiPut('/approvals/config', { type: 'price_change', mode: values.mode });
      message.success('审批流配置已保存');
      setConfigOpen(false);
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
      title: '类型',
      width: 120,
      render: (_, record) => (
        <Tag color={record.type === 'price_change' ? 'blue' : 'purple'}>
          {record.typeLabel ?? (record.type === 'price_change' ? '调价审批' : record.type === 'key_handover' ? '钥匙委托' : '审批单')}
        </Tag>
      ),
    },
    {
      title: '申请内容',
      width: 220,
      render: (_, record) =>
        record.type === 'price_change' ? (
          <div>
            <span style={{ color: '#8a9099', textDecoration: 'line-through' }}>{toWan(record.payload.oldTotalPrice ?? 0)} 万</span>
            <span style={{ margin: '0 6px', color: '#d9d9d9' }}>→</span>
            <span style={{ color: '#f5222d', fontWeight: 600 }}>{toWan(record.payload.newTotalPrice ?? 0)} 万</span>
          </div>
        ) : record.type === 'key_handover' ? (
          <span style={{ color: '#4b5563' }}>钥匙 {record.payload.keyCount ?? 1} 把 → {record.payload.handoverTo ?? '—'}</span>
        ) : (
          <span style={{ color: '#4b5563' }}>{record.reason}</span>
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
        (record.status === 'pending' && canReview) || (record.status === 'level1_approved' && isAdmin) ? (
          <Space size={0}>
            <Button size="small" type="link" onClick={() => { setTarget(record); setMode('approve'); form.setFieldsValue({ comment: record.status === 'level1_approved' ? '终审通过，同意调价。' : '同意调价，请同步意向客户。' }); }} data-testid={`btn-approve-${record.code}`}>
              {record.status === 'level1_approved' ? '终审' : '通过'}
            </Button>
            <Button size="small" type="link" danger onClick={() => { setTarget(record); setMode('reject'); form.setFieldsValue({ comment: '' }); }}>
              驳回
            </Button>
          </Space>
        ) : (
          <Button size="small" type="link" onClick={() => { setTarget(record); setMode('approve'); form.setFieldsValue({ comment: record.reviewComment ?? '' }); }} disabled={!['pending', 'level1_approved'].includes(record.status)}>
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
          {isAdmin && <Button icon={<SettingOutlined />} onClick={() => void openConfig()} data-testid="btn-approval-config">审批流配置</Button>}
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
        title={mode === 'approve' ? (target?.status === 'level1_approved' ? '管理员终审' : '通过调价审批') : '驳回调价审批'}
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

      <Modal
        title="调价审批流配置"
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={() => void saveConfig()}
        okText="保存配置"
        width={520}
        data-testid="approval-config-modal"
      >
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
          一级审批：店长或管理员审批一次即生效；两级审批：店长初审通过后转管理员终审。
        </div>
        <Form form={configForm} layout="vertical">
          <Form.Item name="mode" label="调价审批模式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'single', label: '一级审批（店长或管理员直接通过）' },
                { value: 'two_level', label: '两级审批（店长初审 → 管理员终审）' },
              ]}
              data-testid="approval-config-mode"
            />
          </Form.Item>
        </Form>
        <div style={{ color: '#8a9099', fontSize: 12 }}>已配置类型：{configs.map((item) => `${item.type}(${item.mode === 'single' ? '一级' : '两级'})`).join('、') || '—'}</div>
      </Modal>
    </Card>
  );
}
