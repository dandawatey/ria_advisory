import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Pages
import Login                from './pages/14_F014_Login';
import ExecutiveDashboard   from './pages/15_F015_ExecutiveDashboard';
import CloseCockpit         from './pages/16_F016_CloseCockpit';
import EntityDetail         from './pages/17_F017_EntityDetail';
import Explorer             from './pages/18_F018_Explorer';
import AnnotationsNLQ       from './pages/20_F020_AnnotationsNLQ';
import BCTenantAuth         from './pages/01_F001_BCTenantAuth';
import DataExtraction       from './pages/02_F002_DataExtraction';
import PipelineOrchestration from './pages/03_F003_PipelineOrchestration';
import IngestionResilience  from './pages/04_F004_IngestionResilience';
import BronzeZone           from './pages/05_F005_BronzeZone';
import SilverLayer          from './pages/06_F006_SilverLayer';
import CanonicalCoA         from './pages/07_F007_CanonicalCoA';
import DimensionFramework   from './pages/08_F008_DimensionFramework';
import GoldLayer            from './pages/09_F009_GoldLayer';
import ICElimination        from './pages/10_F010_ICElimination';
import FXTranslation        from './pages/11_F011_FXTranslation';
import DataQuality          from './pages/12_F012_DataQuality';
import DataLineage          from './pages/13_F013_DataLineage';
import APIStatus            from './pages/19_F019_APIStatus';
import MappingConsole       from './pages/21_F021_MappingConsole';
import OnboardingWizard     from './pages/22_F022_OnboardingWizard';
import PipelineHealth       from './pages/23_F023_PipelineHealth';
import SecurityCompliance   from './pages/24_F024_SecurityCompliance';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated shell */}
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Finance views */}
          <Route path="/dashboard"          element={<ExecutiveDashboard />} />
          <Route path="/close"              element={<CloseCockpit />} />
          <Route path="/entities/:id"       element={<EntityDetail />} />
          <Route path="/explorer"           element={<Explorer />} />
          <Route path="/annotations"        element={<AnnotationsNLQ />} />

          {/* Administration */}
          <Route path="/admin/mappings"        element={<MappingConsole />} />
          <Route path="/admin/onboarding"      element={<OnboardingWizard />} />
          <Route path="/admin/pipeline-health" element={<PipelineHealth />} />
          <Route path="/admin/bc-tenants"      element={<BCTenantAuth />} />

          {/* Data platform */}
          <Route path="/admin/data-extraction"  element={<DataExtraction />} />
          <Route path="/admin/pipeline"          element={<PipelineOrchestration />} />
          <Route path="/admin/resilience"        element={<IngestionResilience />} />
          <Route path="/admin/bronze"            element={<BronzeZone />} />
          <Route path="/admin/silver"            element={<SilverLayer />} />
          <Route path="/admin/coa"               element={<CanonicalCoA />} />
          <Route path="/admin/dimensions"        element={<DimensionFramework />} />
          <Route path="/admin/gold"              element={<GoldLayer />} />
          <Route path="/admin/ic-elimination"    element={<ICElimination />} />
          <Route path="/admin/fx"                element={<FXTranslation />} />
          <Route path="/admin/dq"                element={<DataQuality />} />
          <Route path="/admin/lineage"           element={<DataLineage />} />

          {/* Security */}
          <Route path="/admin/api"      element={<APIStatus />} />
          <Route path="/admin/security" element={<SecurityCompliance />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
