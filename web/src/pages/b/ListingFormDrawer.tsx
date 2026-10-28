import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Col, Divider, Drawer, Form, Input, InputNumber, Row, Select, Space, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { apiPatch, apiPost, apiUpload, errorMessage } from '../../api/client';
import type { AdminListing, CommunityOption, ListingImage } from '../../types';

interface SellerOption {
  id: string;
  name: string;
  phone: string;
}

interface AgentOption {
  id: string;
  name: string;
  agencyId: string;
  title: string;
}

interface Props {
  open: boolean;
  initial: AdminListing | null;
  communities: CommunityOption[];
  sellers: SellerOption[];
  agents: AgentOption[];
  canAssignAgent: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const ORIENTATIONS = ['南', '南北', '东南', '西南', '东', '西', '北', '东北', '西北'];
const DECORATIONS = ['毛坯', '简装', '精装', '豪装'];
const PROPERTY_TYPES = ['商品房', '房改房', '经济适用房', '公寓'];

export default function ListingFormDrawer({
  open,
  initial,
  communities,
  sellers,
  agents,
  canAssignAgent,
  onClose,
  onSaved,
}: Props): JSX.Element {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const area = Form.useWatch<number | undefined>('area', form);
  const unitPrice = Form.useWatch<number | undefined>('unitPrice', form);
  const priceReadonly = initial?.status === 'on_sale' || initial?.status === 'signed';

  const totalPriceText = useMemo(() => {
    if (!area || !unitPrice) return '—';
    return `${Math.round((area * unitPrice) / 1000) / 100} 万（按千元取整）`;
  }, [area, unitPrice]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        communityId: initial.community.id,
        ownerId: initial.owner.id,
        agentId: initial.agent.id,
        title: initial.title,
        area: initial.area,
        unitPrice: initial.unitPrice,
        rooms: initial.rooms,
        halls: initial.halls,
        bathrooms: initial.bathrooms,
        orientation: initial.orientation,
        floor: initial.floor,
        totalFloors: initial.totalFloors,
        buildYear: initial.buildYear,
        propertyType: initial.propertyType,
        decoration: initial.decoration,
        description: initial.description,
      });
      setFileList(
        initial.images.map((image, index) => ({
          uid: `existing-${index}`,
          name: image.name,
          status: 'done',
          url: image.url,
        })),
      );
    } else {
      form.resetFields();
      form.setFieldsValue({
        orientation: '南北',
        decoration: '精装',
        propertyType: '商品房',
        rooms: 3,
        halls: 2,
        bathrooms: 2,
        floor: 8,
        totalFloors: 26,
        buildYear: 2015,
      });
      setFileList([]);
    }
  }, [open, initial, form]);

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const images: ListingImage[] = fileList
        .filter((file) => file.status === 'done' && file.url)
        .map((file) => ({ name: file.name, url: file.url as string }));
      const payload = { ...values, images };
      setSubmitting(true);
      if (initial) {
        await apiPatch(`/listings/${initial.id}`, payload);
        message.success('房源已更新');
      } else {
        await apiPost('/listings', payload);
        message.success('房源已创建，请上传委托协议并提交验真');
      }
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof Error) message.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={initial ? `编辑房源 ${initial.code}` : '录入房源'}
      width={720}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={submitting} onClick={submit} data-testid="btn-save-listing">
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="communityId" label="所属小区" rules={[{ required: true, message: '请选择小区' }]}>
              <Select
                showSearch
                placeholder="搜索小区"
                optionFilterProp="label"
                options={communities.map((item) => ({ value: item.id, label: `${item.district} · ${item.name}` }))}
                data-testid="form-community"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ownerId" label="业主（卖方账号）" rules={[{ required: true, message: '请选择业主' }]}>
              <Select
                showSearch
                placeholder="搜索业主"
                optionFilterProp="label"
                options={sellers.map((item) => ({ value: item.id, label: `${item.name}（${item.phone}）` }))}
                data-testid="form-owner"
              />
            </Form.Item>
          </Col>
        </Row>

        {canAssignAgent && (
          <Form.Item name="agentId" label="维护经纪人">
            <Select
              allowClear
              placeholder="默认使用本店首位经纪人或当前登录人"
              options={agents.map((item) => ({ value: item.id, label: `${item.name}（${item.title}）` }))}
            />
          </Form.Item>
        )}

        <Form.Item name="title" label="房源标题" rules={[{ required: true, message: '请填写标题' }, { min: 4, message: '标题至少 4 个字' }]}>
          <Input placeholder="如：锦绣华庭 3室2厅 南北精装" maxLength={60} data-testid="form-title" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="area" label="建筑面积（㎡）" rules={[{ required: true, message: '请填写面积' }]}>
              <InputNumber min={20} max={1000} step={0.5} style={{ width: '100%' }} disabled={priceReadonly} data-testid="form-area" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="unitPrice" label="挂牌单价（元/㎡）" rules={[{ required: true, message: '请填写单价' }]}>
              <InputNumber min={3000} step={100} style={{ width: '100%' }} disabled={priceReadonly} data-testid="form-unit-price" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="总价（自动计算）">
              <div style={{ height: 32, lineHeight: '32px', color: '#f5222d', fontWeight: 600 }}>{totalPriceText}</div>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="rooms" label="室" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="halls" label="厅" rules={[{ required: true }]}>
              <InputNumber min={0} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="bathrooms" label="卫" rules={[{ required: true }]}>
              <InputNumber min={0} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="orientation" label="朝向" rules={[{ required: true }]}>
              <Select options={ORIENTATIONS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="floor" label="所在楼层" rules={[{ required: true }]}>
              <InputNumber min={1} max={99} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="totalFloors" label="总楼层" rules={[{ required: true }]}>
              <InputNumber min={1} max={99} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="buildYear" label="建成年份" rules={[{ required: true }]}>
              <InputNumber min={1980} max={2030} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="decoration" label="装修" rules={[{ required: true }]}>
              <Select options={DECORATIONS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="propertyType" label="产权性质" rules={[{ required: true }]}>
          <Select options={PROPERTY_TYPES.map((item) => ({ value: item, label: item }))} />
        </Form.Item>

        <Form.Item name="description" label="房源描述">
          <Input.TextArea rows={3} maxLength={2000} showCount placeholder="楼层、采光、配套、卖点等" />
        </Form.Item>

        <Form.Item label="房源图片（可选，最多 4 张）">
          <Upload
            listType="picture-card"
            fileList={fileList}
            maxCount={4}
            accept="image/png,image/jpeg,image/webp"
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                const formData = new FormData();
                formData.append('file', file as File);
                const result = await apiUpload<{ filePath: string; fileName: string }>('/attachments', formData, {
                  bizType: 'listing_image',
                  bizId: initial?.id ?? 'draft',
                });
                onSuccess?.(result);
              } catch (error) {
                onError?.(error as Error);
              }
            }}
            onChange={({ fileList: next }) => {
              setFileList(
                next.map((file) => {
                  const response = file.response as { filePath?: string } | undefined;
                  return {
                    ...file,
                    url: file.url ?? response?.filePath,
                    status: file.status === 'uploading' ? 'done' : file.status,
                  };
                }),
              );
            }}
            onPreview={(file) => {
              if (file.url) window.open(file.url, '_blank');
            }}
          >
            {fileList.length >= 4 ? null : (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 6, fontSize: 12 }}>上传</div>
              </div>
            )}
          </Upload>
        </Form.Item>
      </Form>

      <Divider />
      <div style={{ color: '#8a9099', fontSize: 12 }}>
        提交后房源进入「待审核」；需先上传委托协议（房源详情抽屉内）再提交验真，管理员验真通过后方可上架。
      </div>
    </Drawer>
  );
}
