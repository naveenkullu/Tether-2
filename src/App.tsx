import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SkyBackground from './components/common/SkyBackground';
import { AuthProvider } from './contexts/AuthContext';
import { GuardianProvider } from './contexts/GuardianContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SettingsProvider } from './contexts/SettingsContext';
import LoginPage from './features/auth/LoginPage';
import DashboardLayout from './features/dashboard/DashboardLayout';
import DashboardPage from './features/dashboard/DashboardPage';
import EmergencyPage from './features/emergency/EmergencyPage';
import GuardiansPage from './features/guardians/GuardiansPage';
import HistoryPage from './features/history/HistoryPage';
import LandingPage from './features/landing/LandingPage';
import ProfilePage from './features/profile/ProfilePage';
import SafePlacesPage from './features/safePlaces/SafePlacesPage';
import SettingsPage from './features/settings/SettingsPage';
import LoadingScreen from './features/shared/LoadingScreen';
import NotFoundPage from './features/shared/NotFoundPage';
import ProtectedRoute from './routes/ProtectedRoute';

function AppShell() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <SkyBackground />
      <AnimatePresence mode="wait">{booting && <LoadingScreen key="loading" />}</AnimatePresence>
      {!booting && (
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/guardians" element={<GuardiansPage />} />
              <Route path="/emergency" element={<EmergencyPage />} />
              <Route path="/safe-places" element={<SafePlacesPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <GuardianProvider>
            <NotificationProvider>
              <AppShell />
            </NotificationProvider>
          </GuardianProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
