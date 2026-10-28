import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { EnvironmentOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { MapPoint } from '../../types';
import { toWan } from '../../utils/format';

const { Title, Text } = Typography;
const DISTRICTS = ['城东区', '城西区', '高新区', '滨江区', '世纪城区'];

interface DistrictCentroid {
  name: string;
  left: string;
  top: string;
}

function priceColor(totalPrice: number): string {
  if (totalPrice < 2000000) return '#1677ff';
  if (totalPrice < 4000000) return '#13a8a8';
  if (totalPrice < 6000000) return '#fa8c16';
  return '#f5222d';
}

export default function MapPage(): JSX.Element {
  const navigate = useNavigate();
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState<string | undefined>();
  const [focusId, setFocusId] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    void apiGet<MapPoint[]>('/public/listings/map', { params: { district } })
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [district]);

  const bounds = useMemo(() => {
    if (points.length === 0) return { minLng: 121.35, maxLng: 121.45, minLat: 31.14, maxLat: 31.24 };
    const lngs = points.map((point) => point.lng);
    const lats = points.map((point) => point.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const padLng = (maxLng - minLng) * 0.12 || 0.02;
    const padLat = (maxLat - minLat) * 0.12 || 0.02;
    return { minLng: minLng - padLng, maxLng: maxLng + padLng, minLat: minLat - padLat, maxLat: maxLat + padLat };
  }, [points]);

  const positionOf = (point: MapPoint): { left: string; top: string } => {
    const left = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const top = ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return { left: `${Math.min(96, Math.max(4, left))}%`, top: `${Math.min(94, Math.max(6, top))}%` };
  };

  // 区域标签放在该区域房源点位质心附近，避免固定坐标与数据错位
  const districtLabels = useMemo<DistrictCentroid[]>(() => {
    const groups = new Map<string, MapPoint[]>();
    for (const point of points) {
      const list = groups.get(point.district) ?? [];
      list.push(point);
      groups.set(point.district, list);
    }
    return [...groups.entries()].map(([name, list]) => {
      const avgLng = list.reduce((sum, item) => sum + item.lng, 0) / list.length;
      const avgLat = list.reduce((sum, item) => sum + item.lat, 0) / list.length;
      const left = Math.min(90, Math.max(10, ((avgLng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100));
      const top = Math.min(92, Math.max(10, ((bounds.maxLat - avgLat) / (bounds.maxLat - bounds.minLat)) * 100 - 7));
      return { name, left: `${left}%`, top: `${top}%` };
    });
  }, [points, bounds]);

  const cheapest = [...points].sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 5);
  const avgUnit = points.length ? Math.round(points.reduce((sum, point) => sum + point.totalPrice / point.area, 0) / points.length) : 0;

  return (
    <div className="page-section" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            地图找房 <Tag color="blue" style={{ verticalAlign: 'middle' }}>江州市 · 演示点位</Tag>
          </Title>
          <Text type="secondary">
            共 <b>{points.length}</b> 套在售房源 · 全城参考单价约 <b>{avgUnit.toLocaleString()}</b> 元/㎡
          </Text>
        </div>
        <Space>
          <Select
            allowClear
            placeholder="全部区域"
            style={{ width: 150 }}
            value={district}
            onChange={setDistrict}
            options={DISTRICTS.map((item) => ({ value: item, label: item }))}
            data-testid="map-district"
          />
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(260px, 1fr)', gap: 16, alignItems: 'start' }}>
        <Card styles={{ body: { padding: 0 } }} className="map-card">
          <Spin spinning={loading}>
            <div
              data-testid="map-canvas"
              style={{
                position: 'relative',
                height: 580,
                borderRadius: 8,
                overflow: 'hidden',
                background:
                  'radial-gradient(circle at 20% 20%, #e6f4ff 0%, #f0f7ff 35%, #eef7f0 70%, #f6ffed 100%)',
                border: '1px solid #e6f0fa',
              }}
            >
              {/* 装饰：河流与绿带 */}
              <svg width="100%" height="100%" viewBox="0 0 1000 580" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
                <path d="M-20 470 C 180 420, 300 520, 470 470 S 760 380, 1020 430" fill="none" stroke="#bae0ff" strokeWidth="46" opacity="0.7" />
                <path d="M-20 470 C 180 420, 300 520, 470 470 S 760 380, 1020 430" fill="none" stroke="#91caff" strokeWidth="4" opacity="0.5" strokeDasharray="10 8" />
                <circle cx="820" cy="120" r="70" fill="#d9f7be" opacity="0.6" />
                <circle cx="140" cy="120" r="46" fill="#d9f7be" opacity="0.5" />
                <path d="M60 60 H 940 M60 160 H 940 M60 260 H 940 M60 360 H 940 M60 460 H 940" stroke="#dbeafe" strokeWidth="1" opacity="0.55" />
                <path d="M120 20 V 560 M 280 20 V 560 M 440 20 V 560 M 600 20 V 560 M 760 20 V 560 M 900 20 V 560" stroke="#dbeafe" strokeWidth="1" opacity="0.55" />
              </svg>

              {/* 区域标签 */}
              {districtLabels.map((label) => (
                <div
                  key={label.name}
                  style={{
                    position: 'absolute',
                    left: label.left,
                    top: label.top,
                    transform: 'translate(-50%, -50%)',
                    color: '#8aa9c9',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 2,
                    pointerEvents: 'none',
                  }}
                >
                  {label.name}
                </div>
              ))}

              {/* 房源点位 */}
              {points.map((point) => {
                const position = positionOf(point);
                const color = priceColor(point.totalPrice);
                const isFocused = focusId === point.id;
                return (
                  <Tooltip
                    key={point.id}
                    title={
                      <div>
                        <div style={{ fontWeight: 600 }}>{point.title}</div>
                        <div>{point.communityName} · {point.area}㎡ · {point.rooms}室</div>
                        <div style={{ color: '#ffd666' }}>{toWan(point.totalPrice)} 万 · {Math.round(point.totalPrice / point.area).toLocaleString()} 元/㎡</div>
                      </div>
                    }
                  >
                    <button
                      type="button"
                      data-testid={`map-point-${point.id}`}
                      onClick={() => navigate(`/portal/listings/${point.id}`)}
                      onMouseEnter={() => setFocusId(point.id)}
                      onMouseLeave={() => setFocusId(undefined)}
                      style={{
                        position: 'absolute',
                        left: position.left,
                        top: position.top,
                        transform: `translate(-50%, -50%) scale(${isFocused ? 1.35 : 1})`,
                        width: isFocused ? 22 : 16,
                        height: isFocused ? 22 : 16,
                        borderRadius: '50%',
                        background: color,
                        border: '2px solid #fff',
                        boxShadow: `0 2px 8px ${color}66`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        padding: 0,
                      }}
                    />
                  </Tooltip>
                );
              })}

              {points.length === 0 && !loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description="该区域暂无在售房源" />
                </div>
              )}

              {/* 图例 */}
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  bottom: 14,
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  gap: 14,
                  fontSize: 12,
                  color: '#4b5563',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {[
                  { label: '200 万以下', color: '#1677ff' },
                  { label: '200–400 万', color: '#13a8a8' },
                  { label: '400–600 万', color: '#fa8c16' },
                  { label: '600 万以上', color: '#f5222d' },
                ].map((item) => (
                  <span key={item.label}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: item.color,
                        marginRight: 5,
                        verticalAlign: 'middle',
                      }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </Spin>
        </Card>

        <div>
          <Card title={<span><ThunderboltOutlined /> 低价优选</span>} size="small" style={{ marginBottom: 16 }}>
            {cheapest.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            ) : (
              cheapest.map((point) => (
                <div
                  key={point.id}
                  onClick={() => navigate(`/portal/listings/${point.id}`)}
                  style={{ padding: '10px 4px', borderBottom: '1px dashed #eef0f3', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {point.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <EnvironmentOutlined /> {point.communityName} · {point.area}㎡
                    </Text>
                    <Text style={{ color: '#f5222d', fontSize: 13, fontWeight: 600 }}>{toWan(point.totalPrice)} 万</Text>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card size="small" title="说明">
            <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 2 }}>
              · 点位为演示数据，坐标由种子数据生成；<br />
              · 点击圆点或右侧列表查看房源详情；<br />
              · 按总价分色，悬停可快速预览。
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
