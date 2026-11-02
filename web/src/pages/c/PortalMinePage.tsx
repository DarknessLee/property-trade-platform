import { useEffect, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { CheckCircleOutlined, DownloadOutlined, IdcardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../auth/AuthContext';
import { apiGet, apiPatch, apiPost, errorMessage, http } from '../../api/client';
import { TOKEN_KEY } from '../../api/client';
import type { ComplaintItem, ConsultationItem, Contract, ProgressNode, Showing } from '../../types';
import { COMPLAINT_STATUS, COMPLAINT_TYPE, CONTRACT_STATUS, PROGRESS_NODES, PROGRESS_STATUS, SHOWING_STATUS } from '../../types';
import { formatDate, toWan } from '../../utils/format';

const { Title, Text } = Typography;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function PortalMinePage(): JSX.Element {
  const { user, loading, refresh } = useAuth();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<{ realName: string; idCard: string }>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [showings, setShowings] = useState<Showing[]>([]);
  const [showingsLoading, setShowingsLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [detail, setDetail] = useState<Contract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [fullFlow, setFullFlow] = useState<{
    loan: { code: string; status: string; amount: number; bankName: string } | null;
    escrow: { code: string; status: string; totalAmount: number; releasedAmount: number } | null;
    materials: Array<{ status: string }>;
    taxes: Array<{ status: string }>;
    appointments: Array<{ status: string }>;
    registration: { status: string } | null;
    commission: { status: string; totalCommission: number } | null;
  } | null>(null);

  const loadShowings = async (): Promise<void> => {
    setShowingsLoading(true);
    try {
      setShowings(await apiGet<Showing[]>('/showings/my'));
    } catch {
      setShowings([]);
    } finally {
      setShowingsLoading(false);
    }
  };

  const loadContracts = async (): Promise<void> => {
    setContractsLoading(true);
    try {
      const data = await apiGet<{ items: Contract[] }>('/contracts', { params: { pageSize: 20 } });
      setContracts(data.items);
    } catch {
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const [consultations, setConsultations] = useState<ConsultationItem[]>([]);
  const [consultLoading, setConsultLoading] = useState(false);
  const loadConsultations = async (): Promise<void> => {
    setConsultLoading(true);
    try {
      setConsultations(await apiGet<ConsultationItem[]>('/consultations/my'));
    } catch {
      setConsultations([]);
    } finally {
      setConsultLoading(false);
    }
  };

  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [complaintForm] = Form.useForm<{ type: string; content: string }>();
  const loadComplaints = async (): Promise<void> => {
    try {
      setComplaints(await apiGet<ComplaintItem[]>('/complaints/my'));
    } catch {
      setComplaints([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    void apiGet<{ items: NotificationItem[]; unreadCount: number }>('/notifications')
      .then((data) => {
        setNotifications(data.items);
        setUnread(data.unreadCount);
      })
      .catch(() => undefined);
    if (user.role === 'buyer') void loadShowings();
    void loadContracts();
    void loadConsultations();
    void loadComplaints();
  }, [user]);

  if (loading) {
    return (
      <div className="page-section" style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const submitRealName = async (values: { realName: string; idCard: string }): Promise<void> => {
    setSubmitting(true);
    try {
      await apiPost('/auth/realname', values);
      message.success('实名认证资料已提交（演示环境自动进入待审核）');
      form.resetFields();
      await refresh();
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const markAllRead = async (): Promise<void> => {
    try {
      await apiPost('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
      message.success('已全部标记为已读');
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const cancelShowing = async (showing: Showing): Promise<void> => {
    try {
      await apiPatch(`/showings/my/${showing.id}/cancel`);
      message.success('带看已取消');
      await loadShowings();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const openContract = async (contract: Contract): Promise<void> => {
    try {
      const [data, flow] = await Promise.all([
        apiGet<Contract>(`/contracts/${contract.id}`),
        apiGet<typeof fullFlow>(`/contracts/${contract.id}/full-flow`).catch(() => null),
      ]);
      setDetail(data);
      setFullFlow(flow);
      setDetailOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const signContract = async (): Promise<void> => {
    if (!detail) return;
    try {
      await apiPost(`/contracts/${detail.id}/sign`);
      message.success('签署成功，交易进度已更新');
      await openContract(detail);
      await loadContracts();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const downloadContract = async (): Promise<void> => {
    if (!detail) return;
    try {
      const blob = (await http.get(`/contracts/${detail.id}/download`, { responseType: 'blob' })) as unknown as Blob;
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

  const realNameTag =
    user.realNameStatus === 'approved' ? (
      <Tag icon={<CheckCircleOutlined />} color="success">已实名</Tag>
    ) : user.realNameStatus === 'pending' ? (
      <Tag color="processing">实名审核中</Tag>
    ) : user.realNameStatus === 'rejected' ? (
      <Tag color="error">实名被驳回</Tag>
    ) : (
      <Tag color="default">未实名</Tag>
    );

  const showingColumns: ColumnsType<Showing> = [
    {
      title: '预约时间',
      width: 160,
      render: (_, record) => (
        <div>
          {dayjs(record.scheduledAt).format('YYYY-MM-DD HH:mm')}
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.code}</div>
        </div>
      ),
    },
    { title: '房源', render: (_, record) => <div>{record.listing.title}<div style={{ color: '#8a9099', fontSize: 12 }}>{record.listing.community.name}</div></div> },
    { title: '经纪人', width: 100, render: (_, record) => record.agent.name },
    { title: '状态', width: 90, render: (_, record) => <Tag color={SHOWING_STATUS[record.status]?.color}>{SHOWING_STATUS[record.status]?.label}</Tag> },
    {
      title: '操作',
      width: 100,
      render: (_, record) =>
        ['pending', 'confirmed'].includes(record.status) ? (
          <Button size="small" type="link" danger onClick={() => void cancelShowing(record)}>取消</Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        ),
    },
  ];

  const contractColumns: ColumnsType<Contract> = [
    { title: '合同编号', dataIndex: 'code', width: 160 },
    { title: '房源', render: (_, record) => record.listing.title },
    { title: '成交价', width: 110, render: (_, record) => `${toWan(record.amount)} 万` },
    { title: '状态', width: 100, render: (_, record) => <Tag color={CONTRACT_STATUS[record.signStatus]?.color}>{CONTRACT_STATUS[record.signStatus]?.label}</Tag> },
    { title: '进度', width: 100, render: (_, record) => `${record.progressDone}/${record.progressTotal}` },
    {
      title: '操作',
      width: 100,
      render: (_, record) => <Button size="small" type="link" onClick={() => void openContract(record)}>查看</Button>,
    },
  ];

  const timelineOf = (progress: ProgressNode[] | undefined): Array<{ title: string; status: 'finish' | 'process' | 'wait'; description: JSX.Element }> =>
    (progress ?? []).map((node) => ({
      title: PROGRESS_NODES[node.nodeType] ?? node.nodeType,
      status: node.status === 'done' ? 'finish' : node.status === 'doing' ? 'process' : 'wait',
      description: (
        <span style={{ fontSize: 12 }}>
          <Tag color={PROGRESS_STATUS[node.status]?.color}>{PROGRESS_STATUS[node.status]?.label}</Tag>
          {node.completedAt ? `完成 ${formatDate(node.completedAt)}` : node.plannedDate ? `计划 ${formatDate(node.plannedDate)}` : ''}
        </span>
      ),
    }));

  return (
    <div className="page-section" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card>
            <Space size={16} align="start">
              <Avatar size={64} style={{ background: '#1677ff', fontSize: 24 }}>
                {user.name.slice(0, 1)}
              </Avatar>
              <div>
                <Title level={4} style={{ margin: 0 }} data-testid="mine-name">{user.name}</Title>
                <Space size={6} style={{ marginTop: 6 }}>
                  <Tag color="blue">{user.roleLabel}</Tag>
                  {realNameTag}
                </Space>
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>{user.phone} {user.agencyName ? `· ${user.agencyName}` : ''}</div>
              </div>
            </Space>
            <Divider />
            <Descriptions column={1} size="small">
              <Descriptions.Item label="账号 ID">{user.id}</Descriptions.Item>
              <Descriptions.Item label="注册手机">{user.phone}</Descriptions.Item>
              <Descriptions.Item label="实名状态">
                {user.realNameStatus === 'approved' ? '已通过' : user.realNameStatus === 'pending' ? '审核中' : user.realNameStatus === 'rejected' ? '已驳回' : '未提交'}
              </Descriptions.Item>
              <Descriptions.Item label="带看记录">{showings.length} 次</Descriptions.Item>
              <Descriptions.Item label="合同数量">{contracts.length} 份</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={<span><IdcardOutlined /> 实名认证</span>} style={{ marginTop: 16 }} data-testid="realname-card">
            {user.realNameStatus === 'approved' ? (
              <Alert type="success" showIcon message="已完成实名认证" description="您的身份信息已脱敏存储，仅用于交易核验。" />
            ) : (
              <>
                <Alert style={{ marginBottom: 16 }} type="info" showIcon message="演示环境" description="证件号需通过 GB 11643 校验位，提交后自动进入待审核状态；不会调用真实核验接口。" />
                <Form form={form} layout="vertical" onFinish={submitRealName} initialValues={{ realName: user.name }}>
                  <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请填写真实姓名' }]}>
                    <Input placeholder="请输入真实姓名" data-testid="input-realname" />
                  </Form.Item>
                  <Form.Item name="idCard" label="身份证号" rules={[{ required: true, message: '请填写身份证号' }, { pattern: /^\d{17}[\dXx]$/, message: '身份证号应为 18 位' }]}>
                    <Input placeholder="18 位身份证号" data-testid="input-idcard" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={submitting} icon={<SafetyCertificateOutlined />} data-testid="btn-submit-realname">提交实名认证</Button>
                </Form>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card>
            <Tabs
              defaultActiveKey="showings"
              items={[
                {
                  key: 'showings',
                  label: `我的预约（${showings.length}）`,
                  children: (
                    <Table rowKey="id" columns={showingColumns} dataSource={showings} loading={showingsLoading} pagination={false} locale={{ emptyText: <Empty description="还没有预约记录，去房源详情页预约看房吧" /> }} data-testid="my-showings-table" />
                  ),
                },
                {
                  key: 'contracts',
                  label: `我的合同（${contracts.length}）`,
                  children: (
                    <Table rowKey="id" columns={contractColumns} dataSource={contracts} loading={contractsLoading} pagination={false} locale={{ emptyText: <Empty description="暂无合同" /> }} data-testid="my-contracts-table" />
                  ),
                },
                {
                  key: 'consultations',
                  label: `我的咨询（${consultations.length}）`,
                  children: (
                    <List
                      loading={consultLoading}
                      dataSource={consultations}
                      locale={{ emptyText: '暂无咨询记录，可在房源详情页发起在线咨询' }}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                <span style={{ fontWeight: 600 }}>{item.listing.title}</span>
                                <Tag color={item.status === 'replied' ? 'green' : 'gold'}>{item.status === 'replied' ? '已回复' : '待回复'}</Tag>
                              </Space>
                            }
                            description={
                              <div>
                                <div style={{ color: '#4b5563', marginTop: 4 }}>我的留言：{item.content}</div>
                                {item.replyContent && (
                                  <div style={{ background: '#f0f7ff', borderRadius: 6, padding: '8px 10px', marginTop: 6 }}>
                                    <div style={{ color: '#1677ff', fontSize: 12, marginBottom: 2 }}>经纪人回复 · {item.repliedAt ? formatDate(item.repliedAt) : ''}</div>
                                    <div style={{ color: '#1f2329' }}>{item.replyContent}</div>
                                  </div>
                                )}
                                <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ),
                },
                {
                  key: 'complaints',
                  label: `投诉建议（${complaints.length}）`,
                  children: (
                    <>
                      <Form form={complaintForm} layout="vertical" initialValues={{ type: 'listing_quality' }}>
                        <Form.Item name="type" label="投诉类型" rules={[{ required: true }]}>
                          <Select options={Object.entries(COMPLAINT_TYPE).map(([value, label]) => ({ value, label }))} />
                        </Form.Item>
                        <Form.Item name="content" label="投诉/建议内容" rules={[{ required: true, message: '请填写内容' }]}>
                          <Input.TextArea rows={3} maxLength={500} showCount placeholder="请描述遇到的问题，平台将安排专人核实处理" data-testid="complaint-content" />
                        </Form.Item>
                        <Button
                          type="primary"
                          onClick={async () => {
                            try {
                              const values = await complaintForm.validateFields();
                              await apiPost('/complaints', { ...values, contactName: user.name, contactPhone: user.phone });
                              message.success('投诉已提交，管理员将尽快处理');
                              complaintForm.resetFields();
                              await loadComplaints();
                            } catch (error) {
                              if (error instanceof Error) message.error(errorMessage(error));
                            }
                          }}
                          data-testid="btn-submit-complaint"
                        >
                          提交投诉
                        </Button>
                      </Form>
                      <Divider />
                      <List
                        dataSource={complaints}
                        locale={{ emptyText: '暂无投诉记录' }}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <span style={{ fontWeight: 600 }}>{COMPLAINT_TYPE[item.type] ?? item.type}</span>
                                  <Tag color={COMPLAINT_STATUS[item.status]?.color}>{COMPLAINT_STATUS[item.status]?.label}</Tag>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{item.code}</Text>
                                </Space>
                              }
                              description={
                                <div>
                                  <div style={{ color: '#4b5563' }}>{item.content}</div>
                                  {item.handleComment && <div style={{ color: '#1677ff', fontSize: 13, marginTop: 4 }}>平台回复：{item.handleComment}</div>}
                                  <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                                </div>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </>
                  ),
                },
                {
                  key: 'messages',
                  label: `我的消息${unread > 0 ? `（${unread}）` : ''}`,
                  children: (
                    <>
                      <div style={{ textAlign: 'right', marginBottom: 8 }}>
                        <Button size="small" onClick={() => void markAllRead()} disabled={unread === 0}>全部已读</Button>
                      </div>
                      <List
                        dataSource={notifications}
                        locale={{ emptyText: '暂无消息' }}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              title={<Space><span style={{ fontWeight: item.isRead ? 400 : 600 }}>{item.title}</span>{!item.isRead && <Tag color="red">未读</Tag>}</Space>}
                              description={<div><div style={{ color: '#4b5563' }}>{item.content}</div><Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text></div>}
                            />
                          </List.Item>
                        )}
                      />
                    </>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={detail ? `合同详情 · ${detail.code}` : '合同详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={680}
      >
        {detail && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={CONTRACT_STATUS[detail.signStatus]?.color}>{CONTRACT_STATUS[detail.signStatus]?.label}</Tag>
              {detail.esignNo && <Tag color="purple">{detail.esignNo}</Tag>}
            </Space>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="房源" span={2}>{detail.listing.title}</Descriptions.Item>
              <Descriptions.Item label="成交价">{detail.amount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="佣金">{detail.commissionAmount.toLocaleString()} 元</Descriptions.Item>
              <Descriptions.Item label="买方">{detail.buyer.name}</Descriptions.Item>
              <Descriptions.Item label="卖方">{detail.seller.name}</Descriptions.Item>
            </Descriptions>
            <Title level={5} style={{ marginTop: 16 }}>交易进度</Title>
            <Steps direction="vertical" size="small" items={timelineOf(detail.progress)} />
            {fullFlow && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>交易后链路</Title>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="贷款">
                    {fullFlow.loan ? `${fullFlow.loan.bankName} · ${fullFlow.loan.status === 'disbursed' ? '已放款' : fullFlow.loan.status === 'approved' ? '已批贷' : fullFlow.loan.status === 'rejected' ? '已拒绝' : '办理中'}` : '未申请'}
                  </Descriptions.Item>
                  <Descriptions.Item label="资金监管">
                    {fullFlow.escrow ? `${fullFlow.escrow.status === 'released' ? '已解冻' : '监管中'} · 已解冻 ${Math.round(fullFlow.escrow.releasedAmount / 10000)} 万 / ${Math.round(fullFlow.escrow.totalAmount / 10000)} 万` : '未开户'}
                  </Descriptions.Item>
                  <Descriptions.Item label="过户材料">
                    {fullFlow.materials.length > 0 ? `${fullFlow.materials.filter((item) => item.status === 'verified').length}/${fullFlow.materials.length} 已核验` : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="税费">
                    {fullFlow.taxes.length > 0 ? `${fullFlow.taxes.filter((item) => item.status === 'paid').length}/${fullFlow.taxes.length} 已缴纳` : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="不动产登记">
                    {fullFlow.registration ? { submitted: '已提交', accepted: '已受理', registered: '已登簿', completed: '已领证' }[fullFlow.registration.status] ?? fullFlow.registration.status : '未提交'}
                  </Descriptions.Item>
                  <Descriptions.Item label="佣金结算">
                    {fullFlow.commission ? `${fullFlow.commission.status === 'paid' ? '已支付' : fullFlow.commission.status === 'confirmed' ? '已确认' : '待确认'} · ${fullFlow.commission.totalCommission.toLocaleString()} 元` : '未结算'}
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
            <Space style={{ marginTop: 12 }}>
              {['draft', 'pending'].includes(detail.signStatus) && (
                <Button type="primary" onClick={() => void signContract()} data-testid="btn-sign-contract-customer">确认签署</Button>
              )}
              <Button icon={<DownloadOutlined />} onClick={() => void downloadContract()}>下载合同 PDF</Button>
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
}
