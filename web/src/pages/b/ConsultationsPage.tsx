import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Badge, Button, Card, Drawer, Empty, Form, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { ConsultationItem } from '../../types';

const { Title, Text } = Typography;

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待回复', color: 'gold' },
  replied: { label: '已回复', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
};

export default function ConsultationsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<ConsultationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<ConsultationItem | null>(null);
  const [form] = Form.useForm<{ content: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: ConsultationItem[]; total: number; pendingCount: number }>('/consultations/inbox', { params: { status, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
      setPendingCount(data.pendingCount);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = async (): Promise<void> => {
    if (!active) return;
    try {
      const values = await form.validateFields();
      await apiPost(`/consultations/${active.id}/reply`, { content: values.content });
      message.success('回复已发送，用户将收到站内通知');
      setActive(null);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<ConsultationItem> = [
    {
      title: '房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.listing.title}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.listing.code} · {record.listing.community.name}</div>
        </div>
      ),
    },
    { title: '留言人', width: 110, render: (_, record) => record.fromUser.name },
    { title: '留言内容', render: (_, record) => <span style={{ color: '#4b5563' }}>{record.content}</span> },
    { title: '状态', width: 100, render: (_, record) => <Tag color={STATUS[record.status]?.color}>{STATUS[record.status]?.label}</Tag> },
    { title: '时间', width: 150, render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      width: 110,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Button size="small" type="primary" ghost onClick={() => { setActive(record); form.setFieldsValue({ content: '' }); }} data-testid={`btn-reply-${record.code}`}>
            回复
          </Button>
        ) : (
          <Button size="small" type="link" onClick={() => setActive(record)}>查看</Button>
        ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <MessageOutlined /> 房源咨询 <Badge count={pendingCount} style={{ marginLeft: 8 }} />
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>C 端房源留言 · 共 {total} 条</Text>
        </Title>
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(value) => { setPage(1); setStatus(value); }}
          options={Object.entries(STATUS).map(([value, info]) => ({ value, label: info.label }))}
          data-testid="consultation-status"
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }}
        locale={{ emptyText: <Empty description="暂无咨询留言" /> }}
        data-testid="consultation-table"
      />

      <Drawer title="房源咨询" width={560} open={Boolean(active)} onClose={() => setActive(null)} destroyOnClose>
        {active && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{active.listing.title}</div>
              <div style={{ color: '#8a9099', fontSize: 12 }}>{active.listing.community.district} · {active.listing.community.name} · {active.listing.area}㎡</div>
            </div>
            <div style={{ background: '#f7f9fc', borderRadius: 8, padding: 12 }}>
              <div style={{ color: '#8a9099', fontSize: 12, marginBottom: 4 }}>{active.fromUser.name} · {dayjs(active.createdAt).format('YYYY-MM-DD HH:mm')}</div>
              <div>{active.content}</div>
            </div>
            {active.replyContent ? (
              <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 12 }}>
                <div style={{ color: '#8a9099', fontSize: 12, marginBottom: 4 }}>我的回复 · {active.repliedAt ? dayjs(active.repliedAt).format('YYYY-MM-DD HH:mm') : ''}</div>
                <div>{active.replyContent}</div>
              </div>
            ) : (
              <Form form={form} layout="vertical">
                <Form.Item name="content" label="回复内容" rules={[{ required: true, message: '请填写回复内容' }]}>
                  <Input.TextArea rows={4} maxLength={500} showCount placeholder="回复用户咨询，例如：房源在售，周末可安排看房" data-testid="consultation-reply-input" />
                </Form.Item>
              </Form>
            )}
            {active.status === 'pending' && (
              <Button type="primary" onClick={() => void reply()} data-testid="btn-submit-reply">发送回复</Button>
            )}
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
