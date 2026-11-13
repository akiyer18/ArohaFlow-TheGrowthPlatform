import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './today.css';

const PRIMARY_NAV = [
  { to: '/today', label: 'Today' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/goals', label: 'Goals' },
  { to: '/applications', label: 'Applications' },
  { to: '/money-tracker', label: 'Money' },
  { to: '/meal-planning', label: 'Food' },
  { to: '/habit-tracker', label: 'Habits' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/more-tools', label: 'More tools' },
];

export default function OsShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="os-root">
      <div className="os-shell">
        <header className="os-topbar">
          <NavLink to="/today" className="os-brand" end>
            ArohaFlow
          </NavLink>
          <button
            type="button"
            className="os-nav-toggle"
            aria-expanded={navOpen}
            aria-controls="os-primary-nav"
            onClick={() => setNavOpen((v) => !v)}
          >
            Menu
          </button>
          <nav
            id="os-primary-nav"
            className={navOpen ? 'os-nav is-open' : 'os-nav'}
            aria-label="Primary"
          >
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/today'} onClick={() => setNavOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="os-btn os-btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </header>
        <main className="os-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
