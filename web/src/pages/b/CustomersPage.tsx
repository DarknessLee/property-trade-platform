import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { EditOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { Customer, FollowUpItem, MatchItem, Paginated } from '../../types';
import { formatDate } from '../../utils/format';

const { Title, Text } = Typography;

export default function CustomersPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<string | undefined>();
  const [level, setLevel] = useState<string | undefined>();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [followForm] = Form.useForm<{ content: string; nextAction?: string }>();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<Customer>>('/customers', { params: { keyword: keyword || undefined, type, level, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [keyword, type, level, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (): void => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'buyer', level: 'B' });
    setOpen(true);
  };

  const openEdit = (record: Customer): void => {
    setEditing(record);
    form.setFieldsValue({ ...record, tags: record.tags });
    setOpen(true);
  };

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        ...values,
        budgetMin: values.budgetMin ? Number(values.budgetMin) * 10000 : undefined,
        budgetMax: values.budgetMax ? Number(values.budgetMax) * 10000 : undefined,
      };
      if (editing) {
        delete payload.name;
        delete payload.phone;
        delete payload.type;
        await apiPatch(`/customers/${editing.id}`, payload);
        message.success('客户信息已更新');
      } else {
        await apiPost('/customers', payload);
        message.success('客户已创建，默认保护期 30 天');
      }
      setOpen(false);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const protect = async (record: Customer): Promise<void> => {
    try {
      await apiPost(`/customers/${record.id}/protect`, { days: 30 });
      message.success('保护期已续期 30 天');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const openDetail = async (record: Customer): Promise<void> => {
    try {
      const data = await apiGet<Customer & { showings: unknown[]; followUps: FollowUpItem[] }>(`/customers/${record.id}`);
      setDetail(data);
      setFollowUps(data.followUps ?? []);
      setDetailOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const addFollowUp = async (): Promise<void> => {
    if (!detail) return;
    try {
      const values = await followForm.validateFields();
      await apiPost(`/customers/${detail.id}/follow-ups`, values);
      message.success('跟进记录已添加');
      followForm.resetFields();
      const data = await apiGet<Customer & { showings: unknown[]; followUps: FollowUpItem[] }>(`/customers/${detail.id}`);
      setFollowUps(data.followUps ?? []);
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const loadMatches = async (): Promise<void> => {
    if (!detail) return;
    try {
      setMatches(await apiGet<MatchItem[]>(`/customers/${detail.id}/matches`));
      setMatchesOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<Customer> = [
    {
      title: '客户',
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text> <Tag color={record.type === 'buyer' ? 'blue' : 'cyan'}>{record.type === 'buyer' ? '买方' : '卖方'}</Tag>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.code} · {record.phone}</div>
        </div>
      ),
    },
    {
      title: '需求 / 预算',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.demand || '—'}</div>
          <div style={{ color: '#8a9099', fontSize: 12 }}>
            {record.budgetMin ? `${Math.round(record.budgetMin / 10000)}-${Math.round((record.budgetMax ?? 0) / 10000)} 万` : '—'}
          </div>
        </div>
      ),
    },
    { title: '评级', width: 80, render: (_, record) => <Tag color={record.level === 'A' ? 'red' : record.level === 'B' ? 'orange' : 'default'}>{record.level} 类</Tag> },
    { title: '归属经纪人', width: 110, render: (_, record) => record.agent.name },
    { title: '带看', width: 80, render: (_, record) => `${record.showingCount} 次` },
    {
      title: '保护期至',
      width: 130,
      render: (_, record) => {
        const until = record.protectionUntil ? dayjs(record.protectionUntil) : null;
        const active = until ? until.isAfter(dayjs()) : false;
        return until ? <Tag color={active ? 'green' : 'default'}>{until.format('YYYY-MM-DD')}</Tag> : '—';
      },
    },
    {
      title: '操作',
      width: 210,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => void openDetail(record)}>详情</Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" type="link" icon={<SafetyCertificateOutlined />} onClick={() => void protect(record)}>续保护</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          客户管理 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 位 · {user?.role === 'agent' ? '仅显示本人客户' : '显示本店客户'}</Text>
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} data-testid="btn-create-customer">新增客户</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear placeholder="搜索姓名 / 手机号 / 编号" style={{ width: 240 }} onSearch={(value) => { setPage(1); setKeyword(value); }} data-testid="customer-search" />
        <Select allowClear placeholder="客户类型" style={{ width: 130 }} value={type} onChange={(value) => { setPage(1); setType(value); }} options={[{ value: 'buyer', label: '买方' }, { value: 'seller', label: '卖方' }]} />
        <Select allowClear placeholder="客户评级" style={{ width: 130 }} value={level} onChange={(value) => { setPage(1); setLevel(value); }} options={[{ value: 'A', label: 'A 类' }, { value: 'B', label: 'B 类' }, { value: 'C', label: 'C 类' }]} />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage, showTotal: (value) => `共 ${value} 条` }}
      />

      <Drawer
        title={editing ? `编辑客户 · ${editing.name}` : '新增客户'}
        width={560}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => void submit()} data-testid="btn-save-customer">保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="客户姓名" rules={[{ required: true, message: '请填写姓名' }]}>
                <Input placeholder="如：张先生" disabled={Boolean(editing)} data-testid="customer-name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请填写手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]}>
                <Input placeholder="11 位手机号" disabled={Boolean(editing)} data-testid="customer-phone" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="客户类型" rules={[{ required: true }]}>
                <Select options={[{ value: 'buyer', label: '买方' }, { value: 'seller', label: '卖方' }]} disabled={Boolean(editing)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="客户评级">
                <Select options={[{ value: 'A', label: 'A 类（高意向）' }, { value: 'B', label: 'B 类（跟进中）' }, { value: 'C', label: 'C 类（一般）' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="budgetMin" label="预算下限（万元）">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如 200" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budgetMax" label="预算上限（万元）">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如 300" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="需求标签">
            <Select mode="tags" placeholder="如：刚需、地铁房、学区房" maxCount={6} />
          </Form.Item>
          <Form.Item name="demand" label="需求描述">
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="意向区域、户型、楼层、配套要求等" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer title={detail ? `客户详情 · ${detail.name}` : '客户详情'} width={620} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="编号">{detail.code}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail.type === 'buyer' ? '买方' : '卖方'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detail.phone}</Descriptions.Item>
              <Descriptions.Item label="评级">{detail.level} 类</Descriptions.Item>
              <Descriptions.Item label="归属经纪人">{detail.agent.name}</Descriptions.Item>
              <Descriptions.Item label="门店">{detail.agency.name}</Descriptions.Item>
              <Descriptions.Item label="保护期至">{formatDate(detail.protectionUntil)}</Descriptions.Item>
              <Descriptions.Item label="带看次数">{detail.showingCount}</Descriptions.Item>
              <Descriptions.Item label="需求" span={2}>{detail.demand || '—'}</Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5} style={{ marginTop: 20 }}>最近带看</Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={(detail as unknown as { showings: Array<{ id: string; code: string; listing: { title: string }; scheduledAt: string; status: string }> }).showings ?? []}
              columns={[
                { title: '单号', dataIndex: 'code', width: 140 },
                { title: '房源', render: (_, record: { listing: { title: string } }) => record.listing.title },
                { title: '时间', dataIndex: 'scheduledAt', render: (value: string) => formatDate(value) },
                { title: '状态', dataIndex: 'status', width: 90 },
              ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <Title level={5} style={{ margin: 0 }}>跟进记录（{followUps.length}）</Title>
              {detail.type === 'buyer' && <Button size="small" type="primary" ghost onClick={() => void loadMatches()} data-testid="btn-customer-matches">需求匹配推荐</Button>}
            </div>
            <Form form={followForm} layout="vertical" style={{ marginTop: 8 }}>
              <Form.Item name="content" rules={[{ required: true, message: '请填写跟进内容' }]} style={{ marginBottom: 8 }}>
                <Input.TextArea rows={2} maxLength={500} placeholder="记录本次跟进内容，如：电话回访确认预算与区域" data-testid="followup-content" />
              </Form.Item>
              <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                <Form.Item name="nextAction" style={{ flex: 1, marginBottom: 0 }}>
                  <Input placeholder="下一步动作（可选），如：安排二次带看" data-testid="followup-next" />
                </Form.Item>
                <Button type="primary" onClick={() => void addFollowUp()} data-testid="btn-add-followup">添加跟进</Button>
              </Space.Compact>
            </Form>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {followUps.map((item) => (
                <div key={item.id} style={{ borderLeft: '3px solid #1677ff', background: '#f7f9fc', padding: '8px 10px', marginBottom: 8, borderRadius: 4 }}>
                  <div style={{ color: '#4b5563' }}>{item.content}</div>
                  <div style={{ color: '#8a9099', fontSize: 12, marginTop: 4 }}>
                    {item.createdByName} · {formatDate(item.createdAt)}
                    {item.nextAction ? ` · 下一步：${item.nextAction}` : ''}
                    {item.nextFollowAt ? ` · 下次：${formatDate(item.nextFollowAt)}` : ''}
                  </div>
                </div>
              ))}
              {followUps.length === 0 && <Text type="secondary">暂无跟进记录</Text>}
            </div>
          </>
        )}
      </Drawer>

      <Modal title={detail ? `${detail.name} · 需求匹配推荐` : '需求匹配推荐'} open={matchesOpen} onCancel={() => setMatchesOpen(false)} footer={null} width={760}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={matches}
          locale={{ emptyText: '暂无匹配房源（仅买方客户支持匹配）' }}
          columns={[
            { title: '房源', render: (_, record: MatchItem) => <div><div>{record.title}</div><div style={{ color: '#8a9099', fontSize: 12 }}>{record.community.district} · {record.community.name} · {record.area}㎡</div></div> },
            { title: '总价', width: 110, render: (_, record: MatchItem) => `${Math.round(record.totalPrice / 10000)} 万` },
            { title: '匹配分', width: 90, render: (_, record: MatchItem) => <Tag color={record.score >= 60 ? 'green' : 'blue'}>{record.score}</Tag> },
            { title: '匹配原因', render: (_, record: MatchItem) => <span style={{ color: '#6b7280', fontSize: 12 }}>{record.reasons.join('、') || '—'}</span> },
          ]}
        />
      </Modal>
    </Card>
  );
}
