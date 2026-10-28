import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PortalLayout from './pages/c/PortalLayout';
import PortalHomePage from './pages/c/PortalHomePage';
import PortalListingsPage from './pages/c/PortalListingsPage';
import PortalListingDetailPage from './pages/c/PortalListingDetailPage';
import PortalMinePage from './pages/c/PortalMinePage';
import AdminLayout from './pages/b/AdminLayout';
import DashboardPage from './pages/b/DashboardPage';
import PlaceholderPage from './pages/b/PlaceholderPage';
import { useAuth } from './auth/AuthContext';

function RoleLanding(): JSX.Element {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'buyer' || user.role === 'seller' ? (
    <Navigate to="/portal" replace />
  ) : (
    <Navigate to="/admin" replace />
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<RoleLanding />} />
      <Route path="/login" element={<LoginPage />} />

      {/* C 端门户 */}
      <Route path="/portal" element={<PortalLayout />}>
        <Route index element={<PortalHomePage />} />
        <Route path="listings" element={<PortalListingsPage />} />
        <Route path="listings/:id" element={<PortalListingDetailPage />} />
        <Route path="mine" element={<PortalMinePage />} />
      </Route>

      {/* B 端工作台 */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="listings" element={<PlaceholderPage title="房源管理" planned="M2：房源列表、录入、编辑、上下架、验真审核" />} />
        <Route path="customers" element={<PlaceholderPage title="客户管理" planned="M3：客户档案、需求标签、跟进记录、客户保护期" />} />
        <Route path="showings" element={<PlaceholderPage title="带看管理" planned="M3：带看日程日历、冲突检测、反馈与评级" />} />
        <Route path="contracts" element={<PlaceholderPage title="合同签约" planned="M3：合同模板、在线签署（Mock 电子签）、存证下载" />} />
        <Route path="progress" element={<PlaceholderPage title="交易进度" planned="M3：面签/贷款/缴税/过户/交房时间轴" />} />
        <Route path="agencies" element={<PlaceholderPage title="门店与经纪人" planned="M4：门店组织架构、经纪人账号与角色分配" />} />
        <Route path="stats" element={<PlaceholderPage title="业绩统计" planned="M4：成交量、带看量、成交金额看板" />} />
        <Route path="audit" element={<PlaceholderPage title="后台审核" planned="M4：房源验真审核、实名认证审核" />} />
        <Route path="logs" element={<PlaceholderPage title="操作日志" planned="M4：操作留痕查询" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
