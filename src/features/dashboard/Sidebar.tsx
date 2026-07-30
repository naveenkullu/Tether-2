import { motion } from 'framer-motion';
import {
  FiClock,
  FiGrid,
  FiMapPin,
  FiSettings,
  FiShield,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { NavLink } from 'react-router-dom';
import TetherMark from '../../components/common/TetherMark';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/emergency', label: 'Emergency', icon: FiShield },
  { to: '/safe-places', label: 'Safe Places', icon: FiMapPin },
  { to: '/guardians', label: 'Guardians', icon: FiUsers },
  { to: '/history', label: 'History', icon: FiClock },
  { to: '/profile', label: 'Profile', icon: FiUser },
  { to: '/settings', label: 'Settings', icon: FiSettings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 px-5 py-6 border-r border-white/[0.06]">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-dusk-950/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute left-0 top-0 h-full w-72 glass px-5 py-6 flex flex-col"
          >
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="self-end p-2 -mr-2 -mt-1 text-sky-200"
            >
              <FiX size={18} />
            </button>
            <SidebarContent onNavigate={onCloseMobile} />
          </motion.aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <TetherMark size={32} animated={false} />
        <span className="font-display text-lg text-sky-50">Tether</span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 font-medium'
                  : 'text-sky-300/80 hover:text-sky-50 hover:bg-white/[0.06]'
              }`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="glass-light rounded-2xl p-4">
          <p className="text-xs text-sky-200/90 leading-relaxed">
            Your live protection is active. Guardians will be notified automatically if risk rises.
          </p>
        </div>
      </div>
    </>
  );
}
