import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { ComplaintItem } from '../../types';
import { COMPLAINT_STATUS, COMPLAINT_TYPE } from '../../types';

const { Title, Text } = Typography;

export default function ComplaintsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<ComplaintItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>('pending');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<ComplaintItem | null>(null);
  const [form] = Form.useForm<{ status: string; comment: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: ComplaintItem[]; total: number }>('/complaints', { params: { status, page, pageSize: 10 } });
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

  const handle = async (): Promise<void> => {
    if (!active) return;
    try {
      const values = await form.validateFields();
      await apiPost(`/complaints/${active.id}/handle`, { status: values.status, comment: values.comment });
      message.success('投诉处理已保存，并通知投诉人');
      setActive(null);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<ComplaintItem> = [
    {
      title: '投诉单',
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text> <Tag>{COMPLAINT_TYPE[record.type] ?? record.type}</Tag>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.contactName} · {record.contactPhone}</div>
        </div>
      ),
    },
    { title: '内容', render: (_, record) => <span style={{ color: '#4b5563' }}>{record.content}</span> },
    { title: '关联房源', width: 160, render: (_, record) => record.listing?.title ?? '—' },
    { title: '状态', width: 100, render: (_, record) => <Tag color={COMPLAINT_STATUS[record.status]?.color}>{COMPLAINT_STATUS[record.status]?.label}</Tag> },
    { title: '提交时间', width: 130, render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD') },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button size="small" type="link" onClick={() => { setActive(record); form.setFieldsValue({ status: record.status === 'pending' ? 'processing' : 'resolved', comment: record.handleComment ?? '' }); }}>
          {record.status === 'pending' ? '处理' : '查看'}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          投诉审核 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>C 端投诉/建议 · 共 {total} 条</Text>
        </Title>
        <Select allowClear placeholder="处理状态" style={{ width: 140 }} value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={Object.entries(COMPLAINT_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
      </div>

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Modal
        title={active ? `投诉处理 · ${active.code}` : '投诉处理'}
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        onOk={() => void handle()}
        okText="保存处理结果"
        width={620}
      >
        {active && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="类型">{COMPLAINT_TYPE[active.type] ?? active.type}</Descriptions.Item>
              <Descriptions.Item label="投诉人">{active.contactName} · {active.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="关联房源" span={2}>{active.listing?.title ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="内容" span={2}>{active.content}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{dayjs(active.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="处理人">{active.handlerName ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical">
              <Form.Item name="status" label="处理结果" rules={[{ required: true }]}>
                <Select options={[{ value: 'processing', label: '处理中' }, { value: 'resolved', label: '已解决' }, { value: 'rejected', label: '驳回（非平台受理范围）' }]} />
              </Form.Item>
              <Form.Item name="comment" label="处理意见" rules={[{ required: true, message: '请填写处理意见' }]}>
                <Input.TextArea rows={3} maxLength={300} showCount placeholder="如：已联系经纪人核实并回访客户，问题已解决。" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
}
