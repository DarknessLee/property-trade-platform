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

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  type: 'buyer' | 'seller';
  budgetMin: number | null;
  budgetMax: number | null;
  demand: string;
  tags: string[];
  level: 'A' | 'B' | 'C';
  status: string;
  protectionUntil: string | null;
  agent: { id: string; name: string; phone: string };
  agency: { id: string; name: string };
  user: { id: string; name: string } | null;
  showingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Showing {
  id: string;
  code: string;
  listing: { id: string; code: string; title: string; totalPrice: number; area: number; community: { name: string; district: string } };
  customer: { id: string; code: string; name: string; phone: string; type: string; level: string; userId?: string | null };
  agent: { id: string; name: string; agency: { id: string; name: string } };
  scheduledAt: string;
  actualAt: string | null;
  durationMin: number;
  status: string;
  feedback: string | null;
  rating: string | null;
}

export interface ContractTemplate {
  id: string;
  name: string;
  version: string;
  content: string;
}

export interface ProgressNode {
  id: string;
  nodeType: string;
  status: 'todo' | 'doing' | 'done';
  sortOrder: number;
  plannedDate: string | null;
  completedAt: string | null;
  remark: string | null;
}

export interface Contract {
  id: string;
  code: string;
  signStatus: 'draft' | 'pending' | 'signed' | 'voided';
  amount: number;
  commissionAmount: number;
  commissionRate: number;
  depositAmount?: number;
  signedAt: string | null;
  voidedAt?: string | null;
  esignNo: string | null;
  signMethod?: string | null;
  listing: { id: string; title: string; code: string; community: { name: string; district: string }; totalPrice: number; area: number };
  buyer: { id: string; name: string; phone: string };
  seller: { id: string; name: string; phone: string };
  agent: { id: string; name: string };
  agency?: { id: string; name: string };
  template?: { id: string; name: string; version: string };
  contentSnapshot?: string;
  progressDone: number;
  progressTotal: number;
  progress?: ProgressNode[];
  payments?: Array<{ id: string; type: string; amount: number; status: string; tradeNo: string; paidAt: string | null }>;
  createdAt: string;
}

export const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending: { label: '待签署', color: 'gold' },
  signed: { label: '已签署', color: 'green' },
  voided: { label: '已作废', color: 'red' },
};

export const SHOWING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: 'gold' },
  confirmed: { label: '已确认', color: 'blue' },
  done: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
};

export const PROGRESS_NODES: Record<string, string> = {
  sign: '面签',
  loan: '贷款审批',
  tax: '缴税',
  transfer: '过户',
  handover: '交房',
};

export const PROGRESS_STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: '待办', color: 'default' },
  doing: { label: '进行中', color: 'blue' },
  done: { label: '已完成', color: 'green' },
};
