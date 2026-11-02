import { Alert, Avatar, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Image, Input, Modal, Row, Select, Space, Spin, Switch, Tag, TimePicker, Typography, App as AntdApp } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined, PhoneOutlined, ScheduleOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { Listing } from '../../types';
import { toWan } from '../../components/ListingCard';
import PriceChart from '../../components/PriceChart';
import PriceTrendChart from '../../components/PriceTrendChart';
import { useAuth } from '../../auth/AuthContext';
import { estimateTax } from '../../utils/format';

const { Title, Paragraph, Text } = Typography;

export default function PortalListingDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = AntdApp.useApp();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [firstHome, setFirstHome] = useState(true);
  const [overTwoYears, setOverTwoYears] = useState(true);
  const [onlyHomeOverFive, setOnlyHomeOverFive] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm] = Form.useForm<{ date: Dayjs; time: Dayjs }>();
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm] = Form.useForm<{ content: string }>();
  const [consultSubmitting, setConsultSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    void apiGet<Listing>(`/public/listings/${id}`)
      .then(setListing)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const tax = useMemo(() => {
    if (!listing) return null;
    return estimateTax({
      totalPrice: listing.totalPrice,
      area: listing.area,
      firstHome,
      overTwoYears,
      onlyHomeOverFive,
    });
  }, [listing, firstHome, overTwoYears, onlyHomeOverFive]);

  if (loading) {
    return (
      <div className="page-section" style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="page-section" style={{ padding: 40 }}>
        <Alert type="warning" message="房源不存在或已下架" showIcon />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/portal/listings')}>返回房源列表</Button>
      </div>
    );
  }

  const images = listing.images.length > 0 ? listing.images : [{ name: '房源图', url: '/mock/listings/1.svg' }];
  const priceContext = listing.priceContext;
  const isBelowAvg = priceContext ? listing.unitPrice < priceContext.communityAvgUnitPrice : false;

  return (
    <div className="page-section" style={{ paddingTop: 20, paddingBottom: 48 }}>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ paddingLeft: 0 }}>
        返回
      </Button>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Title level={3} style={{ margin: '0 0 8px' }} data-testid="listing-title">
                  {listing.title}
                </Title>
                <Space wrap size={8}>
                  <Tag color="blue">{listing.status === 'on_sale' ? '在售' : listing.status}</Tag>
                  <Tag color="green">已验真</Tag>
                  <Tag>{listing.propertyType}</Tag>
                  <Tag>{listing.buildYear} 年建</Tag>
                  <Tag>房源编号 {listing.code}</Tag>
                  {isBelowAvg && <Tag color="red">低于小区均价</Tag>}
                </Space>
                <div style={{ marginTop: 12, color: '#6b7280' }}>
                  <EnvironmentOutlined /> {listing.community.district} · {listing.community.name} · {listing.address}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <span style={{ color: '#f5222d', fontSize: 34, fontWeight: 700 }}>{toWan(listing.totalPrice)}</span>
                  <span style={{ color: '#f5222d', fontSize: 16 }}> 万</span>
                </div>
                <Text type="secondary">{Math.round(listing.unitPrice).toLocaleString()} 元/㎡</Text>
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <Image.PreviewGroup>
              <Row gutter={8}>
                <Col span={24}>
                  <Image
                    src={images[0].url}
                    alt={images[0].name}
                    style={{ width: '100%', height: 360, objectFit: 'cover', borderRadius: 8 }}
                    fallback="/mock/listings/1.svg"
                  />
                </Col>
                {images.slice(1, 4).map((img) => (
                  <Col span={8} key={img.url}>
                    <Image
                      src={img.url}
                      alt={img.name}
                      style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8 }}
                      fallback="/mock/listings/1.svg"
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>

            <Descriptions title="房源信息" column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginTop: 20 }}>
              <Descriptions.Item label="户型">{listing.rooms}室{listing.halls}厅{listing.bathrooms}卫</Descriptions.Item>
              <Descriptions.Item label="建筑面积">{listing.area} ㎡</Descriptions.Item>
              <Descriptions.Item label="朝向">{listing.orientation}</Descriptions.Item>
              <Descriptions.Item label="楼层">{listing.floor}/{listing.totalFloors} 层</Descriptions.Item>
              <Descriptions.Item label="装修">{listing.decoration}</Descriptions.Item>
              <Descriptions.Item label="产权性质">{listing.propertyType}</Descriptions.Item>
              <Descriptions.Item label="挂牌时间">{listing.listedAt ? new Date(listing.listedAt).toLocaleDateString('zh-CN') : '—'}</Descriptions.Item>
              <Descriptions.Item label="浏览次数">{listing.viewCount}</Descriptions.Item>
              <Descriptions.Item label="所属门店">{listing.agent?.agency.name ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <Title level={5}>房源描述</Title>
            <Paragraph style={{ color: '#4b5563', lineHeight: 1.9 }}>{listing.description}</Paragraph>
          </Card>

          {priceContext && (
            <Card title="同小区价格参考" style={{ marginTop: 16 }} data-testid="price-context-card">
              <Row gutter={16} style={{ marginBottom: 8 }}>
                <Col span={8}>
                  <div style={{ color: '#8a9099', fontSize: 12 }}>本房源单价</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: isBelowAvg ? '#52c41a' : '#f5222d' }}>
                    {listing.unitPrice.toLocaleString()} 元/㎡
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#8a9099', fontSize: 12 }}>小区在售均价</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{priceContext.communityAvgUnitPrice.toLocaleString()} 元/㎡</div>
                </Col>
                <Col span={8}>
                  <div style={{ color: '#8a9099', fontSize: 12 }}>区域在售均价</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{priceContext.districtAvgUnitPrice.toLocaleString()} 元/㎡</div>
                </Col>
              </Row>
              <PriceChart
                items={priceContext.sameCommunity}
                currentId={listing.id}
                height={220}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                柱状图为同小区在售房源单价对比（灰色/蓝色代表不同房源，深色为本房源）；数据来自平台真实挂牌，仅作参考。
              </Text>
            </Card>
          )}

          {listing.priceHistory && listing.priceHistory.length > 1 && (
            <Card title="价格走势" style={{ marginTop: 16 }} data-testid="price-trend-card">
              <PriceTrendChart points={listing.priceHistory} height={240} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                折线为该房源挂牌价历史（含审批调价），橙色节点为审批通过后的调价记录；数据来自平台挂牌留痕，仅作参考。
              </Text>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title="税费估算" style={{ marginBottom: 16 }} data-testid="tax-card">
            <Form layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={8}>
                  <Form.Item label="首套/二套">
                    <Select
                      value={firstHome ? 'first' : 'second'}
                      onChange={(value) => setFirstHome(value === 'first')}
                      options={[
                        { value: 'first', label: '首套' },
                        { value: 'second', label: '二套' },
                      ]}
                      data-testid="tax-first-home"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="满两年">
                    <Switch checked={overTwoYears} onChange={setOverTwoYears} data-testid="tax-over-two" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="满五唯一">
                    <Switch checked={onlyHomeOverFive} onChange={setOnlyHomeOverFive} data-testid="tax-only-five" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            {tax && (
              <>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="契税">{tax.deedTax.toLocaleString()} 元</Descriptions.Item>
                  <Descriptions.Item label="增值税">{tax.vat === 0 ? '免征' : `${tax.vat.toLocaleString()} 元`}</Descriptions.Item>
                  <Descriptions.Item label="个人所得税">{tax.incomeTax === 0 ? '免征' : `${tax.incomeTax.toLocaleString()} 元`}</Descriptions.Item>
                  <Descriptions.Item label="合计估算">
                    <Text strong style={{ color: '#f5222d', fontSize: 16 }}>{tax.total.toLocaleString()} 元</Text>
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ color: '#8a9099', fontSize: 12, marginTop: 8, lineHeight: 1.8 }}>
                  {tax.notes.map((note) => (
                    <div key={note}>· {note}</div>
                  ))}
                  <div>· 以上为演示简化规则，实际税费以不动产登记与税务部门核定为准。</div>
                </div>
              </>
            )}
          </Card>

          <Card title="小区信息" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="小区名称">{listing.community.name}</Descriptions.Item>
              <Descriptions.Item label="所在区域">{listing.community.district} · {listing.community.businessArea}</Descriptions.Item>
              <Descriptions.Item label="建成年代">{listing.community.buildYear} 年</Descriptions.Item>
              <Descriptions.Item label="容积率">{listing.community.plotRatio}</Descriptions.Item>
              <Descriptions.Item label="绿化率">{(listing.community.greenRate * 100).toFixed(0)}%</Descriptions.Item>
              <Descriptions.Item label="物业费">{listing.community.propertyFee} 元/㎡/月</Descriptions.Item>
              <Descriptions.Item label="位置">
                <a onClick={() => navigate('/portal/map')} style={{ cursor: 'pointer' }}>
                  在地图找房中查看 <EnvironmentOutlined />
                </a>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="专属经纪人" data-testid="listing-agent-card">
            <Space align="start" size={12}>
              <Avatar size={48} style={{ background: '#1677ff' }}>
                {listing.agent?.user?.name.slice(0, 1) ?? '房'}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {listing.agent?.user?.name ?? '平台经纪人'} <Tag color="gold">已实名</Tag>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{listing.agent?.agency.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  <PhoneOutlined /> {listing.agent?.agency.phone}
                </div>
              </div>
            </Space>

            <Divider style={{ margin: '14px 0' }} />

            <Space direction="vertical" style={{ width: '100%' }}>
              {user?.role !== 'seller' && (
                <Button
                  type="primary"
                  block
                  icon={<ScheduleOutlined />}
                  onClick={() => {
                    if (!user) {
                      message.info('请先登录后预约看房');
                      navigate('/login');
                      return;
                    }
                    bookingForm.setFieldsValue({ date: dayjs().add(1, 'day'), time: dayjs().hour(10).minute(0) });
                    setBookingOpen(true);
                  }}
                  data-testid="btn-book-showing"
                >
                  预约看房
                </Button>
              )}
              {user?.role === 'seller' && (
                <div style={{ color: '#8a9099', fontSize: 12 }}>当前为卖方账号，预约看房功能仅对买方账号开放。</div>
              )}
              <Button
                block
                icon={<UserOutlined />}
                onClick={() => {
                  if (!user) {
                    message.info('请先登录后在线咨询');
                    navigate('/login');
                    return;
                  }
                  consultForm.resetFields();
                  setConsultOpen(true);
                }}
                data-testid="btn-consult"
              >
                在线咨询
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                平台承诺：看房不收取任何费用，交易资金请走监管账户。
              </Text>
            </Space>
          </Card>

          <Alert style={{ marginTop: 16 }} type="info" showIcon message="演示环境提示" description="房源、价格、经纪人均为虚构数据，仅用于功能演示。" />
        </Col>
      </Row>

      <Modal
        title="预约看房"
        open={bookingOpen}
        onCancel={() => setBookingOpen(false)}
        okText="提交预约"
        confirmLoading={bookingSubmitting}
        onOk={async () => {
          try {
            const values = await bookingForm.validateFields();
            const scheduledAt = values.date.hour(values.time.hour()).minute(values.time.minute()).second(0);
            setBookingSubmitting(true);
            await apiPost('/showings/my', { listingId: listing.id, scheduledAt: scheduledAt.toISOString(), durationMin: 30 });
            message.success('预约已提交，经纪人确认后将通知您');
            setBookingOpen(false);
          } catch (error) {
            if (error instanceof Error) message.error(errorMessage(error));
          } finally {
            setBookingSubmitting(false);
          }
        }}
      >
        <div style={{ marginBottom: 12, color: '#6b7280' }}>
          {listing.title} · {listing.community.name}
        </div>
        <Form form={bookingForm} layout="vertical">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="date" label="预约日期" rules={[{ required: true }]} style={{ flex: 1, marginRight: 12 }}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" disabledDate={(current) => current && current < dayjs().startOf('day')} data-testid="booking-date" />
            </Form.Item>
            <Form.Item name="time" label="预约时间" rules={[{ required: true }]} style={{ flex: 1 }}>
              <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={30} data-testid="booking-time" />
            </Form.Item>
          </Space.Compact>
        </Form>
        <div style={{ color: '#8a9099', fontSize: 12 }}>提交后由该房源维护经纪人确认；同一经纪人时段冲突时需另选时间。</div>
      </Modal>

      <Modal
        title="在线咨询"
        open={consultOpen}
        onCancel={() => setConsultOpen(false)}
        okText="发送咨询"
        confirmLoading={consultSubmitting}
        onOk={async () => {
          try {
            const values = await consultForm.validateFields();
            setConsultSubmitting(true);
            await apiPost('/consultations', { listingId: listing.id, content: values.content });
            message.success('咨询已发送，经纪人回复后将通知您');
            setConsultOpen(false);
          } catch (error) {
            if (error instanceof Error) message.error(errorMessage(error));
          } finally {
            setConsultSubmitting(false);
          }
        }}
      >
        <div style={{ marginBottom: 12, color: '#6b7280' }}>
          {listing.title} · 经纪人 {listing.agent?.user?.name ?? ''}
        </div>
        <Form form={consultForm} layout="vertical">
          <Form.Item name="content" label="咨询内容" rules={[{ required: true, message: '请填写咨询内容' }, { min: 5, message: '请至少填写 5 个字' }]}>
            <Input.TextArea rows={4} maxLength={500} showCount placeholder="如：房源还在售吗？周末方便看房吗？税费大概多少？" data-testid="consult-input" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
