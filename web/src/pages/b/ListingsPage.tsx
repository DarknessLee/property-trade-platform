import { useCallback, useEffect, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { CloudUploadOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, apiUpload, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { AdminListing, CommunityOption, Paginated } from '../../types';
import { LISTING_STATUS, VERIFY_STATUS } from '../../types';
import { formatDate, formatPrice, toWan } from '../../utils/format';
import ListingFormDrawer from './ListingFormDrawer';

const { Text, Title } = Typography;

const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'];

export default function ListingsPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const isAdmin = user?.role === 'admin';
  const canAssignAgent = user?.role === 'store_manager' || user?.role === 'admin';

  const [rows, setRows] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [verifyStatus, setVerifyStatus] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();

  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [sellers, setSellers] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; agencyId: string; title: string }>>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminListing | null>(null);
  const [detail, setDetail] = useState<AdminListing | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<AdminListing | null>(null);
  const [priceTarget, setPriceTarget] = useState<AdminListing | null>(null);
  const [priceForm] = Form.useForm<{ newTotalPrice: number; reason: string }>();
  const [keyTarget, setKeyTarget] = useState<AdminListing | null>(null);
  const [keyForm] = Form.useForm<{ keyCount: number; handoverTo: string; remark?: string }>();
  const [auditForm] = Form.useForm<{ pass: boolean; reason?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<AdminListing>>('/listings', {
        params: {
          keyword: keyword || undefined,
          status,
          verifyStatus,
          district,
          page,
          pageSize: 10,
        },
      });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, verifyStatus, district, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiGet<CommunityOption[]>('/communities/options').then(setCommunities).catch(() => setCommunities([]));
    void apiGet<Array<{ id: string; name: string; phone: string }>>('/users/options', { params: { role: 'seller' } })
      .then(setSellers)
      .catch(() => setSellers([]));
    if (canAssignAgent) {
      void apiGet<Array<{ id: string; name: string; agencyId: string; title: string }>>('/agents/options')
        .then(setAgents)
        .catch(() => setAgents([]));
    }
  }, [canAssignAgent]);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (record: AdminListing): void => {
    setEditing(record);
    setFormOpen(true);
  };

  const openDetail = async (record: AdminListing): Promise<void> => {
    try {
      const data = await apiGet<AdminListing>(`/listings/${record.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const refreshDetail = async (): Promise<void> => {
    if (!detail) return;
    const data = await apiGet<AdminListing>(`/listings/${detail.id}`);
    setDetail(data);
  };

  const action = async (record: AdminListing, path: string, success: string): Promise<void> => {
    try {
      await apiPost(`/listings/${record.id}/${path}`);
      message.success(success);
      await load();
      if (detail?.id === record.id) await refreshDetail();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const submitAudit = async (): Promise<void> => {
    if (!auditTarget) return;
    try {
      const values = await auditForm.validateFields();
      await apiPost(`/listings/${auditTarget.id}/verify`, values);
      message.success(values.pass ? '验真通过，经纪人可上架' : '已驳回并通知经纪人');
      setAuditTarget(null);
      auditForm.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<AdminListing> = [
    {
      title: '房源编号 / 标题',
      dataIndex: 'code',
      width: 260,
      render: (_, record) => (
        <div>
          <Text strong>{record.title}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>
            {record.code} · {record.community.district} · {record.community.name}
          </div>
        </div>
      ),
    },
    {
      title: '户型 / 面积',
      width: 130,
      render: (_, record) => (
        <div>
          {record.rooms}室{record.halls}厅 · {record.area}㎡
          <div style={{ color: '#8a9099', fontSize: 12 }}>
            {record.orientation} · {record.decoration}
          </div>
        </div>
      ),
    },
    {
      title: '总价 / 单价',
      width: 150,
      render: (_, record) => (
        <div>
          <span style={{ color: '#f5222d', fontWeight: 600 }}>{toWan(record.totalPrice)} 万</span>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.unitPrice.toLocaleString()} 元/㎡</div>
        </div>
      ),
    },
    {
      title: '维护人',
      width: 130,
      render: (_, record) => (
        <div>
          {record.agent.name}
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.agency.name.replace('安家地产·', '')}</div>
        </div>
      ),
    },
    {
      title: '状态',
      width: 110,
      render: (_, record) => {
        const info = LISTING_STATUS[record.status] ?? { label: record.status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '验真',
      width: 110,
      render: (_, record) => {
        const info = VERIFY_STATUS[record.verifyStatus] ?? { label: record.verifyStatus, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '挂牌时间',
      width: 110,
      render: (_, record) => formatDate(record.listedAt),
    },
    {
      title: '操作',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0} wrap>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => void openDetail(record)}>
            详情
          </Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)} disabled={record.status === 'signed'}>
            编辑
          </Button>
          {record.status === 'on_sale' ? (
            <>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setPriceTarget(record);
                  priceForm.setFieldsValue({ newTotalPrice: record.totalPrice, reason: '' });
                }}
                data-testid={`btn-price-${record.code}`}
              >
                调价申请
              </Button>
              <Button size="small" type="link" danger onClick={() => void action(record, 'offline', '房源已下架')}>
                下架
              </Button>
            </>
          ) : (
            <>
              {['pending', 'offline'].includes(record.status) && (
                <Button size="small" type="link" onClick={() => void action(record, 'submit-verify', '已提交验真')}>
                  提交验真
                </Button>
              )}
              {record.verifyStatus === 'verified' && ['pending', 'offline'].includes(record.status) && (
                <Button size="small" type="link" onClick={() => void action(record, 'publish', '房源已上架')}>
                  上架
                </Button>
              )}
              {isAdmin && record.verifyStatus === 'pending' && (
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    setAuditTarget(record);
                    auditForm.setFieldsValue({ pass: true });
                  }}
                >
                  验真审核
                </Button>
              )}
            </>
          )}
          {['on_sale', 'signed'].includes(record.status) && (
            <Button size="small" type="link" onClick={() => { setKeyTarget(record); keyForm.setFieldsValue({ keyCount: 1, handoverTo: '', remark: '' }); }} data-testid={`btn-key-${record.code}`}>
              钥匙委托
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            房源管理{' '}
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              共 {total} 套 · {user?.role === 'agent' ? '仅显示本人维护房源' : '显示本店房源'}
            </Text>
          </Title>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} data-testid="btn-create-listing">
            录入房源
          </Button>
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="搜索标题 / 编号 / 小区"
          style={{ width: 240 }}
          onSearch={(value) => {
            setPage(1);
            setKeyword(value);
          }}
          data-testid="listings-search"
        />
        <Select
          allowClear
          placeholder="房源状态"
          style={{ width: 130 }}
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          options={Object.entries(LISTING_STATUS).map(([value, info]) => ({ value, label: info.label }))}
          data-testid="listings-status-filter"
        />
        <Select
          allowClear
          placeholder="验真状态"
          style={{ width: 130 }}
          value={verifyStatus}
          onChange={(value) => {
            setPage(1);
            setVerifyStatus(value);
          }}
          options={Object.entries(VERIFY_STATUS).map(([value, info]) => ({ value, label: info.label }))}
        />
        <Select
          allowClear
          placeholder="区域"
          style={{ width: 130 }}
          value={district}
          onChange={(value) => {
            setPage(1);
            setDistrict(value);
          }}
          options={DISTRICTS.map((item) => ({ value: item, label: item }))}
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1200 }}
        locale={{ emptyText: <Empty description="暂无房源，点击右上角录入" /> }}
        pagination={{
          current: page,
          pageSize: 10,
          total,
          showSizeChanger: false,
          onChange: setPage,
          showTotal: (value) => `共 ${value} 条`,
        }}
        data-testid="listings-table"
      />

      <ListingFormDrawer
        open={formOpen}
        initial={editing}
        communities={communities}
        sellers={sellers}
        agents={agents}
        canAssignAgent={canAssignAgent}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setPage(1);
          void load();
        }}
      />

      <Drawer
        title={detail ? `房源详情 · ${detail.code}` : '房源详情'}
        width={680}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detail && (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>
              {detail.title}
            </Title>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={LISTING_STATUS[detail.status]?.color}>{LISTING_STATUS[detail.status]?.label}</Tag>
              <Tag color={VERIFY_STATUS[detail.verifyStatus]?.color}>{VERIFY_STATUS[detail.verifyStatus]?.label}</Tag>
              <Tag>{detail.propertyType}</Tag>
              <Tag>{detail.decoration}</Tag>
            </Space>

            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="小区">{detail.community.name}</Descriptions.Item>
              <Descriptions.Item label="区域">{detail.community.district}</Descriptions.Item>
              <Descriptions.Item label="面积">{detail.area} ㎡</Descriptions.Item>
              <Descriptions.Item label="户型">
                {detail.rooms}室{detail.halls}厅{detail.bathrooms}卫
              </Descriptions.Item>
              <Descriptions.Item label="总价">{formatPrice(detail.totalPrice)}</Descriptions.Item>
              <Descriptions.Item label="单价">{detail.unitPrice.toLocaleString()} 元/㎡</Descriptions.Item>
              <Descriptions.Item label="楼层">
                {detail.floor}/{detail.totalFloors} 层
              </Descriptions.Item>
              <Descriptions.Item label="建成年份">{detail.buildYear}</Descriptions.Item>
              <Descriptions.Item label="业主">{detail.owner.name}（{detail.owner.phone}）</Descriptions.Item>
              <Descriptions.Item label="维护人">{detail.agent.name}</Descriptions.Item>
              <Descriptions.Item label="挂牌时间" span={2}>
                {formatDate(detail.listedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              委托协议附件
            </Divider>
            {(detail.attachments ?? []).length === 0 ? (
              <Text type="secondary">暂无附件，请上传房屋出售委托协议（PDF/图片）后再提交验真。</Text>
            ) : (
              <ul style={{ paddingLeft: 20 }}>
                {(detail.attachments ?? []).map((item) => (
                  <li key={item.id}>
                    <a href={item.filePath} target="_blank" rel="noreferrer">
                      {item.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <Upload
              accept=".pdf,image/png,image/jpeg"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const formData = new FormData();
                  formData.append('file', file as File);
                  await apiUpload('/attachments', formData, { bizType: 'listing_agreement', bizId: detail.id });
                  onSuccess?.({});
                  message.success('委托协议已上传');
                  await refreshDetail();
                } catch (error) {
                  onError?.(error as Error);
                  message.error(errorMessage(error));
                }
              }}
            >
              <Button icon={<CloudUploadOutlined />} style={{ marginTop: 8 }} data-testid="btn-upload-agreement">
                上传委托协议
              </Button>
            </Upload>

            <Divider />
            <Space wrap>
              <Button
                onClick={() => {
                  setDetailOpen(false);
                  openEdit(detail);
                }}
              >
                编辑
              </Button>
              {['pending', 'offline'].includes(detail.status) && (
                <Button onClick={() => void action(detail, 'submit-verify', '已提交验真')}>提交验真</Button>
              )}
              {detail.verifyStatus === 'verified' && ['pending', 'offline'].includes(detail.status) && (
                <Button type="primary" onClick={() => void action(detail, 'publish', '房源已上架')}>
                  上架
                </Button>
              )}
              {detail.status === 'on_sale' && (
                <Button danger onClick={() => void action(detail, 'offline', '房源已下架')}>
                  下架
                </Button>
              )}
            </Space>
          </div>
        )}
      </Drawer>

      <Modal
        title="房源验真审核"
        open={Boolean(auditTarget)}
        onCancel={() => setAuditTarget(null)}
        onOk={() => void submitAudit()}
        okText="提交"
      >
        <Form form={auditForm} layout="vertical">
          <Form.Item name="pass" label="审核结果" rules={[{ required: true }]}>
            <Select
              options={[
                { value: true, label: '通过（经纪人可上架）' },
                { value: false, label: '驳回（需填写原因）' },
              ]}
              onChange={(value) => {
                if (!value) auditForm.setFieldsValue({ reason: '' });
              }}
            />
          </Form.Item>
          <Form.Item name="reason" label="驳回原因（驳回时必填）">
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="如：委托协议缺少业主签字页" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="调价审批申请"
        open={Boolean(priceTarget)}
        onCancel={() => setPriceTarget(null)}
        okText="提交审批"
        onOk={async () => {
          if (!priceTarget) return;
          try {
            const values = await priceForm.validateFields();
            await apiPost('/approvals/price-change', { listingId: priceTarget.id, newTotalPrice: Math.round(Number(values.newTotalPrice)), reason: values.reason });
            message.success('调价申请已提交，等待店长/管理员审批');
            setPriceTarget(null);
            priceForm.resetFields();
            await load();
          } catch (error) {
            if (error instanceof Error) message.error(errorMessage(error));
          }
        }}
        width={520}
      >
        {priceTarget && (
          <>
            <div style={{ marginBottom: 12, color: '#6b7280' }}>
              {priceTarget.title} · 当前挂牌价 <b>{priceTarget.totalPrice.toLocaleString()}</b> 元（{toWan(priceTarget.totalPrice)} 万）
            </div>
            <Form form={priceForm} layout="vertical">
              <Form.Item name="newTotalPrice" label="申请新总价（元）" rules={[{ required: true, message: '请填写新总价' }]}>
                <InputNumber min={100000} step={10000} style={{ width: '100%' }} data-testid="price-new-total" />
              </Form.Item>
              <Form.Item name="reason" label="调价原因" rules={[{ required: true, message: '请填写调价原因' }]}>
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="如：业主急售/同户型成交价偏低/市场回暖上调" data-testid="price-reason" />
              </Form.Item>
            </Form>
            <div style={{ color: '#8a9099', fontSize: 12 }}>提交后进入审批中心，审批通过后挂牌价自动更新并写入价格历史。</div>
          </>
        )}
      </Modal>

      <Modal
        title="钥匙委托审批申请"
        open={Boolean(keyTarget)}
        onCancel={() => setKeyTarget(null)}
        okText="提交审批"
        onOk={async () => {
          if (!keyTarget) return;
          try {
            const values = await keyForm.validateFields();
            await apiPost('/approvals/key-handover', { listingId: keyTarget.id, ...values });
            message.success('钥匙委托申请已提交，等待店长/管理员审批');
            setKeyTarget(null);
            keyForm.resetFields();
          } catch (error) {
            if (error instanceof Error) message.error(errorMessage(error));
          }
        }}
        width={520}
      >
        {keyTarget && (
          <>
            <div style={{ marginBottom: 12, color: '#6b7280' }}>{keyTarget.title} · {keyTarget.community.name}</div>
            <Form form={keyForm} layout="vertical">
              <Form.Item name="keyCount" label="钥匙数量（把）" rules={[{ required: true }]}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} data-testid="key-count" />
              </Form.Item>
              <Form.Item name="handoverTo" label="受托方 / 保管人" rules={[{ required: true, message: '请填写受托方' }]}>
                <Input placeholder="如：城东店钥匙柜 / 店长赵敏" data-testid="key-handover-to" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} maxLength={200} showCount placeholder="如：业主委托门店保管，带看时登记领用" data-testid="key-remark" />
              </Form.Item>
            </Form>
            <div style={{ color: '#8a9099', fontSize: 12 }}>提交后进入审批中心，审批通过后生效（不改变房源状态）。</div>
          </>
        )}
      </Modal>
    </Card>
  );
}
