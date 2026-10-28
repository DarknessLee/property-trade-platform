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
  plotRatio: number;
  greenRate: number;
  propertyFee: number;
  lng: number;
  lat: number;
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
  agent?: { id: string; user: { name: string }; agency: { name: string; phone: string } };
}

export const ROLE_LABELS: Record<Role, string> = {
  buyer: '买方',
  seller: '卖方',
  agent: '经纪人',
  store_manager: '店长',
  finance: '财务',
  admin: '平台管理员',
};
