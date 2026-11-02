import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { CheckCircleOutlined, KeyOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, apiPut, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { MenuConfigItem, Role } from '../../types';
import { ROLE_LABELS } from '../../types';

const { Title, Text } = Typography;

interface UserRow {
  id: string;
  name: string;
  phone: string;
  role: Role;
  status: string;
  agencyId: string | null;
  agencyName: string | null;
  createdAt: string;
}

interface AgencyNode {
  id: string;
  name: string;
  type: string;
  children?: AgencyNode[];
}

const ROLE_COLORS: Record<string, string> = {
  buyer: 'blue',
  seller: 'cyan',
  agent: 'green',
  store_manager: 'orange',
  finance: 'purple',
  admin: 'red',
};

const MENU_OPTIONS = [
  { key: '/admin', label: '工作台' },
  { key: '/admin/listings', label: '房源管理' },
  { key: '/admin/approvals', label: '审批中心' },
  { key: '/admin/consultations', label: '房源咨询' },
  { key: '/admin/communities', label: '小区字典' },
  { key: '/admin/customers', label: '客户管理' },
  { key: '/admin/showings', label: '带看管理' },
  { key: '/admin/contracts', label: '合同签约' },
  { key: '/admin/progress', label: '交易进度' },
  { key: '/admin/loans', label: '贷款管理' },
  { key: '/admin/escrows', label: '资金监管' },
  { key: '/admin/transfers', label: '过户管理' },
  { key: '/admin/commissions', label: '佣金结算' },
  { key: '/admin/agencies', label: '门店与经纪人' },
  { key: '/admin/stats', label: '业绩统计' },
  { key: '/admin/audit', label: '后台审核' },
  { key: '/admin/logs', label: '操作日志' },
  { key: '/admin/users', label: '账号权限' },
  { key: '/admin/complaints', label: '投诉审核' },
  { key: '/admin/dicts', label: '数据字典' },
  { key: '/admin/templates', label: '合同模板' },
];

const STAFF_ROLES: Role[] = ['agent', 'store_manager', 'finance', 'admin'];

function flattenAgencies(nodes: AgencyNode[]): Array<{ id: string; name: string }> {
  const result: Array<{ id: string; name: string }> = [];
  const walk = (list: AgencyNode[]): void => {
    for (const node of list) {
      if (node.type === 'store') result.push({ id: node.id, name: node.name });
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export default function UsersPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([]);

  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [accountForm] = Form.useForm<{ phone: string; name: string; role: Role; agencyId?: string; password?: string }>();

  const [configs, setConfigs] = useState<MenuConfigItem[]>([]);
  const [configRole, setConfigRole] = useState<Role>('agent');
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: UserRow[]; total: number }>('/users', { params: { role, keyword: keyword || undefined, page, pageSize: 10 } });
      setRows(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [role, keyword, page, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void apiGet<AgencyNode[]>('/agencies')
      .then((data) => setAgencies(flattenAgencies(data)))
      .catch(() => setAgencies([]));
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      const data = await apiGet<MenuConfigItem[]>('/admin/menu-config');
      setConfigs(data);
    } catch {
      setConfigs([]);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    const current = configs.find((item) => item.role === configRole);
    setCheckedKeys(current?.menuKeys ?? []);
  }, [configs, configRole]);

  const resetPassword = async (record: UserRow): Promise<void> => {
    try {
      const result = await apiPost<{ resetTo: string }>(`/users/${record.id}/reset-password`);
      message.success(`密码已重置为演示密码 ${result.resetTo}`);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const toggleStatus = async (record: UserRow): Promise<void> => {
    try {
      await apiPatch(`/users/${record.id}/status`, { status: record.status === 'active' ? 'disabled' : 'active' });
      message.success(record.status === 'active' ? '账号已禁用' : '账号已启用');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const openCreate = (): void => {
    setEditing(null);
    accountForm.resetFields();
    accountForm.setFieldsValue({ role: 'agent' });
    setAccountOpen(true);
  };

  const openEdit = (record: UserRow): void => {
    setEditing(record);
    accountForm.setFieldsValue({ phone: record.phone, name: record.name, role: record.role, agencyId: record.agencyId ?? undefined });
    setAccountOpen(true);
  };

  const submitAccount = async (): Promise<void> => {
    try {
      const values = await accountForm.validateFields();
      if (editing) {
        await apiPatch(`/users/${editing.id}`, { role: values.role, agencyId: values.agencyId });
        message.success('账号角色已更新');
      } else {
        await apiPost('/users', values);
        message.success('账号已开通，初始密码为 123456');
      }
      setAccountOpen(false);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const saveMenuConfig = async (): Promise<void> => {
    try {
      await apiPut('/admin/menu-config', { role: configRole, menuKeys: checkedKeys });
      message.success('角色菜单配置已保存');
      await loadConfigs();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<UserRow> = [
    {
      title: '账号',
      render: (_, record) => (
        <div>
          <Text strong>{record.name}</Text>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.phone}</div>
        </div>
      ),
    },
    { title: '角色', width: 110, render: (_, record) => <Tag color={ROLE_COLORS[record.role]}>{ROLE_LABELS[record.role] ?? record.role}</Tag> },
    { title: '归属门店', width: 160, render: (_, record) => record.agencyName?.replace('安家地产·', '') ?? '—' },
    { title: '创建时间', width: 130, render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD') },
    { title: '状态', width: 90, render: (_, record) => <Tag color={record.status === 'active' ? 'green' : 'red'}>{record.status === 'active' ? '正常' : '已禁用'}</Tag> },
    {
      title: '操作',
      width: 300,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => openEdit(record)}>角色/门店</Button>
          <Button size="small" type="link" icon={<KeyOutlined />} onClick={() => void resetPassword(record)} disabled={record.id === user?.id}>重置密码</Button>
          <Button
            size="small"
            type="link"
            danger={record.status === 'active'}
            icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => void toggleStatus(record)}
            disabled={record.id === user?.id}
          >
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  const roleTabs = STAFF_ROLES.map((item) => ({ value: item, label: ROLE_LABELS[item] ?? item }));

  return (
    <Card>
      <Tabs
        items={[
          {
            key: 'accounts',
            label: '账号管理',
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    账号与权限 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 个账号 · 支持开通账号与角色分配</Text>
                  </Title>
                  <Space wrap>
                    <Input.Search allowClear placeholder="搜索姓名 / 手机号" style={{ width: 220 }} onSearch={(value) => { setPage(1); setKeyword(value); }} />
                    <Select allowClear placeholder="角色" style={{ width: 140 }} value={role} onChange={(value) => { setPage(1); setRole(value); }} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>开通账号</Button>
                  </Space>
                </div>
                <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} scroll={{ x: 1000 }} />
                <div style={{ color: '#8a9099', fontSize: 12, marginTop: 12 }}>
                  说明：开通账号后初始密码为 123456；经纪人角色会自动创建经纪人档案；角色变更后菜单权限按「权限配置」生效。
                </div>
              </>
            ),
          },
          {
            key: 'menu',
            label: '权限配置',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>角色菜单配置</Title>
                  <Space>
                    <Select style={{ width: 160 }} value={configRole} onChange={(value) => setConfigRole(value)} options={roleTabs} data-testid="menu-config-role" />
                    <Button type="primary" onClick={() => void saveMenuConfig()}>保存配置</Button>
                  </Space>
                </div>
                <Checkbox.Group value={checkedKeys} onChange={(values) => setCheckedKeys(values as string[])} style={{ width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {MENU_OPTIONS.map((item) => (
                      <Checkbox key={item.key} value={item.key} style={{ padding: '8px 12px', border: '1px solid #eef0f3', borderRadius: 6 }}>
                        {item.label}
                        <span style={{ color: '#b0b6be', fontSize: 12, marginLeft: 6 }}>{item.key}</span>
                      </Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
                <div style={{ color: '#8a9099', fontSize: 12, marginTop: 16 }}>
                  说明：保存后对应角色登录时只显示勾选的 B 端菜单；管理员角色默认拥有全部菜单。
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal title={editing ? '编辑角色 / 门店' : '开通账号'} open={accountOpen} onCancel={() => setAccountOpen(false)} onOk={() => void submitAccount()} okText="保存" width={520}>
        <Form form={accountForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请填写姓名' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请填写手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]}>
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleTabs} />
          </Form.Item>
          <Form.Item name="agencyId" label="归属门店" rules={[{ required: true, message: '请选择归属门店' }]}>
            <Select showSearch optionFilterProp="label" options={agencies.map((item) => ({ value: item.id, label: item.name.replace('安家地产·', '') }))} />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="初始密码（默认 123456）">
              <Input placeholder="留空则使用 123456" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
