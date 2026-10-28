import { Card, Col, Empty, Input, Pagination, Row, Select, Space, Spin, Typography } from 'antd';
import { EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { Listing } from '../../types';
import ListingCard from '../../components/ListingCard';

const { Title, Text } = Typography;

const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'];
const PRICE_RANGES = [
  { label: '不限价格', value: '' },
  { label: '100 万以下', value: '0-1000000' },
  { label: '100-200 万', value: '1000000-2000000' },
  { label: '200-300 万', value: '2000000-3000000' },
  { label: '300-500 万', value: '3000000-5000000' },
  { label: '500 万以上', value: '5000000-' },
];
const ROOM_OPTIONS = [
  { label: '不限户型', value: '' },
  { label: '1 室', value: '1' },
  { label: '2 室', value: '2' },
  { label: '3 室', value: '3' },
  { label: '4 室及以上', value: '4' },
];
const AREA_OPTIONS = [
  { label: '不限面积', value: '' },
  { label: '60㎡ 以下', value: '0-60' },
  { label: '60-90㎡', value: '60-90' },
  { label: '90-120㎡', value: '90-120' },
  { label: '120-150㎡', value: '120-150' },
  { label: '150㎡ 以上', value: '150-' },
];
const ORIENTATION_OPTIONS = [
  { label: '不限朝向', value: '' },
  { label: '南', value: '南' },
  { label: '南北', value: '南北' },
  { label: '东南', value: '东南' },
  { label: '西南', value: '西南' },
  { label: '东', value: '东' },
  { label: '西', value: '西' },
];
const BUILD_YEAR_OPTIONS = [
  { label: '不限楼龄', value: '' },
  { label: '5 年内', value: 'last5' },
  { label: '10 年内', value: 'last10' },
  { label: '15 年内', value: 'last15' },
];
const SORT_OPTIONS = [
  { label: '默认排序', value: 'default' },
  { label: '总价从低到高', value: 'price_asc' },
  { label: '总价从高到低', value: 'price_desc' },
];

const CURRENT_YEAR = new Date().getFullYear();

export default function PortalListingsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const district = searchParams.get('district') ?? '';
  const keyword = searchParams.get('keyword') ?? '';
  const rooms = searchParams.get('rooms') ?? '';
  const price = searchParams.get('price') ?? '';
  const area = searchParams.get('area') ?? '';
  const orientation = searchParams.get('orientation') ?? '';
  const buildYear = searchParams.get('buildYear') ?? '';
  const sort = searchParams.get('sort') ?? 'default';
  const page = Number(searchParams.get('page') ?? '1');

  const [keywordDraft, setKeywordDraft] = useState(keyword);

  const priceParams = useMemo(() => {
    if (!price) return {};
    const [min, max] = price.split('-');
    return {
      ...(min ? { minPrice: min } : {}),
      ...(max ? { maxPrice: max } : {}),
    };
  }, [price]);

  const areaParams = useMemo(() => {
    if (!area) return {};
    const [min, max] = area.split('-');
    return {
      ...(min ? { minArea: min } : {}),
      ...(max ? { maxArea: max } : {}),
    };
  }, [area]);

  const buildYearParams = useMemo(() => {
    if (!buildYear) return {};
    const yearsAgo = buildYear === 'last5' ? 5 : buildYear === 'last10' ? 10 : 15;
    return { buildYearMin: String(CURRENT_YEAR - yearsAgo) };
  }, [buildYear]);

  useEffect(() => {
    setLoading(true);
    void apiGet<{ items: Listing[]; total: number }>('/public/listings', {
      params: {
        district: district || undefined,
        keyword: keyword || undefined,
        rooms: rooms || undefined,
        orientation: orientation || undefined,
        sort,
        page,
        pageSize: 12,
        ...priceParams,
        ...areaParams,
        ...buildYearParams,
      },
    })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [district, keyword, rooms, orientation, sort, page, priceParams, areaParams, buildYearParams]);

  const updateParam = (key: string, value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="page-section" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <Card style={{ marginBottom: 20 }} styles={{ body: { padding: 16 } }}>
        <Space wrap size={12}>
          <Select
            style={{ width: 140 }}
            placeholder="区域"
            value={district || undefined}
            allowClear
            onChange={(value) => updateParam('district', value ?? '')}
            options={DISTRICTS.map((d) => ({ value: d, label: d }))}
            data-testid="filter-district"
          />
          <Select
            style={{ width: 150 }}
            value={price}
            onChange={(value) => updateParam('price', value)}
            options={PRICE_RANGES}
            data-testid="filter-price"
          />
          <Select
            style={{ width: 140 }}
            value={rooms}
            onChange={(value) => updateParam('rooms', value)}
            options={ROOM_OPTIONS}
            data-testid="filter-rooms"
          />
          <Select
            style={{ width: 140 }}
            value={area}
            onChange={(value) => updateParam('area', value)}
            options={AREA_OPTIONS}
            data-testid="filter-area"
          />
          <Select
            style={{ width: 130 }}
            value={orientation}
            onChange={(value) => updateParam('orientation', value)}
            options={ORIENTATION_OPTIONS}
            data-testid="filter-orientation"
          />
          <Select
            style={{ width: 130 }}
            value={buildYear}
            onChange={(value) => updateParam('buildYear', value)}
            options={BUILD_YEAR_OPTIONS}
            data-testid="filter-build-year"
          />
          <Select
            style={{ width: 160 }}
            value={sort}
            onChange={(value) => updateParam('sort', value)}
            options={SORT_OPTIONS}
            data-testid="filter-sort"
          />
          <Input
            style={{ width: 240 }}
            placeholder="搜索小区 / 关键词"
            prefix={<SearchOutlined />}
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onPressEnter={() => updateParam('keyword', keywordDraft)}
            allowClear
            onClear={() => updateParam('keyword', '')}
            data-testid="filter-keyword"
          />
        </Space>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          在售房源 <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>共 {total} 套</Text>
        </Title>
        <Space>
          <Text
            style={{ color: '#1677ff', cursor: 'pointer' }}
            onClick={() => navigate('/portal/map')}
            data-testid="link-map"
          >
            <EnvironmentOutlined /> 地图找房
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>房源信息经业主实名委托 · 演示数据</Text>
        </Space>
      </div>

      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description="没有符合条件的房源，试试调整筛选条件" style={{ padding: 60 }} />
        ) : (
          <Row gutter={[20, 20]}>
            {items.map((listing) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={listing.id}>
                <ListingCard listing={listing} testId={`listing-card-${listing.code}`} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <Pagination
            current={page}
            pageSize={12}
            total={total}
            showSizeChanger={false}
            onChange={(nextPage) => {
              updateParam('page', String(nextPage));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          想找特定小区？<a onClick={() => navigate('/portal/mine')}>登录后联系专属经纪人</a>
        </Text>
      </div>
    </div>
  );
}
