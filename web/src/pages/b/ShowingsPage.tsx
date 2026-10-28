import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import { LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import type { AdminListing, Customer, Paginated, Showing } from '../../types';
import { SHOWING_STATUS } from '../../types';

const { Title, Text } = Typography;
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface CalendarData {
  weekStart: string;
  days: Array<{ date: string; items: Showing[] }>;
}

export default function ShowingsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf('week'));
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [rows, setRows] = useState<Showing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [active, setActive] = useState<Showing | null>(null);
  const [actionForm] = Form.useForm<{ feedback?: string; rating?: string }>();

  const loadCalendar = useCallback(async () => {
    const data = await apiGet<CalendarData>('/showings/calendar', { params: { weekStart: weekStart.format('YYYY-MM-DD') } });
    setCalendar(data);
  }, [weekStart]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<Showing>>('/showings', { params: { status, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, page, message]);

  useEffect(() => {
    void loadCalendar().catch((error) => message.error(errorMessage(error)));
  }, [loadCalendar, message]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openCreate = async (): Promise<void> => {
    try {
      const [listingData, customerData] = await Promise.all([
        apiGet<Paginated<AdminListing>>('/listings', { params: { status: 'on_sale', pageSize: 60 } }),
        apiGet<Customer[]>('/customers/options'),
      ]);
      setListings(listingData.items);
      setCustomers(customerData);
      createForm.resetFields();
      createForm.setFieldsValue({ date: dayjs().add(1, 'day'), time: dayjs().hour(10).minute(0), durationMin: 30 });
      setCreateOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const submitCreate = async (): Promise<void> => {
    try {
      const values = await createForm.validateFields();
      const scheduledAt = (values.date as Dayjs).hour((values.time as Dayjs).hour()).minute((values.time as Dayjs).minute()).second(0);
      await apiPost('/showings', {
        listingId: values.listingId,
        customerId: values.customerId,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: values.durationMin,
      });
      message.success('带看预约已创建');
      setCreateOpen(false);
      await Promise.all([loadCalendar(), loadList()]);
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const updateShowing = async (showing: Showing, payload: Record<string, unknown>, success: string): Promise<void> => {
    try {
      await apiPatch(`/showings/${showing.id}`, payload);
      message.success(success);
      setActive(null);
      actionForm.resetFields();
      await Promise.all([loadCalendar(), loadList()]);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<Showing> = [
    {
      title: '预约时间',
      width: 170,
      render: (_, record) => (
        <div>
          <Text strong>{dayjs(record.scheduledAt).format('MM-DD HH:mm')}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.durationMin} 分钟 · {record.code}</div>
        </div>
      ),
    },
    { title: '客户', width: 140, render: (_, record) => <span>{record.customer.name}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.customer.phone}</div></span> },
    { title: '房源', render: (_, record) => <span>{record.listing.title}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.listing.community.name}</div></span> },
    { title: '经纪人', width: 100, render: (_, record) => record.agent.name },
    {
      title: '状态',
      width: 100,
      render: (_, record) => <Tag color={SHOWING_STATUS[record.status]?.color}>{SHOWING_STATUS[record.status]?.label ?? record.status}</Tag>,
    },
    {
      title: '操作',
      width: 130,
      render: (_, record) => <Button size="small" type="link" onClick={() => { setActive(record); actionForm.setFieldsValue({ rating: record.rating ?? 'B' }); }}>处理</Button>,
    },
  ];

  const dayColumns = useMemo(() => calendar?.days ?? [], [calendar]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>带看日程</Title>
            <Button size="small" icon={<LeftOutlined />} onClick={() => setWeekStart(weekStart.subtract(1, 'week'))} />
            <Text strong>{weekStart.format('YYYY-MM-DD')} ~ {weekStart.add(6, 'day').format('MM-DD')}</Text>
            <Button size="small" icon={<RightOutlined />} onClick={() => setWeekStart(weekStart.add(1, 'week'))} />
            <Button size="small" onClick={() => setWeekStart(dayjs().startOf('week'))}>本周</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()} data-testid="btn-create-showing">新建预约</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginTop: 16 }} data-testid="showing-calendar">
          {dayColumns.map((day, index) => (
            <div key={day.date} style={{ background: '#fafbfc', borderRadius: 6, padding: 8, minHeight: 170, border: '1px solid #eef0f3' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {WEEK_LABELS[index]} · {dayjs(day.date).format('MM-DD')}
              </div>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {day.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setActive(item); actionForm.setFieldsValue({ rating: item.rating ?? 'B' }); }}
                    style={{
                      background: '#fff',
                      borderLeft: `3px solid ${item.status === 'done' ? '#52c41a' : item.status === 'confirmed' ? '#1677ff' : item.status === 'cancelled' ? '#bfbfbf' : '#faad14'}`,
                      borderRadius: 4,
                      padding: '6px 8px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{dayjs(item.scheduledAt).format('HH:mm')} {item.customer.name}</div>
                    <div style={{ color: '#8a9099', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.listing.title}</div>
                  </div>
                ))}
                {day.items.length === 0 && <div style={{ color: '#c1c7d0', fontSize: 12 }}>暂无安排</div>}
              </Space>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>带看记录</Title>
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 140 }}
            value={status}
            onChange={(value) => { setPage(1); setStatus(value); }}
            options={Object.entries(SHOWING_STATUS).map(([value, info]) => ({ value, label: info.label }))}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }}
        />
      </Card>

      <Modal title="新建带看预约" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void submitCreate()} okText="创建" width={560}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="listingId" label="房源" rules={[{ required: true, message: '请选择房源' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择在售房源"
              options={listings.map((item) => ({ value: item.id, label: `${item.title}（${item.community.name}）` }))}
              data-testid="showing-listing"
            />
          </Form.Item>
          <Form.Item name="customerId" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择客户"
              options={customers.map((item) => ({ value: item.id, label: `${item.name}（${item.phone}）· ${item.level}类` }))}
              data-testid="showing-customer"
            />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="date" label="日期" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="time" label="时间" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
            </Form.Item>
            <Form.Item name="durationMin" label="时长（分钟）" style={{ width: 130 }}>
              <Select options={[15, 30, 45, 60, 90].map((value) => ({ value, label: `${value}` }))} />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>

      <Modal
        title={active ? `处理带看 · ${active.customer.name}` : '处理带看'}
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        footer={null}
        width={560}
      >
        {active && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="房源">{active.listing.title}</Descriptions.Item>
              <Descriptions.Item label="时间">{dayjs(active.scheduledAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="客户">{active.customer.name}</Descriptions.Item>
              <Descriptions.Item label="状态">{SHOWING_STATUS[active.status]?.label}</Descriptions.Item>
            </Descriptions>
            <Form form={actionForm} layout="vertical">
              <Form.Item name="feedback" label="带看反馈（完成时必填）">
                <Input.TextArea rows={2} maxLength={300} showCount placeholder="客户对房源/价格的反馈" />
              </Form.Item>
              <Form.Item name="rating" label="客户评级">
                <Select options={[{ value: 'A', label: 'A 类（高意向）' }, { value: 'B', label: 'B 类' }, { value: 'C', label: 'C 类' }]} />
              </Form.Item>
            </Form>
            <Space wrap>
              {active.status === 'pending' && (
                <Button type="primary" onClick={() => void updateShowing(active, { status: 'confirmed' }, '带看已确认')}>确认带看</Button>
              )}
              {active.status === 'confirmed' && (
                <Button
                  type="primary"
                  onClick={async () => {
                    const values = await actionForm.validateFields();
                    if (!values.feedback?.trim()) {
                      message.warning('完成带看需填写反馈');
                      return;
                    }
                    await updateShowing(active, { status: 'done', feedback: values.feedback, rating: values.rating }, '带看已完成');
                  }}
                >
                  完成带看
                </Button>
              )}
              {['pending', 'confirmed'].includes(active.status) && (
                <Button danger onClick={() => void updateShowing(active, { status: 'cancelled' }, '带看已取消')}>取消预约</Button>
              )}
              {active.feedback && <Text type="secondary">上次反馈：{active.feedback}</Text>}
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
}
