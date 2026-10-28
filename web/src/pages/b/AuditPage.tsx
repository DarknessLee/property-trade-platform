import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { AuditOutlined, IdcardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { AdminListing } from '../../types';
import { formatPrice } from '../../utils/format';

const { Title, Text } = Typography;

interface RealNameRow {
  id: string;
  realName: string;
  idCardMasked: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  user: { id: string; name: string; phone: string; role: string };
}

const ROLE_LABELS: Record<string, string> = {
  buyer: '买方',
  seller: '卖方',
  agent: '经纪人',
  store_manager: '店长',
  finance: '财务',
  admin: '平台管理员',
};

export default function AuditPage(): JSX.Element {
  const { message } = AntdApp.useApp();
  const [tab, setTab] = useState('listings');

  // ---------- 房源验真 ----------
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingTotal, setListingTotal] = useState(0);
  const [listingPage, setListingPage] = useState(1);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingTarget, setListingTarget] = useState<AdminListing | null>(null);
  const [listingForm] = Form.useForm<{ pass: boolean; reason?: string }>();

  // ---------- 实名审核 ----------
  const [realNames, setRealNames] = useState<RealNameRow[]>([]);
  const [realNameTotal, setRealNameTotal] = useState(0);
  const [realNamePage, setRealNamePage] = useState(1);
  const [realNameStatus, setRealNameStatus] = useState('pending');
  const [realNameLoading, setRealNameLoading] = useState(false);
  const [realNameTarget, setRealNameTarget] = useState<RealNameRow | null>(null);
  const [realNameForm] = Form.useForm<{ pass: boolean; reason?: string }>();

  const loadListings = useCallback(async () => {
    setListingLoading(true);
    try {
      const data = await apiGet<{ items: AdminListing[]; total: number }>('/listings', { params: { verifyStatus: 'pending', page: listingPage, pageSize: 10 } });
      setListings(data.items);
      setListingTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setListingLoading(false);
    }
  }, [listingPage, message]);

  const loadRealNames = useCallback(async () => {
    setRealNameLoading(true);
    try {
      const data = await apiGet<{ items: RealNameRow[]; total: number }>('/admin/audits/realnames', { params: { status: realNameStatus, page: realNamePage } });
      setRealNames(data.items);
      setRealNameTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setRealNameLoading(false);
    }
  }, [realNameStatus, realNamePage, message]);

  useEffect(() => {
    if (tab === 'listings') void loadListings();
    else void loadRealNames();
  }, [tab, loadListings, loadRealNames]);

  const submitListingAudit = async (): Promise<void> => {
    if (!listingTarget) return;
    try {
      const values = await listingForm.validateFields();
      await apiPost(`/listings/${listingTarget.id}/verify`, values);
      message.success(values.pass ? '验真通过，已通知经纪人上架' : '已驳回，经纪人将收到通知');
      setListingTarget(null);
      listingForm.resetFields();
      await loadListings();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const submitRealNameAudit = async (): Promise<void> => {
    if (!realNameTarget) return;
    try {
      const values = await realNameForm.validateFields();
      await apiPost(`/admin/audits/realnames/${realNameTarget.id}`, values);
      message.success(values.pass ? '实名认证已通过并通知用户' : '已驳回并通知用户');
      setRealNameTarget(null);
      realNameForm.resetFields();
      await loadRealNames();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const listingColumns: ColumnsType<AdminListing> = [
    {
      title: '房源',
      render: (_, record) => (
        <div>
          <Text strong>{record.title}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.code} · {record.community.district} · {record.community.name}</div>
        </div>
      ),
    },
    { title: '面积', width: 90, render: (_, record) => `${record.area}㎡` },
    { title: '总价', width: 110, render: (_, record) => <span style={{ color: '#f5222d' }}>{formatPrice(record.totalPrice)}</span> },
    { title: '维护人', width: 110, render: (_, record) => record.agent.name },
    {
      title: '操作',
      width: 110,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<AuditOutlined />}
          onClick={() => {
            setListingTarget(record);
            listingForm.setFieldsValue({ pass: true, reason: '' });
          }}
          data-testid={`btn-audit-${record.code}`}
        >
          审核
        </Button>
      ),
    },
  ];

  const realNameColumns: ColumnsType<RealNameRow> = [
    { title: '用户', width: 150, render: (_, record) => <span>{record.user.name}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.user.phone} · {ROLE_LABELS[record.user.role] ?? record.user.role}</div></span> },
    { title: '真实姓名', dataIndex: 'realName', width: 110 },
    { title: '证件号（脱敏）', dataIndex: 'idCardMasked' },
    { title: '提交时间', width: 150, render: (_, record) => dayjs(record.submittedAt).format('YYYY-MM-DD HH:mm') },
    { title: '状态', width: 110, render: (_, record) => <Tag color={record.status === 'approved' ? 'green' : record.status === 'rejected' ? 'red' : 'gold'}>{record.status === 'approved' ? '已通过' : record.status === 'rejected' ? '已驳回' : '待审核'}</Tag> },
    {
      title: '操作',
      width: 110,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Button
            type="primary"
            size="small"
            icon={<IdcardOutlined />}
            onClick={() => {
              setRealNameTarget(record);
              realNameForm.setFieldsValue({ pass: true, reason: '' });
            }}
            data-testid={`btn-audit-realname-${record.id.slice(0, 6)}`}
          >
            审核
          </Button>
        ) : null,
    },
  ];

  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'listings',
            label: `房源验真（${listingTotal}）`,
            children: (
              <>
                <Title level={5} style={{ marginTop: 0 }}>
                  房源验真审核 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>待审核 {listingTotal} 套</Text>
                </Title>
                <Table rowKey="id" columns={listingColumns} dataSource={listings} loading={listingLoading} pagination={{ current: listingPage, pageSize: 10, total: listingTotal, onChange: setListingPage, showSizeChanger: false }} locale={{ emptyText: '暂无待审核房源' }} />
              </>
            ),
          },
          {
            key: 'realnames',
            label: `实名认证（${realNameTotal}）`,
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Title level={5} style={{ margin: 0 }}>实名认证审核</Title>
                  <Select
                    style={{ width: 130 }}
                    value={realNameStatus}
                    onChange={(value) => { setRealNamePage(1); setRealNameStatus(value); }}
                    options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }]}
                  />
                </Space>
                <Table rowKey="id" columns={realNameColumns} dataSource={realNames} loading={realNameLoading} pagination={{ current: realNamePage, pageSize: 10, total: realNameTotal, onChange: setRealNamePage, showSizeChanger: false }} locale={{ emptyText: '暂无实名审核记录' }} />
              </>
            ),
          },
        ]}
      />

      <Modal title="房源验真审核" open={Boolean(listingTarget)} onCancel={() => setListingTarget(null)} onOk={() => void submitListingAudit()} okText="提交">
        {listingTarget && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="房源">{listingTarget.title}</Descriptions.Item>
              <Descriptions.Item label="业主">{listingTarget.owner.name}</Descriptions.Item>
              <Descriptions.Item label="小区">{listingTarget.community.name}</Descriptions.Item>
              <Descriptions.Item label="委托协议">{(listingTarget.attachments ?? []).length} 份</Descriptions.Item>
            </Descriptions>
            <Form form={listingForm} layout="vertical">
              <Form.Item name="pass" label="审核结果" rules={[{ required: true }]}>
                <Select options={[{ value: true, label: '通过（经纪人可上架）' }, { value: false, label: '驳回（需填写原因）' }]} />
              </Form.Item>
              <Form.Item name="reason" label="驳回原因（驳回时必填）">
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="如：产权照片不清晰、委托协议缺失" />
              </Form.Item>
            </Form>
            <Space>
              {(listingTarget.attachments ?? []).map((item) => (
                <Tag key={item.id}>
                  <a href={item.filePath} target="_blank" rel="noreferrer">{item.fileName}</a>
                </Tag>
              ))}
            </Space>
          </>
        )}
      </Modal>

      <Modal title="实名认证审核" open={Boolean(realNameTarget)} onCancel={() => setRealNameTarget(null)} onOk={() => void submitRealNameAudit()} okText="提交">
        {realNameTarget && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="用户">{realNameTarget.user.name}（{realNameTarget.user.phone}）</Descriptions.Item>
              <Descriptions.Item label="提交姓名">{realNameTarget.realName}</Descriptions.Item>
              <Descriptions.Item label="证件号">{realNameTarget.idCardMasked}</Descriptions.Item>
            </Descriptions>
            <Form form={realNameForm} layout="vertical">
              <Form.Item name="pass" label="审核结果" rules={[{ required: true }]}>
                <Select options={[{ value: true, label: '通过' }, { value: false, label: '驳回（需填写原因）' }]} />
              </Form.Item>
              <Form.Item name="reason" label="驳回原因（驳回时必填）">
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="如：证件信息模糊、与姓名不一致" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
}
