import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './config/msalConfig';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { FeatureFlagProvider, useFeatureFlags } from './contexts/FeatureFlagContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ReactNode } from 'react';

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
import DataExtraction          from './pages/02_F002_DataExtraction';
import PipelineOrchestration   from './pages/03_F003_PipelineOrchestration';
import IngestionResilience     from './pages/04_F004_IngestionResilience';
import BronzeZone              from './pages/05_F005_BronzeZone';
import SilverLayer             from './pages/06_F006_SilverLayer';
import DimensionFramework      from './pages/08_F008_DimensionFramework';
import GoldLayer               from './pages/09_F009_GoldLayer';
import FXTranslation           from './pages/11_F011_FXTranslation';
import DataLineage             from './pages/13_F013_DataLineage';
import OnboardingWizard        from './pages/22_F022_OnboardingWizard';
import SecurityCompliance      from './pages/24_F024_SecurityCompliance';
import CFORatios               from './pages/61_F061_CFORatios';
import Revenue                from './pages/62_F062_Revenue';
import UBR                    from './pages/63_F063_UBR';
import Invoicing              from './pages/64_F064_Invoicing';
import FeatureFlagsPage       from './pages/65_F065_FeatureFlags';
import { AppShellBlank }  from './components/layout/AppShellBlank';
import Landing            from './pages/00_F000_Landing';

// ── Feature-flag guard ────────────────────────────────────────────────────────
function FlagGuard({ flagKey, children }: { flagKey: string; children: ReactNode }) {
  const { isEnabled, isLoading } = useFeatureFlags();
  if (isLoading) return null;
  if (!isEnabled(flagKey)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh', gap: 12, color: '#66726F',
      }}>
        <span style={{ fontSize: 32 }}>🔒</span>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#333938' }}>Coming in Phase 2</div>
        <div style={{ fontSize: 13 }}>This feature is not included in the current Phase 1 delivery.</div>
        <div style={{ fontSize: 11, color: '#B0BABA' }}>Contact your administrator to enable it.</div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <TenantProvider>
          <FeatureFlagProvider>
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
                  {/* ── Phase 1 (no FlagGuard needed — always enabled) ── */}
                  <Route path="/collections"    element={<Collections />} />
                  <Route path="/ageing"         element={<Ageing />} />
                  <Route path="/reports/revenue"   element={<Revenue />} />
                  <Route path="/reports/ubr"       element={<UBR />} />
                  <Route path="/reports/invoicing" element={<Invoicing />} />
                  <Route path="/settings"          element={<Settings />} />
                  <Route path="/admin/bc-tenants"  element={<BCTenantAuth />} />
                  <Route path="/admin/api"         element={<APIStatus />} />

                  {/* Feature flags admin — always accessible to superadmin */}
                  <Route path="/admin/feature-flags" element={
                    <ProtectedRoute requiredRole="isource_admin">
                      <FeatureFlagsPage />
                    </ProtectedRoute>
                  } />

                  {/* ── Phase 2 (FlagGuard gates each route) ── */}
                  <Route path="/dashboard"  element={<FlagGuard flagKey="page_executive_dashboard"><ExecutiveDashboard /></FlagGuard>} />
                  <Route path="/analytics"  element={<FlagGuard flagKey="page_analytics"><Analytics /></FlagGuard>} />
                  <Route path="/pl"         element={<FlagGuard flagKey="page_pl"><PLAnalytics /></FlagGuard>} />
                  <Route path="/income"     element={<FlagGuard flagKey="page_monthly_income"><MonthlyIncome /></FlagGuard>} />
                  <Route path="/close"      element={<FlagGuard flagKey="page_close_cockpit"><CloseCockpit /></FlagGuard>} />
                  <Route path="/entities/:id" element={<EntityDetail />} />
                  <Route path="/explorer"   element={<FlagGuard flagKey="page_gl_insights"><Explorer /></FlagGuard>} />
                  <Route path="/annotations" element={<FlagGuard flagKey="page_ai_query"><AnnotationsNLQ /></FlagGuard>} />
                  <Route path="/gl-insights" element={<FlagGuard flagKey="page_gl_insights"><DataInsights /></FlagGuard>} />

                  {/* Reports — Phase 2 */}
                  <Route path="/reports/trial-balance" element={<FlagGuard flagKey="page_trial_balance"><TrialBalance /></FlagGuard>} />
                  <Route path="/reports/balance-sheet" element={<FlagGuard flagKey="page_balance_sheet"><BalanceSheet /></FlagGuard>} />
                  <Route path="/reports/expense"       element={<FlagGuard flagKey="page_expense_analysis"><ExpenseAnalysis /></FlagGuard>} />
                  <Route path="/reports/dept-spend"    element={<FlagGuard flagKey="page_dept_spend"><DeptSpend /></FlagGuard>} />
                  <Route path="/reports/kpi"           element={<FlagGuard flagKey="page_kpi_dashboard"><KPIDashboard /></FlagGuard>} />
                  <Route path="/reports/health-score"  element={<FlagGuard flagKey="page_health_score"><HealthScore /></FlagGuard>} />
                  <Route path="/reports/projects"      element={<FlagGuard flagKey="page_projects"><ProjectFinancials /></FlagGuard>} />
                  <Route path="/reports/verticals"     element={<FlagGuard flagKey="page_verticals"><VerticalAnalytics /></FlagGuard>} />
                  <Route path="/reports/entities"      element={<FlagGuard flagKey="page_entity_comparison"><EntityComparison /></FlagGuard>} />
                  <Route path="/reports/cash-flow"     element={<FlagGuard flagKey="page_cash_flow"><CashFlow /></FlagGuard>} />
                  <Route path="/reports/cfo-ratios"    element={<FlagGuard flagKey="page_cfo_ratios"><CFORatios /></FlagGuard>} />

                  {/* Insights — Phase 2 */}
                  <Route path="/insights/gl"           element={<FlagGuard flagKey="page_gl_insights"><GLInsights /></FlagGuard>} />
                  <Route path="/insights/coa"          element={<FlagGuard flagKey="page_coa_insights"><CoAInsights /></FlagGuard>} />
                  <Route path="/insights/customer"     element={<FlagGuard flagKey="page_customers"><CustomerInsights /></FlagGuard>} />
                  <Route path="/insights/posted-sales" element={<FlagGuard flagKey="page_posted_sales"><PostedSalesInsights /></FlagGuard>} />
                  <Route path="/insights/invoices"     element={<FlagGuard flagKey="page_invoice_insights"><InvoiceInsights /></FlagGuard>} />

                  {/* Planning — Phase 2 */}
                  <Route path="/budgeting"   element={<FlagGuard flagKey="page_budgeting"><Budgeting /></FlagGuard>} />
                  <Route path="/investments" element={<FlagGuard flagKey="page_investments"><Investment /></FlagGuard>} />
                  <Route path="/360-view"    element={<FlagGuard flagKey="page_360_view"><View360 /></FlagGuard>} />

                  {/* Administration — Phase 2 */}
                  <Route path="/admin/mappings"        element={<FlagGuard flagKey="page_gl_mapping"><MappingConsole /></FlagGuard>} />
                  <Route path="/admin/pipeline-health" element={<FlagGuard flagKey="page_pipeline_health"><PipelineHealth /></FlagGuard>} />
                  <Route path="/admin/tenants" element={
                    <ProtectedRoute requiredRole="superadmin">
                      <FlagGuard flagKey="page_tenant_management"><TenantManagement /></FlagGuard>
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
                      <FlagGuard flagKey="page_rbac"><RBACConsole /></FlagGuard>
                    </ProtectedRoute>
                  } />

                  {/* GL Data — Phase 2 */}
                  <Route path="/admin/coa"            element={<FlagGuard flagKey="page_coa"><CanonicalCoA /></FlagGuard>} />
                  <Route path="/admin/dq"             element={<FlagGuard flagKey="page_data_quality"><DataQuality /></FlagGuard>} />
                  <Route path="/admin/ic-elimination" element={<FlagGuard flagKey="page_ic_elimination"><ICElimination /></FlagGuard>} />

                  {/* Data Pipeline — Phase 2 */}
                  <Route path="/pipeline/extraction"    element={<FlagGuard flagKey="page_data_extraction"><DataExtraction /></FlagGuard>} />
                  <Route path="/pipeline/orchestration" element={<FlagGuard flagKey="page_orchestration"><PipelineOrchestration /></FlagGuard>} />
                  <Route path="/pipeline/resilience"    element={<FlagGuard flagKey="page_resilience"><IngestionResilience /></FlagGuard>} />
                  <Route path="/pipeline/bronze"        element={<FlagGuard flagKey="page_bronze_zone"><BronzeZone /></FlagGuard>} />
                  <Route path="/pipeline/silver"        element={<FlagGuard flagKey="page_silver_layer"><SilverLayer /></FlagGuard>} />
                  <Route path="/pipeline/gold"          element={<FlagGuard flagKey="page_gold_layer"><GoldLayer /></FlagGuard>} />
                  <Route path="/pipeline/lineage"       element={<FlagGuard flagKey="page_data_lineage"><DataLineage /></FlagGuard>} />

                  {/* Configuration — Phase 2 */}
                  <Route path="/admin/dimensions" element={<FlagGuard flagKey="page_dimensions"><DimensionFramework /></FlagGuard>} />
                  <Route path="/admin/fx"         element={<FlagGuard flagKey="page_fx_translation"><FXTranslation /></FlagGuard>} />
                  <Route path="/admin/onboarding" element={<FlagGuard flagKey="page_onboarding_wizard"><OnboardingWizard /></FlagGuard>} />
                  <Route path="/admin/security"   element={<FlagGuard flagKey="page_security"><SecurityCompliance /></FlagGuard>} />

                  {/* ERP Integration — Phase 2 */}
                  <Route path="/erp/consolidated" element={<FlagGuard flagKey="page_consolidated"><ConsolidatedDashboard /></FlagGuard>} />
                  <Route path="/erp/cross-pl"     element={<FlagGuard flagKey="page_cross_erp_pl"><CrossERPPL /></FlagGuard>} />
                  <Route path="/erp/sources"      element={<FlagGuard flagKey="page_erp_sources"><ERPSources /></FlagGuard>} />
                  <Route path="/erp/mapping"      element={<FlagGuard flagKey="page_field_mapping"><FieldMapping /></FlagGuard>} />

                  {/* Default redirect */}
                  <Route path="*" element={<Navigate to="/collections" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </FeatureFlagProvider>
        </TenantProvider>
      </AuthProvider>
    </MsalProvider>
  );
}
