import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PortalLayout from './pages/c/PortalLayout';
import PortalHomePage from './pages/c/PortalHomePage';
import PortalListingsPage from './pages/c/PortalListingsPage';
import PortalListingDetailPage from './pages/c/PortalListingDetailPage';
import PortalMinePage from './pages/c/PortalMinePage';
import AdminLayout from './pages/b/AdminLayout';
import DashboardPage from './pages/b/DashboardPage';
import ListingsPage from './pages/b/ListingsPage';
import AuditPage from './pages/b/AuditPage';
import CommunitiesPage from './pages/b/CommunitiesPage';
import CustomersPage from './pages/b/CustomersPage';
import ShowingsPage from './pages/b/ShowingsPage';
import ContractsPage from './pages/b/ContractsPage';
import ProgressPage from './pages/b/ProgressPage';
import AgenciesPage from './pages/b/AgenciesPage';
import StatsPage from './pages/b/StatsPage';
import LogsPage from './pages/b/LogsPage';
import FinancePage from './pages/b/FinancePage';
import UsersPage from './pages/b/UsersPage';
import ApprovalsPage from './pages/b/ApprovalsPage';
import ConsultationsPage from './pages/b/ConsultationsPage';
import LoansPage from './pages/b/LoansPage';
import EscrowsPage from './pages/b/EscrowsPage';
import TransfersPage from './pages/b/TransfersPage';
import CommissionsPage from './pages/b/CommissionsPage';
import PortalMapPage from './pages/c/MapPage';
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
        <Route path="map" element={<PortalMapPage />} />
        <Route path="mine" element={<PortalMinePage />} />
      </Route>

      {/* B 端工作台 */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="listings" element={<ListingsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="consultations" element={<ConsultationsPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="escrows" element={<EscrowsPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="commissions" element={<CommissionsPage />} />
        <Route path="communities" element={<CommunitiesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="showings" element={<ShowingsPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="agencies" element={<AgenciesPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
