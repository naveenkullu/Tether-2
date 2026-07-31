import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { FiBell, FiLogOut, FiMenu, FiShield } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { initials } from '../../utils/format';

interface TopNavbarProps {
  onOpenMobileMenu: () => void;
  title: string;
}

export default function TopNavbar({ onOpenMobileMenu, title }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-3 z-30 mx-4 sm:mx-6 my-2 px-5 sm:px-7 py-3 glass rounded-2xl border border-white/15 flex items-center justify-between gap-4 shadow-xl backdrop-blur-xl transition-all">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-sky-100 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <FiMenu size={20} />
        </button>
        <h1 className="text-lg sm:text-xl font-semibold text-sky-50 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/emergency"
          className="hidden sm:inline-flex items-center gap-2 rounded-full bg-coral-500/20 text-coral-300 border border-coral-500/30 px-4 py-1.5 text-sm font-semibold hover:bg-coral-500/30 transition-all shadow-sm"
        >
          <FiShield size={15} /> Emergency
        </Link>

        <button
          aria-label="Notifications"
          className="p-2 rounded-full hover:bg-white/10 text-sky-100 relative transition-colors"
        >
          <FiBell size={18} />
          <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-teal-400 ring-2 ring-dusk-900" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 rounded-full bg-teal-500/25 text-teal-300 border border-teal-400/40 flex items-center justify-center text-xs font-bold shadow-sm hover:bg-teal-500/35 transition-all"
          >
            {user ? initials(user.name) : 'TU'}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 glass rounded-2xl p-2 text-sm shadow-2xl border border-white/15"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <div className="px-3 py-2">
                  <p className="text-sky-50 font-semibold truncate">{user?.name}</p>
                  <p className="text-sky-200/80 text-xs truncate">{user?.email}</p>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <Link
                  to="/profile"
                  className="block px-3 py-2 rounded-xl text-sky-100 font-medium hover:bg-white/10 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  View profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-coral-400 font-medium hover:bg-white/10 text-left transition-colors"
                >
                  <FiLogOut size={14} /> Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
