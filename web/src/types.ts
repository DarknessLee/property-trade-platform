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

export interface PriceHistoryPoint {
  price: number;
  unitPrice: number;
  changedAt: string;
  source: string;
  remark?: string | null;
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
  priceHistory?: PriceHistoryPoint[];
  agent?: { id: string; user?: { name: string }; name?: string; agency: { id?: string; name: string; phone: string } };
  priceContext?: {
    communityAvgUnitPrice: number;
    districtAvgUnitPrice: number;
    communityOnSaleCount: number;
    sameCommunity: Array<{ id: string; title: string; area: number; totalPrice: number; unitPrice: number }>;
  };
}

export interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  typeLabel?: string;
  status: 'pending' | 'level1_approved' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
  payload: { oldTotalPrice?: number; newTotalPrice?: number; oldUnitPrice?: number; newUnitPrice?: number; reason?: string; keyCount?: number; handoverTo?: string; remark?: string };
  reviewComment: string | null;
  requester: { id: string; name: string };
  approver: { id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    code: string;
    title: string;
    totalPrice: number;
    unitPrice: number;
    area: number;
    status: string;
    community: { name: string; district: string };
    agent: { id: string; name: string };
  } | null;
}

export interface ConsultationItem {
  id: string;
  code: string;
  content: string;
  replyContent: string | null;
  repliedAt: string | null;
  status: 'pending' | 'replied' | 'closed';
  createdAt: string;
  listing: { id: string; code: string; title: string; totalPrice: number; area: number; status: string; community: { name: string; district: string } };
  fromUser: { id: string; name: string; phone?: string; role?: string };
  toUser: { id: string; name: string };
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
  isActive?: boolean;
  createdAt?: string;
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
  customTerms?: string;
  contentSnapshot?: string;
  listing: { id: string; title: string; code: string; community: { name: string; district: string }; totalPrice: number; area: number };
  buyer: { id: string; name: string; phone: string };
  seller: { id: string; name: string; phone: string };
  agent: { id: string; name: string };
  agency?: { id: string; name: string };
  template?: { id: string; name: string; version: string };

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

// ---------- E2：交易后链路 ----------
export interface ContractLite {
  id: string;
  code: string;
  amount: number;
  commissionAmount: number;
  signedAt: string | null;
  agencyId: string;
  listing: { id: string; title: string; code?: string; community: { name: string; district: string } };
  buyerCustomer: { name: string };
  sellerCustomer: { name: string };
  agent: { user: { name: string } };
  agency?: { name: string };
}

export interface LoanItem {
  id: string;
  code: string;
  bankName: string;
  productName: string;
  amount: number;
  termMonths: number;
  annualRate: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'disbursed';
  documents: Array<{ name: string; status: string }>;
  rejectReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  disbursedAt: string | null;
  contract: ContractLite;
  appraisals?: AppraisalItem[];
}

export interface AppraisalItem {
  id: string;
  code: string;
  institutionName: string;
  appraiserName: string;
  appointmentAt: string;
  status: string;
  appraisedValue: number | null;
  reportNo: string | null;
  fee: number;
}

export interface EscrowTransactionItem {
  id: string;
  type: string;
  amount: number;
  nodeType: string | null;
  tradeNo: string;
  remark: string | null;
  createdAt: string;
}

export interface EscrowItem {
  id: string;
  code: string;
  bankName: string;
  accountNoMasked: string;
  agreementNo: string;
  totalAmount: number;
  releasedAmount: number;
  status: string;
  openedAt: string;
  contract: ContractLite;
  transactions: EscrowTransactionItem[];
}

export interface TransferSummary {
  contractId: string;
  code: string;
  listing: { title: string; community: { name: string; district: string } };
  signedAt: string | null;
  materialTotal: number;
  materialVerified: number;
  taxTotal: number;
  taxPaid: number;
  appointmentDone: number;
  appointmentTotal: number;
  registrationStatus: string | null;
}

export interface TransferDetail {
  contract: { id: string; code: string; amount: number; signedAt: string | null; listing: { title: string; community: { name: string; district: string } }; buyer: { name: string }; seller: { name: string } };
  materials: Array<{ id: string; name: string; required: boolean; status: string; remark: string | null }>;
  taxes: Array<{ id: string; taxType: string; amount: number; status: string; receiptNo: string | null; paidAt: string | null }>;
  appointments: Array<{ id: string; code: string; type: string; appointmentAt: string; hallName: string; appointmentNo: string; status: string }>;
  registration: { id: string; code: string; status: string; acceptNo: string | null; acceptedAt: string | null; completedAt: string | null } | null;
}

export interface CommissionItem {
  id: string;
  code: string;
  ruleName: string;
  baseAmount: number;
  totalCommission: number;
  status: 'pending' | 'confirmed' | 'paid';
  confirmedAt: string | null;
  paidAt: string | null;
  contract: ContractLite;
  allocations: Array<{ id: string; role: string; name: string; rate: number; amount: number }>;
}

export const LOAN_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  submitted: { label: '已提交', color: 'gold' },
  approved: { label: '已批贷', color: 'blue' },
  rejected: { label: '已拒绝', color: 'red' },
  disbursed: { label: '已放款', color: 'green' },
};

// ---------- E4：跟进/匹配/投诉/配置 ----------
export interface FollowUpItem {
  id: string;
  customerId: string;
  content: string;
  nextAction: string | null;
  nextFollowAt: string | null;
  createdByName: string;
  createdAt: string;
}

export interface MatchItem {
  id: string;
  code: string;
  title: string;
  area: number;
  rooms: number;
  totalPrice: number;
  unitPrice: number;
  community: { name: string; district: string };
  agentName: string;
  score: number;
  reasons: string[];
}

export interface ComplaintItem {
  id: string;
  code: string;
  type: string;
  content: string;
  contactName: string;
  contactPhone: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  handlerName: string | null;
  handleComment: string | null;
  handledAt: string | null;
  createdAt: string;
  listing: { id: string; title: string; code: string; community?: { name: string } } | null;
}

export interface DictItem {
  id: string;
  category: string;
  key: string;
  label: string;
  value: string | null;
  sortOrder: number;
}

export interface MenuConfigItem {
  role: string;
  menuKeys: string[];
}

export const COMPLAINT_TYPE: Record<string, string> = {
  listing_quality: '房源质量',
  service: '服务态度',
  price: '价格违规',
  false_info: '虚假信息',
  other: '其他',
};

export const COMPLAINT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'gold' },
  processing: { label: '处理中', color: 'blue' },
  resolved: { label: '已解决', color: 'green' },
  rejected: { label: '已驳回', color: 'default' },
};

export const TRANSFER_STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: '已提交', color: 'gold' },
  accepted: { label: '已受理', color: 'blue' },
  registered: { label: '已登簿', color: 'green' },
  completed: { label: '已领证', color: 'green' },
};
