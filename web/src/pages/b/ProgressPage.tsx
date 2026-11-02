import { useCallback, useEffect, useState } from 'react';
import { App as AntdApp, Button, Card, Drawer, Empty, Form, Input, Modal, Select, Space, Table, Tag, Timeline, Typography } from 'antd';
import { BellOutlined, NodeIndexOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { Contract, Paginated, ProgressNode } from '../../types';
import { CONTRACT_STATUS, PROGRESS_NODES, PROGRESS_STATUS } from '../../types';
import { formatDate, toWan } from '../../utils/format';

const { Title, Text } = Typography;

export default function ProgressPage(): JSX.Element {
  const { user } = useAuth();
  const canOperate = user?.role !== 'finance';
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Contract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nodeForm] = Form.useForm<{ status: string; remark?: string }>();
  const [activeNode, setActiveNode] = useState<ProgressNode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Paginated<Contract>>('/contracts', { params: { page, pageSize: 10 } });
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

  const openDetail = async (record: Contract): Promise<void> => {
    try {
      const data = await apiGet<Contract>(`/contracts/${record.id}`);
      setDetail(data);
      setDetailOpen(true);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const refresh = async (): Promise<void> => {
    if (!detail) return;
    const data = await apiGet<Contract>(`/contracts/${detail.id}`);
    setDetail(data);
    await load();
  };

  const saveNode = async (): Promise<void> => {
    if (!activeNode) return;
    try {
      const values = await nodeForm.validateFields();
      await apiPatch(`/progress/${activeNode.id}`, values);
      message.success('进度已更新，并通知买卖双方');
      setActiveNode(null);
      nodeForm.resetFields();
      await refresh();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    }
  };

  const notify = async (node: ProgressNode): Promise<void> => {
    try {
      const result = await apiPost<{ sent: number }>(`/progress/${node.id}/notify`);
      message.success(`已向 ${result.sent} 位交易相关方发送进度提醒`);
    } catch (error) {
      message.error(errorMessage(error));
    }
  };

  const columns: ColumnsType<Contract> = [
    { title: '合同编号', dataIndex: 'code', width: 160 },
    {
      title: '房源 / 双方',
      render: (_, record) => (
        <div>
          {record.listing.title}
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.buyer.name} 买入 · {record.seller.name} 卖出</div>
        </div>
      ),
    },
    { title: '成交价', width: 110, render: (_, record) => <span>{toWan(record.amount)} 万</span> },
    {
      title: '合同状态',
      width: 100,
      render: (_, record) => <Tag color={CONTRACT_STATUS[record.signStatus]?.color}>{CONTRACT_STATUS[record.signStatus]?.label}</Tag>,
    },
    {
      title: '交易进度',
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ color: '#8a9099', fontSize: 12 }}>{record.progressDone}/{record.progressTotal} 节点完成</div>
          <div style={{ height: 6, background: '#eef0f3', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${record.progressTotal ? (record.progressDone / record.progressTotal) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg,#1677ff,#36cfc9)',
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      width: 110,
      render: (_, record) => <Button size="small" type="link" icon={<NodeIndexOutlined />} onClick={() => void openDetail(record)}>管理进度</Button>,
    },
  ];

  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>
        交易进度 <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>共 {total} 份合同 · 节点顺序推进：面签→贷款审批→缴税→过户→交房</Text>
      </Title>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }} pagination={{ current: page, pageSize: 10, total, showSizeChanger: false, onChange: setPage }} />

      <Drawer title={detail ? `交易进度 · ${detail.code}` : '交易进度'} width={640} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {detail ? (
          <>
            <div style={{ color: '#6b7280', marginBottom: 16 }}>
              {detail.listing.title} · {toWan(detail.amount)} 万 · 买方 {detail.buyer.name} / 卖方 {detail.seller.name}
            </div>
            <Timeline
              items={(detail.progress ?? []).map((node) => ({
                color: node.status === 'done' ? 'green' : node.status === 'doing' ? 'blue' : 'gray',
                children: (
                  <div>
                    <Space wrap>
                      <Text strong>{PROGRESS_NODES[node.nodeType] ?? node.nodeType}</Text>
                      <Tag color={PROGRESS_STATUS[node.status]?.color}>{PROGRESS_STATUS[node.status]?.label}</Tag>
                      {node.completedAt && <Text type="secondary" style={{ fontSize: 12 }}>完成 {formatDate(node.completedAt)}</Text>}
                      {node.plannedDate && !node.completedAt && <Text type="secondary" style={{ fontSize: 12 }}>计划 {formatDate(node.plannedDate)}</Text>}
                    </Space>
                    <div style={{ marginTop: 6 }}>
                      {canOperate && node.status !== 'done' && (
                        <Space size={4}>
                          <Button
                            size="small"
                            onClick={() => {
                              setActiveNode(node);
                              nodeForm.setFieldsValue({ status: node.status === 'todo' ? 'doing' : 'done', remark: node.remark ?? '' });
                            }}
                          >
                            更新状态
                          </Button>
                          <Button size="small" icon={<BellOutlined />} onClick={() => void notify(node)}>提醒双方</Button>
                        </Space>
                      )}
                      {node.remark && <div style={{ color: '#8a9099', fontSize: 12, marginTop: 4 }}>{node.remark}</div>}
                    </div>
                  </div>
                ),
              }))}
            />
            <Empty description="节点详情按顺序推进；跳节点将被后端拒绝" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </>
        ) : null}
      </Drawer>

      <Modal title={`更新节点 · ${activeNode ? PROGRESS_NODES[activeNode.nodeType] : ''}`} open={Boolean(activeNode)} onCancel={() => setActiveNode(null)} onOk={() => void saveNode()} okText="保存" width={460}>
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="status" label="节点状态" rules={[{ required: true }]}>
            <Select options={[{ value: 'doing', label: '进行中' }, { value: 'done', label: '已完成（通知双方）' }]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} maxLength={200} placeholder={`如：${dayjs().format('MM月DD日')} 已预约办理`} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
