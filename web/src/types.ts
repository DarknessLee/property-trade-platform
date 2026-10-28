export type Role = 'buyer' | 'seller' | 'agent' | 'store_manager' | 'finance' | 'admin';

export interface SafeUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  roleLabel: string;
  email: string | null;
  avatar: string | null;
  realNameStatus: string | null;
  agencyId?: string | null;
  agencyName?: string | null;
}

export interface LoginResult {
  token: string;
  user: SafeUser;
}

export interface HomeStats {
  onSaleListings: number;
  communities: number;
  signedContracts: number;
  agencies: number;
  agents: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Community {
  id: string;
  name: string;
  district: string;
  businessArea: string;
  address: string;
  buildYear: number;
  totalBuildings?: number;
  plotRatio: number;
  greenRate: number;
  propertyFee: number;
  lng: number;
  lat: number;
  onSaleCount?: number;
  listingCount?: number;
}

export interface CommunityOption {
  id: string;
  name: string;
  district: string;
  businessArea: string;
}

export interface ListingImage {
  name: string;
  url: string;
}

export interface Listing {
  id: string;
  code: string;
  title: string;
  community: Community;
  area: number;
  totalPrice: number;
  unitPrice: number;
  rooms: number;
  halls: number;
  bathrooms: number;
  orientation: string;
  floor: number;
  totalFloors: number;
  buildYear: number;
  propertyType: string;
  decoration: string;
  status: string;
  verifyStatus: string;
  description: string;
  images: ListingImage[];
  address: string;
  listedAt: string | null;
  viewCount: number;
  lng?: number;
  lat?: number;
  agent?: { id: string; user?: { name: string }; name?: string; agency: { id?: string; name: string; phone: string } };
  priceContext?: {
    communityAvgUnitPrice: number;
    districtAvgUnitPrice: number;
    communityOnSaleCount: number;
    sameCommunity: Array<{ id: string; title: string; area: number; totalPrice: number; unitPrice: number }>;
  };
}

export interface AdminListing {
  id: string;
  code: string;
  title: string;
  community: { id: string; name: string; district: string; businessArea: string; address: string };
  owner: { id: string; name: string; phone: string };
  agent: { id: string; name: string; phone: string; agencyId: string; agencyName: string };
  agency: { id: string; name: string };
  area: number;
  totalPrice: number;
  unitPrice: number;
  rooms: number;
  halls: number;
  bathrooms: number;
  orientation: string;
  floor: number;
  totalFloors: number;
  buildYear: number;
  propertyType: string;
  decoration: string;
  status: string;
  verifyStatus: string;
  description: string;
  images: ListingImage[];
  address: string;
  listedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt?: string;
}

export interface MapPoint {
  id: string;
  title: string;
  totalPrice: number;
  area: number;
  rooms: number;
  lng: number;
  lat: number;
  district: string;
  communityName: string;
}

export const LISTING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  on_sale: { label: '在售', color: 'green' },
  signed: { label: '已签约', color: 'blue' },
  offline: { label: '已下架', color: 'default' },
};

export const VERIFY_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待验真', color: 'gold' },
  verified: { label: '已验真', color: 'green' },
  rejected: { label: '验真驳回', color: 'red' },
};

export const ROLE_LABELS: Record<Role, string> = {
  buyer: '买方',
  seller: '卖方',
  agent: '经纪人',
  store_manager: '店长',
  finance: '财务',
  admin: '平台管理员',
};
