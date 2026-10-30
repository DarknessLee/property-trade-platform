import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { Contract, LoanItem, Paginated } from '../../types';
import { LOAN_STATUS } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

export default function LoansPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<LoanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LoanItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reviewOpen, setReviewOpen] = useState<{ loan: LoanItem; pass: boolean } | null>(null);
  const [reviewForm] = Form.useForm<{ reason?: string }>();

  const canReview = user?.role === 'store_manager' || user?.role === 'admin';
  const canOperate = user?.role === 'agent' || user?.role === 'store_manager' || user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: LoanItem[]; total: number }>('/loans', { params: { status, page, pageSize: 10 } });
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

  const openCreate = async (): Promise<void> => {
    try {
      const data = await apiGet<Paginated<Contract>>('/contracts', { params: { status: 'signed', pageSize: 100 } });
      setContracts(data.items);
      createForm.resetFields();
      createForm.setFieldsValue({ termMonths: 240, annualRate: 3.85, productName: '个人二手住房按揭贷', bankName: '江州银行·城东支行' });
      setCreateOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const submitCreate = async (): Promise<void> => {
    try {
      const values = await createForm.validateFields();
      await apiPost('/loans', values);
      message.success('贷款申请已创建');
      setCreateOpen(false);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const operate = async (loan: LoanItem, action: 'submit' | 'disburse', success: string): Promise<void> => {
    try {
      await apiPost(`/loans/${loan.id}/${action}`);
      message.success(success);
      await load();
      if (detail?.id === loan.id) setDetail(await apiGet<LoanItem>(`/loans/${loan.id}`));
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const submitReview = async (): Promise<void> => {
    if (!reviewOpen) return;
    try {
      const values = await reviewForm.validateFields();
      await apiPost(`/loans/${reviewOpen.loan.id}/review`, { pass: reviewOpen.pass, reason: values.reason });
      message.success(reviewOpen.pass ? '已批贷（Mock）' : '已拒绝并通知申请人');
      setReviewOpen(null);
      reviewForm.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const openDetail = async (loan: LoanItem): Promise<void> => {
    const data = await apiGet<LoanItem>(`/loans/${loan.id}`);
    setDetail(data);
    setDetailOpen(true);
  };

  const updateDoc = async (name: string, docStatus: string): Promise<void> => {
    if (!detail) return;
    try {
      const updated = await apiPatch<LoanItem>(`/loans/${detail.id}/documents`, { name, status: docStatus });
      setDetail(updated);
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<LoanItem> = [
    {
      title: '贷款单 / 合同',
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.contract.code} · {record.contract.listing.title}</div>
        </div>
      ),
    },
    { title: '银行 / 产品', width: 220, render: (_, record) => <span>{record.bankName}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.productName}</div></span> },
    { title: '贷款金额', width: 120, render: (_, record) => `${toWan(record.amount)} 万` },
    { title: '期限 / 利率', width: 130, render: (_, record) => `${record.termMonths} 期 / ${record.annualRate}%` },
    { title: '状态', width: 100, render: (_, record) => <Tag color={LOAN_STATUS[record.status]?.color}>{LOAN_STATUS[record.status]?.label}</Tag> },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space size={0} wrap>
          <Button size="small" type="link" onClick={() => void openDetail(record)}>详情</Button>
          {canOperate && record.status === 'draft' && <Button size="small" type="link" onClick={() => void operate(record, 'submit', '已提交银行预审（Mock）')}>提交</Button>}
          {canReview && record.status === 'submitted' && (
            <>
              <Button size="small" type="link" onClick={() => { setReviewOpen({ loan: record, pass: true }); reviewForm.setFieldsValue({ reason: '' }); }}>批贷</Button>
              <Button size="small" type="link" danger onClick={() => { setReviewOpen({ loan: record, pass: false }); reviewForm.setFieldsValue({ reason: '' }); }}>拒绝</Button>
            </>
          )}
          {['store_manager', 'finance', 'admin'].includes(user?.role ?? '') && record.status === 'approved' && (
            <Button size="small" type="link" onClick={() => void operate(record, 'disburse', '已放款（Mock）')}>放款</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          贷款管理 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>银行通道 Mock · 共 {total} 笔</Text>
        </Title>
        <Space>
          <Select allowClear placeholder="贷款状态" style={{ width: 140 }} value={status} data-testid="loans-status" onChange={(value) => { setPage(1); setStatus(value); }} options={Object.entries(LOAN_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
          {canOperate && <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()}>发起贷款</Button>}
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Modal title="发起贷款申请" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void submitCreate()} okText="创建" width={600}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="contractId" label="已签署合同" rules={[{ required: true, message: '请选择合同' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={contracts.map((item) => ({ value: item.id, label: `${item.code} · ${item.listing.title} · ${toWan(item.amount)} 万` }))}
            />
          </Form.Item>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="bankName" label="贷款银行" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <Select options={['江州银行·城东支行', '江州农商行·高新支行', '江城银行·滨江支行'].map((value) => ({ value, label: value }))} />
            </Form.Item>
            <Form.Item name="productName" label="贷款产品" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={['个人二手住房按揭贷', '公积金组合贷'].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="amount" label="贷款金额（元）" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <InputNumber min={10000} step={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="termMonths" label="期限（月）" rules={[{ required: true }]} style={{ width: 150, marginRight: 12 }}>
              <Select options={[120, 240, 300, 360].map((value) => ({ value, label: `${value} 期` }))} />
            </Form.Item>
            <Form.Item name="annualRate" label="年利率（%）" rules={[{ required: true }]} style={{ width: 150 }}>
              <InputNumber min={1} max={12} step={0.05} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
        </Form>
      </Modal>

      <Modal title={reviewOpen?.pass ? '批贷确认' : '拒绝贷款'} open={Boolean(reviewOpen)} onCancel={() => setReviewOpen(null)} onOk={() => void submitReview()} okText={reviewOpen?.pass ? '确认批贷' : '确认拒绝'} okButtonProps={{ danger: !reviewOpen?.pass }}>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="reason" label={reviewOpen?.pass ? '审批意见' : '拒绝原因（必填）'} rules={reviewOpen?.pass ? [] : [{ required: true, message: '请填写拒绝原因' }]}>
            <Input.TextArea rows={3} maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail ? `贷款详情 · ${detail.code}` : '贷款详情'} width={680} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={LOAN_STATUS[detail.status]?.color}>{LOAN_STATUS[detail.status]?.label}</Tag>
              <Tag>{detail.bankName}</Tag>
              <Tag>{detail.productName}</Tag>
            </Space>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="合同">{detail.contract.code}</Descriptions.Item>
              <Descriptions.Item label="房源">{detail.contract.listing.title}</Descriptions.Item>
              <Descriptions.Item label="贷款金额">{detail.amount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="期限/利率">{detail.termMonths} 期 / {detail.annualRate}%</Descriptions.Item>
              <Descriptions.Item label="提交时间">{detail.submittedAt ? dayjs(detail.submittedAt).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="批贷/放款">{detail.approvedAt ? dayjs(detail.approvedAt).format('YYYY-MM-DD') : '—'} / {detail.disbursedAt ? dayjs(detail.disbursedAt).format('YYYY-MM-DD') : '—'}</Descriptions.Item>
              <Descriptions.Item label="拒绝原因" span={2}>{detail.rejectReason ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 16 }}>材料清单</Title>
            <Table
              size="small"
              rowKey="name"
              pagination={false}
              dataSource={detail.documents}
              columns={[
                { title: '材料', dataIndex: 'name' },
                { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === 'verified' ? 'green' : value === 'uploaded' ? 'blue' : 'default'}>{value === 'verified' ? '已核验' : value === 'uploaded' ? '已上传' : '待上传'}</Tag> },
                {
                  title: '操作',
                  width: 140,
                  render: (_, record: { name: string; status: string }) =>
                    canOperate && record.status === 'pending' ? (
                      <Button size="small" type="link" onClick={() => void updateDoc(record.name, 'uploaded')}>标记上传</Button>
                    ) : canOperate && record.status === 'uploaded' ? (
                      <Button size="small" type="link" onClick={() => void updateDoc(record.name, 'verified')}>核验通过</Button>
                    ) : null,
                },
              ]}
            />

            <Title level={5} style={{ marginTop: 16 }}>评估委托</Title>
            {(detail.appraisals ?? []).length === 0 ? <Text type="secondary">暂无评估委托</Text> : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.appraisals}
                columns={[
                  { title: '评估机构', dataIndex: 'institutionName' },
                  { title: '上门时间', dataIndex: 'appointmentAt', width: 140, render: (value: string) => dayjs(value).format('YYYY-MM-DD') },
                  { title: '评估值', dataIndex: 'appraisedValue', width: 120, render: (value: number | null) => (value ? `${toWan(value)} 万` : '—') },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag>{value === 'reported' ? '已出报告' : value === 'visiting' ? '已上门' : '待上门'}</Tag> },
                ]}
              />
            )}
          </>
        )}
      </Drawer>
    </Card>
  );
}
