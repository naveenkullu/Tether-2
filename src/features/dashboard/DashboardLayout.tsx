import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';

const titleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profile': 'Profile',
  '/guardians': 'Guardians',
  '/emergency': 'Emergency',
  '/safe-places': 'Nearby Safe Places',
  '/history': 'History',
  '/settings': 'Settings',
};

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = titleMap[location.pathname] ?? 'Tether';

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex-1 min-w-0">
        <TopNavbar onOpenMobileMenu={() => setMobileOpen(true)} title={title} />
        <main className="px-5 sm:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
