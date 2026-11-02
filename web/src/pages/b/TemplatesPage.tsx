import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import type { ContractTemplate } from '../../types';

const { Title, Text } = Typography;

export default function TemplatesPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form] = Form.useForm<{ name: string; version: string; content: string; isActive: boolean }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiGet<ContractTemplate[]>('/contracts/templates/all'));
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiPatch(`/contracts/templates/${editing.id}`, values);
        message.success('合同模板已更新');
      } else {
        await apiPost('/contracts/templates', values);
        message.success('合同模板已创建');
      }
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const toggle = async (record: ContractTemplate): Promise<void> => {
    try {
      await apiPatch(`/contracts/templates/${record.id}`, { isActive: !record.isActive });
      message.success(record.isActive ? '模板已停用' : '模板已启用');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<ContractTemplate> = [
    {
      title: '模板',
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>版本 {record.version}</div>
        </div>
      ),
    },
    { title: '正文摘要', dataIndex: 'content', render: (value: string) => <span style={{ color: '#6b7280' }}>{value.replace(/\{\{[^}]+\}\}/g, '【占位符】').slice(0, 80)}…</span> },
    { title: '状态', width: 100, render: (_, record) => <Tag color={record.isActive ? 'green' : 'default'}>{record.isActive ? '启用中' : '已停用'}</Tag> },
    { title: '创建时间', width: 120, render: (_, record) => (record.createdAt ? dayjs(record.createdAt).format('YYYY-MM-DD') : '—') },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => { setEditing(record); form.setFieldsValue(record); setOpen(true); }}>编辑</Button>
          <Button size="small" type="link" onClick={() => void toggle(record)}>{record.isActive ? '停用' : '启用'}</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          合同模板 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {rows.length} 个模板 · 占位符格式 {'{{sellerName}}'}</Text>
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ version: 'V1.0', isActive: true }); setOpen(true); }}>新增模板</Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={false} scroll={{ x: 900 }} />

      <Modal title={editing ? '编辑合同模板' : '新增合同模板'} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="保存" width={720}>
        <Form form={form} layout="vertical">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请填写模板名称' }]} style={{ flex: 1, marginRight: 12 }}>
              <Input placeholder="如 存量房买卖合同" />
            </Form.Item>
            <Form.Item name="version" label="版本" rules={[{ required: true }]} style={{ width: 140 }}>
              <Input placeholder="V1.0" />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="content" label="模板正文（支持占位符）" rules={[{ required: true, message: '请填写模板正文' }]}>
            <Input.TextArea rows={12} placeholder="甲方（卖方）：{{sellerName}}&#10;乙方（买方）：{{buyerName}}&#10;成交价：{{amount}} 元…" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
