import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { TransferDetail, TransferSummary } from '../../types';
import { TRANSFER_STATUS } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

const MATERIAL_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待上传', color: 'default' },
  uploaded: { label: '待核验', color: 'blue' },
  verified: { label: '已核验', color: 'green' },
};
const TAX_LABEL: Record<string, string> = { deed: '契税', vat: '增值税', income: '个人所得税' };

export default function TransfersPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const canOperate = ['agent', 'store_manager', 'admin'].includes(user?.role ?? '');
  const canPayTax = ['store_manager', 'finance', 'admin'].includes(user?.role ?? '');
  const [rows, setRows] = useState<TransferSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentForm] = Form.useForm<{ type: string; date: Dayjs; hallName: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: TransferSummary[]; total: number }>('/transfers', { params: { page, pageSize: 10 } });
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

  const openDetail = async (item: TransferSummary): Promise<void> => {
    setDetail(await apiGet<TransferDetail>(`/transfers/${item.contractId}`));
    setDetailOpen(true);
  };

  const refreshDetail = async (): Promise<void> => {
    if (!detail) return;
    setDetail(await apiGet<TransferDetail>(`/transfers/${detail.contract.id}`));
    await load();
  };

  const verifyMaterial = async (materialId: string, status: string): Promise<void> => {
    if (!detail) return;
    try {
      await apiPatch(`/transfers/${detail.contract.id}/materials/${materialId}`, { status });
      message.success(status === 'verified' ? '材料已核验' : '材料已上传');
      await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const payTax = async (taxId: string): Promise<void> => {
    if (!detail) return;
    try {
      await apiPost(`/transfers/${detail.contract.id}/taxes/${taxId}/pay`);
      message.success('税费已缴纳（Mock），已生成完税凭证号');
      await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const updateAppointment = async (id: string, status: string): Promise<void> => {
    try {
      await apiPatch(`/transfers/appointments/${id}`, { status });
      message.success('预约状态已更新');
      await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const submitAppointment = async (): Promise<void> => {
    if (!detail) return;
    try {
      const values = await appointmentForm.validateFields();
      await apiPost(`/transfers/${detail.contract.id}/appointments`, {
        type: values.type,
        appointmentAt: values.date.hour(9).minute(30).second(0).toISOString(),
        hallName: values.hallName,
      });
      message.success('政务预约已提交（Mock）');
      setAppointmentOpen(false);
      appointmentForm.resetFields();
      await refreshDetail();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const registrationAction = async (action: string): Promise<void> => {
    if (!detail) return;
    try {
      await apiPost(`/transfers/${detail.contract.id}/registration`, { action });
      message.success('登记状态已推进');
      await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<TransferSummary> = [
    {
      title: '合同 / 房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.listing.title} · {record.listing.community.name}</div>
        </div>
      ),
    },
    { title: '材料', width: 110, render: (_, record) => `${record.materialVerified}/${record.materialTotal}` },
    { title: '税费', width: 110, render: (_, record) => `${record.taxPaid}/${record.taxTotal} 已缴` },
    { title: '预约', width: 110, render: (_, record) => `${record.appointmentDone}/${record.appointmentTotal} 已办` },
    {
      title: '登记状态',
      width: 110,
      render: (_, record) => (record.registrationStatus ? <Tag color={TRANSFER_STATUS[record.registrationStatus]?.color}>{TRANSFER_STATUS[record.registrationStatus]?.label}</Tag> : <Tag>未提交</Tag>),
    },
    { title: '操作', width: 100, render: (_, record) => <Button size="small" type="link" onClick={() => void openDetail(record)}>办理</Button> },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>过户管理 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>材料清单 / 税费缴纳 / 政务预约 / 不动产登记（均 Mock）</Text></Title>
        <Tag color="blue">已签署合同办理</Tag>
      </div>

      <Table rowKey="contractId" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Drawer title={detail ? `过户办理 · ${detail.contract.code}` : '过户办理'} width={800} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="房源">{detail.contract.listing.title}</Descriptions.Item>
              <Descriptions.Item label="成交价">{toWan(detail.contract.amount)} 万</Descriptions.Item>
              <Descriptions.Item label="买方">{detail.contract.buyer.name}</Descriptions.Item>
              <Descriptions.Item label="卖方">{detail.contract.seller.name}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 16 }}>过户材料清单</Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.materials}
              columns={[
                { title: '材料', dataIndex: 'name' },
                { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={MATERIAL_STATUS[value]?.color}>{MATERIAL_STATUS[value]?.label}</Tag> },
                {
                  title: '操作',
                  width: 120,
                  render: (_, record) =>
                    canOperate && record.status === 'uploaded' ? <Button size="small" type="link" onClick={() => void verifyMaterial(record.id, 'verified')}>核验</Button> : canOperate && record.status === 'pending' ? <Button size="small" type="link" onClick={() => void verifyMaterial(record.id, 'uploaded')}>标记上传</Button> : null,
                },
              ]}
            />

            <Title level={5} style={{ marginTop: 16 }}>税费</Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.taxes}
              columns={[
                { title: '税种', dataIndex: 'taxType', width: 120, render: (value: string) => TAX_LABEL[value] ?? value },
                { title: '金额', dataIndex: 'amount', width: 120, render: (value: number) => `${value.toLocaleString()} 元` },
                { title: '完税凭证', dataIndex: 'receiptNo', render: (value: string | null) => value ?? '—' },
                { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag color={value === 'paid' ? 'green' : 'gold'}>{value === 'paid' ? '已缴纳' : '待缴纳'}</Tag> },
                {
                  title: '操作',
                  width: 100,
                  render: (_, record) => (canPayTax && record.status === 'pending' ? <Button size="small" type="link" onClick={() => void payTax(record.id)}>缴纳</Button> : null),
                },
              ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <Title level={5} style={{ margin: 0 }}>政务预约</Title>
              {canOperate && <Button size="small" onClick={() => { appointmentForm.setFieldsValue({ type: 'transfer', hallName: '江州市不动产登记中心·城东大厅' }); setAppointmentOpen(true); }}>新增预约</Button>}
            </div>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.appointments}
              columns={[
                { title: '类型', dataIndex: 'type', width: 90, render: (value: string) => (value === 'tax' ? '缴税' : '过户') },
                { title: '时间', dataIndex: 'appointmentAt', width: 130, render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm') },
                { title: '大厅', dataIndex: 'hallName' },
                { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <Tag color={value === 'done' ? 'green' : value === 'cancelled' ? 'default' : 'blue'}>{value === 'done' ? '已办理' : value === 'cancelled' ? '已取消' : '已预约'}</Tag> },
                {
                  title: '操作',
                  width: 150,
                  render: (_, record) =>
                    canOperate && record.status === 'booked' ? (
                      <Space size={0}>
                        <Button size="small" type="link" onClick={() => void updateAppointment(record.id, 'done')}>已办理</Button>
                        <Button size="small" type="link" danger onClick={() => void updateAppointment(record.id, 'cancelled')}>取消</Button>
                      </Space>
                    ) : null,
                },
              ]}
            />

            <Title level={5} style={{ marginTop: 16 }}>不动产登记</Title>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="登记编号">{detail.registration?.code ?? '未提交'}</Descriptions.Item>
              <Descriptions.Item label="状态">{detail.registration ? <Tag color={TRANSFER_STATUS[detail.registration.status]?.color}>{TRANSFER_STATUS[detail.registration.status]?.label}</Tag> : <Tag>未提交</Tag>}</Descriptions.Item>
              <Descriptions.Item label="受理号">{detail.registration?.acceptNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{detail.registration?.completedAt ? dayjs(detail.registration.completedAt).format('YYYY-MM-DD') : '—'}</Descriptions.Item>
            </Descriptions>
            {canOperate && (
              <Space style={{ marginTop: 8 }} wrap>
                {!detail.registration && <Button type="primary" onClick={() => void registrationAction('submit')}>提交登记申请</Button>}
                {detail.registration?.status === 'submitted' && <Button onClick={() => void registrationAction('accept')}>标记受理</Button>}
                {detail.registration?.status === 'accepted' && <Button onClick={() => void registrationAction('register')}>标记登簿</Button>}
                {detail.registration?.status === 'registered' && <Button onClick={() => void registrationAction('complete')}>标记领证</Button>}
              </Space>
            )}
          </>
        )}
      </Drawer>

      <Modal title="新增政务预约（Mock）" open={appointmentOpen} onCancel={() => setAppointmentOpen(false)} onOk={() => void submitAppointment()} okText="提交预约">
        <Form form={appointmentForm} layout="vertical">
          <Form.Item name="type" label="预约类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'tax', label: '缴税' }, { value: 'transfer', label: '过户' }]} />
          </Form.Item>
          <Form.Item name="date" label="预约日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current < dayjs().startOf('day')} />
          </Form.Item>
          <Form.Item name="hallName" label="办理大厅" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
