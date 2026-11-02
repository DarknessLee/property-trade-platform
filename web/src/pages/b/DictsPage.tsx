import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage, http } from '../../api/client';
import type { DictItem } from '../../types';

const { Title, Text } = Typography;

export default function DictsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<DictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DictItem | null>(null);
  const [form] = Form.useForm<{ category: string; key: string; label: string; value?: string; sortOrder?: number }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiGet<DictItem[]>('/admin/dicts'));
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category))).sort(), [rows]);
  const filtered = category ? rows.filter((row) => row.category === category) : rows;

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await apiPatch(`/admin/dicts/${editing.id}`, { label: values.label, value: values.value, sortOrder: values.sortOrder });
        message.success('字典项已更新');
      } else {
        await apiPost('/admin/dicts', values);
        message.success('字典项已创建');
      }
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const remove = async (record: DictItem): Promise<void> => {
    try {
      await http.delete(`/admin/dicts/${record.id}`);
      message.success('字典项已删除');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<DictItem> = [
    { title: '分类', dataIndex: 'category', width: 160, render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: '键', dataIndex: 'key', width: 120 },
    { title: '显示名', dataIndex: 'label' },
    { title: '值', dataIndex: 'value', render: (value: string | null) => value ?? '—' },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => { setEditing(record); form.setFieldsValue({ ...record, value: record.value ?? undefined }); setOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除该字典项？" onConfirm={() => void remove(record)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          数据字典 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {rows.length} 项 · 配置中心</Text>
        </Title>
        <Space>
          <Select allowClear placeholder="全部分类" style={{ width: 180 }} value={category} onChange={setCategory} options={categories.map((item) => ({ value: item, label: item }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ sortOrder: 0 }); setOpen(true); }}>新增字典项</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 800 }} />

      <Modal title={editing ? '编辑字典项' : '新增字典项'} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="保存" width={520}>
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请填写分类' }]}>
            <Input disabled={Boolean(editing)} placeholder="如 orientation / decoration" />
          </Form.Item>
          <Form.Item name="key" label="键" rules={[{ required: true, message: '请填写键' }]}>
            <Input disabled={Boolean(editing)} placeholder="如 o1" />
          </Form.Item>
          <Form.Item name="label" label="显示名" rules={[{ required: true, message: '请填写显示名' }]}>
            <Input placeholder="如 南北" />
          </Form.Item>
          <Form.Item name="value" label="值">
            <Input placeholder="默认同显示名" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
