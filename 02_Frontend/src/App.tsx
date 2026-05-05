import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './config/msalConfig';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages backed by real GL data
import Login              from './pages/14_F014_Login';
import ExecutiveDashboard from './pages/15_F015_ExecutiveDashboard';
import CloseCockpit       from './pages/16_F016_CloseCockpit';
import EntityDetail       from './pages/17_F017_EntityDetail';
import Explorer           from './pages/18_F018_Explorer';
import AnnotationsNLQ     from './pages/20_F020_AnnotationsNLQ';
import BCTenantAuth       from './pages/01_F001_BCTenantAuth';
import CanonicalCoA       from './pages/07_F007_CanonicalCoA';
import ICElimination      from './pages/10_F010_ICElimination';
import DataQuality        from './pages/12_F012_DataQuality';
import APIStatus          from './pages/19_F019_APIStatus';
import MappingConsole     from './pages/21_F021_MappingConsole';
import PipelineHealth     from './pages/23_F023_PipelineHealth';
import Analytics          from './pages/25_F025_Analytics';
import DataInsights       from './pages/26_F026_DataInsights';
import GLInsights         from './pages/27_F027_GLInsights';
import CoAInsights        from './pages/28_F028_CoAInsights';
import CustomerInsights   from './pages/29_F029_CustomerInsights';
import PostedSalesInsights from './pages/30_F030_PostedSalesInsights';
import InvoiceInsights    from './pages/31_F031_InvoiceInsights';
import PLAnalytics        from './pages/32_F032_PLAnalytics';
import Collections        from './pages/33_F033_Collections';
import MonthlyIncome      from './pages/34_F034_MonthlyIncome';
import Ageing             from './pages/35_F035_Ageing';
import TrialBalance       from './pages/36_F036_TrialBalance';
import BalanceSheet       from './pages/37_F037_BalanceSheet';
import ExpenseAnalysis    from './pages/38_F038_ExpenseAnalysis';
import DeptSpend          from './pages/39_F039_DeptSpend';
import Settings           from './pages/40_F040_Settings';
import KPIDashboard       from './pages/41_F041_KPIDashboard';
import HealthScore        from './pages/42_F042_HealthScore';
import ProjectFinancials  from './pages/43_F043_ProjectFinancials';
import VerticalAnalytics  from './pages/44_F044_VerticalAnalytics';
import EntityComparison   from './pages/45_F045_EntityComparison';
import CashFlow           from './pages/46_F046_CashFlow';
import TenantManagement   from './pages/47_F047_TenantManagement';
import UserManagement     from './pages/48_F048_UserManagement';
import TenantConfig       from './pages/49_F049_TenantConfig';
import TenantHub          from './pages/50_F050_TenantHub';
import NewTenant          from './pages/51_F051_NewTenant';
import Budgeting          from './pages/52_F052_Budgeting';
import Investment         from './pages/53_F053_Investment';
import View360                 from './pages/54_F054_360View';
import ERPSources              from './pages/55_F055_ERPSources';
import FieldMapping            from './pages/56_F056_FieldMapping';
import CrossERPPL              from './pages/57_F057_CrossERPPL';
import ConsolidatedDashboard   from './pages/58_F058_ConsolidatedDashboard';
import RBACConsole             from './pages/60_F060_RBACConsole';
import { AppShellBlank }  from './components/layout/AppShellBlank';
import Landing            from './pages/00_F000_Landing';

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />

              {/* Superadmin tenant hub — standalone (no AppShell) */}
              <Route path="/admin/hub" element={
                <ProtectedRoute requiredRole="superadmin">
                  <TenantHub />
                </ProtectedRoute>
              } />

              {/* New tenant form — blank sidebar layout */}
              <Route element={
                <ProtectedRoute requiredRole="superadmin">
                  <AppShellBlank />
                </ProtectedRoute>
              }>
                <Route path="/admin/tenants/new" element={<NewTenant />} />
              </Route>

              {/* Protected — all routes require authentication */}
              <Route element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }>
                {/* Finance */}
                <Route path="/dashboard"      element={<ExecutiveDashboard />} />
                <Route path="/analytics"      element={<Analytics />} />
                <Route path="/pl"             element={<PLAnalytics />} />
                <Route path="/collections"    element={<Collections />} />
                <Route path="/income"         element={<MonthlyIncome />} />
                <Route path="/ageing"         element={<Ageing />} />
                <Route path="/gl-insights"    element={<DataInsights />} />
                <Route path="/close"          element={<CloseCockpit />} />
                <Route path="/entities/:id"   element={<EntityDetail />} />
                <Route path="/explorer"       element={<Explorer />} />
                <Route path="/annotations"    element={<AnnotationsNLQ />} />

                {/* Reports */}
                <Route path="/reports/trial-balance" element={<TrialBalance />} />
                <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
                <Route path="/reports/expense"       element={<ExpenseAnalysis />} />
                <Route path="/reports/dept-spend"    element={<DeptSpend />} />
                <Route path="/reports/kpi"           element={<KPIDashboard />} />
                <Route path="/reports/health-score"  element={<HealthScore />} />
                <Route path="/reports/projects"      element={<ProjectFinancials />} />
                <Route path="/reports/verticals"     element={<VerticalAnalytics />} />
                <Route path="/reports/entities"      element={<EntityComparison />} />
                <Route path="/reports/cash-flow"     element={<CashFlow />} />

                {/* Insights */}
                <Route path="/insights/gl"           element={<GLInsights />} />
                <Route path="/insights/coa"          element={<CoAInsights />} />
                <Route path="/insights/customer"     element={<CustomerInsights />} />
                <Route path="/insights/posted-sales" element={<PostedSalesInsights />} />
                <Route path="/insights/invoices"     element={<InvoiceInsights />} />

                {/* Planning & Investments */}
                <Route path="/budgeting"             element={<Budgeting />} />
                <Route path="/investments"           element={<Investment />} />
                <Route path="/360-view"              element={<View360 />} />

                {/* Settings */}
                <Route path="/settings"              element={<Settings />} />

                {/* Administration */}
                <Route path="/admin/mappings"        element={<MappingConsole />} />
                <Route path="/admin/pipeline-health" element={<PipelineHealth />} />
                <Route path="/admin/bc-tenants"      element={<BCTenantAuth />} />
                <Route path="/admin/tenants"         element={
                  <ProtectedRoute requiredRole="superadmin">
                    <TenantManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/tenants/:tenantId/users" element={
                  <ProtectedRoute requiredRole="isource_admin">
                    <UserManagement />
                  </ProtectedRoute>
                } />
                <Route path="/admin/tenants/:tenantId/config" element={
                  <ProtectedRoute requiredRole="isource_admin">
                    <TenantConfig />
                  </ProtectedRoute>
                } />
                <Route path="/admin/rbac" element={
                  <ProtectedRoute requiredRole="isource_admin">
                    <RBACConsole />
                  </ProtectedRoute>
                } />

                {/* GL Data */}
                <Route path="/admin/coa"            element={<CanonicalCoA />} />
                <Route path="/admin/dq"             element={<DataQuality />} />
                <Route path="/admin/ic-elimination" element={<ICElimination />} />

                {/* System */}
                <Route path="/admin/api"  element={<APIStatus />} />

                {/* ERP Integration */}
                <Route path="/erp/consolidated" element={<ConsolidatedDashboard />} />
                <Route path="/erp/cross-pl"     element={<CrossERPPL />} />
                <Route path="/erp/sources"      element={<ERPSources />} />
                <Route path="/erp/mapping"      element={<FieldMapping />} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </MsalProvider>
  );
}
