import { AppShell } from '@/components/layout/AppShell';
import { AnomalyDetection } from '@/pages/AnomalyDetection';
import { CrewProfiles } from '@/pages/CrewProfiles';
import { HealthIntelligence } from '@/pages/HealthIntelligence';
import { LiveMonitoring } from '@/pages/LiveMonitoring';
import { MissionReports } from '@/pages/MissionReports';
import { Overview } from '@/pages/Overview';
import { SensorIntelligence } from '@/pages/SensorIntelligence';
import { SettingsPage } from '@/pages/SettingsPage';
import { SignalAnalysis } from '@/pages/SignalAnalysis';
import { SettingsProvider } from '@/state/SettingsProvider';
import { TelemetryProvider } from '@/state/TelemetryProvider';
import { VitalisBackendProvider } from '@/state/VitalisBackendProvider';
import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <SettingsProvider>
      <TelemetryProvider>
        <VitalisBackendProvider>
          <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="live-monitoring" element={<LiveMonitoring />} />
            <Route path="signal-analysis" element={<SignalAnalysis />} />
            <Route path="anomaly-detection" element={<AnomalyDetection />} />
            <Route path="sensor-intelligence" element={<SensorIntelligence />} />
            <Route path="health-intelligence" element={<HealthIntelligence />} />
            <Route path="crew" element={<CrewProfiles />} />
            <Route path="mission-reports" element={<MissionReports />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </VitalisBackendProvider>
      </TelemetryProvider>
    </SettingsProvider>
  );
}
