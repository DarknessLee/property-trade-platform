import { Card, Tag } from 'antd';
import { EnvironmentOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Listing } from '../types';

export function toWan(yuan: number): string {
  const wan = yuan / 10000;
  return wan >= 1000 ? `${Math.round(wan)}` : wan.toFixed(1).replace(/\.0$/, '');
}

export default function ListingCard({ listing, testId }: { listing: Listing; testId?: string }): JSX.Element {
  const navigate = useNavigate();
  const cover = listing.images?.[0]?.url ?? '/mock/listings/1.svg';
  return (
    <Card
      hoverable
      className="card-hover"
      data-testid={testId}
      onClick={() => navigate(`/portal/listings/${listing.id}`)}
      cover={
        <div style={{ height: 180, overflow: 'hidden', background: '#eef2f7' }}>
          <img
            src={cover}
            alt={listing.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(event) => {
              (event.target as HTMLImageElement).src = '/mock/listings/1.svg';
            }}
          />
        </div>
      }
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {listing.title}
      </div>
      <div style={{ color: '#8a9099', fontSize: 12, marginBottom: 10 }}>
        <EnvironmentOutlined /> {listing.community.district} · {listing.community.name}
        <span style={{ float: 'right' }}>
          <EyeOutlined /> {listing.viewCount}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <Tag color="blue">{listing.rooms}室{listing.halls}厅</Tag>
        <Tag>{listing.area}㎡</Tag>
        <Tag>{listing.orientation}</Tag>
        <Tag>{listing.decoration}</Tag>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span>
          <span style={{ color: '#f5222d', fontSize: 22, fontWeight: 700 }}>{toWan(listing.totalPrice)}</span>
          <span style={{ color: '#f5222d', marginLeft: 2, fontSize: 13 }}>万</span>
        </span>
        <span style={{ color: '#8a9099', fontSize: 12 }}>{Math.round(listing.unitPrice)} 元/㎡</span>
      </div>
    </Card>
  );
}
