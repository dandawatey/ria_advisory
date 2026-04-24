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
          <Route path="/close"          element={<CloseCockpit />} />
          <Route path="/entities/:id"   element={<EntityDetail />} />
          <Route path="/explorer"       element={<Explorer />} />
          <Route path="/annotations"    element={<AnnotationsNLQ />} />

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
