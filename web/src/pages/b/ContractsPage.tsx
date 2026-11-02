import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage, http } from '../../api/client';
import type { AdminListing, Contract, ContractTemplate, Customer, Paginated, ProgressNode } from '../../types';
import { CONTRACT_STATUS, PROGRESS_NODES, PROGRESS_STATUS } from '../../types';
import { formatDate, toWan } from '../../utils/format';

const { Title, Text } = Typography;

export default function ContractsPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  const [detail, setDetail] = useState<Contract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<Contract>>('/contracts', { params: { status, keyword: keyword || undefined, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [status, keyword, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async (): Promise<void> => {
    try {
      const [listingData, customerData, templateData] = await Promise.all([
        apiGet<Paginated<AdminListing>>('/listings', { params: { status: 'on_sale', pageSize: 60 } }),
        apiGet<Customer[]>('/customers/options'),
        apiGet<ContractTemplate[]>('/contracts/templates'),
      ]);
      setListings(listingData.items);
      setCustomers(customerData);
      setTemplates(templateData);
      createForm.resetFields();
      createForm.setFieldsValue({ commissionRate: 0.015, templateId: templateData[0]?.id });
      setCreateOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const selectedListing = useMemo(() => {
    const id = createForm.getFieldValue('listingId') as string | undefined;
    return listings.find((item) => item.id === id) ?? null;
  }, [createForm, listings, createOpen]);

  const submitCreate = async (): Promise<void> => {
    try {
      const values = await createForm.validateFields();
      const created = await apiPost<Contract>('/contracts', values);
      message.success(`合同 ${created.code} 已生成，等待双方签署`);
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const openDetail = async (record: Contract): Promise<void> => {
    try {
      const data = await apiGet<Contract>(`/contracts/${record.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const refreshDetail = async (): Promise<void> => {
    if (!detail) return;
    const data = await apiGet<Contract>(`/contracts/${detail.id}`);
    setDetail(data);
    await load();
  };

  const sign = async (): Promise<void> => {
    if (!detail) return;
    try {
      await apiPost(`/contracts/${detail.id}/sign`);
      message.success('电子签署完成（Mock e签宝）：房源已转为已签约');
      await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const voidContract = async (): Promise<void> => {
    if (!detail) return;
    Modal.confirm({
      title: '确认作废该合同？',
      content: '作废后不可恢复，且不可再签署。',
      onOk: async () => {
        try {
          await apiPost(`/contracts/${detail.id}/void`);
          message.success('合同已作废');
          await refreshDetail();
        } catch (error) {
          message.error(errorMessage(error));
        }
      },
    });
  };

  const download = async (): Promise<void> => {
    if (!detail) return;
    try {
      const response = await http.get(`/contracts/${detail.id}/download`, { responseType: 'blob' });
      const blob = new Blob([response as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${detail.code}-房屋买卖合同.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('合同 PDF 已下载');
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      width: 160,
      render: (_, record) => (
        <div>
          <Text strong>{record.code}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{formatDate(record.createdAt)}</div>
        </div>
      ),
    },
    {
      title: '房源',
      render: (_, record) => (
        <div>
          {record.listing.title}
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.listing.community.district} · {record.listing.community.name} · {record.listing.area}㎡</div>
        </div>
      ),
    },
    { title: '成交价', width: 120, render: (_, record) => <span style={{ color: '#f5222d', fontWeight: 600 }}>{toWan(record.amount)} 万</span> },
    { title: '买卖双方', width: 140, render: (_, record) => <span>{record.buyer.name} / {record.seller.name}</span> },
    {
      title: '状态',
      width: 100,
      render: (_, record) => <Tag color={CONTRACT_STATUS[record.signStatus]?.color}>{CONTRACT_STATUS[record.signStatus]?.label}</Tag>,
    },
    { title: '进度', width: 110, render: (_, record) => `${record.progressDone}/${record.progressTotal} 节点` },
    {
      title: '操作',
      width: 110,
      render: (_, record) => <Button size="small" type="link" onClick={() => void openDetail(record)}>查看</Button>,
    },
  ];

  const progressItems = (detail?.progress ?? []).map((node: ProgressNode) => ({
    title: PROGRESS_NODES[node.nodeType] ?? node.nodeType,
    status: node.status === 'done' ? ('finish' as const) : node.status === 'doing' ? ('process' as const) : ('wait' as const),
    description: (
      <div style={{ fontSize: 12 }}>
        <Tag color={PROGRESS_STATUS[node.status]?.color}>{PROGRESS_STATUS[node.status]?.label}</Tag>
        {node.completedAt ? <span>完成于 {formatDate(node.completedAt)}</span> : node.plannedDate ? <span>计划 {formatDate(node.plannedDate)}</span> : null}
      </div>
    ),
  }));

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          合同签约 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 份合同</Text>
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()} data-testid="btn-create-contract">发起签约</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear placeholder="搜索合同编号 / 房源 / 客户" style={{ width: 260 }} onSearch={(value) => { setPage(1); setKeyword(value); }} />
        <Select allowClear placeholder="合同状态" style={{ width: 140 }} value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={Object.entries(CONTRACT_STATUS).map(([value, info]) => ({ value, label: info.label }))} />
      </Space>

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1000 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Modal title="发起签约" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void submitCreate()} okText="生成合同" width={640}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="listingId" label="在售房源" rules={[{ required: true, message: '请选择房源' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择房源"
              onChange={() => createForm.setFieldsValue({ amount: undefined })}
              options={listings.map((item) => ({ value: item.id, label: `${item.title} · ${toWan(item.totalPrice)} 万` }))}
              data-testid="contract-listing"
            />
          </Form.Item>
          <div style={{ marginBottom: 16, color: '#8a9099', fontSize: 12 }}>
            合同金额自动取房源挂牌总价{selectedListing ? `：${selectedListing.totalPrice.toLocaleString()} 元` : ''}（演示规则：金额必须等于挂牌总价）
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="buyerCustomerId" label="买方客户" rules={[{ required: true, message: '请选择买方' }]} style={{ flex: 1, marginRight: 12 }}>
              <Select showSearch optionFilterProp="label" options={customers.filter((item) => item.type === 'buyer').map((item) => ({ value: item.id, label: `${item.name}（${item.phone}）` }))} data-testid="contract-buyer" />
            </Form.Item>
            <Form.Item name="sellerCustomerId" label="卖方客户" rules={[{ required: true, message: '请选择卖方' }]} style={{ flex: 1 }}>
              <Select showSearch optionFilterProp="label" options={customers.filter((item) => item.type === 'seller').map((item) => ({ value: item.id, label: `${item.name}（${item.phone}）` }))} data-testid="contract-seller" />
            </Form.Item>
          </Space.Compact>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="templateId" label="合同模板" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <Select options={templates.map((item) => ({ value: item.id, label: `${item.name} ${item.version}` }))} />
            </Form.Item>
            <Form.Item name="commissionRate" label="佣金率" style={{ width: 150 }}>
              <Select options={[0.01, 0.015, 0.02, 0.025].map((value) => ({ value, label: `${(value * 100).toFixed(1)}%` }))} />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="terms" label="补充条款（在线填写，可选）">
            <Input.TextArea rows={4} maxLength={2000} showCount placeholder="如：交房前房屋内固定装修及家电家具按现状保留，具体以《交房清单》为准。" data-testid="contract-terms" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail ? `合同详情 · ${detail.code}` : '合同详情'} width={720} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={CONTRACT_STATUS[detail.signStatus]?.color}>{CONTRACT_STATUS[detail.signStatus]?.label}</Tag>
              {detail.esignNo && <Tag color="purple">电子签：{detail.esignNo}</Tag>}
              {detail.signMethod === 'esign_mock' && <Tag>Mock e签宝</Tag>}
            </Space>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="房源" span={2}>{detail.listing.title}（{detail.listing.code}）</Descriptions.Item>
              <Descriptions.Item label="成交金额">{detail.amount.toLocaleString()} 元（{toWan(detail.amount)} 万）</Descriptions.Item>
              <Descriptions.Item label="定金">{detail.depositAmount ? `${detail.depositAmount.toLocaleString()} 元` : '—'}</Descriptions.Item>
              <Descriptions.Item label="佣金">{detail.commissionAmount.toLocaleString()} 元（{(detail.commissionRate * 100).toFixed(1)}%）</Descriptions.Item>
              <Descriptions.Item label="签署时间">{detail.signedAt ? dayjs(detail.signedAt).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="买受人">{detail.buyer.name}（{detail.buyer.phone}）</Descriptions.Item>
              <Descriptions.Item label="出卖人">{detail.seller.name}（{detail.seller.phone}）</Descriptions.Item>
              <Descriptions.Item label="经纪人">{detail.agent.name}</Descriptions.Item>
              <Descriptions.Item label="门店">{detail.agency?.name}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>交易进度</Title>
            {progressItems.length > 0 ? <Steps direction="vertical" size="small" current={progressItems.findIndex((item) => item.status === 'process')} items={progressItems} /> : <Empty description="暂无进度节点" />}

            <Title level={5} style={{ marginTop: 16 }}>资金记录</Title>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.payments ?? []}
              columns={[
                { title: '类型', dataIndex: 'type', width: 100, render: (value: string) => ({ deposit: '定金', down_payment: '首付', balance: '尾款', commission: '佣金' }[value] ?? value) },
                { title: '金额', dataIndex: 'amount', render: (value: number) => `${value.toLocaleString()} 元` },
                { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag color={value === 'paid' ? 'green' : 'default'}>{value === 'paid' ? '已支付' : value === 'refunded' ? '已退款' : '待支付'}</Tag> },
                { title: '流水号', dataIndex: 'tradeNo', width: 190 },
              ]}
            />

            <Title level={5} style={{ marginTop: 16 }}>合同正文（签署快照）</Title>
            <pre style={{ background: '#fafbfc', padding: 12, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>
              {detail.contentSnapshot || detail.template?.name}
            </pre>
            {detail.customTerms && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>补充条款</Title>
                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: 12, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {detail.customTerms}
                </div>
              </>
            )}

            <Space wrap style={{ marginTop: 16 }}>
              {['draft', 'pending'].includes(detail.signStatus) && (
                <Button type="primary" onClick={() => void sign()} data-testid="btn-sign-contract">电子签署（Mock）</Button>
              )}
              {['draft', 'pending'].includes(detail.signStatus) && (
                <Button danger onClick={() => void voidContract()}>作废合同</Button>
              )}
              <Button icon={<DownloadOutlined />} onClick={() => void download()}>下载 PDF</Button>
            </Space>
          </>
        )}
      </Drawer>
    </Card>
  );
}
