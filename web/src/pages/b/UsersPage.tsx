import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { KeyOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

const { Title, Text } = Typography;

interface UserRow {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  agencyName: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: '买方',
  seller: '卖方',
  agent: '经纪人',
  store_manager: '店长',
  finance: '财务',
  admin: '平台管理员',
};

const ROLE_COLORS: Record<string, string> = {
  buyer: 'blue',
  seller: 'cyan',
  agent: 'green',
  store_manager: 'orange',
  finance: 'purple',
  admin: 'red',
};

export default function UsersPage(): JSX.Element {
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const toggleStatus = async (record: UserRow): Promise<void> => {
    try {
      const next = record.status === 'active' ? 'disabled' : 'active';
      await apiPatch(`/users/${record.id}/status`, { status: next });
      message.success(next === 'active' ? '账号已启用' : '账号已禁用');
      await load();
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const resetPassword = async (record: UserRow): Promise<void> => {
    try {
      const result = await apiPost<{ resetTo: string }>(`/users/${record.id}/reset-password`);
      message.success(`密码已重置为演示密码 ${result.resetTo}`);
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
    {
      title: '状态',
      width: 90,
      render: (_, record) => <Tag color={record.status === 'active' ? 'green' : 'red'}>{record.status === 'active' ? '正常' : '已禁用'}</Tag>,
    },
    {
      title: '操作',
      width: 210,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" icon={<KeyOutlined />} onClick={() => void resetPassword(record)} disabled={record.id === user?.id}>
            重置密码
          </Button>
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

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          账号与权限 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 个账号 · 角色分配与账号状态管理</Text>
        </Title>
        <Space wrap>
          <Input.Search allowClear placeholder="搜索姓名 / 手机号" style={{ width: 220 }} onSearch={(value) => { setPage(1); setKeyword(value); }} />
          <Select allowClear placeholder="角色" style={{ width: 140 }} value={role} onChange={(value) => { setPage(1); setRole(value); }} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} scroll={{ x: 900 }} />
      <div style={{ color: '#8a9099', fontSize: 12, marginTop: 12 }}>
        说明：管理员可禁用/启用账号、重置演示密码；演示环境所有账号初始密码为 123456，重置后密码不变更，仅作操作留痕。
      </div>
    </Card>
  );
}
