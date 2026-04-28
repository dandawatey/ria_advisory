import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

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

          {/* Insights */}
          <Route path="/insights/gl"           element={<GLInsights />} />
          <Route path="/insights/coa"          element={<CoAInsights />} />
          <Route path="/insights/customer"     element={<CustomerInsights />} />
          <Route path="/insights/posted-sales" element={<PostedSalesInsights />} />
          <Route path="/insights/invoices"     element={<InvoiceInsights />} />

          {/* Settings */}
          <Route path="/settings"              element={<Settings />} />

          {/* Administration */}
          <Route path="/admin/mappings"        element={<MappingConsole />} />
          <Route path="/admin/pipeline-health" element={<PipelineHealth />} />
          <Route path="/admin/bc-tenants"      element={<BCTenantAuth />} />

          {/* GL Data */}
          <Route path="/admin/coa"            element={<CanonicalCoA />} />
          <Route path="/admin/dq"             element={<DataQuality />} />
          <Route path="/admin/ic-elimination" element={<ICElimination />} />

          {/* System */}
          <Route path="/admin/api"  element={<APIStatus />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
