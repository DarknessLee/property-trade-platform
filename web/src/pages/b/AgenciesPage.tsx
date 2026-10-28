import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { PlusOutlined, ShopOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;

interface AgencyStats {
  agentCount: number;
  listingCount: number;
  onSaleCount: number;
  customerCount: number;
  showingCount: number;
  signedContractCount: number;
  dealAmount: number;
  commissionAmount: number;
}

interface AgencyNode {
  id: string;
  name: string;
  type: string;
  licenseNo: string;
  address: string;
  phone: string;
  stats: AgencyStats;
  children?: AgencyNode[];
}

interface AgentRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  title: string;
  licenseNo: string;
  status: string;
  userStatus: string;
  agency: { id: string; name: string };
  joinedAt: string;
  stats: { listingCount: number; customerCount: number; showingCount: number; signedContractCount: number; dealAmount: number };
}

export default function AgenciesPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const isAdmin = user?.role === 'admin';
  const canManage = isAdmin || user?.role === 'store_manager';

  const [tree, setTree] = useState<AgencyNode[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeForm] = Form.useForm();
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [agentForm] = Form.useForm<{ title: string; status: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [treeData, agentData] = await Promise.all([apiGet<AgencyNode[]>('/agencies'), apiGet<AgentRow[]>('/agents')]);
      setTree(treeData);
      setAgents(agentData);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const createStore = async (): Promise<void> => {
    try {
      const values = await storeForm.validateFields();
      await apiPost('/agencies', values);
      message.success('门店已创建');
      setStoreOpen(false);
      storeForm.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const saveAgent = async (): Promise<void> => {
    if (!editingAgent) return;
    try {
      const values = await agentForm.validateFields();
      await apiPost(`/agents/${editingAgent.id}`, values);
      message.success('经纪人信息已更新');
      setEditingAgent(null);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const agentColumns: ColumnsType<AgentRow> = [
    {
      title: '经纪人',
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text> <Tag color="gold">{record.title}</Tag>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.phone} · 执业证号 {record.licenseNo}</div>
        </div>
      ),
    },
    { title: '门店', width: 160, render: (_, record) => record.agency.name.replace('安家地产·', '') },
    {
      title: '房源/客户/带看',
      width: 160,
      render: (_, record) => (
        <span>
          {record.stats.listingCount} / {record.stats.customerCount} / {record.stats.showingCount}
        </span>
      ),
    },
    {
      title: '成交',
      width: 160,
      render: (_, record) => (
        <div>
          <Text strong>{record.stats.signedContractCount} 单</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>成交额 {toWan(record.stats.dealAmount)} 万</div>
        </div>
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_, record) => (
        <Tag color={record.userStatus === 'active' ? 'green' : 'red'}>{record.userStatus === 'active' ? '在职' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 110,
      render: (_, record) =>
        canManage ? (
          <Button
            size="small"
            type="link"
            onClick={() => {
              setEditingAgent(record);
              agentForm.setFieldsValue({ title: record.title, status: record.status });
            }}
          >
            调整
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Card
        title={<span><ShopOutlined /> 机构与门店</span>}
        extra={
          isAdmin ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { storeForm.resetFields(); setStoreOpen(true); }} data-testid="btn-create-agency">
              新增门店
            </Button>
          ) : null
        }
        style={{ marginBottom: 16 }}
        loading={loading}
      >
        {tree.map((hq) => (
          <div key={hq.id}>
            <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="机构">{hq.name}</Descriptions.Item>
              <Descriptions.Item label="资质编号">{hq.licenseNo}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{hq.phone}</Descriptions.Item>
              <Descriptions.Item label="门店数">{hq.children?.length ?? 0}</Descriptions.Item>
              <Descriptions.Item label="经纪人">{hq.stats.agentCount} 人</Descriptions.Item>
              <Descriptions.Item label="房源/在售">{hq.stats.listingCount} / {hq.stats.onSaleCount}</Descriptions.Item>
              <Descriptions.Item label="累计签约">{hq.stats.signedContractCount} 单</Descriptions.Item>
              <Descriptions.Item label="成交金额">{toWan(hq.stats.dealAmount)} 万</Descriptions.Item>
              <Descriptions.Item label="佣金">{toWan(hq.stats.commissionAmount)} 万</Descriptions.Item>
            </Descriptions>
            <Row gutter={[16, 16]}>
              {(hq.children ?? []).map((store) => (
                <Col xs={24} md={12} xl={8} key={store.id}>
                  <Card size="small" className="card-hover">
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{store.name}</div>
                    <div style={{ color: '#8a9099', fontSize: 12, marginBottom: 10 }}>{store.address}</div>
                    <Row gutter={8}>
                      <Col span={8}><Statistic title="在售" value={store.stats.onSaleCount} suffix="套" valueStyle={{ fontSize: 18 }} /></Col>
                      <Col span={8}><Statistic title="经纪" value={store.stats.agentCount} suffix="人" valueStyle={{ fontSize: 18 }} /></Col>
                      <Col span={8}><Statistic title="签约" value={store.stats.signedContractCount} suffix="单" valueStyle={{ fontSize: 18 }} /></Col>
                    </Row>
                    <div style={{ color: '#8a9099', fontSize: 12, marginTop: 8 }}>成交额 {toWan(store.stats.dealAmount)} 万 · 佣金 {toWan(store.stats.commissionAmount)} 万</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
        {tree.length === 0 && <Text type="secondary">暂无机构数据</Text>}
      </Card>

      <Card title={<span><TeamOutlined /> 经纪人团队</span>} extra={<Text type="secondary" style={{ fontSize: 12 }}>{agents.length} 人</Text>}>
        <Table rowKey="id" columns={agentColumns} dataSource={agents} pagination={false} scroll={{ x: 900 }} />
      </Card>

      <Modal title="新增门店" open={storeOpen} onCancel={() => setStoreOpen(false)} onOk={() => void createStore()} okText="创建" width={560}>
        <Form form={storeForm} layout="vertical">
          <Form.Item name="name" label="门店名称" rules={[{ required: true, message: '请填写门店名称' }]}>
            <Input placeholder="如：安家地产·新城店" data-testid="agency-name" />
          </Form.Item>
          <Form.Item name="licenseNo" label="备案资质编号" rules={[{ required: true, message: '请填写资质编号' }]}>
            <Input placeholder="如：JJ-2026-0100" data-testid="agency-license" />
          </Form.Item>
          <Form.Item name="address" label="门店地址" rules={[{ required: true, message: '请填写地址' }]}>
            <Input placeholder="如：江州市城东区东湖大道 100 号" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请填写电话' }]}>
            <Input placeholder="如：0571-88000010" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`调整经纪人 · ${editingAgent?.name ?? ''}`} open={Boolean(editingAgent)} onCancel={() => setEditingAgent(null)} onOk={() => void saveAgent()} okText="保存" width={480}>
        <Form form={agentForm} layout="vertical">
          <Form.Item name="title" label="职级" rules={[{ required: true }]}>
            <Select options={['房产经纪人', '资深经纪人', '金牌经纪人', '门店主管'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="status" label="执业状态" rules={[{ required: true }]}>
            <Select options={[{ value: 'active', label: '在职' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>
        </Form>
        <div style={{ color: '#8a9099', fontSize: 12 }}>入职时间：{editingAgent ? dayjs(editingAgent.joinedAt).format('YYYY-MM-DD') : '—'}</div>
      </Modal>
    </div>
  );
}
