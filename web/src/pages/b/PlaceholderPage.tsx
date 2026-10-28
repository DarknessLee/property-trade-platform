import { Alert, Card, Space, Tag, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function PlaceholderPage({ title, planned }: { title: string; planned: string }): JSX.Element {
  return (
    <Card>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {title} <Tag color="orange" icon={<ClockCircleOutlined />}>建设中</Tag>
          </Title>
          <Text type="secondary">该模块已纳入契约与数据基座，将在后续阶段交付。</Text>
        </div>
        <Alert type="info" showIcon message="交付计划" description={planned} />
        <div className="placeholder-box" style={{ background: '#fafafa' }}>
          <Text type="secondary">
            当前阶段（M1 契约与数据基座）已完成：用户认证、数据模型、种子数据、权限骨架、统一响应与错误码。
            <br />
            页面功能按阶段推进，验收通过后更新此处。
          </Text>
        </div>
      </Space>
    </Card>
  );
}
