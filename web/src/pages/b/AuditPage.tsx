import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { AdminListing, Paginated } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';

const { Title, Text } = Typography;

export default function AuditPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<AdminListing | null>(null);
  const [form] = Form.useForm<{ pass: boolean; reason?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<AdminListing>>('/listings', {
        params: { verifyStatus: 'pending', page, pageSize: 10 },
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (): Promise<void> => {
    if (!target) return;
    try {
      const values = await form.validateFields();
      await apiPost(`/listings/${target.id}/verify`, values);
      message.success(values.pass ? '验真通过，已通知经纪人上架' : '已驳回，经纪人将收到通知');
      setTarget(null);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<AdminListing> = [
    {
      title: '房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.title}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>
            {record.code} · {record.community.district} · {record.community.name}
          </div>
        </div>
      ),
    },
    { title: '面积', width: 90, render: (_, record) => `${record.area}㎡` },
    {
      title: '总价',
      width: 110,
      render: (_, record) => <span style={{ color: '#f5222d' }}>{formatPrice(record.totalPrice)}</span>,
    },
    { title: '维护人', width: 120, render: (_, record) => record.agent.name },
    { title: '提交时间', width: 130, render: (_, record) => formatDate(record.updatedAt) },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<AuditOutlined />}
          onClick={() => {
            setTarget(record);
            form.setFieldsValue({ pass: true, reason: '' });
          }}
          data-testid={`btn-audit-${record.code}`}
        >
          审核
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>
        房源验真审核 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>待审核 {total} 套</Text>
      </Title>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ current: page, pageSize: 10, total, onChange: setPage, showSizeChanger: false }}
        locale={{ emptyText: '暂无待审核房源' }}
      />

      <Modal title="房源验真审核" open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void submit()} okText="提交">
        {target && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="房源">{target.title}</Descriptions.Item>
              <Descriptions.Item label="业主">{target.owner.name}</Descriptions.Item>
              <Descriptions.Item label="小区">{target.community.name}</Descriptions.Item>
              <Descriptions.Item label="委托协议">{(target.attachments ?? []).length} 份</Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical">
              <Form.Item name="pass" label="审核结果" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: true, label: '通过（经纪人可上架）' },
                    { value: false, label: '驳回（需填写原因）' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="reason" label="驳回原因（驳回时必填）">
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="如：产权照片不清晰、委托协议缺失" />
              </Form.Item>
            </Form>
            <Space>
              {(target.attachments ?? []).map((item) => (
                <Tag key={item.id}>
                  <a href={item.filePath} target="_blank" rel="noreferrer">
                    {item.fileName}
                  </a>
                </Tag>
              ))}
            </Space>
          </>
        )}
      </Modal>
    </Card>
  );
}
