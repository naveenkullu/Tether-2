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
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 px-5 py-6 glass border-y-0 border-l-0 border-r border-white/15 backdrop-blur-2xl shadow-2xl z-20">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-dusk-950/85 backdrop-blur-md" onClick={onCloseMobile} />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute left-0 top-0 h-full w-72 bg-dusk-900/95 backdrop-blur-2xl border-r border-white/15 px-5 py-6 flex flex-col shadow-2xl"
          >
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="self-end p-2 -mr-2 -mt-1 text-sky-100 hover:text-white"
            >
              <FiX size={20} />
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
        <TetherMark size={34} animated={false} />
        <span className="font-display text-xl font-bold tracking-tight text-white">Tether</span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal-500/25 text-teal-300 font-semibold border border-teal-400/30 shadow-md shadow-teal-500/10'
                  : 'text-sky-100/90 hover:text-white hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-teal-400' : 'text-sky-300'} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="bg-dusk-800/80 border border-teal-500/20 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-sky-100 leading-relaxed font-medium">
            Your live protection is active. Guardians will be notified automatically if risk rises.
          </p>
        </div>
      </div>
    </>
  );
}
