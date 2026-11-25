import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import './os.css';

/**
 * Ordered by the day's rhythm: plan and do (Today, Calendar), keep up (Habits),
 * reflect (Journal), then the longer horizons and supporting tools.
 * Journal, Money and Food still render in the legacy frame until each is moved in.
 */
const PRIMARY_NAV = [
  { to: '/today', label: 'Today' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/habits', label: 'Habits' },
  { to: '/journal', label: 'Journal' },
  { to: '/goals', label: 'Goals' },
  { to: '/applications', label: 'Applications' },
  { to: '/money', label: 'Money' },
  { to: '/food', label: 'Food' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/more-tools', label: 'More' },
];

const EASE_OUT = [0.16, 1, 0.3, 1];

function formatTopbarDate(date) {
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function OsShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const routeMotion = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
        exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: EASE_OUT } },
      };

  return (
    <div className="os-root">
      <div className="os-shell">
        <header className="os-topbar">
          <NavLink to="/today" className="os-brand" end>
            ArohaFlow
          </NavLink>

          <LayoutGroup id="os-nav">
            <nav
              id="os-primary-nav"
              className={navOpen ? 'os-nav is-open' : 'os-nav'}
              aria-label="Primary"
            >
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/today'}>
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          layoutId="os-nav-card"
                          className="os-nav-card"
                          transition={
                            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }
                          }
                        />
                      ) : null}
                      <span className="os-nav-label">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>

          <div className="os-topbar-end">
            <span className="os-topbar-date">{formatTopbarDate(new Date())}</span>
            <button
              type="button"
              className="os-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="os-primary-nav"
              onClick={() => setNavOpen((v) => !v)}
            >
              Menu
            </button>
            <button type="button" className="os-btn os-btn-secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="os-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} className="os-route" {...routeMotion}>
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
