import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { Community, Paginated } from '../../types';

const { Title, Text } = Typography;

const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'];

export default function CommunitiesPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<Community[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<Community>>('/communities', { params: { keyword: keyword || undefined, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [keyword, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      await apiPost('/communities', values);
      message.success('小区已创建');
      setOpen(false);
      form.resetFields();
      setPage(1);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<Community> = [
    {
      title: '小区',
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.address}</div>
        </div>
      ),
    },
    { title: '区域', width: 110, render: (_, record) => <Tag color="blue">{record.district}</Tag> },
    { title: '商圈', width: 120, dataIndex: 'businessArea' },
    { title: '建成年份', width: 100, dataIndex: 'buildYear' },
    { title: '容积率', width: 90, dataIndex: 'plotRatio' },
    { title: '物业费', width: 100, render: (_, record) => `${record.propertyFee} 元/㎡` },
    {
      title: '在售/房源数',
      width: 130,
      render: (_, record) => (
        <span>
          <Text style={{ color: '#1677ff' }}>{record.onSaleCount ?? 0}</Text> / {record.listingCount ?? 0}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          小区字典 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 个小区</Text>
        </Title>
        <Space>
          <Input.Search allowClear placeholder="搜索小区名称/地址" style={{ width: 240 }} onSearch={(value) => { setPage(1); setKeyword(value); }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ district: '城东区', buildYear: 2015, plotRatio: 2, greenRate: 0.35, propertyFee: 3, lng: 121.42, lat: 31.18 }); setOpen(true); }} data-testid="btn-create-community">
            新建小区
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ current: page, pageSize: 10, total, onChange: setPage, showSizeChanger: false }}
      />

      <Modal title="新建小区" open={open} onCancel={() => setOpen(false)} onOk={() => void create()} okText="创建" width={640}>
        <Form form={form} layout="vertical">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="name" label="小区名称" rules={[{ required: true, message: '请填写名称' }]} style={{ flex: 1 }}>
              <Input placeholder="如：云栖花园" />
            </Form.Item>
            <Form.Item name="district" label="区域" rules={[{ required: true }]} style={{ width: 160, marginLeft: 12 }}>
              <Select options={DISTRICTS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="businessArea" label="商圈" rules={[{ required: true, message: '请填写商圈' }]}>
            <Input placeholder="如：东湖商圈" />
          </Form.Item>
          <Form.Item name="address" label="地址" rules={[{ required: true, message: '请填写地址' }]}>
            <Input placeholder="如：江州市城东区东湖大道 88 号" />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="buildYear" label="建成年份" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <InputNumber min={1980} max={2030} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="plotRatio" label="容积率" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <InputNumber min={0.5} max={10} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="greenRate" label="绿化率" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="propertyFee" label="物业费（元/㎡/月）" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <InputNumber min={0} max={50} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lng" label="经度" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <InputNumber min={100} max={130} step={0.000001} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lat" label="纬度" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={20} max={50} step={0.000001} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>
    </Card>
  );
}
